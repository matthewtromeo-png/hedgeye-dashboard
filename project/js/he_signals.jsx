// he_signals.jsx — Signals, Volatility, Research tabs

// ── SIGNALS TAB ────────────────────────────────────────────────────
const SignalsTab = ({macroCtx}) => {
  const [selectedTicker, setSelectedTicker] = React.useState(null);

  // Live SSS data from macroCtx
  const liveTickers = macroCtx?.pdf?.sss?.tickers ?? null;
  console.log('[SignalsTab] SSS tickers from pipeline:', liveTickers?.length ?? 'null (using fallback)');
  const sssCount    = macroCtx?.pdf?.sss?.count ?? null;
  const sssAdded    = new Set(macroCtx?.pdf?.sss?.added ?? []);
  const sssRemoved  = new Set(macroCtx?.pdf?.sss?.removed ?? []);
  const sssHistory  = macroCtx?.sss_history ?? [];

  // Hardcoded Apr 20 metadata fallback
  const HE_SSS_MAP = Object.fromEntries(window.HE.SSS.map(s => [s.ticker, s]));

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

  const displayTickers = liveTickers ?? window.HE.SSS.map(s => s.ticker);

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

  const selEntry = selectedTicker ? HE_SSS_MAP[selectedTicker] : null;
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
            Showing Apr 20 snapshot — run update_full.ps1 for live data
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
                  <TH>Conv</TH><TH>Ticker</TH><TH>Signal Date</TH>
                  <TH right>Entry $</TH><TH>Sector</TH><TH>Analyst</TH><TH right>HAM Wt</TH>
                </tr>
              </thead>
              <tbody>
                {displayTickers.map((ticker, i) => {
                  const s     = HE_SSS_MAP[ticker];
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
                      <TD><Stars score={score} /></TD>
                      <TD>
                        <span style={{fontWeight:700}}>{ticker}</span>
                        {isNew && (
                          <span style={{marginLeft:5, fontSize:8, fontWeight:700, color:'#27500A',
                            background:'#EAF3DE', padding:'1px 4px', borderRadius:2}}>NEW</span>
                        )}
                      </TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{s?.signalDate ?? '—'}</TD>
                      <TD right>{s?.priorClose ? `$${s.priorClose.toFixed(2)}` : '—'}</TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{s?.sector ?? '—'}</TD>
                      <TD style={{color:'#7A7770', fontSize:10}}>{s?.analyst ?? '—'}</TD>
                      <TD right style={{fontWeight:ham?600:400, color:ham?'#27500A':'#ccc'}}>
                        {ham ? `${(ham.total_weight*100).toFixed(2)}%` : '—'}
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              {selEntry ? (
                <div style={{display:'flex', flexDirection:'column', gap:5}}>
                  {[
                    ['Analyst',      selEntry.analyst],
                    ['Sector',       selEntry.sector],
                    ['Days on Signal', `${selEntry.days}d`],
                    ['Signal Date',  selEntry.signalDate],
                    ['Entry Price',  selEntry.priorClose != null ? `$${selEntry.priorClose.toFixed(2)}` : null],
                    ['Apr 20 Close', selEntry.lastClose   != null ? `$${selEntry.lastClose.toFixed(2)}`  : null],
                    ['Since Signal', selEntry.pct         != null ? `${selEntry.pct >= 0 ? '+' : ''}${selEntry.pct.toFixed(1)}%` : null],
                  ].map(([label, val]) => (
                    <div key={label} style={{display:'flex', justifyContent:'space-between', gap:8}}>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                        color:'#9A9790', flexShrink:0}}>{label}</span>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                        fontWeight:600, color:'#1A1A18', textAlign:'right'}}>{val ?? '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{fontSize:11, color:'#7A7770', lineHeight:1.6}}>
                  Metadata not available — ticker added after Apr 20 snapshot.
                </div>
              )}
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
const VolTab = ({quad}) => {
  const [vix, setVix] = React.useState('');
  const [rv1, setRv1] = React.useState('');
  const [rv3, setRv3] = React.useState('');
  const [ivRank, setIvRank] = React.useState('');
  const q = window.HE.QUADS[quad] || window.HE.QUADS.Q3;

  const V = parseFloat(vix), R1 = parseFloat(rv1), R3 = parseFloat(rv3);
  const ratio = !isNaN(V) && !isNaN(R1) && R1 > 0 ? V/R1 : null;
  const roc = !isNaN(R1) && !isNaN(R3) ? R1 - R3 : null;

  const inputStyle = {width:'100%',border:'none',borderBottom:'2px solid #E4E1DA',
    fontFamily:'IBM Plex Mono,monospace',fontSize:24,fontWeight:700,color:'#1A1A18',
    background:'none',outline:'none',paddingBottom:4};

  return (
    <div style={{padding:'20px 24px', maxWidth:1200}}>
      {/* Input cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
        {[['VIX Spot',vix,setVix,'e.g. 22'],['Realized Vol 1M',rv1,setRv1,'%'],
          ['Realized Vol 3M',rv3,setRv3,'%'],['IV Rank (0–100)',ivRank,setIvRank,'pct']].map(([l,v,s,ph])=>(
          <div key={l} style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 16px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',
              textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>{l}</div>
            <input type="number" value={v} onChange={e=>s(e.target.value)} placeholder={ph}
              style={inputStyle} />
          </div>
        ))}
      </div>

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

      {/* Framework notes */}
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
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,color:'#1A1A18',marginBottom:6}}>RoC Signals</div>
            <div>RVol rising → regime expanding, position smaller</div>
            <div>RVol falling → compression → breakout risk rises</div>
            <div>IV &gt; RVol → sell premium / be long delta</div>
            <div>IV &lt; RVol → buy protection / hedge downside</div>
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
