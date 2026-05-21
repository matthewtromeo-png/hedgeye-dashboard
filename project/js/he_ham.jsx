// he_ham.jsx — HAM Holdings tab (v2 — daily/weekly flows + quad alignment)

// ── Quad alignment map ────────────────────────────────────────────────
// Monthly Q2 = operative | Quarterly Q3 = backdrop
// TAILWIND_BOTH = best on both layers; TAILWIND_Q2 = only monthly tailwind; HEADWIND = avoid
const ASSET_CLASS_MAP = {
  // Metals
  GLD:'metals',GOLD:'metals',AAAU:'metals',SLV:'metals',SILVER:'metals',
  GDX:'metals',GDXJ:'metals',NEM:'metals',AEM:'metals',AG:'metals',HL:'metals',
  PPLT:'metals',PALL:'metals',IAU:'metals',DBB:'metals',CPER:'metals',HBM:'metals',
  // Commodities
  CORN:'commodities',SOYB:'commodities',BNO:'commodities',WEAT:'commodities',
  DBA:'commodities',COM:'commodities',PDBC:'commodities',GSG:'commodities',
  // Energy
  XLE:'energy',XOP:'energy',OIH:'energy',NORW:'energy',OXY:'energy',
  CVX:'energy',XOM:'energy',HAL:'energy',SLB:'energy',BKR:'energy',
  ENB:'energy',KMI:'energy',LNG:'energy',AR:'energy',RRC:'energy',
  LUV:'energy',JETS:'energy',  // airlines = energy correlated
  // Crypto
  IBIT:'crypto',MSTR:'crypto',COIN:'crypto',MARA:'crypto',RIOT:'crypto',
  CLSK:'crypto',HUT:'crypto',BITF:'crypto',CRCL:'crypto',
  // High Yield / Credit
  HYG:'high_yield',JNK:'high_yield',USHY:'high_yield',BKLN:'high_yield',
  // Long Bonds (HEADWIND in Q2/Q3)
  TLT:'long_bonds',LQD:'long_bonds',ZROZ:'long_bonds',EDV:'long_bonds',
  IEF:'long_bonds',AGG:'long_bonds',BND:'long_bonds',GOVT:'long_bonds',
  // Utilities (HEADWIND)
  XLU:'utilities',VPU:'utilities',FUTY:'utilities',
  // Defensives (HEADWIND in Q2)
  XLP:'defensives',CWEN:'defensives',
  // Industrials
  XLI:'industrials',CAT:'industrials',DE:'industrials',EMR:'industrials',
  ITW:'industrials',GEV:'industrials',ROK:'industrials',CMI:'industrials',
  CSX:'industrials',ULS:'industrials',URI:'industrials',DOW:'industrials',
  TT:'industrials',PCAR:'industrials',UNP:'industrials',CP:'industrials',
  GFS:'industrials',
  // Growth Tech / S-Curve
  NVDA:'growth_tech',AMD:'growth_tech',AMAT:'growth_tech',LRCX:'growth_tech',
  MRVL:'growth_tech',SITM:'growth_tech',INTC:'growth_tech',TSM:'growth_tech',
  AVGO:'growth_tech',MSFT:'growth_tech',AAPL:'growth_tech',AMZN:'growth_tech',
  GOOGL:'growth_tech',META:'growth_tech',TSLA:'growth_tech',NFLX:'growth_tech',
  ORCL:'growth_tech',NOW:'growth_tech',PLTR:'growth_tech',
  // Financials
  XLF:'financials',JPM:'financials',GS:'financials',MS:'financials',
  BAC:'financials',C:'financials',BK:'financials',BNY:'financials',
  GPN:'financials',V:'financials',MA:'financials',PYPL:'financials',
  AFRM:'financials',CACC:'financials',XYZ:'financials',
  // Healthcare (neutral to headwind in Q2)
  XLV:'healthcare',UNH:'healthcare',LLY:'healthcare',ABBV:'healthcare',
  // Broad Index
  SPY:'broad_index',QQQ:'broad_index',IWM:'broad_index',
  VTI:'broad_index',VOO:'broad_index',VXF:'broad_index',
  // FX
  UUP:'usd_long',FXB:'usd_short',EWW:'em_fx',EWH:'em_fx',
  IDX:'em_fx',EPHE:'em_fx',EWQ:'europe',EWG:'europe',
};

// Q2 monthly (operative) + Q3 quarterly (backdrop)
function getQuadAlign(ticker) {
  const cls = ASSET_CLASS_MAP[ticker?.toUpperCase()];
  if (!cls) return null;
  // Both Q2 and Q3 tailwind = strongest
  if (['metals','commodities','energy'].includes(cls))   return 'BOTH';
  // Q2 tailwind only (Q3 may flip)
  if (['crypto','high_yield','industrials'].includes(cls)) return 'Q2';
  // Growth tech: Q2 ok, but Q3 backdrop is headwind
  if (['growth_tech'].includes(cls))                      return 'Q2_ONLY';
  // Headwind in both layers
  if (['long_bonds','utilities','defensives'].includes(cls)) return 'HEADWIND';
  return 'NEUTRAL';
}

const ALIGN_META = {
  BOTH:     { label:'TAILWIND',      bg:'#EAF3DE', color:'#27500A', border:'#7AB648', tip:'Q2+Q3 both confirm — strongest setup' },
  Q2:       { label:'Q2 TAILWIND',   bg:'#E8F0FB', color:'#1A4D8F', border:'#5B8FD8', tip:'Monthly Q2 tailwind, Q3 backdrop neutral' },
  Q2_ONLY:  { label:'Q2 (watch Q3)', bg:'#FFF3E0', color:'#B8860B', border:'#D4A017', tip:'Q2 tailwind but Q3 shift = headwind — watch transition' },
  HEADWIND: { label:'HEADWIND',      bg:'#FCEBEB', color:'#C8302A', border:'#E07070', tip:'Headwind in current Q2/Q3 regime' },
  NEUTRAL:  { label:'NEUTRAL',       color:'#9A9790', bg:'#F5F3EF', border:'#C8C5BE', tip:'Quad-agnostic' },
};

// ── CSV builder ──────────────────────────────────────────────────────
function buildHAMData(rows) {
  const funds = {};
  rows.forEach(r => {
    const f = r.Account; if (!f) return;
    if (!funds[f]) funds[f] = [];
    const wPct = parseFloat((r.Weightings||'0').replace('%','')) || 0;
    const w = wPct / 100;
    funds[f].push({
      ticker: r.StockTicker,
      name: r.SecurityName,
      weight: w,
      price: parseFloat(r.Price)||0,
      mv: parseFloat(r.MarketValue)||0,
      isLong: w > 0,
      isShort: w < 0,
      isCash: r.StockTicker === 'Cash&Other' || r.MoneyMarketFlag === 'Y',
      isSwap: (r.StockTicker||'').includes('-TRS-') || (r.StockTicker||'').includes(' SWP '),
    });
  });
  const tickerMap = {};
  Object.entries(funds).forEach(([fund, holdings]) => {
    holdings.filter(h => h.isLong && !h.isCash && !h.isSwap).forEach(h => {
      if (!tickerMap[h.ticker]) tickerMap[h.ticker] = {ticker:h.ticker, name:h.name, funds:{}};
      tickerMap[h.ticker].funds[fund] = h.weight;
    });
  });
  const overlaps = Object.values(tickerMap)
    .filter(t => Object.keys(t.funds).length >= 2)
    .sort((a,b) => Object.keys(b.funds).length - Object.keys(a.funds).length
      || Object.values(b.funds).reduce((x,y)=>x+y,0) - Object.values(a.funds).reduce((x,y)=>x+y,0));
  return { funds, tickerMap, overlaps };
}

// ── HAM Tab ──────────────────────────────────────────────────────────
const HAMTab = ({myPositions, onMyPositionsChange, macroCtx}) => {
  const [hamData,    setHamData]    = React.useState(null);
  const [loading,    setLoading]    = React.useState(true);
  const [liveSource, setLiveSource] = React.useState(null);
  const [activeFund, setActiveFund] = React.useState('HEFT');
  const [showLongs,  setShowLongs]  = React.useState(true);
  const [subTab,     setSubTab]     = React.useState('overlaps');
  const [myInput,    setMyInput]    = React.useState(myPositions || '');
  const [quadShiftMode, setQuadShiftMode] = React.useState(false); // toggle Q3 headwind view

  const deltas    = macroCtx?.ham_deltas ?? {};
  const daily     = deltas.daily    ?? {};
  const weekly    = deltas.weekly   ?? {};
  const dlyAdded  = deltas.daily_added   ?? [];
  const dlyRemoved= deltas.daily_removed ?? [];
  const wlyAdded  = deltas.weekly_added  ?? [];
  const wlyRemoved= deltas.weekly_removed ?? [];

  React.useEffect(() => {
    try {
      const live = JSON.parse(localStorage.getItem('he_ham_live') || '{}');
      if (live.rows?.length > 0) {
        setHamData(buildHAMData(live.rows));
        setLiveSource({ source: live.source, modifiedAt: live.modifiedAt });
        setLoading(false);
        return;
      }
    } catch {}
    fetch(window.__resources?.hamCsv || './data/ham_holdings_latest.csv')
      .then(r => r.text())
      .then(txt => { setHamData(buildHAMData(window.HE.parseCSV(txt))); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner msg="Loading HAM holdings…" />;
  if (!hamData) return <div style={{padding:40,color:'#C8302A',fontFamily:'IBM Plex Mono,monospace',fontSize:12}}>Could not load HAM data.</div>;

  const { funds, tickerMap, overlaps } = hamData;
  const asOfStr = liveSource?.modifiedAt
    ? new Date(liveSource.modifiedAt).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})
    : 'May 21, 2026';
  const FUNDS = ['HECA','HEFT','HGRO','HELS'].filter(f => funds[f]);
  const myTickers = myInput.split(/[\s,\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  const sssSet = new Set(window.HE.SSS.map(s => s.ticker));
  const pct = w => w === 0 ? '—' : (w > 0 ? '+' : '') + (w*100).toFixed(2) + '%';
  const delta_fmt = d => d === 0 ? '' : (d > 0 ? '+' : '') + (d*100).toFixed(2) + '%';
  const fundColors = {HECA:'#1A4D8F',HEFT:'#27500A',HGRO:'#B8860B',HELS:'#C8302A'};

  const AlignBadge = ({ticker}) => {
    const align = getQuadAlign(ticker);
    if (!align || align === 'NEUTRAL') return null;
    const m = ALIGN_META[align];
    return (
      <span title={m.tip} style={{fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:3,
        background:m.bg,color:m.color,border:`1px solid ${m.border}`,
        letterSpacing:'0.04em',whiteSpace:'nowrap'}}>
        {m.label}
      </span>
    );
  };

  const DeltaBadge = ({ticker, period='daily'}) => {
    const src = period === 'daily' ? daily : weekly;
    const v = src[ticker];
    if (!v) return null;
    if (v.added)   return <span style={{fontSize:8,background:'#EAF3DE',color:'#27500A',padding:'1px 5px',borderRadius:3,fontWeight:700}}>+NEW</span>;
    if (v.removed) return <span style={{fontSize:8,background:'#FCEBEB',color:'#C8302A',padding:'1px 5px',borderRadius:3,fontWeight:700}}>OUT</span>;
    const d = v.delta;
    if (Math.abs(d) < 0.0005) return null;
    return (
      <span style={{fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:3,
        background: d>0?'rgba(39,80,10,0.08)':'rgba(200,48,42,0.08)',
        color: d>0?'#27500A':'#C8302A'}}>
        {d>0?'↑':'↓'}{Math.abs(d*100).toFixed(2)}%
      </span>
    );
  };

  const FundSummary = () => (
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
      {FUNDS.map(f => {
        const longs = (funds[f]||[]).filter(h => h.isLong && !h.isCash && !h.isSwap);
        const shorts = (funds[f]||[]).filter(h => h.isShort && !h.isSwap);
        const nav = (funds[f]||[]).filter(h=>!h.isSwap).reduce((s,h) => s+Math.abs(h.mv), 0);
        return (
          <div key={f} onClick={() => { setActiveFund(f); setSubTab('holdings'); }}
            style={{background:'#fff',border:`1px solid ${activeFund===f&&subTab==='holdings'?fundColors[f]:'#E4E1DA'}`,
              borderRadius:8,padding:'14px 16px',cursor:'pointer',transition:'border-color 0.15s',
              borderLeft:`3px solid ${fundColors[f]}`}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
              letterSpacing:'0.1em',color:fundColors[f],marginBottom:4}}>{f}</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:'IBM Plex Mono,monospace',
              color:'#1A1A18',lineHeight:1,marginBottom:4}}>${(nav/1e6).toFixed(0)}M</div>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770'}}>
              {longs.length}L / {shorts.length}S
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── FLOWS TAB ─────────────────────────────────────────────────────
  const FlowsTab = () => {
    const [period, setPeriod] = React.useState('daily');
    const src = period === 'daily' ? daily : weekly;
    const addedList  = period === 'daily' ? dlyAdded  : wlyAdded;
    const removedList= period === 'daily' ? dlyRemoved: wlyRemoved;

    // Changes excluding added/removed — just weight shifts
    const shifts = Object.entries(src)
      .filter(([t,v]) => !v.added && !v.removed && Math.abs(v.delta) > 0.001)
      .sort((a,b) => Math.abs(b[1].delta) - Math.abs(a[1].delta));

    const increases = shifts.filter(([,v]) => v.delta > 0);
    const decreases = shifts.filter(([,v]) => v.delta < 0);

    const rowStyle = {display:'flex',alignItems:'center',gap:8,padding:'7px 12px',
      borderBottom:'1px solid #F5F3EF',fontFamily:'IBM Plex Mono,monospace',fontSize:11};

    return (
      <div>
        {/* Period toggle */}
        <div style={{display:'flex',gap:6,marginBottom:16}}>
          {[['daily','Daily (vs yesterday)'],['weekly','Weekly (vs 5 days ago)']].map(([k,lbl])=>(
            <button key={k} onClick={()=>setPeriod(k)} style={{
              padding:'5px 14px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
              fontFamily:'IBM Plex Mono,monospace',fontSize:11,
              background:period===k?'#1A1A18':'#fff',color:period===k?'#fff':'#7A7770'}}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12}}>
          {/* New Additions */}
          <div style={{background:'#EAF3DE',border:'1px solid #7AB648',borderRadius:8,padding:'12px 14px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
              color:'#27500A',letterSpacing:'0.08em',marginBottom:8}}>
              ✚ ADDED ({addedList.length})
            </div>
            {addedList.length === 0
              ? <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790'}}>None</div>
              : addedList.map(t => (
                <div key={t} style={{...rowStyle,background:'transparent',borderBottom:'1px solid rgba(122,182,72,0.2)',padding:'5px 0'}}>
                  <span style={{fontWeight:700,minWidth:52}}>{t}</span>
                  <AlignBadge ticker={t} />
                  <span style={{color:'#27500A',fontSize:10}}>{src[t]?.cur ? '+'+((src[t].cur||0)*100).toFixed(2)+'%' : ''}</span>
                </div>
              ))
            }
          </div>

          {/* Removed */}
          <div style={{background:'#FCEBEB',border:'1px solid #E07070',borderRadius:8,padding:'12px 14px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
              color:'#C8302A',letterSpacing:'0.08em',marginBottom:8}}>
              ✕ REMOVED ({removedList.length})
            </div>
            {removedList.length === 0
              ? <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790'}}>None</div>
              : removedList.map(t => (
                <div key={t} style={{...rowStyle,background:'transparent',borderBottom:'1px solid rgba(200,48,42,0.15)',padding:'5px 0'}}>
                  <span style={{fontWeight:700,minWidth:52,textDecoration:'line-through',color:'#C8302A'}}>{t}</span>
                  <AlignBadge ticker={t} />
                </div>
              ))
            }
          </div>

          {/* Weight Increases */}
          <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'12px 14px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
              color:'#27500A',letterSpacing:'0.08em',marginBottom:8}}>
              ↑ ADDING ({increases.length})
            </div>
            {increases.slice(0,12).map(([t,v]) => (
              <div key={t} style={{...rowStyle,background:'transparent',borderBottom:'1px solid #F5F3EF',padding:'5px 0'}}>
                <span style={{fontWeight:700,minWidth:52}}>{t}</span>
                <AlignBadge ticker={t} />
                <span style={{color:'#27500A',marginLeft:'auto',fontSize:10,fontWeight:600}}>
                  +{(v.delta*100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          {/* Weight Decreases */}
          <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'12px 14px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
              color:'#C8302A',letterSpacing:'0.08em',marginBottom:8}}>
              ↓ TRIMMING ({decreases.length})
            </div>
            {decreases.slice(0,12).map(([t,v]) => (
              <div key={t} style={{...rowStyle,background:'transparent',borderBottom:'1px solid #F5F3EF',padding:'5px 0'}}>
                <span style={{fontWeight:700,minWidth:52}}>{t}</span>
                <AlignBadge ticker={t} />
                <span style={{color:'#C8302A',marginLeft:'auto',fontSize:10,fontWeight:600}}>
                  {(v.delta*100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quad narrative */}
        <div style={{marginTop:16,padding:'12px 16px',background:'#F9F8F5',
          border:'1px solid #E4E1DA',borderRadius:8,
          fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',lineHeight:1.7}}>
          <span style={{fontWeight:700,color:'#1A1A18'}}>QUAD CONTEXT → </span>
          Monthly Q2 (operative) / Quarterly Q3 (backdrop).{' '}
          <span style={{color:'#27500A'}}>TAILWIND = metals, commodities, energy (Q2+Q3 both confirm).</span>{' '}
          <span style={{color:'#1A4D8F'}}>Q2 TAILWIND = crypto, HYG, industrials.</span>{' '}
          <span style={{color:'#B8860B'}}>Q2 (watch Q3) = growth tech — works now but Q3 shift = headwind.</span>{' '}
          <span style={{color:'#C8302A'}}>HEADWIND = TLT, LQD, XLU.</span>
        </div>
      </div>
    );
  };

  // ── HOLDINGS TABLE ────────────────────────────────────────────────
  const HoldingsTable = ({fund}) => {
    const holdings = (funds[fund]||[])
      .filter(h => !h.isCash && !h.isSwap && (showLongs ? h.isLong : h.isShort))
      .sort((a,b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 60);
    return (
      <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
        <thead>
          <tr>
            <TH>Ticker</TH><TH>Name</TH><TH right>Weight</TH>
            <TH right>Day Δ</TH><TH right>Week Δ</TH>
            <TH>Quad</TH><TH>SSS</TH><TH>My Book</TH>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h,i) => {
            const inSSS = sssSet.has(h.ticker);
            const isMine = myTickers.includes(h.ticker);
            const sssInfo = inSSS ? window.HE.SSS.find(s=>s.ticker===h.ticker) : null;
            const dd = daily[h.ticker];
            const wd = weekly[h.ticker];
            return (
              <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                background: isMine?'rgba(26,77,143,0.05)':inSSS?'rgba(39,80,10,0.03)':i%2===0?'#fff':'#FAFAF8'}}>
                <TD>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{fontWeight:700}}>{h.ticker}</span>
                    {dd?.added && <span style={{fontSize:8,background:'#EAF3DE',color:'#27500A',padding:'0px 4px',borderRadius:2,fontWeight:700}}>NEW</span>}
                  </div>
                </TD>
                <TD style={{color:'#7A7770',fontSize:10,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.name}</TD>
                <TD right style={{fontWeight:600,color:h.isLong?'#27500A':'#C8302A'}}>{pct(h.weight)}</TD>
                <TD right style={{fontSize:10, color: dd&&dd.delta>0?'#27500A':dd&&dd.delta<0?'#C8302A':'#ccc'}}>
                  {dd ? delta_fmt(dd.delta) : '—'}
                </TD>
                <TD right style={{fontSize:10, color: wd&&wd.delta>0?'#27500A':wd&&wd.delta<0?'#C8302A':'#ccc'}}>
                  {wd ? delta_fmt(wd.delta) : '—'}
                </TD>
                <TD><AlignBadge ticker={h.ticker} /></TD>
                <TD>{inSSS?<span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 6px',borderRadius:3}}>
                  {sssInfo.days}d +{sssInfo.pct>0?'+':''}{sssInfo.pct.toFixed(1)}%
                </span>:''}</TD>
                <TD>{isMine?<span style={{fontSize:9,background:'#E4EDF8',color:'#1A4D8F',padding:'1px 6px',borderRadius:3,fontWeight:600}}>MY</span>:''}</TD>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  // ── OVERLAPS TABLE ────────────────────────────────────────────────
  const OverlapsTable = () => (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770'}}>
          {overlaps.length} tickers held across 2+ HAM funds (longs only) · as of {asOfStr}
        </div>
        <label style={{display:'flex',alignItems:'center',gap:6,fontFamily:'IBM Plex Mono,monospace',
          fontSize:10,color:'#7A7770',cursor:'pointer'}}>
          <input type="checkbox" checked={quadShiftMode} onChange={e=>setQuadShiftMode(e.target.checked)} />
          Highlight Q3 shift risks
        </label>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
          <thead>
            <tr>
              <TH>Ticker</TH><TH>Name</TH>
              {FUNDS.map(f=><TH key={f} right>{f}</TH>)}
              <TH right>Day Δ</TH>
              <TH right>Wk Δ</TH>
              <TH>Funds</TH><TH>Quad</TH><TH>SSS</TH><TH>My Book</TH>
            </tr>
          </thead>
          <tbody>
            {overlaps.map((o,i) => {
              const cnt = Object.keys(o.funds).length;
              const inSSS = window.HE.SSS.find(s=>s.ticker===o.ticker);
              const isMine = myTickers.includes(o.ticker);
              const dd = daily[o.ticker];
              const wd = weekly[o.ticker];
              const align = getQuadAlign(o.ticker);
              // Highlight Q3 risks if toggle on
              const isQ3Risk = quadShiftMode && align === 'Q2_ONLY';
              return (
                <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                  background:isQ3Risk?'rgba(200,48,42,0.04)':isMine?'rgba(26,77,143,0.05)':cnt===FUNDS.length?'rgba(39,80,10,0.05)':i%2===0?'#fff':'#FAFAF8'}}>
                  <TD>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontWeight:700}}>{o.ticker}</span>
                      {dd?.added && <span style={{fontSize:7,background:'#EAF3DE',color:'#27500A',padding:'0 3px',borderRadius:2,fontWeight:700}}>NEW</span>}
                    </div>
                  </TD>
                  <TD style={{color:'#7A7770',fontSize:10,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.name}</TD>
                  {FUNDS.map(f=>(
                    <TD key={f} right style={{fontWeight:o.funds[f]?600:400,color:o.funds[f]?'#27500A':'#ccc'}}>
                      {o.funds[f]?`${(o.funds[f]*100).toFixed(2)}%`:'—'}
                    </TD>
                  ))}
                  <TD right style={{fontSize:10,color:dd&&dd.delta>0?'#27500A':dd&&dd.delta<0?'#C8302A':'#ccc'}}>
                    {dd ? delta_fmt(dd.delta) : '—'}
                  </TD>
                  <TD right style={{fontSize:10,color:wd&&wd.delta>0?'#27500A':wd&&wd.delta<0?'#C8302A':'#ccc'}}>
                    {wd ? delta_fmt(wd.delta) : '—'}
                  </TD>
                  <TD>
                    <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:3,
                      background:cnt===FUNDS.length?'#EAF3DE':'#E4EDF8',
                      color:cnt===FUNDS.length?'#27500A':'#1A4D8F'}}>
                      {cnt}/{FUNDS.length}
                    </span>
                  </TD>
                  <TD><AlignBadge ticker={o.ticker} /></TD>
                  <TD>{inSSS?<span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 6px',borderRadius:3}}>
                    ✓ {inSSS.days}d +{inSSS.pct.toFixed(1)}%
                  </span>:''}</TD>
                  <TD>{isMine?<span style={{fontSize:9,background:'#E4EDF8',color:'#1A4D8F',padding:'1px 6px',borderRadius:3,fontWeight:600}}>MY</span>:''}</TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── MY BOOK ───────────────────────────────────────────────────────
  const MyBookTab = () => (
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',marginBottom:6}}>
          Enter your tickers (space, comma, or line separated):
        </div>
        <textarea value={myInput}
          onChange={e=>{setMyInput(e.target.value); onMyPositionsChange&&onMyPositionsChange(e.target.value);}}
          placeholder="e.g. AAPL NVDA CASY XOM TSN SWBI"
          style={{width:'100%',padding:10,border:'1px solid #E4E1DA',borderRadius:6,
            fontFamily:'IBM Plex Mono,monospace',fontSize:12,color:'#1A1A18',
            background:'#FAFAF8',resize:'vertical',minHeight:72,outline:'none'}} />
      </div>
      {myTickers.length > 0 && (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
            <thead>
              <tr>
                <TH>Ticker</TH>
                {FUNDS.map(f=><TH key={f} right>{f}</TH>)}
                <TH right>Day Δ</TH><TH right>Wk Δ</TH>
                <TH>Quad</TH><TH>Overlap</TH><TH>SSS Signal</TH>
              </tr>
            </thead>
            <tbody>
              {myTickers.map((ticker,i) => {
                const info = tickerMap[ticker];
                const sssInfo = window.HE.SSS.find(s=>s.ticker===ticker);
                const cnt = info ? Object.keys(info.funds).length : 0;
                const dd = daily[ticker];
                const wd = weekly[ticker];
                return (
                  <tr key={i} style={{borderBottom:'1px solid #F5F3EF',background:i%2===0?'#fff':'#FAFAF8'}}>
                    <TD><span style={{fontWeight:700}}>{ticker}</span></TD>
                    {FUNDS.map(f=>{
                      const w = info?.funds[f];
                      return <TD key={f} right style={{fontWeight:w?600:400,color:w?'#27500A':'#ccc'}}>{w?`${(w*100).toFixed(2)}%`:'—'}</TD>;
                    })}
                    <TD right style={{fontSize:10,color:dd&&dd.delta>0?'#27500A':dd&&dd.delta<0?'#C8302A':'#ccc'}}>
                      {dd ? delta_fmt(dd.delta) : '—'}
                    </TD>
                    <TD right style={{fontSize:10,color:wd&&wd.delta>0?'#27500A':wd&&wd.delta<0?'#C8302A':'#ccc'}}>
                      {wd ? delta_fmt(wd.delta) : '—'}
                    </TD>
                    <TD><AlignBadge ticker={ticker} /></TD>
                    <TD>
                      {cnt===0
                        ? <span style={{fontSize:9,background:'#F1EFE8',color:'#888',padding:'1px 7px',borderRadius:3}}>Not held</span>
                        : <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:3,
                            background:cnt===FUNDS.length?'#EAF3DE':cnt>=3?'#E4EDF8':'#FFF8E1',
                            color:cnt===FUNDS.length?'#27500A':cnt>=3?'#1A4D8F':'#B8860B'}}>
                            {cnt===FUNDS.length?'All 4 funds':`${cnt}/${FUNDS.length} funds`}
                          </span>
                      }
                    </TD>
                    <TD>
                      {sssInfo
                        ? <span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 7px',borderRadius:3}}>
                            {sssInfo.days}d · +{sssInfo.pct.toFixed(1)}% · {sssInfo.sector}
                          </span>
                        : <span style={{color:'#ccc',fontSize:10}}>—</span>}
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

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      {liveSource && (
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#27500A',
          background:'#EAF3DE',padding:'3px 10px',borderRadius:3,marginBottom:12,display:'inline-flex',gap:10}}>
          <span>📂 {liveSource.source}</span>
          {liveSource.modifiedAt && (
            <span style={{color:'#5A7770'}}>
              Modified {new Date(liveSource.modifiedAt).toLocaleDateString([], {month:'short',day:'numeric',year:'2-digit'})}
            </span>
          )}
        </div>
      )}
      <FundSummary />

      {/* Sub-tabs */}
      <div style={{display:'flex',gap:6,marginBottom:16}}>
        {[
          ['flows','📊 Flows'],
          ['overlaps','Fund Overlaps'],
          ['holdings','Holdings'],
          ['mybook','My Book'],
        ].map(([k,v])=>(
          <button key={k} onClick={()=>setSubTab(k)} style={{
            padding:'6px 16px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
            fontFamily:'IBM Plex Mono,monospace',fontSize:11,
            background:subTab===k?'#1A1A18':'#fff',
            color:subTab===k?'#fff':'#7A7770',fontWeight:subTab===k?500:400}}>
            {v}
          </button>
        ))}
        {subTab === 'holdings' && (
          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
            <button onClick={()=>setShowLongs(true)} style={{padding:'5px 14px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontSize:11,background:showLongs?'#EAF3DE':'#fff',color:showLongs?'#27500A':'#7A7770'}}>LONG</button>
            <button onClick={()=>setShowLongs(false)} style={{padding:'5px 14px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontSize:11,background:!showLongs?'#FCEBEB':'#fff',color:!showLongs?'#C8302A':'#7A7770'}}>SHORT</button>
          </div>
        )}
      </div>

      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20}}>
        {subTab==='flows' && <FlowsTab />}
        {subTab==='holdings' && (
          <>
            <div style={{display:'flex',gap:6,marginBottom:16}}>
              {FUNDS.map(f=>(
                <button key={f} onClick={()=>setActiveFund(f)} style={{
                  padding:'5px 16px',border:`1px solid ${activeFund===f?fundColors[f]:'#E4E1DA'}`,
                  borderRadius:4,cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontSize:11,
                  background:activeFund===f?fundColors[f]:'#fff',
                  color:activeFund===f?'#fff':'#7A7770',fontWeight:activeFund===f?600:400}}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{overflowX:'auto'}}><HoldingsTable fund={activeFund} /></div>
          </>
        )}
        {subTab==='overlaps' && <OverlapsTable />}
        {subTab==='mybook' && <MyBookTab />}
      </div>
    </div>
  );
};

Object.assign(window, {HAMTab});
