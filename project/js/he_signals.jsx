// he_signals.jsx — Signals, Volatility, Research tabs

// ── SIGNALS TAB ────────────────────────────────────────────────────
const SignalsTab = ({macroCtx}) => {
  const [selectedTicker, setSelectedTicker] = React.useState(null);

  // Live SSS data from macroCtx
  const VALID_TICKER = /^[A-Z]{1,5}[0-9]?$/;
  const rawLiveTickers = macroCtx?.pdf?.sss?.tickers ?? null;
  const liveTickers = rawLiveTickers ? rawLiveTickers.filter(t => VALID_TICKER.test(t)) : null;
  if (rawLiveTickers && liveTickers.length < rawLiveTickers.length) {
    console.log('[SignalsTab] Filtered', rawLiveTickers.length - liveTickers.length, 'artifact ticker(s):',
      rawLiveTickers.filter(t => !VALID_TICKER.test(t)));
  }
  console.log('[SignalsTab] SSS tickers from pipeline:', liveTickers?.length ?? 'null (using fallback)');
  const sssCount    = macroCtx?.pdf?.sss?.count ?? null;
  const sssAdded    = new Set(macroCtx?.pdf?.sss?.added ?? []);
  const sssRemoved  = new Set(macroCtx?.pdf?.sss?.removed ?? []);
  const sssHistory  = macroCtx?.sss_history ?? [];

  // Per-ticker metadata from pipeline only (tickers_detail)
  const sssDetail   = macroCtx?.pdf?.sss?.tickers_detail ?? {};

  const calcDays = (signalDate) => {
    if (!signalDate) return null;
    const diff = Date.now() - new Date(signalDate).getTime();
    return diff > 0 ? Math.floor(diff / 86400000) : null;
  };

  const getMeta = (ticker) => {
    const det = sssDetail[ticker];
    if (!det) return null;
    return {
      analyst:    det.analyst     ?? null,
      sector:     det.sector      ?? null,
      days:       det.days_on_list ?? calcDays(det.signal_date),
      signalDate: det.signal_date  ?? null,
      entryPrice: det.entry_price  ?? null,
    };
  };

  // HAM from macroCtx
  const hamHoldings = macroCtx?.ham_holdings ?? [];
  const hamMap      = Object.fromEntries(hamHoldings.map(h => [h.ticker, h]));

  // Investing ideas + RTA
  const iiLongs    = macroCtx?.pdf?.investing_ideas?.longs  ?? {};
  const iiShorts   = macroCtx?.pdf?.investing_ideas?.shorts ?? {};
  const rtaTickers = new Set(macroCtx?.rta?.recently_traded_tickers ?? []);

  // Conviction score 0–4: SSS + HAM + investing_ideas + RTA
  const convictionScore = (ticker) => {
    let s = 1;
    if (hamMap[ticker])                            s++;
    if (iiLongs[ticker] || iiShorts[ticker])       s++;
    if (rtaTickers.has(ticker))                    s++;
    return s;
  };

  const rawDisplayTickers = liveTickers ?? [];

  // The live SSS list is authoritative — any ticker in it always shows.
  // Anything not in it is a PDF extraction artifact and gets hidden.
  const liveSssSet = new Set(liveTickers ?? []);
  let hiddenCount = 0;
  const filteredTickers = liveTickers
    ? rawDisplayTickers.filter(ticker => {
        if (liveSssSet.has(ticker)) return true;
        hiddenCount++;
        return false;
      })
    : rawDisplayTickers;

  // Sort by days on list descending (longest first); tickers without date go to end
  const displayTickers = [...filteredTickers].sort((a, b) => {
    const aDays = getMeta(a)?.days;
    const bDays = getMeta(b)?.days;
    if (aDays == null && bDays == null) return 0;
    if (aDays == null) return 1;
    if (bDays == null) return -1;
    return bDays - aDays;
  });

  // Sparkline for sss_history count trend
  const SparkLine = () => {
    if (sssHistory.length < 2) return null;
    const counts = sssHistory.map(h => h.count);
    const min = Math.min(...counts) - 2;
    const max = Math.max(...counts) + 2;
    const W = 100, H = 28;
    const xAt = i => (i / (counts.length - 1)) * W;
    const yAt = v => H - ((v - min) / (max - min || 1)) * H;
    const pts = counts.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
    const last = counts[counts.length - 1], prev = counts[counts.length - 2];
    const col = last >= prev ? '#27500A' : '#C8302A';
    return (
      <svg width={W} height={H} style={{display:'block', overflow:'visible'}}>
        <polyline points={pts} fill="none" stroke={col} strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={xAt(counts.length-1).toFixed(1)} cy={yAt(last).toFixed(1)} r={2.5} fill={col} />
      </svg>
    );
  };

  const Stars = ({score}) => (
    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, letterSpacing:1,
      color:'#B8860B'}}>
      {'★'.repeat(score)}{'☆'.repeat(4 - score)}
    </span>
  );

  if (macroCtx === null) {
    return <div style={{padding:'20px 24px'}}><LoadingSpinner msg="Loading pipeline data…" /></div>;
  }

  const selMeta  = selectedTicker ? getMeta(selectedTicker)     : null;
  const selHam   = selectedTicker ? hamMap[selectedTicker]      : null;
  const selScore = selectedTicker ? convictionScore(selectedTicker) : 0;

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>

      {/* ── Header: count + sparkline + added/removed badges ── */}
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap'}}>
        <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8,
          padding:'12px 20px', display:'flex', alignItems:'center', gap:20}}>
          <div>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2}}>SSS Count</div>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:28, fontWeight:700,
              color:'#1A1A18', lineHeight:1}}>
              {sssCount ?? displayTickers.length}
            </div>
          </div>
          {sssHistory.length >= 2 && (
            <div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>10-run trend</div>
              <SparkLine />
            </div>
          )}
        </div>

        {sssAdded.size > 0 && (
          <div style={{background:'#EAF3DE', border:'1px solid #7AB648', borderRadius:6,
            padding:'8px 14px', fontFamily:'IBM Plex Mono,monospace', fontSize:10}}>
            <span style={{color:'#27500A', fontWeight:700}}>+{sssAdded.size} Added: </span>
            <span style={{color:'#27500A'}}>{[...sssAdded].join(', ')}</span>
          </div>
        )}
        {sssRemoved.size > 0 && (
          <div style={{background:'#FCEBEB', border:'1px solid #E07070', borderRadius:6,
            padding:'8px 14px', fontFamily:'IBM Plex Mono,monospace', fontSize:10}}>
            <span style={{color:'#C8302A', fontWeight:700}}>−{sssRemoved.size} Removed: </span>
            <span style={{color:'#C8302A'}}>{[...sssRemoved].join(', ')}</span>
          </div>
        )}
        {!liveTickers && (
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#9A9790',
            background:'#F5F3EF', border:'1px solid #E4E1DA', borderRadius:6, padding:'8px 14px'}}>
            No pipeline data — run update_full.ps1 to populate
          </div>
        )}
      </div>

      {/* ── Main layout: table + detail panel ── */}
      <div style={{display:'grid',
        gridTemplateColumns: selectedTicker ? '1fr 300px' : '1fr', gap:12, alignItems:'start'}}>

        {/* Table */}
        <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:20}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
            letterSpacing:'0.1em', textTransform:'uppercase', color:'#7A7770', marginBottom:12}}>
            Signal Strength Stocks — {displayTickers.length} tickers
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse',
              fontFamily:'IBM Plex Mono,monospace', fontSize:11}}>
              <thead>
                <tr>
                  <TH right>Days</TH><TH>Conv</TH><TH>Ticker</TH><TH>Signal Date</TH>
                  <TH right>Entry $</TH><TH>Sector</TH><TH>Analyst</TH><TH right>HAM Wt</TH>
                </tr>
              </thead>
              <tbody>
                {displayTickers.map((ticker, i) => {
                  const meta  = getMeta(ticker);
                  const ham   = hamMap[ticker];
                  const score = convictionScore(ticker);
                  const isNew = sssAdded.has(ticker);
                  const isSel = selectedTicker === ticker;
                  return (
                    <tr key={i}
                      onClick={() => setSelectedTicker(isSel ? null : ticker)}
                      style={{borderBottom:'1px solid #F5F3EF', cursor:'pointer',
                        background: isSel ? '#EEF2FB'
                          : isNew ? 'rgba(39,80,10,0.05)'
                          : ham    ? 'rgba(39,80,10,0.02)'
                          : i%2===0 ? '#fff' : '#FAFAF8'}}>
                      <TD right style={{color:'#7A7770', fontWeight:600}}>
                        {meta?.days != null ? `${meta.days}d` : '—'}
                      </TD>
                      <TD><Stars score={score} /></TD>
                      <TD>
                        <span style={{fontWeight:700}}>{ticker}</span>
                        {isNew && (
                          <span style={{marginLeft:5, fontSize:8, fontWeight:700, color:'#27500A',
                            background:'#EAF3DE', padding:'1px 4px', borderRadius:2}}>NEW</span>
                        )}
                      </TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{meta?.signalDate ?? '—'}</TD>
                      <TD right>{meta?.entryPrice != null ? `$${meta.entryPrice.toFixed(2)}` : '—'}</TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{meta?.sector ?? '—'}</TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{meta?.analyst ?? '—'}</TD>
                      <TD right style={{fontWeight:ham?600:400, color:ham?'#27500A':'#ccc'}}>
                        {ham ? `${(ham.total_weight*100).toFixed(2)}%` : '—'}
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hiddenCount > 0 && (
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
              marginTop:8, textAlign:'right'}}>
              + {hiddenCount} unrecognized ticker{hiddenCount > 1 ? 's' : ''} hidden
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedTicker && (
          <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:20,
            position:'sticky', top:12}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:20, fontWeight:700, color:'#1A1A18'}}>
                {selectedTicker}
              </div>
              <button onClick={() => setSelectedTicker(null)}
                style={{background:'none', border:'none', cursor:'pointer',
                  color:'#9A9790', fontFamily:'IBM Plex Mono,monospace', fontSize:18, lineHeight:1}}>
                ×
              </button>
            </div>

            {/* Section 1 — SSS Status */}
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.1em', color:'#7A7770', marginBottom:8}}>
                1 · SSS Status
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:5}}>
                {[
                  ['Analyst',        selMeta?.analyst],
                  ['Sector',         selMeta?.sector],
                  ['Days on Signal', selMeta?.days != null ? `${selMeta.days}d` : null],
                  ['Signal Date',    selMeta?.signalDate],
                  ['Entry Price',    selMeta?.entryPrice != null ? `$${selMeta.entryPrice.toFixed(2)}` : null],
                ].map(([label, val]) => (
                  <div key={label} style={{display:'flex', justifyContent:'space-between', gap:8}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                      color:'#9A9790', flexShrink:0}}>{label}</span>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                      fontWeight:600, color:'#1A1A18', textAlign:'right'}}>{val ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2 — HAM Holdings */}
            <div style={{marginBottom:14, paddingTop:12, borderTop:'1px solid #F5F3EF'}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.1em', color:'#7A7770', marginBottom:8}}>
                2 · HAM Holdings
              </div>
              {selHam ? (
                <div style={{display:'flex', flexDirection:'column', gap:5}}>
                  <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790'}}>
                      Total Weight
                    </span>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                      fontWeight:700, color:'#27500A'}}>
                      {(selHam.total_weight * 100).toFixed(2)}%
                    </span>
                  </div>
                  {Object.entries(selHam.accounts).map(([fund, w]) => (
                    <div key={fund} style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                        color:'#9A9790'}}>{fund}</span>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                        fontWeight:600, color:'#1A1A18'}}>{(w * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#9A9790'}}>
                  Not held in HAM portfolios
                </div>
              )}
            </div>

            {/* Section 4 — Conviction Score */}
            <div style={{paddingTop:12, borderTop:'1px solid #F5F3EF'}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.1em', color:'#7A7770', marginBottom:8}}>
                4 · Conviction Score
              </div>
              <div style={{marginBottom:10, display:'flex', alignItems:'center', gap:8}}>
                <Stars score={selScore} />
                <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790'}}>
                  {selScore}/4
                </span>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:4}}>
                {[
                  [true,                                           'On SSS list'],
                  [!!selHam,                                       'In HAM portfolios'],
                  [!!(iiLongs[selectedTicker]||iiShorts[selectedTicker]), 'In Investing Ideas'],
                  [rtaTickers.has(selectedTicker),                 'Traded last 60d (RTA)'],
                ].map(([met, label], i) => (
                  <div key={i} style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                    color: met ? '#27500A' : '#C8C5BE', fontWeight: met ? 600 : 400}}>
                    {met ? '✓' : '○'} {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Link to ETF Pro tab */}
      <div style={{background:'#F9F8F5', border:'1px solid #E4E1DA', borderRadius:8, padding:16,
        marginTop:12}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#7A7770'}}>
          ETF Pro re-ranks have moved to the dedicated <strong style={{color:'#1A1A18'}}>ETF Pro</strong> tab — streak tracker, heatmap, and full history.
        </div>
      </div>
    </div>
  );
};

// ── VOLATILITY TAB ─────────────────────────────────────────────────
const VolTab = ({quad, macroCtx}) => {
  const [liveVix,  setLiveVix]  = React.useState(null);
  const [rv1, setRv1] = React.useState('');
  const [rv3, setRv3] = React.useState('');
  const [ivRank, setIvRank] = React.useState('');
  const [vixOverride, setVixOverride] = React.useState('');
  const [lastFetch, setLastFetch] = React.useState(null);
  const q = window.HE.QUADS[quad] || window.HE.QUADS.Q3;

  // Auto-fetch live VIX on mount
  React.useEffect(() => {
    const fetchVix = async () => {
      try {
        const url = window.HE.apiUrl.yfQuote(['^VIX']);
        const r = await fetch(url, {signal: AbortSignal.timeout(10000)});
        const d = await r.json();
        const price = d.quoteResponse?.result?.[0]?.regularMarketPrice;
        if (price != null) { setLiveVix(price); setLastFetch(new Date()); }
      } catch(e) { console.warn('[VolTab] VIX fetch failed:', e.message); }
    };
    fetchVix();
    const id = setInterval(fetchVix, 60000);
    return () => clearInterval(id);
  }, []);

  // Populate realized vol from MSR if available
  React.useEffect(() => {
    const rv10d = macroCtx?.pdf?.msr?.realized_vol_10d;
    if (rv10d && !rv1) setRv1(String(rv10d));
  }, [macroCtx]);

  // VIX: live wins over manual override over fallback from model
  const vixFallback = macroCtx?.levels?.VIX?.prev_close ?? macroCtx?.pdf?.early_look?.vix_level ?? null;
  const V = parseFloat(vixOverride) || liveVix || vixFallback || NaN;
  const R1 = parseFloat(rv1), R3 = parseFloat(rv3);
  const ratio = !isNaN(V) && !isNaN(R1) && R1 > 0 ? V/R1 : null;
  const roc = !isNaN(R1) && !isNaN(R3) ? R1 - R3 : null;

  // Keith's VIX risk range from levels
  const vixLrr = macroCtx?.levels?.VIX?.lrr ?? null;
  const vixTrr = macroCtx?.levels?.VIX?.trr ?? null;
  const vixSignal = macroCtx?.levels?.VIX?.signal ?? null;

  const vixBucket = isNaN(V) ? null
    : V < 19 ? {label:'CALM',    sub:'INVESTABLE — full size, buy dips', color:'#27500A', bg:'#EAF3DE'}
    : V < 30 ? {label:'CHOP',    sub:'Reduce sizing — no fresh adds',    color:'#B8860B', bg:'#FFF8E1'}
    :           {label:'FEAR',    sub:'Defensive — reduce gross exposure', color:'#C8302A', bg:'#FCEBEB'};

  const inputStyle = {width:'100%',border:'none',borderBottom:'2px solid #E4E1DA',
    fontFamily:'IBM Plex Mono,monospace',fontSize:24,fontWeight:700,color:'#1A1A18',
    background:'none',outline:'none',paddingBottom:4};

  // Gauge bar showing VIX within risk range
  const VixGauge = () => {
    if (!vixLrr || !vixTrr || isNaN(V)) return null;
    const min = vixLrr * 0.85, max = vixTrr * 1.15;
    const lrrPct = ((vixLrr - min) / (max - min) * 100).toFixed(1);
    const trrPct = ((vixTrr - min) / (max - min) * 100).toFixed(1);
    const spotPct = Math.max(0, Math.min(100, ((V - min) / (max - min) * 100)));
    return (
      <div style={{marginTop:12}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',
          marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>
          Keith's Range: {vixLrr}–{vixTrr} · Signal: {vixSignal}
        </div>
        <div style={{position:'relative',height:8,background:'#F5F3EF',borderRadius:4,overflow:'visible'}}>
          {/* LRR marker */}
          <div style={{position:'absolute',left:lrrPct+'%',top:-2,width:2,height:12,background:'#27500A',borderRadius:1}} />
          {/* TRR marker */}
          <div style={{position:'absolute',left:trrPct+'%',top:-2,width:2,height:12,background:'#C8302A',borderRadius:1}} />
          {/* Range fill */}
          <div style={{position:'absolute',left:lrrPct+'%',width:(trrPct-lrrPct)+'%',
            height:'100%',background:'rgba(26,77,143,0.12)',borderRadius:2}} />
          {/* Spot */}
          <div style={{position:'absolute',left:spotPct+'%',top:-4,
            width:10,height:16,background:'#1A1A18',borderRadius:2,
            transform:'translateX(-50%)',transition:'left 0.5s'}} />
        </div>
        <div style={{display:'flex',justifyContent:'space-between',
          fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',marginTop:3}}>
          <span>BUY {vixLrr}</span><span>SELL {vixTrr}</span>
        </div>
      </div>
    );
  };

  // MSR context from today's data
  const msr = macroCtx?.pdf?.msr ?? {};
  const hasMsr = Object.keys(msr).length > 2;

  return (
    <div style={{padding:'20px 24px', maxWidth:1200}}>
      {/* Live VIX hero + input cards */}
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr',gap:10,marginBottom:20}}>
        {/* VIX card — live auto-populated */}
        <div style={{background: vixBucket?.bg || '#fff',
          border:`1px solid ${vixBucket ? vixBucket.color : '#E4E1DA'}`,borderRadius:8,padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',
              textTransform:'uppercase',letterSpacing:'0.08em'}}>VIX Spot</div>
            {liveVix && (
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,fontWeight:600,
                background: vixBucket?.color+'22', color: vixBucket?.color,
                padding:'1px 5px',borderRadius:2,letterSpacing:'0.04em'}}>● LIVE</span>
            )}
          </div>
          {isNaN(V)
            ? <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:18,color:'#ccc'}}>Loading…</div>
            : <>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:36,fontWeight:700,
                  color: vixBucket?.color || '#1A1A18',lineHeight:1}}>{V.toFixed(2)}</div>
                {vixBucket && (
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:600,
                    color:vixBucket.color,marginTop:4}}>{vixBucket.label}</div>
                )}
                {vixBucket && (
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:vixBucket.color,
                    opacity:0.8,marginTop:2}}>{vixBucket.sub}</div>
                )}
                <VixGauge />
              </>
          }
          {/* Manual override */}
          <div style={{marginTop:10,borderTop:'1px solid rgba(0,0,0,0.06)',paddingTop:8}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',marginBottom:3}}>
              Override (if live unavailable)
            </div>
            <input type="number" value={vixOverride}
              onChange={e=>setVixOverride(e.target.value)} placeholder="—"
              style={{...inputStyle,fontSize:14,borderBottom:'1px solid #E4E1DA'}} />
          </div>
        </div>

        {/* RVol 1M */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 16px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',
            textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Realized Vol 1M</div>
          <input type="number" value={rv1} onChange={e=>setRv1(e.target.value)} placeholder="—"
            style={inputStyle} />
          {msr.realized_vol_10d && !rv1 && (
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#1A4D8F',marginTop:6}}>
              MSR 10d: {msr.realized_vol_10d}% · GVT: {msr.gvt_index}
            </div>
          )}
        </div>

        {/* RVol 3M */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 16px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',
            textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Realized Vol 3M</div>
          <input type="number" value={rv3} onChange={e=>setRv3(e.target.value)} placeholder="—"
            style={inputStyle} />
        </div>

        {/* IV Rank */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 16px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',
            textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>IV Rank (0–100)</div>
          <input type="number" value={ivRank} onChange={e=>setIvRank(e.target.value)} placeholder="—"
            style={inputStyle} />
        </div>
      </div>

      {/* MSR Market Structure panel */}
      {hasMsr && (
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,
          padding:'14px 18px',marginBottom:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',marginBottom:12}}>
            Market Structure (MSR — {macroCtx?.source_date || 'today'})
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
            {[
              ['Gamma', msr.gamma_exposure,   msr.gamma_exposure==='POSITIVE'?'#27500A':'#C8302A'],
              ['Systematic', msr.systematic_flow, msr.systematic_flow==='BULLISH'?'#27500A':msr.systematic_flow==='NEUTRAL'?'#7A7770':'#C8302A'],
              ['Strategic', msr.strategic_allocation, msr.strategic_allocation==='RISK_ON'?'#27500A':'#C8302A'],
              ['10d RVol', msr.realized_vol_10d ? msr.realized_vol_10d+'%' : '—', '#1A4D8F'],
            ].map(([lbl,val,col]) => (
              <div key={lbl}>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginBottom:3,
                  textTransform:'uppercase',letterSpacing:'0.06em'}}>{lbl}</div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:14,fontWeight:700,color:col||'#1A1A18'}}>{val||'—'}</div>
              </div>
            ))}
          </div>
          {msr.spx_support && (
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',
              background:'#F9F8F5',padding:'8px 12px',borderRadius:4}}>
              SPX support {msr.spx_support.toLocaleString()} · resistance {msr.spx_resistance?.toLocaleString()} ·
              PV band {msr.pv_band_pct}% range
            </div>
          )}
          {msr.note && (
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#555',marginTop:8,lineHeight:1.6}}>
              {msr.note}
            </div>
          )}
        </div>
      )}

      {/* Live interpretation */}
      {ratio !== null && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          <div style={{padding:16,borderRadius:8,border:`1px solid ${ratio>1?'#3B6D11':'#C8302A'}`,
            background:ratio>1?'#EAF3DE':'#FCEBEB'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,textTransform:'uppercase',
              letterSpacing:'0.1em',color:ratio>1?'#27500A':'#C8302A',marginBottom:6,fontWeight:600}}>
              Vol Risk Premium (IV/RVol)
            </div>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:28,fontWeight:700,color:'#1A1A18'}}>{ratio.toFixed(2)}×</div>
            <div style={{fontSize:12,color:'#555',marginTop:4,lineHeight:1.5}}>
              {ratio>1.2?'Elevated VRP — options pricing in more than realized. Consider selling premium.':
               ratio>1.0?'Mild VRP — IV slightly above RVol. Neutral stance.':
               'IV < RVol — cheap options. Consider hedging or buying vol.'}
            </div>
          </div>

          <div style={{padding:16,borderRadius:8,border:'1px solid #E4E1DA',background:'#fff'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,textTransform:'uppercase',
              letterSpacing:'0.1em',color:'#7A7770',marginBottom:6,fontWeight:600}}>VIX Regime</div>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:28,fontWeight:700,
              color:V>30?'#C8302A':V>20?'#B8860B':'#27500A'}}>
              {V>30?'FEAR':V>25?'HIGH':V>20?'ELEVATED':V>15?'NORMAL':'LOW'}
            </div>
            <div style={{fontSize:12,color:'#555',marginTop:4}}>
              VIX {V.toFixed(1)} · 1M RVol {R1.toFixed(1)}%
              {ivRank && ` · IV Rank ${ivRank}`}
            </div>
          </div>

          {roc !== null && (
            <div style={{padding:16,borderRadius:8,border:'1px solid #E4E1DA',background:'#fff'}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,textTransform:'uppercase',
                letterSpacing:'0.1em',color:'#7A7770',marginBottom:6,fontWeight:600}}>Vol RoC (1M – 3M)</div>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:28,fontWeight:700,
                color:roc>2?'#C8302A':roc<-2?'#27500A':'#B8860B'}}>
                {roc>0?'+':''}{roc.toFixed(1)}%
              </div>
              <div style={{fontSize:12,color:'#555',marginTop:4}}>
                {roc>3?'Accelerating ↑ — regime expanding':
                 roc>0?'Rising — watch for breakout':
                 roc<-3?'Compressing ↓ — vol contraction regime':
                 'Declining — trending lower'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quad vol playbook */}
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20,marginBottom:20}}>
        <SectionTitle mono>Vol Expectations by Quad</SectionTitle>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {Object.en