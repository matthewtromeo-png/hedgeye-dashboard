// he_prices.jsx — Live Market Prices + Inflation

// ── Price fetcher ──────────────────────────────────────────────────
const PROXY = 'https://corsproxy.io/?';
const YF    = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=';

async function fetchYF(symbols) {
  const url = PROXY + encodeURIComponent(YF + symbols.join(',') +
    '&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,shortName');
  const r = await fetch(url, {signal: AbortSignal.timeout(10000)});
  const d = await r.json();
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
const MarketTab = ({quad}) => {
  const [prices, setPrices]     = React.useState({});
  const [sssP,   setSssP]       = React.useState({});
  const [infl,   setInfl]       = React.useState(null);
  const [status, setStatus]     = React.useState('idle');
  const [inflStatus, setInflStatus] = React.useState('idle');
  const [lastUpdated, setLastUpdated] = React.useState(null);

  const MARKET_SYMS = ['^VIX','^GSPC','QQQ','IWM','GLD','TLT','UUP','BTC-USD','^TNX','USO','GDX'];
  const SSS_SYMS    = window.HE.SSS.map(s => s.ticker).slice(0, 40);

  const refresh = React.useCallback(async () => {
    setStatus('loading');
    try {
      const [mkt, sss] = await Promise.all([
        fetchYF(MARKET_SYMS),
        fetchYF(SSS_SYMS),
      ]);
      setPrices(mkt);
      setSssP(sss);
      setStatus('ok');
      setLastUpdated(new Date());
    } catch(e) {
      console.warn('Price fetch error', e);
      setStatus('error');
    }
  }, []);

  // Inflation from BLS
  const fetchInflation = React.useCallback(async () => {
    setInflStatus('loading');
    try {
      const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          seriesid: ['CUUR0000SA0','CUUR0000SA0L1E'],
          startyear:'2024', endyear:'2026',
        })
      });
      const d = await res.json();
      if (d.status === 'REQUEST_SUCCEEDED') {
        const series = {};
        d.Results.series.forEach(s => {
          series[s.seriesID] = s.data.slice(0, 14).reverse();
        });
        setInfl(series);
        setInflStatus('ok');
      } else { setInflStatus('error'); }
    } catch { setInflStatus('error'); }
  }, []);

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
  const cpiYoY  = calcYoY(cpiSeries);
  const cpiMoM  = calcMoM(cpiSeries);
  const coreYoY = calcYoY(coreSeries);
  const latestCpiMonth = cpiSeries.length ? `${cpiSeries[cpiSeries.length-1]?.periodName} ${cpiSeries[cpiSeries.length-1]?.year}` : '';

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
            Price fetch failed — check connection
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
              {window.HE.SSS.map((s, i) => {
                const p = sssP[s.ticker];
                const curPrice = p?.price;
                const sinceSignal = curPrice ? ((curPrice - s.priorClose) / s.priorClose * 100) : null;
                return (
                  <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                    background: sinceSignal > 20 ? 'rgba(39,80,10,0.04)' : i%2===0?'#fff':'#FAFAF8'}}>
                    <TD><span style={{fontWeight:700}}>{s.ticker}</span></TD>
                    <TD style={{color:'#7A7770', fontSize:10}}>{s.sector}</TD>
                    <TD style={{color:'#9A9790', fontSize:10}}>{s.days}d</TD>
                    <TD right>${s.priorClose.toFixed(2)}</TD>
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
          <SectionTitle mono>Inflation Dashboard — BLS Data{latestCpiMonth ? ` · Latest: ${latestCpiMonth}` : ''}</SectionTitle>
          {inflStatus==='error' && (
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8302A'}}>BLS API unavailable</span>
          )}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16}}>
          {[
            ['CPI YoY', cpiYoY, '%', cpiYoY > 3 ? '#C8302A' : cpiYoY > 2 ? '#B8860B' : '#27500A'],
            ['CPI MoM', cpiMoM, '%', cpiMoM > 0.4 ? '#C8302A' : cpiMoM > 0.2 ? '#B8860B' : '#27500A'],
            ['Core CPI YoY', coreYoY, '%', coreYoY > 3 ? '#C8302A' : coreYoY > 2 ? '#B8860B' : '#27500A'],
            ['Hedgeye Quad Context', null, '', '#7A7770'],
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
                  `Q3 = Rising inflation, slowing growth. Hedge with gold, short bonds, long defensive equities.`}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CPI trend mini table */}
        {cpiSeries.length > 0 && (
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse', fontFamily:'IBM Plex Mono,monospace', fontSize:11}}>
              <thead>
                <tr>
                  <TH>Period</TH><TH right>CPI</TH><TH right>Core CPI</TH><TH right>CPI MoM</TH>
                </tr>
              </thead>
              <tbody>
                {cpiSeries.slice(-8).reverse().map((row, i) => {
                  const coreRow = coreSeries.find(r => r.year===row.year && r.period===row.period);
                  const prev = cpiSeries[cpiSeries.indexOf(row) - 1];
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
    </div>
  );
};

Object.assign(window, {MarketTab});
