// he_shared.jsx — shared React components, exports to window

const SignalBadge = ({signal}) => {
  const s = (signal||'').toUpperCase();
  const map = {
    BULLISH:{bg:'#EAF3DE',color:'#27500A',brd:'#3B6D11'},
    LONG:   {bg:'#EAF3DE',color:'#27500A',brd:'#3B6D11'},
    BEARISH:{bg:'#FCEBEB',color:'#C8302A',brd:'#C8302A'},
    SHORT:  {bg:'#FCEBEB',color:'#C8302A',brd:'#C8302A'},
    NEUTRAL:{bg:'#E4EDF8',color:'#1A4D8F',brd:'#1A4D8F'},
  };
  const c = map[s] || {bg:'#F1EFE8',color:'#6B6860',brd:'#ccc'};
  return (
    <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:700,letterSpacing:'0.1em',
      padding:'2px 7px',borderRadius:3,background:c.bg,color:c.color,border:`1px solid ${c.brd}`,
      textTransform:'uppercase',display:'inline-block',whiteSpace:'nowrap'}}>
      {s}
    </span>
  );
};

const StatCard = ({label,value,sub,accent,color}) => (
  <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:'14px 16px',
    ...(accent?{borderLeft:`3px solid ${accent}`}:{})}}>
    <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',textTransform:'uppercase',
      letterSpacing:'0.08em',marginBottom:5}}>{label}</div>
    <div style={{fontSize:22,fontWeight:600,fontFamily:'IBM Plex Mono,monospace',
      color:color||'#1A1A18',lineHeight:1}}>{value}</div>
    {sub && <div style={{fontSize:10,color:'#7A7770',fontFamily:'IBM Plex Mono,monospace',marginTop:3}}>{sub}</div>}
  </div>
);

const SectionTitle = ({children,mono}) => (
  <div style={{fontFamily:mono?'IBM Plex Mono,monospace':'IBM Plex Sans,sans-serif',
    fontSize:mono?10:13,fontWeight:600,letterSpacing:mono?'0.1em':'normal',
    textTransform:mono?'uppercase':'none',color:mono?'#7A7770':'#1A1A18',
    borderBottom:'1px solid #E4E1DA',paddingBottom:8,marginBottom:16}}>
    {children}
  </div>
);

const LoadingSpinner = ({msg}) => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60,
    gap:12,color:'#7A7770',fontFamily:'IBM Plex Mono,monospace',fontSize:12}}>
    <div style={{width:16,height:16,border:'2px solid #E4E1DA',borderTopColor:'#1A4D8F',
      borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />
    {msg||'Loading...'}
  </div>
);

const QuadBadge = ({quad}) => {
  const q = window.HE.QUADS[quad];
  if (!q) return null;
  return (
    <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
      padding:'3px 10px',borderRadius:4,display:'inline-flex',alignItems:'center',gap:5,
      background:q.bg,color:q.color,border:`1px solid ${q.color}`}}>
      {quad} <span style={{fontWeight:400,opacity:0.75,fontSize:9}}>{q.name.toUpperCase()}</span>
    </span>
  );
};

const TH = ({children,right}) => (
  <th style={{textAlign:right?'right':'left',padding:'6px 8px',borderBottom:'1px solid #E4E1DA',
    fontSize:9,color:'#9A9790',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,
    whiteSpace:'nowrap'}}>{children}</th>
);

const TD = ({children,right,style={}}) => (
  <td style={{padding:'7px 8px',textAlign:right?'right':'left',...style}}>{children}</td>
);

// ── NORMALIZED DATA ACCESSORS ────────────────────────────────────────
// Use these in every component instead of touching macroCtx fields directly.
// When data shapes change (e.g. parser updates), only update here.

window.HE = window.HE || {};

// ham_holdings can arrive as:
//   Wrapped:  {date, holdings:[{ticker,name,weight:"9.10%",price},...], added:[], removed:[]}
//   Flat arr: [{ticker,name,weight:"9.10%",price}]         (legacy flat)
//   Old shape: [{ticker,name,total_weight:0.09, accounts:{fund:w}}]
HE.getHamArray = (macroCtx) => {
  const raw = macroCtx?.ham_holdings;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : (raw.holdings ?? []);
  return Array.isArray(arr) ? arr : [];
};
HE.getHamMap = (macroCtx) => {
  return Object.fromEntries(HE.getHamArray(macroCtx).map(h => [h.ticker, h]));
};
// Weight as display string: "9.10%" from either data shape
HE.hamWeight = (h) => {
  if (!h) return '—';
  if (h.weight) return h.weight;
  if (h.total_weight != null) return (h.total_weight * 100).toFixed(2) + '%';
  return '—';
};
// Weight as 0–1 number from either data shape
HE.hamWeightNum = (h) => {
  if (!h) return null;
  if (h.total_weight != null) return h.total_weight;
  if (h.weight) { const n = parseFloat(h.weight); return isNaN(n) ? null : n / 100; }
  return null;
};
// Safe number format — never produces NaN/undefined in the UI
HE.fmt = (val, decimals=2, suffix='%') => {
  if (val == null || isNaN(Number(val))) return '—';
  return Number(val).toFixed(decimals) + suffix;
};
// position_sizing positions array
HE.getSizingPositions = (macroCtx) => macroCtx?.position_sizing?.positions ?? [];
// SSS detail for a ticker (null-safe)
HE.getSssDetail = (macroCtx, ticker) => macroCtx?.pdf?.sss?.tickers_detail?.[ticker] ?? null;

Object.assign(window, {SignalBadge, StatCard, SectionTitle, LoadingSpinner, QuadBadge, TH, TD});
