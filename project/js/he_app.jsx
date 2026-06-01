// he_app.jsx — Overview tab + main App shell
// v2026-05-07

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "quarterlyQuad": "Q3",
  "monthlyQuad": "Q2",
  "usdSignal": "BEARISH",
  "btcSignal": "NEUTRAL",
  "myPositions": "",
  "fmpKey": ""
}/*EDITMODE-END*/;

// Merge TWEAK_DEFAULTS with any values saved in localStorage
function initTweaks() {
  const s = window.HE.loadQuadState();
  return {
    ...TWEAK_DEFAULTS,
    quarterlyQuad: s.quarterly  || TWEAK_DEFAULTS.quarterlyQuad,
    monthlyQuad:   s.monthly    || TWEAK_DEFAULTS.monthlyQuad,
    usdSignal:     s.usdSignal  || TWEAK_DEFAULTS.usdSignal,
    btcSignal:     s.btcSignal  || TWEAK_DEFAULTS.btcSignal,
    myPositions:   s.myPositions != null ? s.myPositions : TWEAK_DEFAULTS.myPositions,
    fmpKey:        s.fmpKey     || TWEAK_DEFAULTS.fmpKey,
  };
}

// ── PDF VIEWER MODAL ───────────────────────────────────────────────
const PdfViewer = ({pdf, onClose}) => {
  if (!pdf) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:2000,display:'flex',flexDirection:'column',
      background:'rgba(0,0,0,0.7)'}}>
      <div style={{background:'#111',color:'#fff',padding:'0 20px',height:48,display:'flex',
        alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:12,color:'#ccc',
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,marginRight:16}}>
          {pdf.title}
        </span>
        <button onClick={onClose} style={{background:'none',border:'1px solid #444',color:'#aaa',
          fontFamily:'IBM Plex Mono,monospace',fontSize:11,padding:'4px 14px',borderRadius:4,
          cursor:'pointer',flexShrink:0}}>✕ Close</button>
      </div>
      <iframe src={pdf.url} style={{flex:1,border:'none',background:'#222'}}
        title={pdf.title} />
    </div>
  );
};

// ── RESEARCH INTEL PANEL ──────────────────────────────────────────
const ResearchIntelPanel = () => {
  const RI_KEY = 'he_research_intel';
  const [intel, setIntel] = React.useState(null);

  const loadIntel = () => {
    try {
      const ri = JSON.parse(localStorage.getItem(RI_KEY) || '{}');
      if (!ri.pdfs) { setIntel(null); return; }
      const sorted = Object.values(ri.pdfs).sort((a, b) => new Date(b.ingestedAt) - new Date(a.ingestedAt));
      const latest = sorted[0] || null;
      setIntel(latest);
    } catch { setIntel(null); }
  };

  React.useEffect(() => {
    loadIntel();
    const handler = () => loadIntel();
    window.addEventListener('he_research_updated', handler);
    return () => window.removeEventListener('he_research_updated', handler);
  }, []);

  if (!intel) return null;

  const fmt = v => v != null ? v.toFixed(2) + '%' : '—';
  const fmtDate = iso => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    } catch { return '—'; }
  };

  const cpi   = intel.cpi   || {};
  const gdp   = intel.gdp   || {};
  const quads = intel.quads || {};
  const kps   = (intel.keyPoints || []).slice(0, 4);
  const risks = (intel.riskRanges || []).slice(0, 3);

  const kpis = [
    { label: 'CPI YoY',    val: fmt(cpi.headline?.value), color: cpi.headline?.value > 3 ? '#C8302A' : '#27500A' },
    { label: 'Core CPI',   val: fmt(cpi.core?.value),     color: cpi.core?.value > 3 ? '#C8302A' : '#27500A' },
    { label: 'CPI MoM',    val: fmt(cpi.mom?.value),      color: null },
    { label: 'GDP Growth', val: fmt(gdp.growth?.value),   color: gdp.growth?.value < 0 ? '#C8302A' : '#27500A' },
    ...(cpi.nowcast?.value != null ? [{ label: 'CPI Nowcast', val: fmt(cpi.nowcast.value), color: '#1A4D8F' }] : []),
    ...(gdp.nowcast?.value  != null ? [{ label: 'GDP Nowcast', val: fmt(gdp.nowcast.value),  color: '#1A4D8F' }] : []),
  ].filter(k => k.val !== '—');

  const hasContent = kpis.length > 0 || quads.monthly || kps.length > 0;
  if (!hasContent) return null;

  return (
    <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:'14px 18px', marginBottom:16}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770'}}>Research Intelligence</span>
          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, background:'#EAF3DE',
            color:'#27500A', padding:'1px 6px', borderRadius:2, fontWeight:600}}>LIVE</span>
        </div>
        <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790', textAlign:'right', lineHeight:1.4}}>
          <div title={intel.filename} style={{maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {intel.filename}
          </div>
          <div>{fmtDate(intel.ingestedAt)}</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:`repeat(${Math.min(kpis.length, 6)}, 1fr)`, gap:8, marginBottom: (quads.monthly || kps.length > 0 || risks.length > 0) ? 12 : 0}}>
        {kpis.map(k => (
          <div key={k.label} style={{background:'#F9F8F5', borderRadius:6, padding:'8px 10px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2}}>{k.label}</div>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:16, fontWeight:700,
              color: k.color || '#1A1A18'}}>{k.val}</div>
          </div>
        ))}
      </div>

      {(quads.monthly || quads.quarterly || kps.length > 0 || risks.length > 0) && (
        <div style={{display:'grid', gridTemplateColumns: kps.length > 0 ? '200px 1fr' : '1fr', gap:12}}>
          {(quads.monthly || quads.quarterly) && (
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {quads.quarterly && (
                <div style={{display:'flex', alignItems:'center', gap:6}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790', width:60}}>QTR QUAD</span>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:13, fontWeight:700,
                    color: window.HE?.QUADS?.[quads.quarterly]?.color || '#1A1A18'}}>{quads.quarterly}</span>
                  {quads.confidence && <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790'}}>{quads.confidence}% conf</span>}
                </div>
              )}
              {quads.monthly && (
                <div style={{display:'flex', alignItems:'center', gap:6}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790', width:60}}>MO QUAD</span>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:13, fontWeight:700,
                    color: window.HE?.QUADS?.[quads.monthly]?.color || '#1A1A18'}}>{quads.monthly}</span>
                </div>
              )}
              {risks.length > 0 && (
                <div style={{marginTop:4}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                    textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3}}>Risk Ranges</div>
                  {risks.map((r, i) => (
                    <div key={i} style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#555',
                      marginBottom:1}}>{r}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {kps.length > 0 && (
            <div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>Key Points</div>
              {kps.map((pt, i) => (
                <div key={i} style={{display:'flex', gap:6, marginBottom:4, alignItems:'flex-start'}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                    marginTop:1, flexShrink:0}}>›</span>
                  <span style={{fontSize:11, color:'#333', lineHeight:1.4}}>{pt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── OVERVIEW TAB ───────────────────────────────────────────────────
const OverviewTab = ({qQuad, mQuad, usd, btc, macroCtx, onTabChange}) => {
  const [liveVix, setLiveVix]     = React.useState(null);
  const [vixLoading, setVixLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchVix = () => {
      fetchYF(['^VIX'])
        .then(data => {
          const price = data['^VIX']?.price;
          if (price != null) setLiveVix(price);
        })
        .catch(() => {})
        .finally(() => setVixLoading(false));
    };
    fetchVix();
    const id = setInterval(fetchVix, 60000);
    return () => clearInterval(id);
  }, []);

  const qQ = window.HE.QUADS[qQuad] || window.HE.QUADS.Q3;
  const mQ = window.HE.QUADS[mQuad] || window.HE.QUADS.Q2;

  const recentTrades = macroCtx?.rta?.recent_trades ?? null;
  const winRate = recentTrades && recentTrades.length > 0
    ? recentTrades.filter(t => (t.realized_return ?? 0) > 0).length / recentTrades.length
    : null;

  const hamHighConv = macroCtx
    ? HE.getHamArray(macroCtx)
        .filter(h => (HE.hamWeightNum(h) ?? 0) >= 0.015)
        .sort((a,b) => (HE.hamWeightNum(b) ?? 0) - (HE.hamWeightNum(a) ?? 0))
        .slice(0, 10)
    : null;

  const sssTickers  = macroCtx?.pdf?.sss?.tickers ?? null;
  const sssAdded    = macroCtx?.pdf?.sss?.added   ?? [];
  const sssRemoved  = macroCtx?.pdf?.sss?.removed  ?? [];

  const quadSeq         = macroCtx?.pdf?.macro_research?.quad_sequence
                        ?? macroCtx?.pdf?.macro_show?.quad_sequence ?? null;
  const portfolioMovers = macroCtx?.pdf?.portfolio?.top_movers ?? null;
  const fallbackRerank  = window.HE.ETF_RERANKS[0];

  const showNotesPts = macroCtx?.pdf?.macro_show_notes?.key_points ?? [];
  const callSummPts  = macroCtx?.pdf?.call_summary?.key_points ?? [];
  const callSummDate = macroCtx?.pdf?.call_summary?.date ?? null;
  const hasIntel = showNotesPts.length > 0 || callSummPts.length > 0;
  const usdCorrData  = macroCtx?.usd_correlations ? { ...macroCtx.usd_correlations, as_of_date: macroCtx.usd_correlations.date } : null;

  const vixFallback = macroCtx?.pdf?.macro_show?.vix?.current
    ?? macroCtx?.pdf?.early_look?.vix_level
    ?? macroCtx?.levels?.VIX?.close ?? null;
  const isLiveVix = liveVix !== null;
  const vixLevel  = liveVix ?? vixFallback;
  const vixBucket = vixLevel === null ? null
    : vixLevel < 19 ? {label:'● INVESTABLE BUCKET', sub:'Buy dips on Signal Strength longs',   bg:'#EAF3DE', color:'#27500A', border:'#3B6D11'}
    : vixLevel < 30 ? {label:'● CHOP BUCKET',       sub:'Reduce sizing — no fresh short adds', bg:'#FFFBEB', color:'#B8860B', border:'#D4A017'}
    :                 {label:'● F*CK BUCKET',        sub:'Defensive — reduce gross exposure',   bg:'#FCEBEB', color:'#C8302A', border:'#E53E3E'};

  const sssFilename  = (macroCtx?.sources_used?.sss ?? '').replace(/@\d+$/, '');
  const sssCount     = macroCtx?.pdf?.sss?.count ?? null;
  const sssCountM    = sssFilename.match(/(\d+)\s+Stocks/);
  const sssAddedM    = sssFilename.match(/(\d+)\s+Added/);
  const sssRemovedM  = sssFilename.match(/(\d+)\s+Removed/);
  const sssFileCount = sssCountM   ? parseInt(sssCountM[1])   : null;
  const sssAddedN    = sssAddedM   ? parseInt(sssAddedM[1])   : 0;
  const sssRemovedN  = sssRemovedM ? parseInt(sssRemovedM[1]) : 0;
  const sssPrevCount = sssFileCount !== null ? sssFileCount - sssAddedN + sssRemovedN : null;

  const showCallouts    = macroCtx?.pdf?.macro_show?.callouts ?? [];
  const showPositions   = macroCtx?.pdf?.macro_show?.signal_positions ?? [];
  const msrData         = macroCtx?.pdf?.msr ?? null;
  const momoData        = macroCtx?.pdf?.momo ?? null;
  const elThemes        = macroCtx?.pdf?.early_look?.key_themes ?? [];
  const elPositioning   = macroCtx?.pdf?.early_look?.positioning ?? [];
  const macroResThemes  = macroCtx?.macro_research?.themes ?? [];
  const hasCallouts     = showCallouts.length > 0;

  const bulletSentiment = (text) => {
    if (['BULLISH',' long ',' Long ','buying','added','long the'].some(k => text.includes(k))) return '#27500A';
    if (['BEARISH',' short ',' Short ','selling','removed','short the'].some(k => text.includes(k))) return '#C8302A';
    return null;
  };

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      {/* Regime strip */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1.4fr 1fr',gap:10,marginBottom:20}}>
        {/* Quarterly quad */}
        <div style={{background:qQ.bg,border:`1px solid ${qQ.color}`,borderRadius:8,padding:'16px 18px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.12em',color:qQ.color,marginBottom:3}}>
            Quarterly Quad
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:8}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:32,fontWeight:700,
              color:qQ.color,lineHeight:1}}>{qQuad}</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'#1A1A18'}}>{qQ.name}</div>
              <div style={{fontSize:11,color:'#7A7770'}}>{qQ.desc}</div>
            </div>
          </div>
        </div>
        {/* Monthly quad */}
        <div style={{background:mQ.bg,border:`1px solid ${mQ.color}`,borderRadius:8,padding:'16px 18px',
          position:'relative'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.12em',color:mQ.color,marginBottom:3}}>
            Monthly Quad
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:8}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:32,fontWeight:700,
              color:mQ.color,lineHeight:1}}>{mQuad}</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'#1A1A18'}}>{mQ.name}</div>
              <div style={{fontSize:11,color:'#7A7770'}}>{mQ.desc}</div>
            </div>
          </div>
          {mQuad!==qQuad && <div style={{marginTop:8,fontSize:10,color:mQ.color,
            fontFamily:'IBM Plex Mono,monospace',fontWeight:600}}>
            {parseInt(mQuad[1]) < parseInt(qQuad[1]) ? '↑' : '↓'} Transitioning from {qQuad}
          </div>}
        </div>
        {/* Playbook */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'16px 18px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',marginBottom:8}}>
            {mQuad} Playbook (Monthly Dominant)
          </div>
          <div style={{fontSize:11,lineHeight:1.75}}>
            <div>
              <span style={{color:'#27500A',fontWeight:600,fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>BEST · </span>
              <span style={{color:'#555'}}>{mQ.bestSectors}</span>
            </div>
            <div>
              <span style={{color:'#C8302A',fontWeight:600,fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>AVOID · </span>
              <span style={{color:'#555'}}>{mQ.worstSectors}</span>
            </div>
          </div>
        </div>
        {/* Key signals */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'16px 18px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',marginBottom:10}}>Key Signals</div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:10}}>
            {[['USD',usd],['BTC',btc]].map(([lbl,sig])=>(
              <div key={lbl} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#7A7770'}}>{lbl}</span>
                <SignalBadge signal={sig} />
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid #F0EDE8',paddingTop:8}}>
            {quadSeq ? (
              <div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginBottom:4}}>
                  Quad Sequence
                </div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:15,fontWeight:700,
                  color:'#1A1A18',letterSpacing:'0.04em'}}>{quadSeq}</div>
              </div>
            ) : portfolioMovers ? (
              <div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginBottom:4}}>
                  Top Movers
                </div>
                {portfolioMovers.slice(0,3).map((m,i)=>(
                  <div key={i} style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:700,marginBottom:2}}>
                    {typeof m === 'string' ? m : m.ticker}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginBottom:4}}>
                  Latest Re-rank · {fallbackRerank.date}
                </div>
                {fallbackRerank.topMovers.map((m,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    fontFamily:'IBM Plex Mono,monospace',fontSize:11,marginBottom:2}}>
                    <span style={{fontWeight:700}}>{m.ticker}</span>
                    <span style={{color:'#27500A',fontWeight:600}}>{m.pts}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* VIX Bucket Banner */}
      {vixLoading && vixLevel === null ? (
        <div style={{background:'#F9F8F5',border:'1px solid #E4E1DA',borderRadius:8,
          padding:'12px 18px',marginBottom:16}}>
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#9A9790'}}>
            Loading VIX...
          </span>
        </div>
      ) : vixBucket ? (
        <div style={{background:vixBucket.bg,border:`1px solid ${vixBucket.border}`,borderRadius:8,
          padding:'12px 18px',marginBottom:16,display:'flex',alignItems:'center',
          justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:13,fontWeight:700,
              color:vixBucket.color}}>{vixBucket.label}</span>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:vixBucket.color,
              opacity:0.85}}>{vixBucket.sub}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:13,fontWeight:700,
              color:vixBucket.color}}>VIX {vixLevel.toFixed(2)}</span>
            {isLiveVix && (
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,fontWeight:600,
                background:`${vixBucket.color}22`,color:vixBucket.color,
                padding:'1px 5px',borderRadius:2,letterSpacing:'0.04em'}}>● LIVE</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Early Look / Daily Thesis */}
      {(() => {
        const el = macroCtx?.pdf?.early_look;
        if (!el?.title) return null;
        return (
          <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,
            padding:'14px 18px',marginBottom:16,display:'grid',
            gridTemplateColumns:'1fr auto',gap:16,alignItems:'start'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:3,height:14,borderRadius:2,background:'#B8860B',flexShrink:0}} />
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                  textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770'}}>Early Look</span>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790'}}>
                  {macroCtx?.pdf?.early_look?.date ?? macroCtx?.source_date}
                </span>
              </div>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:12,fontWeight:700,
                color:'#1A1A18',marginBottom:6}}>{el.title}</div>
              <div style={{fontSize:11,color:'#555',lineHeight:1.6}}>{el.keith_thesis}</div>
              {el.keith_notes?.length > 0 && (
                <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:3}}>
                  {el.keith_notes.slice(0,3).map((n,i) => (
                    <div key={i} style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                      <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                        color:'#B8860B',marginTop:2,flexShrink:0}}>›</span>
                      <span style={{fontSize:11,color:'#333',lineHeight:1.45}}>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Key levels snapshot */}
            {macroCtx?.levels && Object.keys(macroCtx.levels).length > 0 && (
              <div style={{minWidth:160,background:'#F9F8F5',borderRadius:6,
                padding:'10px 12px',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>
                <div style={{fontWeight:600,color:'#7A7770',letterSpacing:'0.06em',
                  textTransform:'uppercase',fontSize:8,marginBottom:8}}>Today's Ranges</div>
                {['SPX','VIX','HYG','Gold','USD'].map(t => {
                  const l = macroCtx.levels[t]; if (!l) return null;
                  const parts = (l.range || '').split('-');
                  const lo = parts[0] || ''; const hi = parts[1] || '';
                  const sig = (l.signal || '').toUpperCase();
                  return (
                    <div key={t} style={{display:'flex',justifyContent:'space-between',
                      gap:8,marginBottom:4,alignItems:'center'}}>
                      <span style={{fontWeight:700,color:'#1A1A18',minWidth:36}}>{t}</span>
                      <span style={{color:'#9A9790',fontSize:9}}>{lo}–{hi}</span>
                      <span style={{fontSize:8,fontWeight:700,padding:'1px 4px',borderRadius:2,
                        background:sig==='BULLISH'?'#EAF3DE':sig==='BEARISH'?'#FCEBEB':'#F5F3EF',
                        color:sig==='BULLISH'?'#27500A':sig==='BEARISH'?'#C8302A':'#9A9790'}}>
                        {sig.slice(0,4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Macro Show Callouts */}
      {hasCallouts && (
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 18px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:3,height:14,borderRadius:2,background:'#27500A',flexShrink:0}} />
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                textTransform:'uppercase',letterSpacing:'0.12em',color:'#7A7770'}}>Macro Show Callouts</span>
            </div>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790'}}>
              {macroCtx?.pdf?.macro_show?.date}
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(showCallouts.length,3)},1fr)`,gap:10,marginBottom: showPositions.length > 0 ? 12 : 0}}>
            {showCallouts.map((c,i) => {
              const detail  = c.detail ?? c.text ?? '';
              const ctitle  = c.title  ?? c.topic ?? '';
              const isBull = detail.toLowerCase().includes('bullish') || detail.toLowerCase().includes('long ');
              const isBear = detail.toLowerCase().includes('bearish') || detail.toLowerCase().includes('short ');
              const accentColor = isBull ? '#27500A' : isBear ? '#C8302A' : '#B8860B';
              const accentBg   = isBull ? '#EAF3DE' : isBear ? '#FCEBEB' : '#FFFBEB';
              return (
                <div key={i} style={{background:accentBg,borderRadius:6,padding:'10px 12px',
                  borderLeft:`3px solid ${accentColor}`}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
                    color:accentColor,marginBottom:5}}>{ctitle}</div>
                  <div style={{fontSize:11,color:'#333',lineHeight:1.5}}>{detail}</div>
                </div>
              );
            })}
          </div>
          {showPositions.length > 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:6,paddingTop:8,borderTop:'1px solid #F5F3EF'}}>
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
                textTransform:'uppercase',letterSpacing:'0.08em',alignSelf:'center',marginRight:4}}>Positions:</span>
              {showPositions.map((p,i) => {
                const label   = (typeof p === 'object' && p !== null) ? (p.label ?? '') : (p ?? '');
                const pType   = (typeof p === 'object' && p !== null) ? (p.type ?? '') : '';
                const isLong  = pType === 'long'  || label.toLowerCase().startsWith('long');
                const isShort = pType === 'short' || label.toLowerCase().startsWith('short');
                return (
                  <span key={i} style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
                    padding:'2px 8px',borderRadius:3,
                    background: isLong ? '#EAF3DE' : isShort ? '#FCEBEB' : '#F4F3EF',
                    color: isLong ? '#27500A' : isShort ? '#C8302A' : '#1A1A18'}}>
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MSR + MOMO row */}
      {(msrData || momoData) && (
        <div style={{display:'grid',gridTemplateColumns:`repeat(${[msrData,momoData].filter(Boolean).length},1fr)`,gap:12,marginBottom:16}}>
          {msrData && (
            <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                  textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770'}}>MSR — {msrData.title || 'Market Situation'}</span>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790'}}>{msrData.date}</span>
              </div>
              {msrData.pv_band_resistance && (
                <div style={{display:'flex',gap:16,marginBottom:8}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace'}}>
                    <div style={{fontSize:8,color:'#C8302A',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>Resistance</div>
                    <div style={{fontSize:15,fontWeight:700,color:'#C8302A'}}>{msrData.pv_band_resistance}</div>
                  </div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace'}}>
                    <div style={{fontSize:8,color:'#27500A',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>Support</div>
                    <div style={{fontSize:15,fontWeight:700,color:'#27500A'}}>{msrData.pv_band_support}</div>
                  </div>
                  {msrData.gamma_exposure && (
                    <div style={{fontFamily:'IBM Plex Mono,monospace'}}>
                      <div style={{fontSize:8,color:'#9A9790',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>Gamma</div>
                      <div style={{fontSize:12,fontWeight:600,color:'#1A4D8F'}}>{msrData.gamma_exposure}</div>
                    </div>
                  )}
                </div>
              )}
              {(msrData.key_points||[]).slice(0,3).map((pt,i) => (
                <div key={i} style={{display:'flex',gap:5,marginBottom:4,alignItems:'flex-start'}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#B8860B',
                    marginTop:2,flexShrink:0}}>›</span>
                  <span style={{fontSize:10,color:'#555',lineHeight:1.45}}>{pt}</span>
                </div>
              ))}
            </div>
          )}
          {momoData && (
            <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                  textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770'}}>MOMO Tracker</span>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790'}}>{momoData.date}</span>
              </div>
              {momoData.headline && (
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:700,
                  color:'#1A1A18',marginBottom:8}}>{momoData.headline}</div>
              )}
              <div style={{display:'flex',gap:16,marginBottom:8}}>
                {momoData.mag7_perf && (
                  <div style={{fontFamily:'IBM Plex Mono,monospace'}}>
                    <div style={{fontSize:8,color:'#9A9790',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>Mag7</div>
                    <div style={{fontSize:13,fontWeight:700,
                      color: parseFloat(momoData.mag7_perf) >= 0 ? '#27500A' : '#C8302A'}}>
                      {momoData.mag7_perf}
                    </div>
                  </div>
                )}
                {momoData.nvda_rr_room && (
                  <div style={{fontFamily:'IBM Plex Mono,monospace'}}>
                    <div style={{fontSize:8,color:'#9A9790',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>NVDA RR Room</div>
                    <div style={{fontSize:13,fontWeight:700,color:'#1A4D8F'}}>{momoData.nvda_rr_room}</div>
                  </div>
                )}
              </div>
              {(momoData.key_signals||[]).slice(0,3).map((s,i) => (
                <div key={i} style={{display:'flex',gap:5,marginBottom:4,alignItems:'flex-start'}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#B8860B',
                    marginTop:2,flexShrink:0}}>›</span>
                  <span style={{fontSize:10,color:'#555',lineHeight:1.45}}>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Macro Intel Panel */}
      {hasIntel && (
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 18px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:600,
                textTransform:'uppercase',letterSpacing:'0.12em',color:'#7A7770'}}>Macro Intelligence</span>
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,background:'#EAF3DE',
                color:'#27500A',padding:'1px 6px',borderRadius:2,fontWeight:600}}>PIPELINE</span>
            </div>
            {callSummDate && (
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790'}}>
                Call: {callSummDate}
              </span>
            )}
          </div>
          <div style={{display:'grid',
            gridTemplateColumns:(callSummPts.length > 0 && showNotesPts.length > 0) ? '1fr 1fr' : '1fr',
            gap:16}}>
            {showNotesPts.length > 0 && (
              <div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
                  textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Macro Show Notes</div>
                {showNotesPts.slice(0,4).map((pt,i) => {
                  const bc = bulletSentiment(pt);
                  return (
                    <div key={i} style={{display:'flex',gap:6,marginBottom:5,alignItems:'flex-start',
                      paddingLeft:6,borderLeft:`2px solid ${bc || '#E4E1DA'}`}}>
                      <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
                        marginTop:2,flexShrink:0}}>›</span>
                      <span style={{fontSize:11,color:'#333',lineHeight:1.45}}>{pt}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {callSummPts.length > 0 && (
              <div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
                  textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Call Summary</div>
                {callSummPts.slice(0,4).map((pt,i) => {
                  const bc = bulletSentiment(pt);
                  return (
                    <div key={i} style={{display:'flex',gap:6,marginBottom:5,alignItems:'flex-start',
                      paddingLeft:6,borderLeft:`2px solid ${bc || '#E4E1DA'}`}}>
                      <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790',
                        marginTop:2,flexShrink:0}}>›</span>
                      <span style={{fontSize:11,color:'#333',lineHeight:1.45}}>{pt}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}


      {/* USD Correlations card — from Macro Show slide 23 */}
      {usdCorrData && (
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,
          padding:'14px 18px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:3,height:14,borderRadius:2,background:'#1A4D8F',flexShrink:0}} />
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
                textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770'}}>
                Key $USD Correlations
              </span>
            </div>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#9A9790'}}>
              {usdCorrData.as_of_date} &nbsp;·&nbsp; 52-Wk Rolling 30D
            </span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,
              fontFamily:'IBM Plex Mono,monospace'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #E4E1DA'}}>
                  {['Metric','15D','30D','90D','120D','180D','%Time Pos','%Time Neg'].map(h => (
                    <th key={h} style={{padding:'3px 8px',fontSize:8,color:'#9A9790',
                      textTransform:'uppercase',letterSpacing:'0.06em',
                      textAlign: h==='Metric' ? 'left' : 'right',fontWeight:600}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usdCorrData.data.map((row,i) => {
                  const hl = row.highlighted;
                  const cell = (v, key) => {
                    if (v == null) return <td key={key} style={{padding:'4px 8px',textAlign:'right',color:'#C8C5BE'}}>—</td>;
                    const isNeg = v < 0;
                    const isStrong = Math.abs(v) >= 0.5;
                    const bg = hl && isStrong ? (isNeg ? '#FADADD' : '#D4EDDA') : 'transparent';
                    return (
                      <td key={key} style={{padding:'4px 8px',textAlign:'right',
                        fontWeight: isStrong ? 700 : 400,
                        color: isNeg ? '#C8302A' : v > 0 ? '#27500A' : '#555',
                        background: bg, borderRadius:3}}>
                        {v > 0 ? '+' : ''}{v.toFixed(2)}
                      </td>
                    );
                  };
                  return (
                    <tr key={i} style={{
                      background: hl ? 'rgba(200,48,42,0.03)' : i%2===0 ? '#FAFAF8' : '#fff',
                      borderBottom:'1px solid #F5F3EF'}}>
                      <td style={{padding:'4px 8px',fontWeight: hl ? 700 : 500,
                        color: hl ? '#C8302A' : '#1A1A18',whiteSpace:'nowrap'}}>
                        {hl && <span style={{marginRight:4}}>→</span>}{row.metric}
                      </td>
                      {cell(row['15d'],'15d')}
                      {cell(row['30d'],'30d')}
                      {cell(row['90d'],'90d')}
                      {cell(row['120d'],'120d')}
                      {cell(row['180d'],'180d')}
                      <td style={{padding:'4px 8px',textAlign:'right',color:'#27500A',fontWeight:500}}>
                        {row.pct_pos}%
                      </td>
                      <td style={{padding:'4px 8px',textAlign:'right',color:'#C8302A',fontWeight:500}}>
                        {row.pct_neg}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Three feeds */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        {/* RTA Feed */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',
            borderBottom:'1px solid #E4E1DA',paddingBottom:8,marginBottom:12,
            display:'flex',justifyContent:'space-between'}}>
            <span>RTA — Recent</span>
            {winRate != null && (
              <span style={{color:winRate>0.5?'#27500A':'#C8302A',fontWeight:700}}>
                {(winRate*100).toFixed(0)}% WR
              </span>
            )}
          </div>
          {recentTrades === null ? <LoadingSpinner msg="Loading…" /> :
           recentTrades.length === 0 ? (
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790',
              textAlign:'center',padding:'20px 0'}}>No trades in last 90 days</div>
          ) : recentTrades.slice(0,10).map((t,i) => {
            const r = t.realized_return ?? 0;
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'5px 0',borderBottom:i<Math.min(9,recentTrades.length-1)?'1px solid #F5F3EF':'none'}}>
                <div style={{display:'flex',gap:7,alignItems:'center'}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,fontSize:12,minWidth:48}}>{t.ticker}</span>
                  <SignalBadge signal={(t.position||'').toUpperCase()} />
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:600,
                    color:r>0?'#27500A':'#C8302A'}}>{r>0?'+':''}{(r*100).toFixed(1)}%</div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790'}}>
                    {(t.close_date||'').slice(5,10)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* HAM Feed */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',
            borderBottom:'1px solid #E4E1DA',paddingBottom:8,marginBottom:12}}>
            HAM — Highest Conviction
          </div>
          {hamHighConv === null ? <LoadingSpinner msg="Loading…" /> :
           hamHighConv.length === 0 ? (
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790',
              textAlign:'center',padding:'20px 0'}}>No holdings in 3+ funds</div>
          ) : hamHighConv.map((h,i) => {
            const wt   = HE.hamWeightNum(h);
            const isSss = (sssTickers || []).includes(h.ticker);
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'5px 0',borderBottom:i<hamHighConv.length-1?'1px solid #F5F3EF':'none'}}>
                <div>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,fontSize:12}}>{h.ticker}</span>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginLeft:6}}>
                    {(h.name||'').slice(0,22)}
                  </span>
                </div>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  {isSss && <span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 5px',borderRadius:3}}>SSS</span>}
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:700,
                    padding:'2px 7px',borderRadius:3,
                    background:wt!=null&&wt>=0.05?'#EAF3DE':'#E4EDF8',
                    color:wt!=null&&wt>=0.05?'#27500A':'#1A4D8F'}}>
                    {HE.fmt(wt!=null?wt*100:null,2,'%')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* SSS Feed */}
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',
            borderBottom:'1px solid #E4E1DA',paddingBottom:8,marginBottom:12,
            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>Signal Strength Stocks</span>
            {sssTickers && <span style={{color:'#9A9790',fontWeight:400,fontSize:9}}>{sssTickers.length}</span>}
          </div>
          {sssAdded.length > 0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#27500A',
                textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>+ Added</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {sssAdded.map((t,i) => (
                  <span key={i} style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
                    background:'#EAF3DE',color:'#27500A',padding:'2px 6px',borderRadius:3}}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {sssRemoved.length > 0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#C8302A',
                textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>– Removed</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {sssRemoved.map((t,i) => (
                  <span key={i} style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
                    background:'#FCEBEB',color:'#C8302A',padding:'2px 6px',borderRadius:3}}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {sssCount !== null && sssPrevCount !== null && (
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,marginBottom:8,
              color: sssCount > sssPrevCount ? '#27500A' : sssCount < sssPrevCount ? '#C8302A' : '#9A9790'}}>
              {sssPrevCount} → {sssCount} {sssCount > sssPrevCount ? '↑ Expanding' : sssCount < sssPrevCount ? '↓ Contracting' : '— Stable'}
            </div>
          )}
          {macroCtx === null ? <LoadingSpinner msg="Loading…" /> :
           sssTickers === null ? (
             <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790',
               textAlign:'center',padding:'20px 0',lineHeight:1.7}}>
               <div>No SSS data available</div>
             </div>
           ) : (
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {(sssTickers || []).map((t,i) => (
                <span key={i} style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
                  background:'#F4F3EF',color:'#1A1A18',padding:'2px 6px',borderRadius:3,
                  border:'1px solid #E4E1DA'}}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── ERROR BOUNDARY ─────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err.message || String(err) || 'Unknown render error' }; }
  componentDidCatch(err, info) { console.error('[ErrorBoundary]', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:'32px 24px',fontFamily:'IBM Plex Mono,monospace'}}>
          <div style={{background:'#FFF0F0',border:'1px solid #FDB8B8',borderRadius:8,
            padding:'20px 24px',maxWidth:700}}>
            <div style={{fontSize:13,fontWeight:700,color:'#C8302A',marginBottom:8}}>
              ⚠ Component Error
            </div>
            <div style={{fontSize:11,color:'#555',marginBottom:16,lineHeight:1.6,
              fontFamily:'monospace',background:'#F9F9F9',padding:'8px 12px',
              borderRadius:4,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
              {this.state.error}
            </div>
            <button onClick={() => this.setState({error:null})}
              style={{padding:'5px 14px',background:'#1A1A18',color:'#fff',
              border:'none',borderRadius:4,cursor:'pointer',fontSize:11}}>
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


// ── he_analyzer.jsx — inlined for reliable execution ──────────────────────
// he_analyzer.jsx — Stock Analyzer (Sam Rahman's investment process)

const CF_WORKER = 'https://schwab-prices.hedgeye-dashboard.workers.dev';

// ── Sam's three buckets ──────────────────────────────────────────────
const BUCKETS = {
  MOAT: {
    label:  'Moat',
    desc:   'Durable competitive advantage, multi-year compounder',
    sub:    'Consistent FCF growth, pricing power, secular market dominance. These are businesses you hold for years through quad shifts.',
    detail: 'A Moat company has a structural barrier — exchange monopoly, network effects, switching costs, brand — that lets it grow FCF regardless of the macro environment. Sam looks for businesses where the competitive moat widens over time: pricing power that protects margins, recurring revenue that smooths cycles, and returns on capital that compound. The ideal Moat name is one you never need to sell — you size up on weakness and hold through quad shifts because the secular story never broke.',
    quadCompatibility: { Q1:'strong', Q2:'strong', Q3:'neutral', Q4:'neutral' },
    addWhen: 'Any quad — best entries when macro headwinds temporarily compress the price below intrinsic value',
    chartPos: { x: 0.60, y: 0.28 },
    exampleTickers: ['AAPL','GOOGL','MSFT','V','MA','CME','CBOE','SPGI'],
    color:  '#27500A',
    bg:     '#EAF3DE',
    border: '#7AB648',
    // Sam's known examples + logical extensions
    tickers: new Set(['AAPL','GOOGL','GOOG','AMZN','ADI','CBOE','NDAQ','LNG','MSFT','V','MA','MELI','BRK.B','BRK.A','CME','ICE','SPGI','MCO']),
    // Hedgeye sectors that lean Moat
    sectors: new Set(['Communications','Financials']),
    industryKw: ['exchange','payment network','capital markets','financial data','enterprise software','cloud platform'],
  },
  SCURVE: {
    label:  'S-Curve',
    desc:   'Secular growth — AI, semis, supply chain infrastructure',
    sub:    'Early-to-mid innings of a multi-year secular growth cycle. Macro matters less when the secular tailwind is strong enough.',
    detail: 'An S-Curve name is in the early-to-middle innings of a secular growth cycle that spans multiple years — typically 5–10+. Sam focuses on markets where adoption is still sub-20% penetrated, meaning the TAM expansion itself drives revenue regardless of whether GDP is accelerating or decelerating. The classic tells: revenue beating consensus by wide margins, analyst estimates still lagging reality, and a product cycle (AI inference, power infrastructure, semi complexity) that has years to run. These names are sensitive to macro in Q3/Q4 but the secular story can override short-term headwinds.',
    quadCompatibility: { Q1:'strong', Q2:'strong', Q3:'caution', Q4:'avoid' },
    addWhen: 'Q1 or Q2 entries preferred — step aside or trim into Q3/Q4 unless the secular cycle clearly dominates',
    chartPos: { x: 0.82, y: 0.62 },
    exampleTickers: ['NVDA','AVGO','AMD','AMAT','GEV','CAT','PLTR','ORCL'],
    color:  '#1A4D8F',
    bg:     '#E4EDF8',
    border: '#5B8FD8',
    tickers: new Set(['AVGO','KLA','KLAC','GEV','STX','COHR','CAT','NVDA','AMD','TSM','AMAT','LRCX','MRVL','ONTO','TSSI','SITM','POET','CRWV','ASML','SMCI','ARM','PLTR','ORCL']),
    sectors: new Set(['Global Tech','Industrials','Digital Assets']),
    industryKw: ['semiconductor','electronic component','semiconductor equipment','power system','industrial automation','data center','networking'],
  },
  IDIO: {
    label:  'Idiosyncratic',
    desc:   'Management change, turnaround, or business transformation',
    sub:    'Company-specific catalyst that can work in any quad. The thesis is about the business change, not the macro.',
    detail: "An Idiosyncratic name has a company-specific catalyst — new CEO, spin-off, balance sheet restructuring, product turnaround, or regulatory resolution — that drives the thesis independent of the macro backdrop. Sam's key test: would you still own this if the quad flipped tomorrow? If the answer is yes, it's truly idiosyncratic. The risk is that 'idio' becomes an excuse to fight the tape — these names need a concrete, time-bound catalyst and a clear exit trigger if the catalyst fails to materialize. They often offer the best risk/reward in Q3 and Q4 when macro tailwinds are scarce.",
    quadCompatibility: { Q1:'neutral', Q2:'neutral', Q3:'neutral', Q4:'neutral' },
    addWhen: 'Any quad — catalyst is company-specific; size smaller and hedge macro exposure separately',
    chartPos: { x: 0.28, y: 0.22 },
    exampleTickers: ['C','SBUX','NKE','INTC','MGM','HLT','PFE','WBD'],
    color:  '#7A5C00',
    bg:     '#FFF8E1',
    border: '#D4A017',
    tickers: new Set(['C','SBUX','CZR','CF','NKE','INTC','WBD','PFE','PARA','MGM','HLT','MAR']),
    sectors: new Set(['GLL','Restaurants','Healthcare','Energy','Consumer Staples']),
    industryKw: ['casino','hotel','lodging','restaurant','food service','pharmaceutical','oil','gas','turnaround'],
  },
};

// ── Quad compatibility label metadata ───────────────────────────────
const QUAD_COMPAT_META = {
  strong:  { label: 'STRONG',  color: '#27500A', bg: '#EAF3DE' },
  neutral: { label: 'NEUTRAL', color: '#7A5C00', bg: '#FFF8E1' },
  caution: { label: 'CAUTION', color: '#B8860B', bg: '#FFF3CD' },
  avoid:   { label: 'AVOID',   color: '#C8302A', bg: '#FCEBEB' },
};

// ── 2×2 Bucket Positioning Chart (SVG) ──────────────────────────────
const BucketPositioningChart = ({ activeBucketKey }) => {
  const W = 320, H = 260;
  const PL = 48, PR = 16, PT = 24, PB = 44;
  const CW = W - PL - PR, CH = H - PT - PB;

  const bucketDots = Object.entries(BUCKETS).map(([key, b]) => ({
    key,
    x: PL + b.chartPos.x * CW,
    y: PT + (1 - b.chartPos.y) * CH,
    color: b.color,
    bg: b.bg,
    border: b.border,
    label: b.label,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', maxWidth:320, display:'block', margin:'0 auto'}}
      xmlns="http://www.w3.org/2000/svg">
      {/* Axis lines */}
      <line x1={PL} y1={PT} x2={PL} y2={PT+CH} stroke="#E4E1DA" strokeWidth={1}/>
      <line x1={PL} y1={PT+CH} x2={PL+CW} y2={PT+CH} stroke="#E4E1DA" strokeWidth={1}/>
      {/* Quadrant dividers */}
      <line x1={PL+CW/2} y1={PT} x2={PL+CW/2} y2={PT+CH} stroke="#F1EFE8" strokeWidth={1} strokeDasharray="3,3"/>
      <line x1={PL} y1={PT+CH/2} x2={PL+CW} y2={PT+CH/2} stroke="#F1EFE8" strokeWidth={1} strokeDasharray="3,3"/>
      {/* Y-axis label */}
      <text x={12} y={PT+CH/2} textAnchor="middle" fontSize={8} fill="#9A9790"
        fontFamily="IBM Plex Mono,monospace"
        transform={`rotate(-90,12,${PT+CH/2})`}>MACRO SENSITIVITY</text>
      {/* X-axis label */}
      <text x={PL+CW/2} y={H-6} textAnchor="middle" fontSize={8} fill="#9A9790"
        fontFamily="IBM Plex Mono,monospace">GROWTH DEPENDENCY</text>
      {/* Y-axis ticks */}
      <text x={PL-4} y={PT+4}    textAnchor="end" fontSize={7} fill="#C8C5BE" fontFamily="IBM Plex Mono,monospace">HIGH</text>
      <text x={PL-4} y={PT+CH+4} textAnchor="end" fontSize={7} fill="#C8C5BE" fontFamily="IBM Plex Mono,monospace">LOW</text>
      {/* X-axis ticks */}
      <text x={PL}    y={PT+CH+14} textAnchor="middle" fontSize={7} fill="#C8C5BE" fontFamily="IBM Plex Mono,monospace">LOW</text>
      <text x={PL+CW} y={PT+CH+14} textAnchor="middle" fontSize={7} fill="#C8C5BE" fontFamily="IBM Plex Mono,monospace">HIGH</text>
      {/* Bucket dots */}
      {bucketDots.map(d => {
        const isActive = d.key === activeBucketKey;
        return (
          <g key={d.key}>
            <circle cx={d.x} cy={d.y} r={isActive ? 16 : 12}
              fill={d.bg} stroke={d.border} strokeWidth={isActive ? 2 : 1}/>
            <text x={d.x} y={d.y+4} textAnchor="middle" fontSize={isActive ? 9 : 8}
              fontWeight={700} fill={d.color} fontFamily="IBM Plex Mono,monospace">
              {d.label.slice(0,4).toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Map FMP sector/industry → Hedgeye sector label ───────────────────
function mapFmpToHedgeyeSector(fmpSector, fmpIndustry) {
  const s = (fmpSector    || '').toLowerCase();
  const i = (fmpIndustry  || '').toLowerCase();
  if (s.includes('technology')   || i.includes('semiconductor') || i.includes('software')) return 'Global Tech';
  if (s.includes('communication')) return 'Communications';
  if (s.includes('consumer') && s.includes('discretionary')) {
    if (i.includes('restaurant') || i.includes('food service')) return 'Restaurants';
    if (i.includes('hotel') || i.includes('casino') || i.includes('lodging') || i.includes('gaming')) return 'GLL';
    return 'Retail';
  }
  if (s.includes('consumer') && s.includes('staples'))  return 'Consumer Staples';
  if (s.includes('energy'))                             return 'Energy';
  if (s.includes('industrial'))                         return 'Industrials';
  if (s.includes('financial') || s.includes('finance')) return 'Financials';
  if (s.includes('health'))                             return 'Healthcare';
  return null;
}

// ── Sector → quad fit ────────────────────────────────────────────────
// Derived from window.HE.QUADS best/worst sector lists
const SECTOR_QUAD = {
  'Global Tech':      { Q1:'best',    Q2:'best',    Q3:'best',    Q4:'worst'   },
  'Communications':   { Q1:'best',    Q2:'neutral', Q3:'neutral', Q4:'neutral' },
  'Industrials':      { Q1:'best',    Q2:'best',    Q3:'neutral', Q4:'worst'   },
  'Retail':           { Q1:'best',    Q2:'best',    Q3:'neutral', Q4:'worst'   },
  'Consumer Staples': { Q1:'worst',   Q2:'worst',   Q3:'neutral', Q4:'best'    },
  'Financials':       { Q1:'neutral', Q2:'best',    Q3:'worst',   Q4:'worst'   },
  'Energy':           { Q1:'neutral', Q2:'best',    Q3:'best',    Q4:'worst'   },
  'GLL':              { Q1:'best',    Q2:'best',    Q3:'neutral', Q4:'worst'   },
  'Restaurants':      { Q1:'best',    Q2:'best',    Q3:'neutral', Q4:'neutral' },
  'Healthcare':       { Q1:'neutral', Q2:'worst',   Q3:'neutral', Q4:'best'    },
  'Digital Assets':   { Q1:'best',    Q2:'best',    Q3:'worst',   Q4:'worst'   },
};

const FIT_META = {
  best:    { label:'Best Fit',  color:'#27500A', bg:'#EAF3DE', score:3 },
  neutral: { label:'Neutral',   color:'#7A5C00', bg:'#FFF8E1', score:2 },
  worst:   { label:'Headwind',  color:'#C8302A', bg:'#FCEBEB', score:1 },
};

const VERDICT_META = {
  STRONG_SETUP:   {
    label: 'STRONG SETUP',
    color: '#27500A', bg: '#EAF3DE', border: '#7AB648',
    desc: 'On SSS + sector is a best-fit for the current quad. All three of Sam\'s conditions are aligned.',
  },
  WATCH: {
    label: 'WATCH',
    color: '#B8860B', bg: '#FFF8E1', border: '#D4A017',
    desc: 'On SSS but macro timing is neutral. Monitor for a quad shift before adding size.',
  },
  WEAK_TIMING: {
    label: 'WEAK TIMING',
    color: '#C8302A', bg: '#FCEBEB', border: '#E07070',
    desc: 'On SSS but sector faces a macro headwind in the current quad. Size accordingly or wait.',
  },
  NOT_ACTIONABLE: {
    label: 'NOT ACTIONABLE',
    color: '#9A9790', bg: '#F5F3EF', border: '#C8C5BE',
    desc: 'Not on Hedgeye SSS. Sam\'s process requires SSS qualification before any entry, regardless of bucket or macro.',
  },
};

function classifyBucket(ticker, hedgeyeSector, fmpIndustry) {
  const t = (ticker || '').toUpperCase();
  for (const [key, b] of Object.entries(BUCKETS)) {
    if (b.tickers.has(t)) return key;
  }
  if (hedgeyeSector) {
    for (const [key, b] of Object.entries(BUCKETS)) {
      if (b.sectors.has(hedgeyeSector)) return key;
    }
  }
  if (fmpIndustry) {
    const ind = fmpIndustry.toLowerCase();
    for (const [key, b] of Object.entries(BUCKETS)) {
      if (b.industryKw.some(kw => ind.includes(kw))) return key;
    }
  }
  return null;
}

// ── Analyzer Tab ─────────────────────────────────────────────────────
const AnalyzerTab = ({macroCtx}) => {
  const [input,          setInput]          = React.useState('');
  const [ticker,         setTicker]         = React.useState('');
  const [loading,        setLoading]        = React.useState(false);
  const [priceData,      setPriceData]      = React.useState(null);
  const [fmpData,        setFmpData]        = React.useState(null);
  const [fmpErr,         setFmpErr]         = React.useState('');
  const [fetchErr,       setFetchErr]       = React.useState('');
  const [expandedBucket, setExpandedBucket] = React.useState(null);

  const analyze = async () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    setTicker(sym);
    setLoading(true);
    setPriceData(null);
    setFmpData(null);
    setFmpErr('');
    setFetchErr('');

    // Live price — CF Worker primary, Netlify fallback
    const endpoints = [
      `${CF_WORKER}?symbols=${encodeURIComponent(sym)}`,
      window.HE.apiUrl.yfQuote([sym]),
    ];
    let priceResult = null;
    for (const url of endpoints) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        const q = d.quoteResponse?.result?.[0];
        if (q) { priceResult = q; break; }
      } catch (e) {
        console.warn('[analyzer] price endpoint failed:', e.message);
      }
    }
    if (priceResult) setPriceData(priceResult);
    else setFetchErr('Price data unavailable — check ticker symbol');

    // FMP fundamentals — free-tier endpoints only
    const fmpKey = window.HE.loadQuadState().fmpKey;
    if (fmpKey) {
      try {
        const [quoteRes, incomeRes, surpriseRes] = await Promise.all([
          fetch(`https://financialmodelingprep.com/api/v3/quote/${sym}?apikey=${fmpKey}`,                                    { signal: AbortSignal.timeout(8000) }),
          fetch(`https://financialmodelingprep.com/api/v3/income-statement/${sym}?period=quarter&limit=4&apikey=${fmpKey}`,  { signal: AbortSignal.timeout(8000) }),
          fetch(`https://financialmodelingprep.com/api/v3/earnings-surprises/${sym}?apikey=${fmpKey}`,                       { signal: AbortSignal.timeout(8000) }),
        ]);
        if (!quoteRes.ok) {
          const msg = quoteRes.status === 403
            ? 'FMP subscription required — upgrade at financialmodelingprep.com'
            : `FMP error (HTTP ${quoteRes.status}) — verify your API key in ⚙ Settings`;
          console.warn('[analyzer] FMP HTTP error:', quoteRes.status);
          setFmpErr(msg);
        } else {
          const [quote, income, surprises] = await Promise.all([
            quoteRes.json(),
            incomeRes.ok   ? incomeRes.json()   : [],
            surpriseRes.ok ? surpriseRes.json() : [],
          ]);
          const q0 = Array.isArray(quote) ? quote[0] : null;
          if (!q0) {
            setFmpErr('FMP returned no data for this ticker');
          } else {
            // Revenue QoQ growth — income statements arrive newest-first, reverse to chronological
            const stmts = (Array.isArray(income) ? income : []).slice(0, 4).reverse();
            const revenueGrowths = [];
            for (let i = 1; i < stmts.length; i++) {
              const prev = stmts[i-1].revenue, curr = stmts[i].revenue;
              if (prev && curr) revenueGrowths.push((curr - prev) / Math.abs(prev) * 100);
            }
            const revAccelerating = revenueGrowths.length >= 2
              ? revenueGrowths[revenueGrowths.length-1] > revenueGrowths[revenueGrowths.length-2]
              : null;
            // EPS beat/miss — surprises newest-first, take last 4
            const eps4 = (Array.isArray(surprises) ? surprises : []).slice(0, 4);
            const beats = eps4.filter(s => (s.actualEarningResult ?? 0) > (s.estimatedEarning ?? 0)).length;
            setFmpData({
              name:          q0.name,
              sector:        q0.sector   ?? null,
              industry:      q0.industry ?? null,
              exchange:      q0.exchange ?? null,
              mktCap:        q0.marketCap,
              pe:            q0.pe,
              eps:           q0.eps,
              weekHigh52:    q0.yearHigh,
              weekLow52:     q0.yearLow,
              price:         q0.price,
              revenueGrowths,
              revAccelerating,
              beats,
              totalEpsQ:     eps4.length,
            });
          }
        }
      } catch (e) {
        console.warn('[analyzer] FMP failed:', e.message);
        setFmpErr('FMP data unavailable');
      }
    }

    setLoading(false);
  };

  const onKey = e => { if (e.key === 'Enter') analyze(); };

  // ── Derived analysis ───────────────────────────────────────────────
  const sssTickerDetail = ticker ? (macroCtx?.pdf?.sss?.tickers_detail?.[ticker] ?? null) : null;
  const liveSssTickers  = new Set(macroCtx?.pdf?.sss?.tickers ?? []);
  const isOnSss = ticker ? liveSssTickers.has(ticker) : false;
  const qs = window.HE.loadQuadState();
  const currentQuad = qs.monthly || qs.quarterly || 'Q3';
  const quadDef     = window.HE.QUADS[currentQuad];
  const fmpKey      = qs.fmpKey;

  // Effective sector: SSS tickers_detail > FMP-mapped > null
  const hedgeyeSector = sssTickerDetail?.sector
    || (fmpData ? mapFmpToHedgeyeSector(fmpData.sector, fmpData.industry) : null);

  const bucketKey  = ticker ? classifyBucket(ticker, hedgeyeSector, fmpData?.industry) : null;
  const bucket     = bucketKey ? BUCKETS[bucketKey] : null;
  const quadFit    = hedgeyeSector ? (SECTOR_QUAD[hedgeyeSector]?.[currentQuad] || 'neutral') : null;
  const fitMeta    = quadFit ? FIT_META[quadFit] : null;

  const verdictKey = !ticker ? null
    : !isOnSss ? 'NOT_ACTIONABLE'
    : quadFit === 'best' ? 'STRONG_SETUP'
    : quadFit === 'worst' ? 'WEAK_TIMING'
    : 'WATCH';
  const verdict = verdictKey ? VERDICT_META[verdictKey] : null;

  // Portfolio signals — no FMP needed
  const hamHoldings   = HE.getHamArray(macroCtx);
  const hamEntry      = ticker ? hamHoldings.find(h => h.ticker === ticker) : null;
  const investLongs   = macroCtx?.pdf?.investing_ideas?.longs  ?? {};
  const investShorts  = macroCtx?.pdf?.investing_ideas?.shorts ?? {};
  const investNeutral = macroCtx?.pdf?.investing_ideas?.neutral ?? [];
  const levelData     = ticker ? (macroCtx?.levels?.[ticker] ?? null) : null;
  // Pre-parse the range string so we can use values directly in JSX without an IIFE
  const _lvlParts  = (levelData?.range || '').split('-');
  const levelLrr   = _lvlParts[0] || null;
  const levelTrr   = _lvlParts[1] || null;
  const levelSig   = (levelData?.signal || '').toUpperCase();
  const levelClose = levelData?.close ?? null;
  const levelLrrN  = parseFloat(levelLrr);
  const levelTrrN  = parseFloat(levelTrr);
  const ideaDir  = investLongs[ticker]   ? 'LONG'
                 : investShorts[ticker]  ? 'SHORT'
                 : investNeutral.includes(ticker) ? 'NEUTRAL' : null;
  const ideaThesis = investLongs[ticker]?.thesis ?? investShorts[ticker]?.thesis ?? null;
  // Actionability timeframe: MOAT=long-term, SCURVE=secular multi-year, IDIO=near-term
  const TIMEFRAME_META = {
    MOAT:   { label: 'LONG-TERM HOLD',    color: '#1A4D8F', bg: '#EBF2FB', desc: 'Durable competitive advantage — size over time, not in one trade.' },
    SCURVE:  { label: 'SECULAR MULTI-YEAR', color: '#27500A', bg: '#EAF3DE', desc: 'S-Curve name — entry timing matters but thesis spans years.' },
    IDIO:    { label: 'NEAR-TERM CATALYST',color: '#B8860B', bg: '#FFF8E1', desc: 'Idiosyncratic catalyst driven — watch for the event window.' },
  };
  const timeframeMeta = bucketKey ? TIMEFRAME_META[bucketKey] : null;

  const fmtMktCap = v => {
    if (v == null) return '—';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
    return `$${(v / 1e6).toFixed(0)}M`;
  };
  const fmtN = (v, d = 1) => (v != null && !isNaN(v)) ? Number(v).toFixed(d) : '—';

  const showResults = !!ticker && !loading;

  return (
    <div style={{padding:'20px 24px', maxWidth:1200}}>

      {/* Search bar */}
      <div style={{display:'flex', gap:10, marginBottom: showResults ? 20 : 48, alignItems:'center'}}>
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={onKey}
          placeholder="Ticker (e.g. NVDA)"
          style={{width:200, padding:'9px 14px', fontFamily:'IBM Plex Mono,monospace', fontSize:15,
            fontWeight:700, border:'1px solid #E4E1DA', borderRadius:6, outline:'none',
            background:'#fff', color:'#1A1A18', letterSpacing:'0.06em', boxSizing:'border-box'}}
        />
        <button onClick={analyze} disabled={loading || !input.trim()} style={{
          padding:'9px 24px', background:'#1A1A18', color:'#fff', border:'none', borderRadius:6,
          cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
          fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700, letterSpacing:'0.08em',
          opacity: (loading || !input.trim()) ? 0.45 : 1,
        }}>
          {loading ? 'ANALYZING…' : 'ANALYZE'}
        </button>
        {fetchErr && (
          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8302A'}}>{fetchErr}</span>
        )}
      </div>

      {/* Empty state — bucket guide */}
      {!showResults && !loading && (
        <div style={{padding:'8px 0 40px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
            letterSpacing:'0.1em', color:'#C8C5BE', textTransform:'uppercase', marginBottom:14}}>
            Sam Rahman's 3 Buckets — click to expand
          </div>

          {/* 3 bucket cards */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16}}>
            {Object.entries(BUCKETS).map(([key, b]) => {
              const isOpen = expandedBucket === key;
              return (
                <div key={key}
                  onClick={() => setExpandedBucket(isOpen ? null : key)}
                  style={{background: isOpen ? b.bg : '#fff',
                    border:`1px solid ${isOpen ? b.border : '#E4E1DA'}`,
                    borderTop: `3px solid ${b.border}`,
                    borderRadius:8, padding:'14px 16px', cursor:'pointer',
                    transition:'all 0.15s ease'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:13, fontWeight:700,
                        color:b.color, marginBottom:3}}>{b.label.toUpperCase()}</div>
                      <div style={{fontSize:10, color:b.color, lineHeight:1.5, marginBottom:8}}>{b.desc}</div>
                    </div>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:14, color:b.color,
                      marginLeft:8, flexShrink:0}}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {/* Quad compat pills */}
                  <div style={{display:'flex', gap:4, flexWrap:'wrap', marginBottom:8}}>
                    {['Q1','Q2','Q3','Q4'].map(q => {
                      const compat = b.quadCompatibility[q];
                      const cm = QUAD_COMPAT_META[compat];
                      return (
                        <span key={q} style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:700,
                          color:cm.color, background:cm.bg, borderRadius:3, padding:'2px 6px'}}>
                          {q}:{cm.label.slice(0,3)}
                        </span>
                      );
                    })}
                  </div>
                  {/* Example tickers */}
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790'}}>
                    {b.exampleTickers.slice(0,5).join(' · ')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded bucket detail panel */}
          {expandedBucket && (() => {
            const b = BUCKETS[expandedBucket];
            return (
              <div style={{background:'#fff', border:`1px solid ${b.border}`,
                borderLeft:`4px solid ${b.border}`, borderRadius:8,
                padding:'20px 24px', marginBottom:16, display:'grid',
                gridTemplateColumns:'1fr auto', gap:20, alignItems:'start'}}>
                <div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
                    color:b.color, letterSpacing:'0.1em', marginBottom:8}}>
                    {b.label.toUpperCase()} — SAM'S DEFINITION
                  </div>
                  <div style={{fontSize:12, color:'#333', lineHeight:1.8, marginBottom:16}}>
                    {b.detail}
                  </div>
                  <div style={{background:b.bg, borderRadius:6, padding:'10px 14px', marginBottom:12}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:700,
                      color:b.color, letterSpacing:'0.08em', marginRight:8}}>ADD WHEN</span>
                    <span style={{fontSize:11, color:'#444'}}>{b.addWhen}</span>
                  </div>
                  {/* Full quad compat grid */}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6}}>
                    {['Q1','Q2','Q3','Q4'].map(q => {
                      const compat = b.quadCompatibility[q];
                      const cm = QUAD_COMPAT_META[compat];
                      const qd = window.HE.QUADS[q];
                      return (
                        <div key={q} style={{background:cm.bg, border:`1px solid ${cm.color}30`,
                          borderRadius:5, padding:'8px 10px', textAlign:'center'}}>
                          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:16, fontWeight:700,
                            color:qd.color, marginBottom:2}}>{q}</div>
                          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:700,
                            color:cm.color}}>{cm.label}</div>
                          <div style={{fontSize:9, color:'#9A9790', marginTop:3, lineHeight:1.3}}>{qd.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Positioning chart */}
                <div style={{width:240, flexShrink:0}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                    textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, textAlign:'center'}}>
                    Positioning
                  </div>
                  <BucketPositioningChart activeBucketKey={expandedBucket} />
                </div>
              </div>
            );
          })()}

          <div style={{fontSize:11, color:'#9A9790', lineHeight:1.8, maxWidth:520}}>
            Enter any ticker to check SSS qualification, assign a bucket, score
            quad timing, and receive an actionability verdict.
          </div>
        </div>
      )}

      {showResults && (
        <>
          {/* ── Verdict banner ── */}
          <div style={{
            background: verdict.bg,
            border: `1px solid ${verdict.border}`,
            borderLeft: `4px solid ${verdict.border}`,
            borderRadius: 8, padding: '14px 20px', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{flex: 1}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.12em', color:verdict.color, marginBottom:4}}>
                Sam's Actionability Verdict
              </div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:22, fontWeight:700,
                color:verdict.color, lineHeight:1, marginBottom:5}}>
                {verdict.label}
              </div>
              <div style={{fontSize:12, color:'#444', lineHeight:1.5}}>{verdict.desc}</div>
            </div>
            <div style={{textAlign:'right', flexShrink:0}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:32, fontWeight:700,
                color:'#1A1A18', lineHeight:1}}>{ticker}</div>
              {fmpData?.name && (
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#7A7770', marginTop:2,
                  maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {fmpData.name}
                </div>
              )}
              {priceData && (
                <div style={{marginTop:5, fontFamily:'IBM Plex Mono,monospace', fontSize:16, fontWeight:700, color:'#1A1A18'}}>
                  ${priceData.regularMarketPrice?.toFixed(2)}
                  <span style={{fontSize:11, marginLeft:8, fontWeight:600,
                    color: priceData.regularMarketChangePercent >= 0 ? '#27500A' : '#C8302A'}}>
                    {priceData.regularMarketChangePercent >= 0 ? '+' : ''}
                    {priceData.regularMarketChangePercent?.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Portfolio Signals Row ── */}
          {showResults && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12}}>

              {/* Timeframe */}
              <div style={{background: timeframeMeta ? timeframeMeta.bg : '#F9F8F5',
                border:`1px solid ${timeframeMeta ? timeframeMeta.color+'30' : '#E4E1DA'}`,
                borderRadius:8, padding:'12px 14px'}}>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:600,
                  letterSpacing:'0.1em', color:'#9A9790', textTransform:'uppercase', marginBottom:6}}>
                  Timeframe
                </div>
                {timeframeMeta ? (
                  <>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700,
                      color:timeframeMeta.color, marginBottom:4}}>{timeframeMeta.label}</div>
                    <div style={{fontSize:9, color:'#555', lineHeight:1.5}}>{timeframeMeta.desc}</div>
                  </>
                ) : (
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8C5BE'}}>—</div>
                )}
              </div>

              {/* Risk Range */}
              <div style={{background:'#F9F8F5', border:'1px solid #E4E1DA', borderRadius:8, padding:'12px 14px'}}>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:600,
                  letterSpacing:'0.1em', color:'#9A9790', textTransform:'uppercase', marginBottom:6}}>
                  Risk Range
                </div>
                {levelData ? (
                  <div style={{display:'flex', flexDirection:'column', gap:4}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:700,
                      color: levelSig === 'BULLISH' ? '#27500A' : '#C8302A'}}>
                      {levelSig || '—'}
                    </div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#7A7770'}}>
                      LRR <span style={{fontWeight:700, color:'#1A1A18'}}>{levelLrr ?? '—'}</span>
                      {'  '}TRR <span style={{fontWeight:700, color:'#1A1A18'}}>{levelTrr ?? '—'}</span>
                    </div>
                    {levelClose != null && levelLrrN > 0 && (
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790'}}>
                        Close <span style={{fontWeight:700, color:'#1A1A18'}}>{levelClose}</span>
                        <span style={{marginLeft:6, color: levelClose >= levelLrrN ? '#27500A' : '#C8302A', fontWeight:700}}>
                          {levelClose >= levelTrrN ? '▲ ABOVE TRR'
                           : levelClose >= levelLrrN ? '✓ IN RANGE'
                           : '▼ BELOW LRR'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#C8C5BE', lineHeight:1.6}}>
                    No levels in tracker
                  </div>
                )}
              </div>

              {/* HAM Holdings */}
              <div style={{background:'#F9F8F5', border:'1px solid #E4E1DA', borderRadius:8, padding:'12px 14px'}}>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:600,
                  letterSpacing:'0.1em', color:'#9A9790', textTransform:'uppercase', marginBottom:6}}>
                  HAM Portfolios
                </div>
                {hamEntry ? (
                  <div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700,
                      color:'#27500A', marginBottom:5}}>
                      HELD ✓
                    </div>
                    {Object.entries(hamEntry.accounts ?? {}).map(([fund, wt]) => (
                      <div key={fund} style={{display:'flex', justifyContent:'space-between',
                        fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#555', marginBottom:2}}>
                        <span style={{fontWeight:700}}>{fund}</span>
                        <span>{(wt*100).toFixed(2)}%</span>
                      </div>
                    ))}
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                      marginTop:5, borderTop:'1px solid #EEECE8', paddingTop:4}}>
                      Total {HE.hamWeight(hamEntry)}
                    </div>
                  </div>
                ) : (
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8C5BE'}}>
                    Not in HAM ETFs
                  </div>
                )}
              </div>

              {/* Investing Idea */}
              <div style={{
                background: ideaDir === 'LONG' ? '#EAF3DE' : ideaDir === 'SHORT' ? '#FCEBEB' : '#F9F8F5',
                border:`1px solid ${ideaDir === 'LONG' ? '#7AB648' : ideaDir === 'SHORT' ? '#E07070' : '#E4E1DA'}`,
                borderRadius:8, padding:'12px 14px'}}>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:600,
                  letterSpacing:'0.1em', color:'#9A9790', textTransform:'uppercase', marginBottom:6}}>
                  Investing Idea
                </div>
                {ideaDir ? (
                  <>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:700,
                      color: ideaDir === 'LONG' ? '#27500A' : ideaDir === 'SHORT' ? '#C8302A' : '#B8860B',
                      marginBottom:5}}>
                      {ideaDir}
                    </div>
                    {ideaThesis && (
                      <div style={{fontSize:9, color:'#555', lineHeight:1.55}}>{ideaThesis}</div>
                    )}
                  </>
                ) : (
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8C5BE'}}>
                    No active idea
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── Three analysis cards ── */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12}}>

            {/* Card 1 — SSS Status */}
            <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:16}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:12}}>
                1 · Signal Strength Status
              </div>
              {isOnSss ? (
                <>
                  <div style={{display:'inline-flex', alignItems:'center', gap:6, background:'#EAF3DE',
                    border:'1px solid #7AB648', borderRadius:4, padding:'4px 10px', marginBottom:14}}>
                    <span style={{width:6, height:6, borderRadius:'50%', background:'#27500A',
                      display:'inline-block', flexShrink:0}} />
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:700,
                      color:'#27500A'}}>QUALIFIED</span>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    {[
                      ['Analyst',        sssTickerDetail?.analyst ?? null],
                      ['Sector',         sssTickerDetail?.sector ?? null],
                      ['Days on Signal', sssTickerDetail?.days_on_list != null ? `${sssTickerDetail.days_on_list}d` : null],
                      ['Signal Date',    sssTickerDetail?.signal_date ?? null],
                      ['Signal Price',   sssTickerDetail?.entry_price != null ? `$${sssTickerDetail.entry_price.toFixed(2)}` : null],
                    ].map(([label, val]) => (
                      <div key={label} style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
                        <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790', flexShrink:0}}>
                          {label}
                        </span>
                        <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600,
                          color:'#1A1A18', textAlign:'right'}}>
                          {val ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{display:'inline-flex', alignItems:'center', gap:6, background:'#F5F3EF',
                    border:'1px solid #C8C5BE', borderRadius:4, padding:'4px 10px', marginBottom:14}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:700,
                      color:'#9A9790'}}>NOT QUALIFIED</span>
                  </div>
                  <div style={{fontSize:11, color:'#7A7770', lineHeight:1.65, marginBottom:12}}>
                    <strong style={{color:'#1A1A18'}}>{ticker}</strong> is not currently on the
                    Hedgeye Signal Strength list. Sam's process requires SSS qualification
                    before any position entry.
                  </div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
                    borderTop:'1px solid #F5F3EF', paddingTop:10}}>
                    {macroCtx?.pdf?.sss?.count ?? 0} tickers currently qualified on SSS
                  </div>
                </>
              )}
            </div>

            {/* Card 2 — Bucket */}
            <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:16}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:12}}>
                2 · Sam's Bucket Classification
              </div>
              {bucket ? (
                <>
                  <div style={{background:bucket.bg, border:`1px solid ${bucket.border}`, borderRadius:6,
                    padding:'10px 14px', marginBottom:12}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:18, fontWeight:700,
                      color:bucket.color, lineHeight:1, marginBottom:3}}>
                      {bucket.label.toUpperCase()}
                    </div>
                    <div style={{fontSize:10, color:bucket.color, fontWeight:500}}>{bucket.desc}</div>
                  </div>
                  <div style={{fontSize:11, color:'#555', lineHeight:1.7, marginBottom:10}}>
                    {bucket.sub}
                  </div>
                  {/* Add-when box */}
                  <div style={{background:bucket.bg, borderRadius:5, padding:'8px 10px', marginBottom:10}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:700,
                      color:bucket.color, letterSpacing:'0.08em', marginRight:6}}>ADD WHEN</span>
                    <span style={{fontSize:10, color:'#444', lineHeight:1.5}}>{bucket.addWhen}</span>
                  </div>
                  {/* Quad compat 2×2 */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:10}}>
                    {['Q1','Q2','Q3','Q4'].map(q => {
                      const compat = bucket.quadCompatibility[q];
                      const cm = QUAD_COMPAT_META[compat];
                      const qd = window.HE.QUADS[q];
                      const isActive = q === currentQuad;
                      return (
                        <div key={q} style={{background: isActive ? cm.bg : '#F9F8F5',
                          border:`1px solid ${isActive ? cm.color+'40' : '#E4E1DA'}`,
                          borderRadius:4, padding:'4px 8px',
                          display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:700,
                            color: isActive ? qd.color : '#9A9790'}}>{q}</span>
                          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:700,
                            color: isActive ? cm.color : '#C8C5BE'}}>{cm.label.slice(0,3)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{borderTop:'1px solid #F5F3EF', paddingTop:10, display:'flex',
                    flexDirection:'column', gap:5}}>
                    {Object.entries(BUCKETS).filter(([k]) => k !== bucketKey).map(([k, b]) => (
                      <div key={k} style={{display:'flex', alignItems:'center', gap:7}}>
                        <span style={{width:7, height:7, borderRadius:1, background:'#E4E1DA',
                          display:'inline-block', flexShrink:0}} />
                        <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#C8C5BE',
                          fontWeight:600, minWidth:90}}>{b.label.toUpperCase()}</span>
                        <span style={{fontSize:9, color:'#C8C5BE'}}>{b.desc.split(',')[0]}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{color:'#9A9790', fontSize:11, lineHeight:1.7}}>
                  Could not classify <strong style={{color:'#1A1A18'}}>{ticker}</strong> into a bucket.
                  Bucket assignment uses known tickers and Hedgeye sector data.
                </div>
              )}
            </div>

            {/* Card 3 — Quad Alignment */}
            <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:16}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:12}}>
                3 · Quad Alignment
              </div>
              {/* Current quad pill */}
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
                <div style={{background:quadDef.bg, border:`1px solid ${quadDef.color}`, borderRadius:6,
                  padding:'6px 14px', flexShrink:0}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:quadDef.color,
                    letterSpacing:'0.1em', marginBottom:1}}>CURRENT</div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:22, fontWeight:700,
                    color:quadDef.color, lineHeight:1}}>{currentQuad}</div>
                </div>
                <div>
                  <div style={{fontSize:12, fontWeight:600, color:'#1A1A18'}}>{quadDef.name}</div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
                    marginTop:2}}>{quadDef.desc}</div>
                </div>
              </div>

              {hedgeyeSector ? (
                <>
                  <div style={{background:fitMeta.bg, border:`1px solid ${fitMeta.color}20`,
                    borderLeft:`3px solid ${fitMeta.color}`,
                    borderRadius:4, padding:'7px 10px', marginBottom:10,
                    display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700,
                      color:fitMeta.color}}>{fitMeta.label}</span>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                      color:fitMeta.color, opacity:0.8}}>{hedgeyeSector}</span>
                  </div>
                  {/* All quads mini-grid */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:10}}>
                    {['Q1','Q2','Q3','Q4'].map(q => {
                      const fit  = SECTOR_QUAD[hedgeyeSector]?.[q] || 'neutral';
                      const meta = FIT_META[fit];
                      const qd   = window.HE.QUADS[q];
                      const isActive = q === currentQuad;
                      return (
                        <div key={q} style={{
                          background: isActive ? meta.bg : '#F9F8F5',
                          border: `1px solid ${isActive ? meta.color + '40' : '#E4E1DA'}`,
                          borderRadius:4, padding:'4px 8px',
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                        }}>
                          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:700,
                            color: isActive ? qd.color : '#9A9790'}}>{q}</span>
                          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8,
                            color: isActive ? meta.color : '#C8C5BE', fontWeight:600}}>
                            {fit === 'best' ? '✓' : fit === 'worst' ? '✗' : '–'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:4}}>
                    <div>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#27500A',
                        fontWeight:700}}>BEST · </span>
                      <span style={{fontSize:10, color:'#555'}}>{quadDef.bestSectors}</span>
                    </div>
                    <div>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#C8302A',
                        fontWeight:700}}>AVOID · </span>
                      <span style={{fontSize:10, color:'#555'}}>{quadDef.worstSectors}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{fontSize:11, color:'#7A7770', lineHeight:1.65}}>
                  Sector mapping requires SSS qualification or FMP data.
                  <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:4}}>
                    <div>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#27500A',
                        fontWeight:700}}>BEST · </span>
                      <span style={{fontSize:10, color:'#555'}}>{quadDef.bestSectors}</span>
                    </div>
                    <div>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#C8302A',
                        fontWeight:700}}>AVOID · </span>
                      <span style={{fontSize:10, color:'#555'}}>{quadDef.worstSectors}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Bucket Positioning Chart ── */}
          {bucketKey && (
            <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8,
              padding:16, marginBottom:12, display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap'}}>
              <div style={{flex:1, minWidth:200}}>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                  textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:10}}>
                  Bucket Positioning — Growth Dependency vs Macro Sensitivity
                </div>
                <div style={{fontSize:11, color:'#555', lineHeight:1.7}}>
                  {bucket.detail}
                </div>
              </div>
              <div style={{width:260, flexShrink:0}}>
                <BucketPositioningChart activeBucketKey={bucketKey} />
              </div>
            </div>
          )}

          {/* ── Fundamentals (Pod 1 Signal) ── */}
          {fmpData && (
            <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:16, marginBottom:12}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:14}}>
                Fundamentals
              </div>

              {/* Revenue Acceleration — Pod 1 signal, most prominent */}
              {fmpData.revenueGrowths?.length > 0 ? (
                <div style={{marginBottom:14, padding:'12px 14px', borderRadius:6,
                  background: fmpData.revAccelerating === true  ? '#EAF3DE'
                            : fmpData.revAccelerating === false ? '#FCEBEB' : '#F9F8F5',
                  border: `1px solid ${fmpData.revAccelerating === true  ? '#7AB648'
                                     : fmpData.revAccelerating === false ? '#E07070' : '#E4E1DA'}`}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                    textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>
                    Revenue Growth (QoQ) — Pod 1 Signal
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:12}}>
                      {fmpData.revenueGrowths.map((g, i) => (
                        <React.Fragment key={i}>
                          <span style={{color: g > 0 ? '#27500A' : '#C8302A', fontWeight:700}}>
                            {g > 0 ? '+' : ''}{g.toFixed(1)}%
                          </span>
                          {i < fmpData.revenueGrowths.length - 1 && (
                            <span style={{color:'#C8C5BE', margin:'0 8px'}}>→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    {fmpData.revAccelerating !== null && (
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:700,
                        color: fmpData.revAccelerating ? '#27500A' : '#C8302A'}}>
                        {fmpData.revAccelerating ? 'ACCELERATING ↑' : 'DECELERATING ↓'}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Metrics grid */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:8}}>
                {fmpData.totalEpsQ > 0 && (
                  <div style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                      textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3}}>EPS vs Estimate</div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:14, fontWeight:700,
                      color: fmpData.beats >= Math.ceil(fmpData.totalEpsQ * 0.75) ? '#27500A'
                           : fmpData.beats <= Math.floor(fmpData.totalEpsQ * 0.25) ? '#C8302A' : '#1A1A18'}}>
                      Beat {fmpData.beats} of {fmpData.totalEpsQ}
                    </div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790', marginTop:2}}>
                      last {fmpData.totalEpsQ} quarters
                    </div>
                  </div>
                )}
                {fmpData.weekHigh52 != null && fmpData.weekLow52 != null && (() => {
                  const rng = fmpData.weekHigh52 - fmpData.weekLow52;
                  const pos = rng > 0 ? ((fmpData.price - fmpData.weekLow52) / rng * 100) : null;
                  return (
                    <div style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                        textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3}}>52-Week Position</div>
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:14, fontWeight:700, color:'#1A1A18'}}>
                        {pos != null ? `${pos.toFixed(0)}% of range` : '—'}
                      </div>
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790', marginTop:2}}>
                        L: ${fmpData.weekLow52?.toFixed(2)} · H: ${fmpData.weekHigh52?.toFixed(2)}
                      </div>
                    </div>
                  );
                })()}
                {fmpData.mktCap != null && (
                  <div style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                      textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3}}>Market Cap</div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:14, fontWeight:700, color:'#1A1A18'}}>
                      {fmtMktCap(fmpData.mktCap)}
                    </div>
                  </div>
                )}
                {fmpData.pe != null && (
                  <div style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                      textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3}}>P/E</div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:14, fontWeight:700, color:'#1A1A18'}}>
                      {Number(fmpData.pe).toFixed(0)}x
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Price & Valuation ── */}
          <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:16}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.12em', color:'#7A7770', marginBottom:14}}>
              Live Price — {ticker}{fmpData?.exchange ? ` · ${fmpData.exchange}` : ''}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8}}>
              {[
                ['Price',      priceData ? `$${priceData.regularMarketPrice?.toFixed(2)}` : '—', null],
                ['Day Change', priceData
                  ? `${priceData.regularMarketChangePercent >= 0 ? '+' : ''}${priceData.regularMarketChangePercent?.toFixed(2)}%`
                  : '—',
                  priceData ? (priceData.regularMarketChangePercent >= 0 ? '#27500A' : '#C8302A') : null],
                ['Prev Close', priceData ? `$${priceData.regularMarketPreviousClose?.toFixed(2)}` : '—', null],
                ['Day High',   priceData ? `$${priceData.regularMarketDayHigh?.toFixed(2)}`  : '—', null],
                ['Day Low',    priceData ? `$${priceData.regularMarketDayLow?.toFixed(2)}`   : '—', null],
              ].map(([label, val, color]) => (
                <div key={label} style={{background:'#F9F8F5', borderRadius:6, padding:'10px 12px'}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                    textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3}}>{label}</div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:15, fontWeight:700,
                    color: color || '#1A1A18'}}>{val}</div>
                </div>
              ))}
            </div>
            {fmpErr && (
              <div style={{marginTop:10, borderTop:'1px solid #F5F3EF', paddingTop:8,
                fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#C8302A'}}>
                {fmpErr}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
// ── end he_analyzer inline ────────────────────────────────────────────────

// he_sizing.jsx — Position Sizing tab
// Reads position_sizing block from macro_context.json
// Data built by scripts/parse_position_sizing.py from Portfolio Solutions PDFs + ETF Pro rank table
// Key rule: positions ranked above HYG (rank 21) are confirmed above 3%

const SizingTab = ({ macroCtx }) => {
  const [sortBy, setSortBy] = React.useState('rank');   // 'rank' | 'size' | 'room'
  const [filter, setFilter]  = React.useState('all');   // 'all' | 'above' | 'below'

  const ps = macroCtx?.position_sizing;
  if (!ps) return (
    <div style={{padding:40,textAlign:'center',color:'#999',fontFamily:'IBM Plex Mono,monospace',fontSize:13}}>
      No position sizing data — run scripts/parse_position_sizing.py
    </div>
  );

  const { positions = [], threshold_ticker, threshold_rank, threshold_pct, threshold_note, as_of_date } = ps;
  // Include all ranked positions; estimated_pct may be null if parser couldn't extract a %
  const active = positions.filter(p => p.rank != null);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sorted = [...active].sort((a, b) => {
    if (sortBy === 'size') return (b.estimated_pct ?? 0) - (a.estimated_pct ?? 0);
    if (sortBy === 'room') return (b.room_to_add ?? 0) - (a.room_to_add ?? 0);
    return a.rank - b.rank;
  });

  const filtered = filter === 'above' ? sorted.filter(p => p.above_hyg_threshold)
                 : filter === 'below' ? sorted.filter(p => !p.above_hyg_threshold)
                 : sorted;

  // ── Portfolio summary ──────────────────────────────────────────────────────
  const totalDeployed  = active.reduce((s, p) => s + (p.estimated_pct ?? 0), 0);
  const aboveThreshold = active.filter(p => p.above_hyg_threshold).length;
  const avgFill        = null; // fill_pct not available in current data schema

  // ── Helpers ────────────────────────────────────────────────────────────────
  const TIER_STYLE = {
    max: { bg:'#276749', color:'#fff',    label:'MAX' },
    mid: { bg:'#D97706', color:'#fff',    label:'MID' },
    min: { bg:'#E2E8F0', color:'#4A5568', label:'MIN' },
  };

  const dirIcon = d =>
    d === 'adding'   ? <span style={{color:'#276749',fontWeight:700}}>↑</span>
  : d === 'trimming' ? <span style={{color:'#C53030',fontWeight:700}}>↓</span>
  : d === 'closed'   ? <span style={{color:'#999'}}>✕</span>
  :                    <span style={{color:'#ccc'}}>—</span>;

  const rkIcon = v =>
    v == null  ? <span style={{color:'#ccc',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>—</span>
  : v > 0      ? <span style={{color:'#276749',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>↑{v}</span>
  : v < 0      ? <span style={{color:'#C53030',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>↓{Math.abs(v)}</span>
  :              <span style={{color:'#999',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>—</span>;

  const fmtDate = d => d ? d.slice(5).replace('-','/') : '—';

  // ── Size bar component ─────────────────────────────────────────────────────
  const SizeBar = ({ p }) => {
    const { min_pct, max_pct, estimated_pct, size_source, above_hyg_threshold } = p;
    if (max_pct === 0 || estimated_pct == null) return null;
    const fillPct  = Math.min(100, (estimated_pct / max_pct) * 100);
    const minMark  = (min_pct / max_pct) * 100;
    const barColor = above_hyg_threshold ? '#276749' : '#718096';
    const isFloor  = size_source === 'rank_floor';

    return (
      <div style={{display:'flex',alignItems:'center',gap:6,minWidth:160}}>
        {/* Bar track */}
        <div style={{flex:1,position:'relative',height:8,borderRadius:4,
          background:'#E2E8F0',overflow:'visible'}}>
          {/* Min marker */}
          <div style={{position:'absolute',left:`${minMark}%`,top:-2,width:2,height:12,
            background:'#A0AEC0',borderRadius:1,zIndex:2}} title={`Min: ${min_pct}%`} />
          {/* Fill */}
          <div style={{position:'absolute',left:0,top:0,height:'100%',
            width:`${fillPct}%`,borderRadius:4,
            background: isFloor ? `repeating-linear-gradient(45deg,${barColor},${barColor} 3px,${barColor}aa 3px,${barColor}aa 6px)` : barColor,
            transition:'width 0.4s ease'}} />
        </div>
        {/* Label */}
        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,
          color: above_hyg_threshold ? '#276749' : '#4A5568',
          fontWeight:600,minWidth:38,textAlign:'right'}}>
          {estimated_pct.toFixed(1)}%
          {isFloor && <span style={{fontSize:9,color:'#999',marginLeft:2}}>≥</span>}
        </span>
      </div>
    );
  };

  // ── Size anchor divider (dynamic — based on current minimum-sized position) ──
  const AnchorDivider = () => (
    <tr>
      <td colSpan={9} style={{padding:'4px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{flex:1,height:1,background:'#C53030',opacity:0.35}} />
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
            color:'#C53030',fontWeight:700,whiteSpace:'nowrap',letterSpacing:'0.08em'}}>
            ▼ {threshold_ticker || 'ANCHOR'} AT MIN ({threshold_pct || '—'}%) — BELOW THIS: UNDER {threshold_pct || '—'}%
          </span>
          <div style={{flex:1,height:1,background:'#C53030',opacity:0.35}} />
        </div>
      </td>
    </tr>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const COL = { color:'#718096', fontSize:10, fontFamily:'IBM Plex Mono,monospace',
                letterSpacing:'0.06em', textTransform:'uppercase', padding:'6px 10px',
                whiteSpace:'nowrap', userSelect:'none' };
  const SortBtn = ({ field, label }) => (
    <span onClick={() => setSortBy(field)} style={{
      ...COL, cursor:'pointer',
      color: sortBy === field ? '#1A1A18' : '#718096',
      borderBottom: sortBy === field ? '2px solid #1A1A18' : '2px solid transparent',
    }}>{label}</span>
  );

  let hygDividerShown = false;

  return (
    <div style={{fontFamily:'IBM Plex Sans,sans-serif',padding:'0 0 40px'}}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{padding:'20px 20px 12px',borderBottom:'1px solid #E2E8F0'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:'#1A1A18',marginBottom:4}}>
              Position Sizing Tracker
            </div>
            <div style={{fontSize:11,color:'#718096',fontFamily:'IBM Plex Mono,monospace'}}>
              Source: Portfolio Solutions commentary + ETF Pro rank &nbsp;·&nbsp; as of {as_of_date}
            </div>
          </div>
          {/* Summary pills */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              { label:'Active Positions', value: active.length },
              { label:'Above 3% Threshold', value: aboveThreshold, color:'#276749' },
              { label:'Avg Fill', value: avgFill != null ? avgFill+'%' : '—' },
              { label:'Total Deployed', value: totalDeployed > 0 ? totalDeployed.toFixed(1)+'%' : '—' },
            ].map(pill => (
              <div key={pill.label} style={{background:'#fff',border:'1px solid #E2E8F0',
                borderRadius:6,padding:'6px 12px',textAlign:'center',minWidth:100}}>
                <div style={{fontSize:18,fontWeight:700,color:pill.color||'#1A1A18',
                  fontFamily:'IBM Plex Mono,monospace',lineHeight:1}}>
                  {pill.value}
                </div>
                <div style={{fontSize:9,color:'#999',marginTop:2,letterSpacing:'0.06em',
                  textTransform:'uppercase'}}>{pill.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic threshold callout */}
        {threshold_ticker && (
          <div style={{marginTop:12,padding:'8px 12px',background:'#FFFBEB',border:'1px solid #FCD34D',
            borderRadius:6,fontSize:11,color:'#92400E',fontFamily:'IBM Plex Mono,monospace',
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:14}}>⚡</span>
            <span>
              <strong>Today's anchor:</strong> {threshold_ticker} (rank #{threshold_rank}) is at minimum ({threshold_pct}%).
              &nbsp;Positions ranked above it are confirmed &gt;{threshold_pct}%.
              &nbsp;This anchor shifts daily as Keith adds/trims.
              &nbsp;Hatched bars = rank-floor estimate · Solid = confirmed from commentary.
            </span>
          </div>
        )}

        {/* Filter + sort controls */}
        <div style={{marginTop:12,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:4}}>
            {[['all','All'],['above','Above 3%'],['below','Below 3%']].map(([val,label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                padding:'4px 10px',border:'1px solid #E2E8F0',borderRadius:4,cursor:'pointer',
                fontSize:11,background: filter===val ? '#1A1A18' : '#fff',
                color: filter===val ? '#fff' : '#4A5568',
              }}>{label}</button>
            ))}
          </div>
          <div style={{fontSize:10,color:'#999',marginLeft:'auto'}}>
            Sort by: <SortBtn field="rank" label="Rank" /> <SortBtn field="size" label="Size" /> <SortBtn field="room" label="Room" />
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'#F8F7F4',borderBottom:'2px solid #E2E8F0'}}>
              <th style={{...COL,textAlign:'left'}}>Rank</th>
              <th style={{...COL,textAlign:'left'}}>Ticker</th>
              <th style={{...COL,textAlign:'left'}}>Class</th>
              <th style={{...COL,textAlign:'left',minWidth:200}}>Size ← min · max →</th>
              <th style={{...COL,textAlign:'center'}}>Tier</th>
              <th style={{...COL,textAlign:'center'}}>1W ▲▼</th>
              <th style={{...COL,textAlign:'center'}}>Dir</th>
              <th style={{...COL,textAlign:'right'}}>Room</th>
              <th style={{...COL,textAlign:'right'}}>Entry</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const ts = TIER_STYLE[p.tier] || TIER_STYLE.min;
              const showDivider = !hygDividerShown && threshold_rank && p.rank > threshold_rank && sortBy === 'rank' && filter !== 'above';
              if (showDivider) hygDividerShown = true;

              return (
                <React.Fragment key={p.ticker}>
                  {showDivider && <AnchorDivider />}
                  <tr style={{
                    borderBottom:'1px solid #EEF0F0',
                    background: p.above_hyg_threshold ? 'rgba(39,103,73,0.03)' : '#fff',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F4F3EF'}
                  onMouseLeave={e => e.currentTarget.style.background =
                    p.above_hyg_threshold ? 'rgba(39,103,73,0.03)' : '#fff'}>

                    {/* Rank */}
                    <td style={{padding:'9px 10px',fontFamily:'IBM Plex Mono,monospace',
                      fontSize:11,color:'#999'}}>
                      {p.rank}
                    </td>

                    {/* Ticker */}
                    <td style={{padding:'9px 10px'}}>
                      <span style={{fontWeight:700,fontSize:13,letterSpacing:'0.02em',
                        color:'#1A1A18'}}>
                        {p.ticker}
                      </span>
                    </td>

                    {/* Class */}
                    <td style={{padding:'9px 10px',fontSize:11,color:'#718096',whiteSpace:'nowrap'}}>
                      {p.asset_class}
                    </td>

                    {/* Size bar */}
                    <td style={{padding:'9px 10px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                          color:'#999',minWidth:22,textAlign:'right'}}>
                          {p.min_pct}%
                        </span>
                        <SizeBar p={p} />
                        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                          color:'#999',minWidth:22}}>
                          {p.max_pct}%
                        </span>
                      </div>
                    </td>

                    {/* Tier badge */}
                    <td style={{padding:'9px 10px',textAlign:'center'}}>
                      <span style={{display:'inline-block',padding:'2px 7px',borderRadius:4,
                        fontSize:10,fontWeight:700,fontFamily:'IBM Plex Mono,monospace',
                        letterSpacing:'0.06em',background:ts.bg,color:ts.color}}>
                        {ts.label}
                      </span>
                    </td>

                    {/* 1W re-rank */}
                    <td style={{padding:'9px 10px',textAlign:'center'}}>
                      {rkIcon(p.rerank_1w)}
                    </td>

                    {/* Direction */}
                    <td style={{padding:'9px 10px',textAlign:'center',fontSize:14}}>
                      {dirIcon(p.last_direction)}
                    </td>

                    {/* Room */}
                    <td style={{padding:'9px 10px',textAlign:'right',
                      fontFamily:'IBM Plex Mono,monospace',fontSize:11,
                      color: p.room_to_add > 2 ? '#276749' : '#999'}}>
                      {p.room_to_add != null ? `+${p.room_to_add.toFixed(1)}%` : '—'}
                    </td>

                    {/* Entry date */}
                    <td style={{padding:'9px 10px',textAlign:'right',
                      fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#999'}}>
                      {fmtDate(p.entry_date)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div style={{padding:'16px 20px',borderTop:'1px solid #E2E8F0',marginTop:8,
        display:'flex',gap:24,flexWrap:'wrap',fontSize:10,color:'#999',
        fontFamily:'IBM Plex Mono,monospace'}}>
        <span>■ <span style={{color:'#276749'}}>GREEN</span> = above anchor (≥{threshold_pct != null ? threshold_pct : '—'}%)</span>
        <span>■ <span style={{color:'#718096'}}>GRAY</span> = below threshold (&lt;3%)</span>
        <span>╱╱ HATCHED = rank-floor estimate (exact bps not in parsed PDFs)</span>
        <span>MIN marker = vertical line in bar</span>
        <span>↑ DIR = last commentary move was an add &nbsp;·&nbsp; ↓ = trim</span>
        <span style={{marginLeft:'auto'}}>
          {ps.source_pdfs} PDFs parsed &nbsp;·&nbsp; {positions.length} ranked positions
        </span>
      </div>
    </div>
  );
};

// ── MAIN APP ───────────────────────────────────────────────────────
const App = () => {
  const [tweaks, setTweaks]         = React.useState(initTweaks);
  const [tab, setTab]               = React.useState('overview');
  const [showTweaks, setShowTweaks] = React.useState(false);
  const [openPdf, setOpenPdf]       = React.useState(null);
  const [macroCtx, setMacroCtx]     = React.useState(null);
  const [researchSource, setResearchSource] = React.useState(
    () => window.HE.loadQuadState().researchSource || null
  );
  const [newResearchReady, setNewResearchReady] = React.useState(false);
  const deployedAtRef = React.useRef(null);
  const navRef        = React.useRef(null);

  // Load macro_context.json and auto-initialize tweaks from pipeline data
  React.useEffect(() => {
    fetch('./data/macro_context.json')
      .then(r => r.json())
      .then(data => {
        setMacroCtx(data);
        const ms = data.pdf?.macro_show || {};
        const qQuart = ms.quad?.quarterly;
        const qMo    = ms.quad?.monthly;
        const usd    = data.levels?.USD?.signal?.toUpperCase();
        const btc    = data.pdf?.btc?.btc_signal;
        setTweaks(t => ({
          ...t,
          ...(qQuart != null ? { quarterlyQuad: 'Q' + qQuart } : {}),
          ...(qMo    != null ? { monthlyQuad:   'Q' + qMo    } :
              qQuart != null ? { monthlyQuad:   'Q' + qQuart } : {}),
          ...(usd ? { usdSignal: usd } : {}),
          ...(btc ? { btcSignal: btc } : {}),
        }));
        setResearchSource('macro_context.json');
      })
      .catch(() => {});
  }, []);

  // Auto-refresh: poll version.json every 60s; show banner when new deploy detected
  React.useEffect(() => {
    const checkVersion = () => {
      fetch('./data/version.json?_=' + Date.now())
        .then(r => r.json())
        .then(v => {
          if (!deployedAtRef.current) {
            deployedAtRef.current = v.deployed_at;
          } else if (v.deployed_at !== deployedAtRef.current) {
            setNewResearchReady(true);
          }
        })
        .catch(() => {});
    };
    checkVersion();
    const iv = setInterval(checkVersion, 60000);
    return () => clearInterval(iv);
  }, []);

  // Tweaks host integration
  React.useEffect(() => {
    window.addEventListener('message', e => {
      if (e.data?.type === '__activate_edit_mode')   setShowTweaks(true);
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false);
    });
    window.parent.postMessage({type:'__edit_mode_available'}, '*');
  }, []);

  // React to quad updates emitted by the Ingest tab
  React.useEffect(() => {
    const handler = (e) => {
      const { monthly, quarterly, researchSource: src } = e.detail || {};
      setTweaks(t => ({
        ...t,
        ...(quarterly ? { quarterlyQuad: quarterly } : {}),
        ...(monthly   ? { monthlyQuad:   monthly   } : {}),
      }));
      if (src) setResearchSource(src);
    };
    window.addEventListener('he_quad_updated', handler);
    return () => window.removeEventListener('he_quad_updated', handler);
  }, []);

  const setTweak = (k, v) => {
    setTweaks(t => ({ ...t, [k]: v }));
    // Persist to localStorage
    const patch = {};
    if      (k === 'quarterlyQuad') patch.quarterly   = v;
    else if (k === 'monthlyQuad')   patch.monthly     = v;
    else if (k === 'usdSignal')     patch.usdSignal   = v;
    else if (k === 'btcSignal')     patch.btcSignal   = v;
    else if (k === 'myPositions')   patch.myPositions = v;
    else if (k === 'fmpKey')        patch.fmpKey      = v;
    window.HE.saveQuadState(patch);
    window.parent.postMessage({type:'__edit_mode_set_keys', edits:{[k]:v}}, '*');
  };

  const handleQuadUpdate = ({ monthly, quarterly, source }) => {
    if (quarterly) setTweak('quarterlyQuad', quarterly);
    if (monthly)   setTweak('monthlyQuad',   monthly);
    if (source)    setResearchSource(source);
  };

  const TABS = [
    {id:'overview',  label:'Overview'},
    {id:'market',    label:'Live Market'},
    {id:'rta',       label:'RTA History'},
    {id:'ham',       label:'HAM Holdings'},
    {id:'signals',   label:'Signal Strength'},
    {id:'riskrange', label:'Risk Range'},
    {id:'analyzer',  label:'Stock Analyzer'},
    {id:'etfpro',    label:'ETF Pro'},
    {id:'sizing',    label:'Position Sizing'},
    {id:'vol',       label:'Volatility'},
    {id:'research',  label:'Daily Brief'},
    {id:'ingest',   label:'Research Status'},
  ];

  const today = new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});

  return (
    <div style={{minHeight:'100vh',background:'#F4F3EF',color:'#1A1A18',fontFamily:'IBM Plex Sans,sans-serif'}}>
      {/* NEW RESEARCH BANNER */}
      {newResearchReady && (
        <div style={{position:'fixed',bottom:20,right:20,zIndex:9999,
          background:'#1A4D8F',color:'#fff',borderRadius:8,padding:'12px 18px',
          display:'flex',alignItems:'center',gap:12,boxShadow:'0 4px 16px rgba(0,0,0,0.25)',
          fontFamily:'IBM Plex Mono,monospace',fontSize:12}}>
          <span>🔄 New research deployed</span>
          <button onClick={() => window.location.reload()}
            style={{background:'#fff',color:'#1A4D8F',border:'none',borderRadius:4,
              padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer',
              fontFamily:'IBM Plex Mono,monospace'}}>
            Refresh
          </button>
          <button onClick={() => setNewResearchReady(false)}
            style={{background:'none',border:'none',color:'rgba(255,255,255,0.6)',
              cursor:'pointer',fontSize:14,padding:'0 2px',lineHeight:1}}>
            ×
          </button>
        </div>
      )}
      {/* HEADER */}
      <div style={{background:'#111',color:'#fff',padding:'0 20px',height:50,display:'flex',
        alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100,gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12,overflow:'hidden'}}>
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:13,fontWeight:600,
            letterSpacing:'0.04em',color:'#fff',flexShrink:0}}>HEDGEYE</span>
          <div style={{width:1,height:16,background:'#333',flexShrink:0}} />
          {/* Quarterly */}
          <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#555'}}>QTR</span>
            <QuadBadge quad={tweaks.quarterlyQuad} />
          </div>
          {/* Monthly */}
          <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#555'}}>MO</span>
            <QuadBadge quad={tweaks.monthlyQuad} />
          </div>
          {/* Research source indicator */}
          {researchSource && (
            <span title={`Quads from: ${researchSource}`}
              style={{fontFamily:'IBM Plex Mono,monospace',fontSize:8,color:'#4A7C22',
                background:'rgba(39,80,10,0.15)',padding:'1px 5px',borderRadius:2,flexShrink:0,
                cursor:'default',letterSpacing:'0.04em'}}>
              RESEARCH
            </span>
          )}
          <div style={{width:1,height:16,background:'#333',flexShrink:0}} />
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {[['USD',tweaks.usdSignal],['BTC',tweaks.btcSignal]].map(([lbl,sig])=>(
              <div key={lbl} style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#555'}}>{lbl}</span>
                <SignalBadge signal={sig} />
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#555'}}>
            {today}
          </span>
          <button
            onClick={() => setShowTweaks(s => !s)}
            title="Settings"
            style={{background:'none',border:'1px solid #333',color:'#888',borderRadius:4,
              cursor:'pointer',padding:'3px 9px',fontFamily:'IBM Plex Mono,monospace',
              fontSize:11,lineHeight:1,flexShrink:0,
              ...(showTweaks ? {borderColor:'#666',color:'#fff'} : {})}}>
            ⚙
          </button>
        </div>
      </div>

      {/* NAV — scrollable with arrow buttons for split-screen use */}
      <div style={{background:'#fff',borderBottom:'1px solid #E4E1DA',
        display:'flex',position:'sticky',top:50,zIndex:99,alignItems:'stretch'}}>
        {/* Left arrow */}
        <button onClick={()=>{ if(navRef.current) navRef.current.scrollLeft -= 120; }} style={{
          flexShrink:0,width:28,border:'none',borderRight:'1px solid #F0EDE8',
          background:'#fff',cursor:'pointer',color:'#9A9790',fontSize:14,
          display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>‹</button>
        {/* Tab strip */}
        <div ref={navRef} style={{flex:1,display:'flex',overflowX:'auto',scrollbarWidth:'none',
          msOverflowStyle:'none', scrollBehavior:'smooth'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              height:40,padding:'0 14px',fontFamily:'IBM Plex Mono,monospace',fontSize:11,
              color:tab===t.id?'#1A4D8F':'#7A7770',border:'none',
              borderBottom:tab===t.id?'2px solid #1A4D8F':'2px solid transparent',
              background:'none',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
              fontWeight:tab===t.id?500:400,transition:'color 0.1s'}}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Right arrow */}
        <button onClick={()=>{ if(navRef.current) navRef.current.scrollLeft += 120; }} style={{
          flexShrink:0,width:28,border:'none',borderLeft:'1px solid #F0EDE8',
          background:'#fff',cursor:'pointer',color:'#9A9790',fontSize:14,
          display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>›</button>
      </div>

      {/* CONTENT — wrapped in error boundary so a single component crash shows an error instead of blanking the whole page */}
      <ErrorBoundary key={tab}>
        {tab==='overview' && <OverviewTab qQuad={tweaks.quarterlyQuad} mQuad={tweaks.monthlyQuad} usd={tweaks.usdSignal} btc={tweaks.btcSignal} macroCtx={macroCtx} />}
        {tab==='market'   && <MarketTab quad={tweaks.monthlyQuad} macroCtx={macroCtx} />}
        {tab==='rta'      && <RTATab />}
        {tab==='ham'      && <HAMTab myPositions={tweaks.myPositions} onMyPositionsChange={v=>setTweak('myPositions',v)} macroCtx={macroCtx} />}
        {tab==='signals'   && <SignalsTab macroCtx={macroCtx} />}
        {tab==='riskrange' && (
          <iframe
            src="./risk_range_dashboard.html"
            style={{width:'100%',height:'calc(100vh - 90px)',border:'none',display:'block'}}
            title="Risk Range Dashboard"
          />
        )}
        {tab==='analyzer' && <AnalyzerTab macroCtx={macroCtx} />}
        {tab==='etfpro'   && <ETFProTab macroCtx={macroCtx} />}
        {tab==='sizing'   && <SizingTab macroCtx={macroCtx} />}
        {tab==='vol'      && <VolTab quad={tweaks.monthlyQuad} macroCtx={macroCtx} />}
        {tab==='research' && <ResearchTab onOpenPdf={setOpenPdf} macroCtx={macroCtx} />}
        {tab==='ingest'   && <ResearchStatusTab />}
      </ErrorBoundary>

      {/* PDF VIEWER */}
      <PdfViewer pdf={openPdf} onClose={()=>setOpenPdf(null)} />

      {/* TWEAKS PANEL */}
      {showTweaks && (
        <div style={{position:'fixed',bottom:20,right:20,width:280,background:'#fff',
          border:'1px solid #E4E1DA',borderRadius:10,
          boxShadow:'0 8px 32px rgba(0,0,0,0.12)',zIndex:1500,overflow:'hidden'}}>
          <div style={{padding:'11px 16px',background:'#F9F8F5',borderBottom:'1px solid #E4E1DA',
            fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770'}}>Settings</div>
          <div style={{padding:16,display:'flex',flexDirection:'column',gap:13}}>
            {[['quarterlyQuad','Quarterly Quad'],['monthlyQuad','Monthly Quad']].map(([key,label])=>(
              <div key={key}>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',marginBottom:5}}>{label}</div>
                <div style={{display:'flex',gap:3}}>
                  {['Q1','Q2','Q3','Q4'].map(o=>{
                    const qd=window.HE.QUADS[o];
                    const active=tweaks[key]===o;
                    return (
                      <button key={o} onClick={()=>setTweak(key,o)} style={{
                        flex:1,padding:'5px 2px',borderRadius:4,cursor:'pointer',
                        fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:active?700:400,
                        border:`1px solid ${active?qd.color:'#E4E1DA'}`,
                        background:active?qd.bg:'#fff',color:active?qd.color:'#7A7770'}}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {[['usdSignal','USD Signal'],['btcSignal','BTC Signal']].map(([key,label])=>(
              <div key={key}>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',marginBottom:5}}>{label}</div>
                <div style={{display:'flex',gap:3}}>
                  {['BULLISH','NEUTRAL','BEARISH'].map(o=>(
                    <button key={o} onClick={()=>setTweak(key,o)} style={{
                      flex:1,padding:'5px 2px',borderRadius:4,cursor:'pointer',
                      fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:tweaks[key]===o?700:400,
                      border:'1px solid #E4E1DA',
                      background:tweaks[key]===o?'#1A1A18':'#fff',
                      color:tweaks[key]===o?'#fff':'#7A7770',
                    }}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


ReactDOM.createRoot(document.getElementById("root")).render(<App />);
