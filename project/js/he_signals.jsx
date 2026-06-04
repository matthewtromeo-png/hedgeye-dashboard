// he_signals.jsx — Signals, Volatility, Research tabs

// ── SIGNALS TAB ────────────────────────────────────────────────────
const SignalsTab = ({macroCtx}) => {
  const [selectedTicker, setSelectedTicker] = React.useState(null);

  // Live SSS data from macroCtx
  const VALID_TICKER = /^[A-Z]{1,5}[0-9]?$/;
  const rawLiveTickers = macroCtx?.pdf?.sss?.tickers ?? null;
  const liveTickers = rawLiveTickers ? rawLiveTickers.filter(t => VALID_TICKER.test(t)) : null;
  // (artifact ticker filtering happens silently — no console.log in production)
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
      entryPrice:  det.entry_price   ?? null,
      recentPrice: det.recent_price  ?? null,
      pctChg:      det.pct_since_entry ?? null,
    };
  };

  // HAM from macroCtx
  const hamHoldings = HE.getHamArray(macroCtx);
  const hamMap      = HE.getHamMap(macroCtx);

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
                  <TH right>Entry $</TH><TH right>Recent $</TH><TH right>% Chg</TH><TH>Sector</TH><TH>Analyst</TH><TH right>HAM Wt</TH>
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
                      <TD right style={{color:'#1A1A18'}}>{meta?.recentPrice != null ? `$${meta.recentPrice.toFixed(2)}` : '—'}</TD>
                      <TD right style={{
                        fontWeight: meta?.pctChg != null ? 600 : 400,
                        color: meta?.pctChg == null ? '#ccc' : meta.pctChg >= 0 ? '#27500A' : '#C8302A'
                      }}>{meta?.pctChg != null ? `${meta.pctChg >= 0 ? '+' : ''}${meta.pctChg.toFixed(1)}%` : '—'}</TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{meta?.sector ?? '—'}</TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{meta?.analyst ?? '—'}</TD>
                      <TD right style={{fontWeight:ham?600:400, color:ham?'#27500A':'#ccc'}}>
                        {HE.hamWeight(ham)}
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
                      {HE.hamWeight(selHam)}
                    </span>
                  </div>
                  {selHam.accounts && Object.entries(selHam.accounts).map(([fund, w]) => (
                    <div key={fund} style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                        color:'#9A9790'}}>{fund}</span>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                        fontWeight:600, color:'#1A1A18'}}>{typeof w === 'number' ? (w*100).toFixed(2)+'%' : w}</span>
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
  const [liveVix,  setLiveVix]  = React.useState(null);   // {vix, vix3m, vix9m}
  const [vixStatus,setVixStatus]= React.useState('loading');
  const [rv1, setRv1] = React.useState('');
  const [rv3, setRv3] = React.useState('');
  const q = window.HE.QUADS[quad] || window.HE.QUADS.Q3;
  const vixRange = macroCtx?.levels?.VIX || null;

  React.useEffect(() => {
    fetch(window.HE.apiUrl.yfQuote(['^VIX', '^VIX3M', '^VIX9M']),
          {signal: AbortSignal.timeout(10000)})
      .then(r => r.json())
      .then(d => {
        const results = d.quoteResponse?.result || [];
        const m = {};
        results.forEach(q => { m[q.symbol] = q.regularMarketPrice; });
        if (m['^VIX']) {
          setLiveVix({vix: m['^VIX'], vix3m: m['^VIX3M'] || null, vix9m: m['^VIX9M'] || null});
          setVixStatus('ok');
        } else { setVixStatus('error'); }
      })
      .catch(() => setVixStatus('error'));
  }, []);

  // ── SVG Arc Gauge ────────────────────────────────────────────────
  const VixGauge = ({value, lrr, trr}) => {
    const W = 300, H = 178;
    const cx = W / 2, cy = H - 24;
    const Ro = 118, Ri = 80;
    const minV = 10, maxV = 45;

    const vToRad = v => {
      const n = Math.max(0, Math.min(1, (v - minV) / (maxV - minV)));
      return (180 - n * 180) * Math.PI / 180;
    };

    const pt = (angle, r) => ({
      x: (cx + r * Math.cos(angle)).toFixed(2),
      y: (cy - r * Math.sin(angle)).toFixed(2),
    });

    // Filled arc segment (donut slice)
    const seg = (v1, v2, fill) => {
      const a1 = vToRad(v1), a2 = vToRad(v2);
      const o1 = pt(a1, Ro), o2 = pt(a2, Ro);
      const i1 = pt(a1, Ri), i2 = pt(a2, Ri);
      const large = Math.abs(v2 - v1) / (maxV - minV) > 0.5 ? 1 : 0;
      const d = `M ${o1.x} ${o1.y} A ${Ro} ${Ro} 0 ${large} 0 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${Ri} ${Ri} 0 ${large} 1 ${i1.x} ${i1.y} Z`;
      return <path key={v1} d={d} fill={fill} />;
    };

    // Tick mark for a value level
    const tick = (v, color, dash) => {
      const a = vToRad(Math.max(minV, Math.min(maxV, v)));
      const outer = pt(a, Ro + 7);
      const inner = pt(a, Ri - 5);
      return <line key={v} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
        stroke={color} strokeWidth={2.5} strokeDasharray={dash || 'none'} strokeLinecap="round" />;
    };

    const val = Math.max(minV, Math.min(maxV, value));
    const needleA = vToRad(val);
    const needleTip = pt(needleA, Ro - 10);
    const vixColor = value > 30 ? '#C8302A' : value > 20 ? '#B8860B' : value > 15 ? '#7A5C00' : '#27500A';
    const vixLabel = value > 30 ? 'FEAR' : value > 25 ? 'HIGH' : value > 20 ? 'ELEVATED' : value > 15 ? 'NORMAL' : 'LOW VOLATILITY';

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', maxWidth:300, display:'block', margin:'0 auto'}}
        xmlns="http://www.w3.org/2000/svg">
        {/* Zones */}
        {seg(10, 15, '#D4EDDA')}
        {seg(15, 20, '#FFF3CD')}
        {seg(20, 30, '#FFE4B5')}
        {seg(30, 45, '#FADADD')}
        {/* Zone borders */}
        {[15, 20, 30].map(v => tick(v, '#fff', 'none'))}
        {/* LRR / TRR markers */}
        {lrr && lrr >= minV && lrr <= maxV && tick(lrr, '#27500A', '4,2')}
        {trr && trr >= minV && trr <= maxV && tick(trr, '#C8302A', '4,2')}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y}
          stroke="#1A1A18" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="#1A1A18" />
        {/* Value */}
        <text x={cx} y={cy - 16} textAnchor="middle" fontFamily="IBM Plex Mono,monospace"
          fontSize={30} fontWeight={700} fill={vixColor}>{value.toFixed(1)}</text>
        <text x={cx} y={cy - 3} textAnchor="middle" fontFamily="IBM Plex Mono,monospace"
          fontSize={8} fontWeight={600} fill={vixColor} letterSpacing="0.1em">{vixLabel}</text>
        {/* Scale labels */}
        <text x={(cx - Ro - 6)} y={cy + 5} textAnchor="end"
          fontFamily="IBM Plex Mono,monospace" fontSize={8} fill="#9A9790">10</text>
        <text x={(cx + Ro + 6)} y={cy + 5} textAnchor="start"
          fontFamily="IBM Plex Mono,monospace" fontSize={8} fill="#9A9790">45</text>
        {/* LRR/TRR legend */}
        {lrr && <text x={8} y={H - 6} fontFamily="IBM Plex Mono,monospace"
          fontSize={7} fill="#27500A">LRR {lrr.toFixed(2)} ╌╌</text>}
        {trr && <text x={W - 8} y={H - 6} textAnchor="end" fontFamily="IBM Plex Mono,monospace"
          fontSize={7} fill="#C8302A">╌╌ TRR {trr.toFixed(2)}</text>}
      </svg>
    );
  };

  // ── Term Structure Chart ─────────────────────────────────────────
  const TermStructure = ({vix, vix3m, vix9m}) => {
    const terms = [
      {label:'VIX',  sub:'30d',  value: vix},
      {label:'VIX3M',sub:'93d',  value: vix3m},
      {label:'VIX9M',sub:'270d', value: vix9m},
    ].filter(t => t.value != null && t.value > 0);

    if (terms.length < 2) return (
      <div style={{height:160, display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#C8C5BE', textAlign:'center'}}>
        VIX3M / VIX9M not available<br/>from price feed
      </div>
    );

    const pad = 2;
    const minV = Math.min(...terms.map(t => t.value)) - pad;
    const maxV = Math.max(...terms.map(t => t.value)) + pad;
    const W = 260, H = 150, PL = 38, PR = 12, PT = 20, PB = 36;
    const CW = W - PL - PR, CH = H - PT - PB;

    const xp = i => PL + (i / (terms.length - 1)) * CW;
    const yp = v => PT + CH - ((v - minV) / (maxV - minV)) * CH;

    const isContango = terms[terms.length - 1].value >= terms[0].value;
    const lineColor  = isContango ? '#27500A' : '#C8302A';
    const fillColor  = isContango ? '#EAF3DE' : '#FCEBEB';

    const linePts = terms.map((t, i) => `${i === 0 ? 'M' : 'L'} ${xp(i).toFixed(1)} ${yp(t.value).toFixed(1)}`).join(' ');
    const fillPts = `${linePts} L ${xp(terms.length-1).toFixed(1)} ${(PT+CH).toFixed(1)} L ${xp(0).toFixed(1)} ${(PT+CH).toFixed(1)} Z`;

    const spread = ((terms[terms.length-1].value - terms[0].value)).toFixed(2);
    const spreadSign = parseFloat(spread) >= 0 ? '+' : '';

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', maxWidth:260, display:'block', margin:'0 auto'}}
        xmlns="http://www.w3.org/2000/svg">
        {/* Background fill */}
        <path d={fillPts} fill={fillColor} opacity={0.45} />
        {/* Connecting line */}
        <path d={linePts} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {/* Data points */}
        {terms.map((t, i) => (
          <g key={i}>
            <circle cx={xp(i).toFixed(1)} cy={yp(t.value).toFixed(1)} r={5}
              fill={lineColor} stroke="#fff" strokeWidth={1.5} />
            <text x={xp(i).toFixed(1)} y={(yp(t.value) - 11).toFixed(1)} textAnchor="middle"
              fontFamily="IBM Plex Mono,monospace" fontSize={11} fontWeight={700} fill={lineColor}>
              {t.value.toFixed(1)}
            </text>
            <text x={xp(i).toFixed(1)} y={(PT + CH + 14).toFixed(1)} textAnchor="middle"
              fontFamily="IBM Plex Mono,monospace" fontSize={9} fontWeight={700} fill="#1A1A18">
              {t.label}
            </text>
            <text x={xp(i).toFixed(1)} y={(PT + CH + 24).toFixed(1)} textAnchor="middle"
              fontFamily="IBM Plex Mono,monospace" fontSize={7} fill="#9A9790">
              {t.sub}
            </text>
          </g>
        ))}
        {/* Contango/backwardation badge */}
        <text x={PL + CW / 2} y={PT - 6} textAnchor="middle"
          fontFamily="IBM Plex Mono,monospace" fontSize={8} fontWeight={700}
          fill={lineColor} letterSpacing="0.08em">
          {isContango ? '▲ CONTANGO' : '▼ BACKWARDATION'}  {spreadSign}{spread}
        </text>
      </svg>
    );
  };

  const V   = liveVix?.vix  || null;
  const V3  = liveVix?.vix3m|| null;
  const V9  = liveVix?.vix9m|| null;
  // Normalize ivol_table from top-level key into the sections format the renderer expects
  const ivolData = (() => {
    const raw = macroCtx?.ivol_table ?? null;
    if (!raw) return null;
    const normalizeRows = arr => (arr || []).map(r => ({
      ticker:         r.ticker,
      tr:             r.ytd,
      ivol_prem:      r.ivol_prem,
      ivol_rvol_yest: r.ivol_rvol_yest,
      ivol_rvol_1w:   r.ivol_rvol_1w,
      ivol_rvol_1m:   r.ivol_rvol_1m,
      ttm_z:          r.z_ttm,
      yr3_z:          r.z_3yr,
      mm_pct:         r.rvol_mm,
      pctl:           r.rvol_10yr,
    }));
    const sections = {};
    if (raw.us_equities?.length)    sections['US Equities']   = normalizeRows(raw.us_equities);
    if (raw.intl_equities?.length)  sections['Intl Equities'] = normalizeRows(raw.intl_equities);
    if (raw.currencies?.length)     sections['Currencies']    = normalizeRows(raw.currencies);
    if (raw.commodities?.length)    sections['Commodities']   = normalizeRows(raw.commodities);
    if (raw.fixed_income?.length)   sections['Fixed Income']  = normalizeRows(raw.fixed_income);
    if (raw.mega_cap?.length)       sections['Mega-Cap']      = normalizeRows(raw.mega_cap);
    if (!Object.keys(sections).length) return null;
    return { sections, window: raw.note || 'IVOL/RVOL 30D', as_of_date: raw.date };
  })();
  // usd_correlations lives at top level; add as_of_date alias for the renderer
  const usdCorrData = macroCtx?.usd_correlations
    ? { ...macroCtx.usd_correlations, as_of_date: macroCtx.usd_correlations.date }
    : null;
  const R1  = parseFloat(rv1) || null;
  const R3p = parseFloat(rv3) || null;
  const ratio = V && R1 ? V / R1 : null;
  const roc   = R1 && R3p ? R1 - R3p : null;

  const inputStyle = {width:'100%', border:'none', borderBottom:'2px solid #E4E1DA',
    fontFamily:'IBM Plex Mono,monospace', fontSize:22, fontWeight:700, color:'#1A1A18',
    background:'none', outline:'none', paddingBottom:3};

  return (
    <div style={{padding:'20px 24px', maxWidth:1200}}>

      {/* ── Top row: Gauge + Term Structure ── */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>

        {/* VIX Gauge card */}
        <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:'16px 20px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:12,
            display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span>Live VIX</span>
            {vixStatus === 'loading' && <span style={{fontSize:8, color:'#C8C5BE'}}>fetching…</span>}
            {vixStatus === 'error'   && <span style={{fontSize:8, color:'#C8302A'}}>unavailable</span>}
          </div>
          {V ? (
            <>
              <VixGauge value={V} lrr={vixRange?.lrr} trr={vixRange?.trr} />
              {vixRange && (
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                  marginTop:10, paddingTop:10, borderTop:'1px solid #F5F3EF',
                  fontFamily:'IBM Plex Mono,monospace', fontSize:9}}>
                  <span style={{color:'#27500A'}}>Keith LRR {vixRange.lrr?.toFixed(2)}</span>
                  <span style={{fontWeight:700, padding:'2px 8px', borderRadius:3,
                    background: vixRange.signal === 'BEARISH' ? '#FCEBEB' : '#EAF3DE',
                    color:      vixRange.signal === 'BEARISH' ? '#C8302A' : '#27500A'}}>
                    {vixRange.signal}
                  </span>
                  <span style={{color:'#C8302A'}}>Keith TRR {vixRange.trr?.toFixed(2)}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{height:160, display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8C5BE'}}>
              {vixStatus === 'loading' ? 'Loading VIX…' : 'VIX data unavailable'}
            </div>
          )}
        </div>

        {/* Term Structure card */}
        <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:'16px 20px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:12}}>
            VIX Term Structure
          </div>
          <TermStructure vix={V} vix3m={V3} vix9m={V9} />
          {V && V3 && (
            <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid #F5F3EF',
              fontSize:11, color:'#555', lineHeight:1.6}}>
              {V3 > V
                ? `Contango +${(V3-V).toFixed(2)} pts — market expects more vol at 3M. Normal, complacent environment.`
                : `Backwardation ${(V3-V).toFixed(2)} pts — near-term stress elevated above 3M expectation. Watch for regime shift.`}
            </div>
          )}
        </div>
      </div>

      {/* ── Realized Vol Analysis ── */}
      <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8,
        padding:'16px 20px', marginBottom:12}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
          textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:14}}>
          IV / Realized Vol Analysis
          <span style={{fontWeight:400, color:'#C8C5BE', marginLeft:10}}>— enter SPY realized vol manually</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16}}>
          {/* VIX auto */}
          <div style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>VIX (auto-fetched)</div>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:22, fontWeight:700,
              color: V ? (V>30?'#C8302A':V>20?'#B8860B':'#27500A') : '#C8C5BE'}}>
              {V ? V.toFixed(2) : '—'}
            </div>
          </div>
          {/* RVol 1M */}
          <div style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>SPY RVol 1M (%)</div>
            <input type="number" value={rv1} onChange={e => setRv1(e.target.value)}
              placeholder="e.g. 18" style={inputStyle} />
          </div>
          {/* RVol 3M */}
          <div style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>SPY RVol 3M (%)</div>
            <input type="number" value={rv3} onChange={e => setRv3(e.target.value)}
              placeholder="e.g. 22" style={inputStyle} />
          </div>
        </div>

        {ratio !== null && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10}}>
            <div style={{padding:14, borderRadius:6,
              background:ratio>1?'#EAF3DE':'#FCEBEB',
              border:`1px solid ${ratio>1?'#7AB648':'#E07070'}`}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, textTransform:'uppercase',
                letterSpacing:'0.1em', color:ratio>1?'#27500A':'#C8302A', marginBottom:6, fontWeight:600}}>
                VRP (IV / RVol)
              </div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:26, fontWeight:700, color:'#1A1A18'}}>
                {ratio.toFixed(2)}×
              </div>
              <div style={{fontSize:11, color:'#555', marginTop:4, lineHeight:1.5}}>
                {ratio>1.2?'Elevated VRP — options expensive, consider selling premium'
                :ratio>1.0?'Mild VRP — IV slightly above RVol, neutral'
                :'IV < RVol — cheap options, consider buying protection'}
              </div>
            </div>
            <div style={{padding:14, borderRadius:6, border:'1px solid #E4E1DA', background:'#fff'}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, textTransform:'uppercase',
                letterSpacing:'0.1em', color:'#7A7770', marginBottom:6, fontWeight:600}}>VIX Regime</div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:26, fontWeight:700,
                color:V>30?'#C8302A':V>25?'#B8860B':V>20?'#7A5C00':V>15?'#1A1A18':'#27500A'}}>
                {V>30?'FEAR':V>25?'HIGH':V>20?'ELEV':V>15?'NORM':'LOW'}
              </div>
              <div style={{fontSize:11, color:'#555', marginTop:4}}>
                VIX {V?.toFixed(1)} · 1M RVol {R1?.toFixed(1)}%
              </div>
            </div>
            {roc !== null && (
              <div style={{padding:14, borderRadius:6, border:'1px solid #E4E1DA', background:'#fff'}}>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, textTransform:'uppercase',
                  letterSpacing:'0.1em', color:'#7A7770', marginBottom:6, fontWeight:600}}>Vol RoC (1M – 3M)</div>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:26, fontWeight:700,
                  color:roc>2?'#C8302A':roc<-2?'#27500A':'#B8860B'}}>
                  {roc>0?'+':''}{roc.toFixed(1)}%
                </div>
                <div style={{fontSize:11, color:'#555', marginTop:4}}>
                  {roc>3?'Accelerating ↑ — expanding vol regime'
                  :roc>0?'Rising — watch for breakout'
                  :roc<-3?'Compressing ↓ — vol contraction'
                  :'Declining — trending lower'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* ── Implied & Realized Vol Table (Macro Show slide 27) ── */}
      {ivolData && (() => {
        const sections = ivolData.sections || {};
        const SECTION_ORDER = ['US Equities','Intl Equities','Currencies','Commodities','Fixed Income','Mega-Cap'];
        const fmtZ = z => z == null ? '—' : (z > 0 ? '+' : '') + z.toFixed(1);
        const zColor = z => z == null ? '#C8C5BE' : z >= 1.5 ? '#C8302A' : z <= -1.5 ? '#27500A' : '#1A1A18';
        const fmtPrem = v => v == null ? '—' : (v > 0 ? '+' : '') + v + '%';
        const premColor = v => v == null ? '#C8C5BE' : v > 50 ? '#C8302A' : v > 20 ? '#B8860B' : v < 0 ? '#27500A' : '#555';
        const fmtPctl = v => v == null ? '—' : v + '%';
        const pctlColor = v => v == null ? '#C8C5BE' : v >= 80 ? '#27500A' : v <= 20 ? '#C8302A' : '#555';
        const TH = ({children, right}) => (
          <th style={{padding:'3px 6px',fontSize:8,color:'#9A9790',textTransform:'uppercase',
            letterSpacing:'0.05em',fontWeight:600,whiteSpace:'nowrap',
            textAlign: right ? 'right' : 'left',borderBottom:'1px solid #E4E1DA',
            background:'#F8F7F4'}}>
            {children}
          </th>
        );
        return (
          <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,
            padding:'16px 20px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                textTransform:'uppercase',letterSpacing:'0.12em',color:'#7A7770'}}>
                Implied & Realized Volatility
              </div>
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790'}}>
                {ivolData.window} &nbsp;·&nbsp; {ivolData.as_of_date}
              </span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,
                fontFamily:'IBM Plex Mono,monospace'}}>
                <thead>
                  <tr>
                    <TH>Ticker</TH>
                    <TH right>TR%</TH>
                    <TH right>IVOL Prem</TH>
                    <TH right>IV/RV Yest</TH>
                    <TH right>1W Ago</TH>
                    <TH right>1M Ago</TH>
                    <TH right>TTM Z</TH>
                    <TH right>3Y Z</TH>
                    <TH right>MM%</TH>
                    <TH right>Pctl</TH>
                  </tr>
                </thead>
                <tbody>
                  {SECTION_ORDER.filter(s => sections[s]).map(section => [
                    <tr key={section + '_hdr'}>
                      <td colSpan={10} style={{padding:'8px 6px 3px',fontFamily:'IBM Plex Mono,monospace',
                        fontSize:8,fontWeight:700,color:'#7A7770',textTransform:'uppercase',
                        letterSpacing:'0.1em',borderTop:'2px solid #E4E1DA',background:'#F8F7F4'}}>
                        {section}
                      </td>
                    </tr>,
                    ...(sections[section] || []).map((row, i) => (
                      <tr key={row.ticker} style={{
                        borderBottom:'1px solid #F5F3EF',
                        background: i % 2 === 0 ? '#fff' : '#FAFAF8'}}
                        onMouseEnter={e => e.currentTarget.style.background='#F4F3EF'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAF8'}>
                        <td style={{padding:'5px 6px',fontWeight:700,color:'#1A1A18',whiteSpace:'nowrap'}}>
                          {row.ticker}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',
                          color: row.tr > 0 ? '#27500A' : row.tr < 0 ? '#C8302A' : '#555'}}>
                          {row.tr > 0 ? '+' : ''}{row.tr?.toFixed(1) ?? '—'}%
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',color:premColor(row.ivol_prem)}}>
                          {fmtPrem(row.ivol_prem)}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',color:premColor(row.ivol_rvol_yest)}}>
                          {fmtPrem(row.ivol_rvol_yest)}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',color:premColor(row.ivol_rvol_1w)}}>
                          {fmtPrem(row.ivol_rvol_1w)}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',color:premColor(row.ivol_rvol_1m)}}>
                          {fmtPrem(row.ivol_rvol_1m)}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',fontWeight:600,
                          color:zColor(row.ttm_z)}}>
                          {fmtZ(row.ttm_z)}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',fontWeight:600,
                          color:zColor(row.yr3_z)}}>
                          {fmtZ(row.yr3_z)}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',
                          color: row.mm_pct < 0 ? '#C8302A' : '#27500A'}}>
                          {row.mm_pct != null ? (row.mm_pct > 0 ? '+' : '') + row.mm_pct + '%' : '—'}
                        </td>
                        <td style={{padding:'5px 6px',textAlign:'right',color:pctlColor(row.pctl)}}>
                          {fmtPctl(row.pctl)}
                        </td>
                      </tr>
                    ))
                  ])}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:8,fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
              display:'flex',gap:16,flexWrap:'wrap'}}>
              <span><span style={{color:'#C8302A',fontWeight:700}}>RED Z</span> = elevated vol (≥1.5σ)</span>
              <span><span style={{color:'#27500A',fontWeight:700}}>GREEN Z</span> = suppressed vol (≤-1.5σ)</span>
              <span>IVOL Prem = implied over realized · Pctl = 52-wk percentile</span>
            </div>
          </div>
        );
      })()}

      {/* ── USD Correlations (from Macro Show slide 23) ── */}
      {usdCorrData && (() => {
        const cell = (v, key) => {
          if (v == null) return <td key={key} style={{padding:'4px 6px',textAlign:'right',color:'#C8C5BE',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>—</td>;
          const isNeg = v < 0, isStrong = Math.abs(v) >= 0.5;
          return <td key={key} style={{padding:'4px 6px',textAlign:'right',fontWeight:isStrong?700:400,
            color:isNeg?'#C8302A':v>0?'#27500A':'#555',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>
            {v > 0 ? '+' : ''}{v.toFixed(2)}
          </td>;
        };
        return (
          <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,
            padding:'16px 20px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                textTransform:'uppercase',letterSpacing:'0.12em',color:'#7A7770'}}>
                Key $USD Correlations
              </div>
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790'}}>
                {usdCorrData.as_of_date} &nbsp;·&nbsp; slide 23
              </span>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:10,fontFamily:'IBM Plex Mono,monospace'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #E4E1DA'}}>
                  {['Metric','15D','30D','90D','120D','180D','%+ Time','%- Time'].map(h => (
                    <th key={h} style={{padding:'3px 6px',fontSize:8,color:'#9A9790',textTransform:'uppercase',
                      letterSpacing:'0.05em',fontWeight:600,textAlign:h==='Metric'?'left':'right'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usdCorrData.data.map((row,i) => (
                  <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                    background:row.highlighted?'rgba(200,48,42,0.04)':i%2===0?'#fff':'#FAFAF8'}}>
                    <td style={{padding:'4px 6px',fontWeight:row.highlighted?700:500,
                      color:row.highlighted?'#C8302A':'#1A1A18',whiteSpace:'nowrap'}}>
                      {row.highlighted && <span style={{marginRight:4}}>→</span>}{row.metric}
                    </td>
                    {cell(row['15d'],'15d')}{cell(row['30d'],'30d')}{cell(row['90d'],'90d')}
                    {cell(row['120d'],'120d')}{cell(row['180d'],'180d')}
                    <td style={{padding:'4px 6px',textAlign:'right',color:'#27500A',fontWeight:500}}>
                      {row.pct_pos}%
                    </td>
                    <td style={{padding:'4px 6px',textAlign:'right',color:'#C8302A',fontWeight:500}}>
                      {row.pct_neg}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Macro Show Charts: Key $USD Correlations + Implied & Realized Vol ── */}
      {(() => {
        const manifest = macroCtx?.chart_manifest;
        const charts = [
          {key:'usd_corr', label:'Key $USD Correlations',    src:'assets/generated/macro_show_usd_corr.png'},
          {key:'ivol',     label:'Implied & Realized Volatility', src:'assets/generated/macro_show_ivol.png'},
        ];
        const anyChart = charts.some(c => manifest?.charts?.[c.key]?.status === 'ok');
        if (!anyChart && !manifest) return null;
        return (
          <div style={{marginBottom:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {charts.map(({key, label, src}) => {
                const info = manifest?.charts?.[key];
                const available = info?.status === 'ok';
                return (
                  <div key={key} style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'16px 20px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                        textTransform:'uppercase',letterSpacing:'0.12em',color:'#7A7770'}}>{label}</div>
                      {available && manifest?.source_pdf && (
                        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790'}}>
                          {manifest.source_pdf.replace(/^HE_TMS_/,'').replace(/\.pdf$/,'')} · p.{info.page}
                        </span>
                      )}
                    </div>
                    {available ? (
                      <img src={src} alt={label}
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                        style={{width:'100%',borderRadius:4,display:'block'}} />
                    ) : null}
                    <div style={{display: available ? 'none' : 'flex', height:120,
                      alignItems:'center',justifyContent:'center',
                      fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#C8C5BE',
                      background:'#F9F8F5',borderRadius:4,flexDirection:'column',gap:6}}>
                      <span>Unavailable from source</span>
                      {info?.status && info.status !== 'ok' && (
                        <span style={{fontSize:8,color:'#C8C5BE'}}>{info.status}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {manifest && (
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
                marginTop:6,paddingLeft:2}}>
                Extracted {manifest.extracted_at} from {manifest.source_pdf}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Quad Vol Playbook ── */}
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20,marginBottom:12}}>
        <SectionTitle mono>Vol Expectations by Quad</SectionTitle>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {Object.entries(window.HE.QUADS).map(([k,qd])=>(
            <div key={k} style={{padding:14,borderRadius:6,
              background:quad===k?qd.bg:'#F9F8F5',
              border:`1px solid ${quad===k?qd.color:'#E4E1DA'}`,transition:'all 0.15s'}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:700,
                color:qd.color,marginBottom:6}}>{k} · {qd.name}</div>
              <div style={{fontSize:11,color:'#555',lineHeight:1.7}}>
                <div><strong style={{color:'#1A1A18'}}>Best:</strong> {qd.bestAssets}</div>
                <div><strong style={{color:'#1A1A18'}}>Worst:</strong> {qd.worstAssets}</div>
                <div style={{marginTop:6,color:'#7A7770',fontSize:10}}>{qd.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Framework Reference ── */}
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20}}>
        <SectionTitle mono>Framework Reference</SectionTitle>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,fontSize:12,lineHeight:1.8,color:'#555'}}>
          <div>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,color:'#1A1A18',marginBottom:6}}>VIX Levels</div>
            <div>&lt;15 — Low. Complacency. Quad 1/2 regime.</div>
            <div>15–20 — Normal. Transition zone.</div>
            <div>20–30 — Elevated. Quad 3 territory.</div>
            <div>&gt;30 — Fear. Quad 4 extremes / dislocation.</div>
          </div>
          <div>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,color:'#1A1A18',marginBottom:6}}>Term Structure</div>
            <div>Contango (spot &lt; 3M) → normalized, market calm</div>
            <div>Backwardation (spot &gt; 3M) → near-term stress</div>
            <div>VRP &gt; 1.2× → elevated IV, consider selling premium</div>
            <div>VRP &lt; 1.0× → cheap vol, consider buying protection</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── DAILY BRIEF TAB ────────────────────────────────────────────────
const ResearchTab = ({onOpenPdf, macroCtx}) => {
  const loading = macroCtx === null;

  const showNotes   = macroCtx?.pdf?.macro_show_notes   ?? {};
  const callSumm    = macroCtx?.pdf?.call_summary        ?? {};
  const keyPts      = showNotes.key_points       ?? [];
  const positioning = showNotes.positioning_changes ?? [];
  const watchlist   = showNotes.keith_watching   ?? [];
  const callPts     = callSumm.key_points         ?? [];
  const callDate    = callSumm.date               ?? null;
  const callQuad    = callSumm.quad               ?? null;
  const trades      = callSumm.trades_mentioned   ?? [];

  const genAt = macroCtx?.generated_at
    ? new Date(macroCtx.generated_at).toLocaleString('en-US', {
        month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
      })
    : null;

  const hasAnyContent = keyPts.length > 0 || callPts.length > 0 || positioning.length > 0 || watchlist.length > 0;

  const SectionCard = ({title, badge, items, accentColor}) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'16px 20px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <div style={{width:3,height:14,borderRadius:2,background:accentColor||'#1A4D8F',flexShrink:0}} />
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770'}}>{title}</span>
          {badge && (
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,
              background:'#F4F3EF',color:'#9A9790',padding:'1px 6px',borderRadius:2,marginLeft:'auto'}}>
              {badge}
            </span>
          )}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {items.map((pt,i) => (
            <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start'}}>
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                color:accentColor||'#7A7770',marginTop:3,flexShrink:0}}>›</span>
              <span style={{fontSize:12,color:'#1A1A18',lineHeight:1.55}}>{pt}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{padding:'20px 24px',maxWidth:900}}>
        <LoadingSpinner msg="Loading pipeline data…" />
      </div>
    );
  }

  if (!hasAnyContent) {
    return (
      <div style={{padding:'20px 24px',maxWidth:900}}>
        <div style={{background:'#F9F8F5',border:'1px dashed #D0CCC4',borderRadius:8,
          padding:'32px 24px',textAlign:'center'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:13,fontWeight:600,
            color:'#1A1A18',marginBottom:8}}>No brief available yet</div>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#7A7770',lineHeight:1.7}}>
            Run <strong style={{color:'#1A1A18'}}>build_macro_context.py</strong> with PDF extraction
            to populate the Daily Brief. Check the <strong style={{color:'#1A4D8F'}}>Research Status</strong> tab for pipeline state.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:'20px 24px',maxWidth:900}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:13,fontWeight:700,color:'#1A1A18'}}>
            Daily Brief
          </span>
          {callQuad && (
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
              padding:'2px 8px',borderRadius:3,
              background: window.HE?.QUADS?.['Q'+callQuad]?.bg || '#F4F3EF',
              color: window.HE?.QUADS?.['Q'+callQuad]?.color || '#1A1A18',
              border: `1px solid ${window.HE?.QUADS?.['Q'+callQuad]?.color || '#E4E1DA'}`}}>
              Q{callQuad}
            </span>
          )}
        </div>
        {genAt && (
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790'}}>
            Updated {genAt}
          </span>
        )}
      </div>

      {/* Call Summary */}
      {callPts.length > 0 && (
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'16px 20px',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <div style={{width:3,height:14,borderRadius:2,background:'#1A4D8F',flexShrink:0}} />
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
              textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770'}}>Morning Call</span>
            {callDate && (
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,
                background:'#E4EDF8',color:'#1A4D8F',padding:'1px 6px',borderRadius:2,marginLeft:'auto'}}>
                {callDate}
              </span>
            )}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {callPts.map((pt,i) => (
              <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                  color:'#1A4D8F',marginTop:3,flexShrink:0}}>›</span>
                <span style={{fontSize:12,color:'#1A1A18',lineHeight:1.55}}>{pt}</span>
              </div>
            ))}
          </div>
          {trades.length > 0 && (
            <div style={{marginTop:12,paddingTop:10,borderTop:'1px solid #F0EDE8'}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
                textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Trades Mentioned</div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                {trades.map((t,i) => (
                  <div key={i} style={{fontSize:11,color:'#555',lineHeight:1.4}}>{t}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <SectionCard title="Keith's Commentary" items={keyPts} accentColor="#27500A" />
      <SectionCard title="Positioning Changes" items={positioning} accentColor="#B8860B"
        badge={positioning.length > 0 ? `${positioning.length} moves` : null} />
      <SectionCard title="Keith's Watchlist" items={watchlist} accentColor="#9A3B26" />
    </div>
  );
};

Object.assign(window, {SignalsTab, VolTab, ResearchTab});
