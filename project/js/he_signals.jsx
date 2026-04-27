// he_signals.jsx — Signals, Volatility, Research tabs

// ── SIGNALS TAB ────────────────────────────────────────────────────
const SignalsTab = () => {
  const [hamTickers, setHamTickers] = React.useState({});
  const [imgDate, setImgDate] = React.useState('Apr 20');

  React.useEffect(() => {
    fetch(window.__resources?.hamCsv || './data/ham_holdings_latest.csv').then(r=>r.text()).then(txt => {
      const rows = window.HE.parseCSV(txt);
      const t = {};
      rows.forEach(r => {
        const w = parseFloat((r.Weightings||'0').replace('%',''))/100||0;
        if (w > 0 && !(r.StockTicker||'').includes('-TRS-') && r.StockTicker !== 'Cash&Other' && r.MoneyMarketFlag !== 'Y') {
          if (!t[r.StockTicker]) t[r.StockTicker] = {};
          t[r.StockTicker][r.Account] = w;
        }
      });
      setHamTickers(t);
    }).catch(()=>{});
  }, []);

  const FUNDS = ['HECA','HEFT','HGRO','HELS'];
  const SSS_IMAGES = {
    'Apr 20': window.__resources?.sssApr20 || 'signals/sss_apr20.png',
    'Apr 13': window.__resources?.sssApr13 || 'signals/sss_apr13.png',
    'Apr 10': window.__resources?.sssApr10 || 'signals/sss_apr10.png',
    'Apr 6':  window.__resources?.sssApr6  || 'signals/sss_apr6.png',
  };

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      {/* Image toggle + data table header */}
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
            letterSpacing:'0.1em',textTransform:'uppercase',color:'#7A7770'}}>
            Signal Strength Stocks — Apr 20, 2026 &nbsp;·&nbsp; HAM overlap highlighted
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>setImgDate(null)}
              style={{padding:'4px 12px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
                fontFamily:'IBM Plex Mono,monospace',fontSize:10,
                background:!imgDate?'#1A1A18':'#fff',color:!imgDate?'#fff':'#7A7770'}}>
              Table view
            </button>
            {Object.keys(SSS_IMAGES).map(d=>(
              <button key={d} onClick={()=>setImgDate(d)}
                style={{padding:'4px 12px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
                  fontFamily:'IBM Plex Mono,monospace',fontSize:10,
                  background:imgDate===d?'#1A1A18':'#fff',color:imgDate===d?'#fff':'#7A7770'}}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {imgDate ? (
          <img src={SSS_IMAGES[imgDate]} alt={`SSS ${imgDate}`}
            style={{width:'100%',borderRadius:4,display:'block'}} />
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
              <thead>
                <tr>
                  <TH>Days</TH><TH>Ticker</TH><TH>Signal Date</TH>
                  <TH right>Prior $</TH><TH right>Last $</TH><TH right>% Gain</TH>
                  <TH>Sector</TH><TH>Analyst</TH>
                  {FUNDS.map(f=><TH key={f} right>{f}</TH>)}
                </tr>
              </thead>
              <tbody>
                {window.HE.SSS.map((s,i) => {
                  const hamFunds = hamTickers[s.ticker]||{};
                  const hamCount = Object.keys(hamFunds).length;
                  return (
                    <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                      background:hamCount>=2?'rgba(39,80,10,0.04)':i%2===0?'#fff':'#FAFAF8'}}>
                      <TD style={{color:'#9A9790',fontSize:10}}>{s.days}</TD>
                      <TD><span style={{fontWeight:700}}>{s.ticker}</span></TD>
                      <TD style={{color:'#7A7770',fontSize:10}}>{s.signalDate}</TD>
                      <TD right>${s.priorClose.toFixed(2)}</TD>
                      <TD right>${s.lastClose.toFixed(2)}</TD>
                      <TD right style={{fontWeight:600,color:s.pct>0?'#27500A':'#C8302A'}}>
                        {s.pct>0?'+':''}{s.pct.toFixed(1)}%
                      </TD>
                      <TD style={{color:'#7A7770',fontSize:10}}>{s.sector}</TD>
                      <TD style={{color:'#7A7770',fontSize:10}}>{s.analyst}</TD>
                      {FUNDS.map(f => {
                        const w = hamFunds[f];
                        return (
                          <TD key={f} right style={{fontWeight:w?600:400,color:w?'#27500A':'#ccc'}}>
                            {w ? `${(w*100).toFixed(2)}%` : '—'}
                          </TD>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link to ETF Pro tab */}
      <div style={{background:'#F9F8F5',border:'1px solid #E4E1DA',borderRadius:8,padding:16,
        display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#7A7770'}}>
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

// ── RESEARCH TAB ───────────────────────────────────────────────────
const ResearchTab = ({onOpenPdf}) => {
  const [search, setSearch] = React.useState('');
  const [expanded, setExpanded] = React.useState(new Set(['Founder\'s Choice']));
  const fileInputRef = React.useRef(null);
  const [pendingFile, setPendingFile] = React.useState(null);

  const toggle = cat => setExpanded(prev => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  const handleProjectPdf = (path, name) => {
    onOpenPdf({url: path, title: name, isProject: true});
  };

  const handlePickFile = (name) => {
    setPendingFile(name);
    fileInputRef.current.click();
  };

  const handleFileChosen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onOpenPdf({url, title: pendingFile || file.name});
    e.target.value = '';
  };

  const filtered = window.HE.RESEARCH.map(cat => ({
    ...cat,
    files: search ? cat.files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : cat.files,
  })).filter(cat => cat.files.length > 0);

  return (
    <div style={{padding:'20px 24px', maxWidth:1100}}>
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChosen}
        style={{display:'none'}} />

      {/* Drop hint */}
      <div style={{background:'#F9F8F5',border:'1px dashed #D0CCC4',borderRadius:8,
        padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:16}}>📄</span>
        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#7A7770'}}>
          <strong style={{color:'#1A1A18'}}>Pinned PDFs</strong> open instantly. For others, click the row — a file picker will open so you can select the PDF from your Hedgeye folder. Or <strong style={{color:'#1A1A18'}}>drag any PDF</strong> onto this window.
        </span>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search research by title…"
        style={{width:'100%',padding:'10px 14px',border:'1px solid #E4E1DA',borderRadius:6,
          fontFamily:'IBM Plex Mono,monospace',fontSize:13,color:'#1A1A18',
          background:'#fff',outline:'none',marginBottom:16}} />

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:12}}>
        {filtered.map((cat,ci) => {
          const isExp = expanded.has(cat.category) || !!search;
          const shown = isExp ? cat.files : cat.files.slice(0,3);
          return (
            <div key={ci} style={{background:'#fff',border:`1px solid ${cat.pinned?cat.color+'55':'#E4E1DA'}`,
              borderRadius:8,overflow:'hidden'}}>
              <div style={{padding:'10px 16px',background: cat.pinned ? cat.color+'11' : '#F9F8F5',
                borderBottom:`1px solid ${cat.pinned?cat.color+'33':'#E4E1DA'}`,
                display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:3,height:14,borderRadius:2,background:cat.color,flexShrink:0}} />
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:600,
                  textTransform:'uppercase',letterSpacing:'0.1em',color:'#7A7770',flex:1}}>
                  {cat.category}
                </div>
                <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#aaa'}}>{cat.files.length}</div>
              </div>
              {shown.map((f,fi) => {
                const hasProject = !!f.projectPath;
                return (
                  <div key={fi}
                    onClick={() => hasProject ? handleProjectPdf(f.projectPath, f.name) : handlePickFile(f.name)}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                      padding:'9px 16px',borderBottom:'1px solid #F5F3EF',cursor:'pointer',
                      transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#F9F8F5'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <div style={{fontSize:12,color:'#1A1A18',flex:1,marginRight:8,lineHeight:1.4}}>{f.name}</div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      {f.date&&<span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790',whiteSpace:'nowrap'}}>{f.date}</span>}
                      <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                        padding:'1px 6px',borderRadius:3,border:'1px solid',
                        borderColor: hasProject?cat.color:'#E4E1DA',
                        color: hasProject?cat.color:'#ccc',
                        background: hasProject?cat.color+'11':'transparent'}}>
                        {hasProject ? 'View' : 'PDF'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {cat.files.length > 3 && !search && (
                <button onClick={()=>toggle(cat.category)}
                  style={{width:'100%',padding:'8px 16px',border:'none',borderTop:'1px solid #F5F3EF',
                    background:'none',fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',
                    cursor:'pointer',textAlign:'left'}}>
                  {isExp ? '▲ Show less' : `▼ ${cat.files.length - 3} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

Object.assign(window, {SignalsTab, VolTab, ResearchTab});
