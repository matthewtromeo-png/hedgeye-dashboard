// he_prices.jsx — Live Market Prices + Inflation

// ── Price fetcher — Cloudflare Worker (schwab-prices.hedgeye-dashboard.workers.dev) ──
async function fetchYF(symbols) {
  const url = window.HE.apiUrl.yfQuote(symbols);
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status}: ${body.slice(0, 120)}`);
  }
  const d = await r.json();
  if (d.error) throw new Error(d.error.description || d.error.message || JSON.stringify(d.error));
  const out = {};
  (d.quoteResponse?.result || []).forEach(q => {
    out[q.symbol] = {
      price: q.regularMarketPrice,
      chg:   q.regularMarketChange,
      chgPct:q.regularMarketChangePercent,
      prev:  q.regularMarketPreviousClose,
      high:  q.regularMarketDayHigh,
      low:   q.regularMarketDayLow,
      name:  q.shortName || q.symbol,
    };
  });
  return out;
}

// ── Market Pulse card ──────────────────────────────────────────────
const PriceCard = ({symbol, label, data, size='normal', accent}) => {
  if (!data) return (
    <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:'12px 14px',
      ...(accent?{borderLeft:`3px solid ${accent}`}:{})}}>
      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
        textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4}}>{label||symbol}</div>
      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#ccc'}}>Loading…</div>
    </div>
  );
  const up = data.chgPct >= 0;
  const big = size === 'big';
  return (
    <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8,
      padding: big ? '16px 18px' : '12px 14px',
      ...(accent ? {borderLeft:`3px solid ${accent}`} : {})}}>
      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
        textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2}}>{label||symbol}</div>
      <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8}}>
        <span style={{fontFamily:'IBM Plex Mono,monospace', fontWeight:700,
          fontSize: big ? 26 : 18, color:'#1A1A18', lineHeight:1}}>
          {symbol==='^TNX' ? data.price?.toFixed(3)+'%' : symbol==='BTC-USD' ?
            '$'+Math.round(data.price||0).toLocaleString() : '$'+data.price?.toFixed(2)}
        </span>
        <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize: big?13:11, fontWeight:600,
          color: up ? '#27500A' : '#C8302A'}}>
          {up?'+':''}{data.chgPct?.toFixed(2)}%
        </span>
      </div>
      {big && (
        <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790', marginTop:4}}>
          H: ${data.high?.toFixed(2)} · L: ${data.low?.toFixed(2)}
        </div>
      )}
    </div>
  );
};

// ── Market Tab ─────────────────────────────────────────────────────
const MarketTab = ({quad, macroCtx}) => {
  const [prices, setPrices]   = React.useState({});
  const [sssP,   setSssP]     = React.useState({});
  const [researchCpi, setResearchCpi] = React.useState(null); // populated by he_ingest
  const [infl,       setInfl]       = React.useState(null);
  const [inflSource, setInflSource] = React.useState('');
  const [status,     setStatus]     = React.useState('idle');
  const [inflStatus, setInflStatus] = React.useState('idle');
  const [lastUpdated, setLastUpdated] = React.useState(null);

  const MARKET_SYMS  = ['^VIX','^GSPC','QQQ','IWM','GLD','TLT','UUP','BTC-USD','^TNX','USO','GDX'];
  const SSS_SYMS     = macroCtx?.pdf?.sss?.tickers ?? [];
  const sssDetail    = macroCtx?.pdf?.sss?.tickers_detail ?? {};
  console.log('[MarketTab] SSS_SYMS count:', SSS_SYMS.length, macroCtx?.pdf?.sss?.tickers ? '(live)' : '(pipeline not loaded)');

  // Use a ref so the refresh callback always reads the latest SSS_SYMS without
  // being recreated every render (avoids stale-closure bug with [] deps).
  const sssSymsRef = React.useRef(SSS_SYMS);
  sssSymsRef.current = SSS_SYMS;

  const refresh = React.useCallback(async () => {
    setStatus('loading');
    try {
      const [mkt, sss] = await Promise.all([
        fetchYF(MARKET_SYMS),
        fetchYF(sssSymsRef.current),
      ]);
      if (Object.keys(mkt).length === 0) throw new Error('No price data returned');
      setPrices(mkt);
      setSssP(sss);
      setStatus('ok');
      setLastUpdated(new Date());
    } catch(e) {
      console.warn('[prices]', e.message);
      setStatus('error');
    }
  }, []);

  // Re-fetch SSS prices whenever the live ticker list arrives from the pipeline
  const prevSssTickersRef = React.useRef(null);
  React.useEffect(() => {
    const live = macroCtx?.pdf?.sss?.tickers;
    if (live && live !== prevSssTickersRef.current) {
      prevSssTickersRef.current = live;
      console.log('[MarketTab] Live SSS tickers loaded, re-fetching prices for', live.length, 'tickers');
      fetchYF(live).then(setSssP).catch(e => console.warn('[prices] SSS re-fetch failed:', e.message));
    }
  }, [macroCtx?.pdf?.sss?.tickers]);

  // Re-run inflation fetch whenever new PDFs are ingested
  React.useEffect(() => {
    const handler = () => fetchInflation();
    window.addEventListener('he_research_updated', handler);
    return () => window.removeEventListener('he_research_updated', handler);
  }, []);

  // Inflation — Research Intel first, then BLS, then hardcoded FRED
  const fetchInflation = React.useCallback(async () => {
    setInflStatus('loading');

    // ── macro_context.json (Cowork-maintained) — highest priority ─────
    // cpi_nowcast lives at macroCtx.pdf.macro_research.cpi_nowcast
    // This beats stale localStorage from previously ingested PDFs.
    try {
      const nowcast = macroCtx?.pdf?.macro_research?.cpi_nowcast ?? null;
      if (nowcast != null) {
        setResearchCpi({
          headline: null,
          core:     null,
          mom:      null,
          nowcast:  { value: nowcast },
          source:   'macro_context.json (Cowork)',
          ingestedAt: new Date().toISOString(),
        });
        setInflSource('Research');
        setInflStatus('ok');
        // Don't return — fall through so BLS still fills headline/core from hardcoded data
        // Actually clear any stale localStorage CPI so calcYoY runs from he_data.js
      }
    } catch (e) {}

    // ── Research Intel (from ingested PDFs — stale, lower priority) ──
    // Skipped: stale PDF extractions override the correct hardcoded values.
    // To re-enable, remove this comment block and restore the localStorage read.

    // ── BLS ──────────────────────────────────────────────────────────
    try {
      const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ seriesid: ['CUUR0000SA0','CUUR0000SA0L1E'], startyear:'2024', endyear:'2026' }),
        signal: AbortSignal.timeout(8000),
      });
      const d = await res.json();
      if (d.status === 'REQUEST_SUCCEEDED') {
        const series = {};
        d.Results.series.forEach(s => { series[s.seriesID] = s.data.slice(0, 14).reverse(); });
        setInfl(series);
        setInflSource('BLS');
        setInflStatus('ok');
        return;
      }
      throw new Error(Array.isArray(d.message) ? d.message[0] : (d.status || 'BLS error'));
    } catch (blsErr) {
      console.warn('[inflation] BLS failed:', blsErr.message, '— using hardcoded fallback');
    }

    // ── Hardcoded fallback (BLS data inlined in he_data.js) ─────────
    if (window.HE.CPI_DATA) {
      setInfl(window.HE.CPI_DATA);
      setInflSource('Hardcoded');
      setInflStatus('ok');
      return;
    }

    setInflStatus('error');
  }, [macroCtx]);

  React.useEffect(() => { refresh(); fetchInflation(); }, []);

  const vix = prices['^VIX'];
  const vixLevel = vix ? (vix.price > 30 ? 'FEAR' : vix.price > 25 ? 'HIGH' : vix.price > 20 ? 'ELEVATED' : vix.price > 15 ? 'NORMAL' : 'LOW') : null;
  const vixColor = vix ? (vix.price > 30 ? '#C8302A' : vix.price > 20 ? '#B8860B' : '#27500A') : '#ccc';

  // Inflation YoY
  const cpiSeries  = infl?.['CUUR0000SA0']  || [];
  const coreSeries = infl?.['CUUR0000SA0L1E'] || [];
  const calcYoY = (series) => {
    if (series.length < 13) return null;
    const latest = parseFloat(series[series.length-1]?.value);
    const yearAgo = parseFloat(series[series.length-13]?.value);
    return yearAgo ? ((latest - yearAgo) / yearAgo * 100) : null;
  };
  const calcMoM = (series) => {
    if (series.length < 2) return null;
    const latest = parseFloat(series[series.length-1]?.value);
    const prev   = parseFloat(series[series.length-2]?.value);
    return prev ? ((latest - prev) / prev * 100) : null;
  };
  const cpiYoY     = researchCpi?.headline?.value ?? calcYoY(cpiSeries);
  const cpiMoM     = researchCpi?.mom?.value      ?? calcMoM(cpiSeries);
  const coreYoY    = researchCpi?.core?.value     ?? calcYoY(coreSeries);
  const cpiNowcast = researchCpi?.nowcast?.value  ?? null;
  const latestCpiMonth = researchCpi
    ? new Date(researchCpi.ingestedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : (cpiSeries.length ? `${cpiSeries[cpiSeries.length-1]?.periodName} ${cpiSeries[cpiSeries.length-1]?.year}` : '');

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      {/* Refresh bar */}
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
        <button onClick={refresh} disabled={status==='loading'}
          style={{padding:'6px 16px', border:'1px solid #E4E1DA', borderRadius:4, cursor:'pointer',
            fontFamily:'IBM Plex Mono,monospace', fontSize:11,
            background: status==='loading'?'#F5F3EF':'#fff', color:'#7A7770'}}>
          {status==='loading' ? 'Fetching…' : '↻ Refresh Prices'}
        </button>
        {lastUpdated && (
          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#9A9790'}}>
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        {status==='error' && (
          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8302A'}}>
            Price fetch failed — check browser console for details
          </span>
        )}
      </div>

      {/* VIX hero */}
      <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:10, marginBottom:16}}>
        <div style={{background: vix ? (vix.price>25?'#FCEBEB':vix.price>20?'#FFF8E1':'#EAF3DE') : '#fff',
          border:`1px solid ${vixColor}`, borderRadius:8, padding:'16px 24px',
          display:'flex', flexDirection:'column', justifyContent:'center', minWidth:160}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.12em', color:vixColor, marginBottom:4}}>VIX</div>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:44, fontWeight:700,
            color:vixColor, lineHeight:1}}>{vix ? vix.price?.toFixed(2) : '—'}</div>
          {vixLevel && <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600,
            color:vixColor, marginTop:4}}>{vixLevel}</div>}
          {vix && <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#9A9790', marginTop:2}}>
            {vix.chgPct>=0?'+':''}{vix.chgPct?.toFixed(2)}% today
          </div>}
        </div>

        {/* Market grid */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8}}>
          {[
            ['^GSPC','S&P 500','#1A4D8F'],
            ['QQQ','NASDAQ 100','#1A4D8F'],
            ['IWM','Russell 2000','#1A4D8F'],
            ['GLD','Gold','#B8860B'],
            ['TLT','Long Bonds','#27500A'],
            ['UUP','USD ETF','#6B6860'],
            ['USO','Oil ETF','#7A5C00'],
            ['GDX','Gold Miners','#B8860B'],
            ['^TNX','10Y Yield','#6B6860'],
            ['BTC-USD','Bitcoin','#B8860B'],
          ].map(([sym, lbl, acc]) => (
            <PriceCard key={sym} symbol={sym} label={lbl} data={prices[sym]} accent={acc} />
          ))}
        </div>
      </div>

      {/* SSS Watchlist */}
      <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:20, marginBottom:16}}>
        <SectionTitle mono>Signal Strength Stocks — Live Prices vs Signal Price</SectionTitle>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'IBM Plex Mono,monospace', fontSize:11}}>
            <thead>
              <tr>
                <TH>Ticker</TH><TH>Sector</TH><TH>Days On</TH>
                <TH right>Signal $</TH><TH right>Current $</TH><TH right>Since Signal</TH><TH right>Today %</TH>
              </tr>
            </thead>
            <tbody>
              {SSS_SYMS.map((ticker, i) => {
                const p           = sssP[ticker];
                const det         = sssDetail[ticker];
                const signalPrice = det?.entry_price ?? macroCtx?.levels?.[ticker]?.close;
                const daysOnList  = det?.days_on_list ?? (det?.signal_date
                  ? Math.floor((Date.now() - new Date(det.signal_date)) / 86400000)
                  : null);
                const curPrice    = p?.price;
                const sinceSignal = (curPrice && signalPrice)
                  ? ((curPrice - signalPrice) / signalPrice * 100) : null;
                return (
                  <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                    background: sinceSignal > 20 ? 'rgba(39,80,10,0.04)' : i%2===0?'#fff':'#FAFAF8'}}>
                    <TD><span style={{fontWeight:700}}>{ticker}</span></TD>
                    <TD style={{color:'#7A7770', fontSize:10}}>{det?.sector ?? '—'}</TD>
                    <TD style={{color:'#9A9790', fontSize:10}}>{daysOnList != null ? `${daysOnList}d` : '—'}</TD>
                    <TD right>{signalPrice ? `$${signalPrice.toFixed(2)}` : '—'}</TD>
                    <TD right style={{fontWeight:curPrice?600:400}}>
                      {curPrice ? `$${curPrice.toFixed(2)}` : '—'}
                    </TD>
                    <TD right style={{fontWeight:600,
                      color: sinceSignal===null?'#ccc':sinceSignal>0?'#27500A':'#C8302A'}}>
                      {sinceSignal === null ? '—' : `${sinceSignal>0?'+':''}${sinceSignal.toFixed(1)}%`}
                    </TD>
                    <TD right style={{fontWeight:p?600:400,
                      color: !p?'#ccc':p.chgPct>=0?'#27500A':'#C8302A'}}>
                      {p ? `${p.chgPct>=0?'+':''}${p.chgPct?.toFixed(2)}%` : '—'}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inflation */}
      <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:20}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
          <div>
            <SectionTitle mono style={{marginBottom:2}}>Inflation Dashboard</SectionTitle>
            {researchCpi ? (
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#27500A', marginTop:2}}>
                ● Research · {researchCpi.source.replace('.pdf','').slice(-45)} · {new Date(researchCpi.ingestedAt).toLocaleString()}
              </div>
            ) : (inflSource || latestCpiMonth) && (
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790', marginTop:2}}>
                {inflSource}{latestCpiMonth ? ` · ${latestCpiMonth}` : ''}
              </div>
            )}
          </div>
          {inflStatus==='error' && (
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8302A'}}>BLS + FRED unavailable</span>
          )}
        </div>
        <div style={{display:'grid', gridTemplateColumns:`repeat(${cpiNowcast !== null ? 5 : 4},1fr)`, gap:10, marginBottom:16}}>
          {[
            ['CPI YoY',      cpiYoY,     '%', cpiYoY  > 3 ? '#C8302A' : cpiYoY  > 2 ? '#B8860B' : '#27500A'],
            ['CPI MoM',      cpiMoM,     '%', cpiMoM  > 0.4 ? '#C8302A' : cpiMoM > 0.2 ? '#B8860B' : '#27500A'],
            ['Core CPI YoY', coreYoY,    '%', coreYoY > 3 ? '#C8302A' : coreYoY > 2 ? '#B8860B' : '#27500A'],
            ...(cpiNowcast !== null ? [['CPI Nowcast ↗', cpiNowcast, '%', '#1A4D8F']] : []),
            ['Quad Context', null, '', '#7A7770'],
          ].map(([lbl, val, unit, col]) => (
            <div key={lbl} style={{background:'#F9F8F5', border:'1px solid #E4E1DA',
              borderRadius:8, padding:'14px 16px'}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#7A7770',
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>{lbl}</div>
              {val !== null && val !== undefined ? (
                <>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:26, fontWeight:700,
                    color: col, lineHeight:1}}>{val > 0 ? '+' : ''}{val.toFixed(2)}{unit}</div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#9A9790', marginTop:3}}>
                    {val > 3 ? 'Stagflationary — Quad 3 signal' : val > 2 ? 'Above target — watch RoC' : 'Near target — benign'}
                  </div>
                </>
              ) : (
                <div style={{fontSize:12, color:'#555', lineHeight:1.6, marginTop:4}}>
                  {inflStatus==='loading' ? <span style={{color:'#ccc',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>fetching…</span> :
                  inflStatus==='error' ? <span style={{color:'#ccc',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>unavailable</span> :
                  (() => {
                    const mq = macroCtx?.pdf?.macro_show?.monthly_quad;
                    const qq = macroCtx?.pdf?.macro_show?.quarterly_quad;
                    const seq = macroCtx?.pdf?.macro_show?.quad_sequence || '';
                    const desc = {
                      1: 'Growth ↑ Inflation ↓ — own tech, growth equities, high yield',
                      2: 'Growth ↑↑ Inflation ↑↑ — own metals, commodities, crypto, HY. Avoid TLT/LQD',
                      3: 'Growth ↓ Inflation ↑ — own energy, metals, short duration. Avoid tech/growth',
                      4: 'Growth ↓ Inflation ↓ — own long bonds, cash, defensives',
                    };
                    if (!mq) return 'No quad data — run morning research pipeline';
                    return `Monthly Q${mq} / Quarterly Q${qq}${seq ? ' · '+seq : ''} — ${desc[mq] || ''}`;
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CPI Trend Chart + Table */}
        <CpiTrendChart cpiSeries={cpiSeries} coreSeries={coreSeries} cpiNowcast={cpiNowcast}
          macroCtx={macroCtx} />
      </div>
    </div>
  );
};

// ── CPI Trend Chart (inline SVG) ─────────────────────────────────────
const CpiTrendChart = ({cpiSeries, coreSeries, cpiNowcast, macroCtx}) => {
  const W = 820, H = 200, PAD = {t:20, r:20, b:40, l:48};
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  // Build dataset — use hardcoded HE.CPI_DATA if BLS not loaded yet
  const rawCpi  = cpiSeries.length  > 2 ? cpiSeries  : (window.HE?.CPI_DATA?.['CUUR0000SA0']    ?? []);
  const rawCore = coreSeries.length > 2 ? coreSeries : (window.HE?.CPI_DATA?.['CUUR0000SA0L1E'] ?? []);

  if (rawCpi.length < 4) {
    return (
      <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790',padding:'12px 0'}}>
        Chart loading — CPI data not yet available
      </div>
    );
  }

  // Compute YoY for each month
  const pts = [];
  for (let i = 12; i < rawCpi.length; i++) {
    const cur  = parseFloat(rawCpi[i]?.value);
    const ago  = parseFloat(rawCpi[i-12]?.value);
    if (!cur || !ago) continue;
    const yoy = ((cur - ago) / ago * 100);
    const coreRow = rawCore.find(r => r.year===rawCpi[i].year && r.period===rawCpi[i].period);
    const coreAgo = coreRow ? rawCore[rawCore.indexOf(coreRow)-12] : null;
    const coreYoy = coreRow && coreAgo
      ? ((parseFloat(coreRow.value) - parseFloat(coreAgo?.value)) / parseFloat(coreAgo?.value) * 100)
      : null;
    pts.push({
      label: `${rawCpi[i].periodName?.slice(0,3)} ${rawCpi[i].year}`,
      yoy: Math.round(yoy * 100) / 100,
      coreYoy: coreYoy ? Math.round(coreYoy * 100) / 100 : null,
    });
  }

  // Add nowcast as projected final point
  if (cpiNowcast && pts.length > 0) {
    pts.push({ label: 'Nowcast', yoy: cpiNowcast, coreYoy: null, projected: true });
  }

  const recent = pts.slice(-14);
  const allVals = recent.flatMap(p => [p.yoy, p.coreYoy].filter(v=>v!=null));
  const minV = Math.min(...allVals, 2.5);
  const maxV = Math.max(...allVals, 5.5);
  const range = maxV - minV || 1;

  const xPos = (i) => PAD.l + (i / (recent.length - 1)) * chartW;
  const yPos = (v) => PAD.t + chartH - ((v - minV) / range) * chartH;

  const makePath = (data, key) => {
    const validPts = data.map((p,i) => ({x: xPos(i), y: yPos(p[key]), i})).filter(p=>p.y!=null && !isNaN(p.y));
    return validPts.map((p,j) => `${j===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  };

  // Y-axis grid lines at 0.5% intervals
  const gridVals = [];
  for (let v = Math.ceil(minV*2)/2; v <= maxV; v += 0.5) gridVals.push(v);

  // Quad color band — Q3 = red zone above ~3.5%
  const q3Threshold = 3.5;
  const q3Y = yPos(Math.min(q3Threshold, maxV));
  const q2Y = yPos(Math.min(2.5, maxV));

  // Determine monthly quad
  const mq = macroCtx?.pdf?.macro_show?.monthly_quad;
  const qq = macroCtx?.pdf?.macro_show?.quarterly_quad;

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
          color:'#1A1A18',letterSpacing:'0.06em'}}>CPI YoY TREND</div>
        <div style={{display:'flex',gap:14,fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#7A7770'}}>
          <span><span style={{display:'inline-block',width:18,height:2,background:'#C8302A',
            verticalAlign:'middle',marginRight:4}}/>CPI YoY</span>
          <span><span style={{display:'inline-block',width:18,height:2,background:'#1A4D8F',
            verticalAlign:'middle',marginRight:4,borderTop:'2px dashed #1A4D8F'}}/>Core CPI</span>
          {cpiNowcast && <span><span style={{display:'inline-block',width:8,height:8,
            background:'#B8860B',borderRadius:'50%',verticalAlign:'middle',marginRight:4}}/>Nowcast</span>}
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:W,display:'block'}}>
          {/* Background quad color bands */}
          <rect x={PAD.l} y={PAD.t} width={chartW} height={Math.max(0, q3Y - PAD.t)}
            fill="rgba(200,48,42,0.04)" />
          <rect x={PAD.l} y={q3Y} width={chartW}
            height={Math.max(0, yPos(2.5) - q3Y)}
            fill="rgba(184,134,11,0.04)" />
          <rect x={PAD.l} y={yPos(2.5)} width={chartW}
            height={Math.max(0, (PAD.t+chartH) - yPos(2.5))}
            fill="rgba(39,80,10,0.04)" />

          {/* Grid lines */}
          {gridVals.map(v => (
            <g key={v}>
              <line x1={PAD.l} x2={PAD.l+chartW} y1={yPos(v)} y2={yPos(v)}
                stroke="#E4E1DA" strokeWidth={0.5} />
              <text x={PAD.l-4} y={yPos(v)+4} textAnchor="end"
                fontFamily="IBM Plex Mono,monospace" fontSize={8} fill="#9A9790">
                {v.toFixed(1)}%
              </text>
            </g>
          ))}

          {/* Fed 2% target line */}
          {minV <= 2 && (
            <line x1={PAD.l} x2={PAD.l+chartW} y1={yPos(2)} y2={yPos(2)}
              stroke="#27500A" strokeWidth={0.8} strokeDasharray="4,3" opacity={0.5} />
          )}

          {/* 3.5% threshold label */}
          {maxV >= q3Threshold && (
            <text x={PAD.l+chartW+2} y={q3Y+4}
              fontFamily="IBM Plex Mono,monospace" fontSize={7} fill="#C8302A">Q3</text>
          )}

          {/* Core CPI line (dashed blue) */}
          <path d={makePath(recent, 'coreYoy')} fill="none"
            stroke="#1A4D8F" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />

          {/* CPI YoY line */}
          <path d={makePath(recent, 'yoy')} fill="none"
            stroke="#C8302A" strokeWidth={2} />

          {/* Data points */}
          {recent.map((p, i) => (
            <g key={i}>
              {/* CPI dot */}
              <circle cx={xPos(i)} cy={yPos(p.yoy)} r={p.projected?5:3}
                fill={p.projected?'#B8860B':'#C8302A'}
                stroke={p.projected?'#fff':'none'} strokeWidth={1.5} />
              {/* Core dot */}
              {p.coreYoy != null && !p.projected && (
                <circle cx={xPos(i)} cy={yPos(p.coreYoy)} r={2} fill="#1A4D8F" opacity={0.8} />
              )}
            </g>
          ))}

          {/* Nowcast label */}
          {cpiNowcast && recent[recent.length-1]?.projected && (
            <text x={xPos(recent.length-1)} y={yPos(cpiNowcast)-8} textAnchor="middle"
              fontFamily="IBM Plex Mono,monospace" fontSize={8} fontWeight={700} fill="#B8860B">
              {cpiNowcast.toFixed(2)}%↗
            </text>
          )}

          {/* X-axis labels — every other */}
          {recent.map((p, i) => i % 2 === 0 && (
            <text key={i} x={xPos(i)} y={H-8} textAnchor="middle"
              fontFamily="IBM Plex Mono,monospace" fontSize={7.5} fill="#9A9790"
              transform={`rotate(-30,${xPos(i)},${H-8})`}>
              {p.label}
            </text>
          ))}

          {/* Current value callout */}
          {recent.length > 1 && !recent[recent.length-2].projected && (() => {
            const last = recent[recent.length - (cpiNowcast?2:1)];
            const li = recent.length - (cpiNowcast?2:1);
            return (
              <text x={xPos(li)} y={yPos(last.yoy)-8} textAnchor="middle"
                fontFamily="IBM Plex Mono,monospace" fontSize={8} fontWeight={700} fill="#C8302A">
                {last.yoy.toFixed(2)}%
              </text>
            );
          })()}
        </svg>
      </div>

      {/* CPI trend table */}
      {rawCpi.length > 0 && (
        <div style={{overflowX:'auto',marginTop:12}}>
          <table style={{borderCollapse:'collapse', fontFamily:'IBM Plex Mono,monospace', fontSize:11}}>
            <thead>
              <tr>
                <TH>Period</TH><TH right>CPI</TH><TH right>Core CPI</TH><TH right>CPI MoM</TH>
              </tr>
            </thead>
            <tbody>
              {rawCpi.slice(-8).reverse().map((row, i) => {
                const coreRow = rawCore.find(r => r.year===row.year && r.period===row.period);
                const prev = rawCpi[rawCpi.indexOf(row) - 1];
                const mom = prev ? ((parseFloat(row.value) - parseFloat(prev.value)) / parseFloat(prev.value) * 100) : null;
                return (
                  <tr key={i} style={{borderBottom:'1px solid #F5F3EF', background:i===0?'#FAFAF8':'#fff'}}>
                    <TD style={{fontWeight:i===0?600:400}}>{row.periodName} {row.year}</TD>
                    <TD right>{parseFloat(row.value).toFixed(3)}</TD>
                    <TD right>{coreRow ? parseFloat(coreRow.value).toFixed(3) : '—'}</TD>
                    <TD right style={{color: mom===null?'#ccc':mom>0.3?'#C8302A':mom>0?'#B8860B':'#27500A', fontWeight:600}}>
                      {mom === null ? '—' : `${mom>0?'+':''}${mom.toFixed(3)}%`}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

Object.assign(window, {MarketTab});
