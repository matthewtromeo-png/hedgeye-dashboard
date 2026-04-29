// he_app.jsx — Overview tab + main App shell

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
const OverviewTab = ({qQuad, mQuad, usd, btc, onTabChange}) => {
  const [rta, setRta]             = React.useState(null);
  const [hamOverlaps, setHamOverlaps] = React.useState(null);

  React.useEffect(() => {
    fetch(window.__resources?.rtaCsv || './data/rta_latest.csv').then(r=>r.text()).then(txt =>
      setRta(window.HE.computeRTAStats(window.HE.parseCSV(txt)))
    ).catch(()=>{});
    fetch(window.__resources?.hamCsv || './data/ham_holdings_latest.csv').then(r=>r.text()).then(txt => {
      const rows = window.HE.parseCSV(txt);
      const map = {};
      rows.forEach(r => {
        const w = parseFloat((r.Weightings||'0').replace('%',''))/100||0;
        if (w>0 && !(r.StockTicker||'').includes('-TRS-') && r.StockTicker!=='Cash&Other' && r.MoneyMarketFlag!=='Y') {
          if (!map[r.StockTicker]) map[r.StockTicker] = {name:r.SecurityName, funds:[]};
          if (!map[r.StockTicker].funds.includes(r.Account)) map[r.StockTicker].funds.push(r.Account);
        }
      });
      setHamOverlaps(Object.entries(map).filter(([,v])=>v.funds.length>=3)
        .sort((a,b)=>b[1].funds.length-a[1].funds.length).slice(0,10));
    }).catch(()=>{});
  }, []);

  const qQ = window.HE.QUADS[qQuad] || window.HE.QUADS.Q3;
  const mQ = window.HE.QUADS[mQuad] || window.HE.QUADS.Q2;
  const latest = window.HE.ETF_RERANKS[0];
  const fmt = n => isNaN(n)?'—':(n>=0?'+':'')+(n*100).toFixed(1)+'%';

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
            ↑ Transitioning from {qQuad}
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
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginBottom:4}}>
              Latest Re-rank · {latest.date}
            </div>
            {latest.topMovers.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',
                fontFamily:'IBM Plex Mono,monospace',fontSize:11,marginBottom:2}}>
                <span style={{fontWeight:700}}>{m.ticker}</span>
                <span style={{color:'#27500A',fontWeight:600}}>{m.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Research Intelligence */}
      <ResearchIntelPanel />

      {/* Three feeds */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',
            borderBottom:'1px solid #E4E1DA',paddingBottom:8,marginBottom:12,
            display:'flex',justifyContent:'space-between'}}>
            <span>RTA — Recent</span>
            {rta&&<span style={{color:rta.winRate>0.5?'#27500A':'#C8302A',fontWeight:700}}>
              {(rta.winRate*100).toFixed(0)}% WR
            </span>}
          </div>
          {rta ? rta.recentTrades.slice(0,10).map((t,i)=>{
            const r=parseFloat(t['Realized Return'])||0;
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'5px 0',borderBottom:i<9?'1px solid #F5F3EF':'none'}}>
                <div style={{display:'flex',gap:7,alignItems:'center'}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,fontSize:12,minWidth:48}}>{t.Symbol}</span>
                  <SignalBadge signal={t.Position} />
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:600,
                    color:r>0?'#27500A':'#C8302A'}}>{r>0?'+':''}{(r*100).toFixed(1)}%</div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790'}}>
                    {(t['Close Date']||'').slice(5,10)}</div>
                </div>
              </div>
            );
          }) : <LoadingSpinner msg="Loading…" />}
        </div>

        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',
            borderBottom:'1px solid #E4E1DA',paddingBottom:8,marginBottom:12}}>
            HAM — Highest Conviction
          </div>
          {hamOverlaps ? hamOverlaps.map(([ticker,v],i)=>{
            const sss=window.HE.SSS.find(s=>s.ticker===ticker);
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'5px 0',borderBottom:i<hamOverlaps.length-1?'1px solid #F5F3EF':'none'}}>
                <div>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,fontSize:12}}>{ticker}</span>
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginLeft:6}}>
                    {(v.name||'').slice(0,22)}
                  </span>
                </div>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  {sss&&<span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 5px',borderRadius:3}}>SSS</span>}
                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:700,
                    padding:'2px 7px',borderRadius:3,
                    background:v.funds.length===4?'#EAF3DE':'#E4EDF8',
                    color:v.funds.length===4?'#27500A':'#1A4D8F'}}>
                    {v.funds.length}/4
                  </span>
                </div>
              </div>
            );
          }) : <LoadingSpinner msg="Loading…" />}
        </div>

        <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',
            borderBottom:'1px solid #E4E1DA',paddingBottom:8,marginBottom:12}}>
            Signal Strength — Top Names
          </div>
          {window.HE.SSS.slice(0,10).map((s,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'5px 0',borderBottom:i<9?'1px solid #F5F3EF':'none'}}>
              <div>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,fontSize:12,
                  minWidth:48,display:'inline-block'}}>{s.ticker}</span>
                <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790'}}>{s.days}d · {s.sector}</span>
              </div>
              <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:600,
                color:s.pct>0?'#27500A':'#C8302A'}}>
                {s.pct>0?'+':''}{s.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
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
  const [researchSource, setResearchSource] = React.useState(
    () => window.HE.loadQuadState().researchSource || null
  );

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
    {id:'overview', label:'Overview'},
    {id:'market',   label:'Live Market'},
    {id:'rta',      label:'RTA History'},
    {id:'ham',      label:'HAM Holdings'},
    {id:'signals',  label:'Signal Strength'},
    {id:'etfpro',   label:'ETF Pro'},
    {id:'vol',      label:'Volatility'},
    {id:'research', label:'Research'},
    {id:'ingest',   label:'Ingest PDFs'},
  ];

  const today = new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});

  return (
    <div style={{minHeight:'100vh',background:'#F4F3EF',color:'#1A1A18',fontFamily:'IBM Plex Sans,sans-serif'}}>
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

      {/* NAV */}
      <div style={{background:'#fff',borderBottom:'1px solid #E4E1DA',display:'flex',
        overflowX:'auto',position:'sticky',top:50,zIndex:99,scrollbarWidth:'none'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            height:40,padding:'0 16px',fontFamily:'IBM Plex Mono,monospace',fontSize:11,
            color:tab===t.id?'#1A4D8F':'#7A7770',border:'none',
            borderBottom:tab===t.id?'2px solid #1A4D8F':'2px solid transparent',
            background:'none',cursor:'pointer',whiteSpace:'nowrap',
            fontWeight:tab===t.id?500:400,transition:'color 0.1s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {tab==='overview' && <OverviewTab qQuad={tweaks.quarterlyQuad} mQuad={tweaks.monthlyQuad} usd={tweaks.usdSignal} btc={tweaks.btcSignal} />}
      {tab==='market'   && <MarketTab quad={tweaks.monthlyQuad} />}
      {tab==='rta'      && <RTATab />}
      {tab==='ham'      && <HAMTab myPositions={tweaks.myPositions} onMyPositionsChange={v=>setTweak('myPositions',v)} />}
      {tab==='signals'  && <SignalsTab />}
      {tab==='etfpro'   && <ETFProTab />}
      {tab==='vol'      && <VolTab quad={tweaks.monthlyQuad} />}
      {tab==='research' && <ResearchTab onOpenPdf={setOpenPdf} />}
      {tab==='ingest'   && <IngestTab onQuadUpdate={handleQuadUpdate} />}

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
                      color:tweaks[key]===o?'#fff':'#7A7770'}}>
                      {o.slice(0,4)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',marginBottom:5}}>My Positions (HAM cross-ref)</div>
              <textarea value={tweaks.myPositions}
                onChange={e=>setTweak('myPositions',e.target.value)}
                placeholder="AAPL NVDA CASY XOM…"
                style={{width:'100%',padding:8,border:'1px solid #E4E1DA',borderRadius:4,
                  fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#1A1A18',
                  background:'#FAFAF8',resize:'none',height:52,outline:'none',boxSizing:'border-box'}} />
            </div>
            <div>
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',marginBottom:5}}>FMP API Key (optional)</div>
              <input
                type="password"
                value={tweaks.fmpKey}
                onChange={e=>setTweak('fmpKey',e.target.value)}
                placeholder="Enter key for analyst data…"
                style={{width:'100%',padding:'6px 8px',border:'1px solid #E4E1DA',borderRadius:4,
                  fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#1A1A18',
                  background:'#FAFAF8',outline:'none',boxSizing:'border-box'}}
              />
              <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,color:'#9A9790',marginTop:3}}>
                financialmodelingprep.com — free tier works
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
