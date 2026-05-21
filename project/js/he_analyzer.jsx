// he_analyzer.jsx — Stock Analyzer (Sam Rahman's investment process)

const CF_WORKER = 'https://schwab-prices.hedgeye-dashboard.workers.dev';

// ── Sam's three buckets ──────────────────────────────────────────────
const BUCKETS = {
  MOAT: {
    label:  'Moat',
    desc:   'Durable competitive advantage, multi-year compounder',
    sub:    'Consistent FCF growth, pricing power, secular market dominance. These are businesses you hold for years through quad shifts.',
    detail: 'A Moat company has a structural barrier — exchange monopoly, network effects, switching costs, brand — that lets it grow FCF regardless of the macro environment. Sam sizes these up during periods of macro-driven price compression (Q3/Q4 headwinds) and holds through multiple quad cycles. The investment thesis is the business moat, not the quarter.',
    color:  '#27500A',
    bg:     '#EAF3DE',
    border: '#7AB648',
    // Sam's known examples + logical extensions
    tickers: new Set(['AAPL','GOOGL','GOOG','AMZN','ADI','CBOE','NDAQ','LNG','MSFT','V','MA','MELI','BRK.B','BRK.A','CME','ICE','SPGI','MCO']),
    // Hedgeye sectors that lean Moat
    sectors: new Set(['Communications','Financials']),
    industryKw: ['exchange','payment network','capital markets','financial data','enterprise software','cloud platform'],
    quadCompatibility: { Q1:'strong', Q2:'strong', Q3:'neutral', Q4:'neutral' },
    addWhen: 'Any quad — best entries when macro headwinds temporarily compress the price',
    chartPos: { x: 0.60, y: 0.28 },
    exampleTickers: ['AAPL','GOOGL','MSFT','V','MA','CME','CBOE','SPGI'],
  },
  SCURVE: {
    label:  'S-Curve',
    desc:   'Secular growth — AI, semis, supply chain infrastructure',
    sub:    'Early-to-mid innings of a multi-year secular growth cycle. Macro matters less when the secular tailwind is strong enough.',
    detail: 'An S-Curve name is in the early-to-middle innings of a secular growth cycle that spans multiple years — AI infrastructure, semiconductor capex, power grid buildout. The secular tailwind is large enough to override a single bad quad, but Q1/Q2 quads (growth accelerating) provide the best entry and hold environment. In Q3/Q4 (slowing growth), the secular story may persist but near-term risk/reward deteriorates.',
    color:  '#1A4D8F',
    bg:     '#E4EDF8',
    border: '#5B8FD8',
    tickers: new Set(['AVGO','KLA','KLAC','GEV','STX','COHR','CAT','NVDA','AMD','TSM','AMAT','LRCX','MRVL','ONTO','TSSI','SITM','POET','CRWV','ASML','SMCI','ARM','PLTR','ORCL']),
    sectors: new Set(['Global Tech','Industrials','Digital Assets']),
    industryKw: ['semiconductor','electronic component','semiconductor equipment','power system','industrial automation','data center','networking'],
    quadCompatibility: { Q1:'strong', Q2:'strong', Q3:'caution', Q4:'avoid' },
    addWhen: 'Q1 or Q2 entries preferred — step aside or trim into Q3 / Q4 unless secular cycle dominates',
    chartPos: { x: 0.82, y: 0.62 },
    exampleTickers: ['NVDA','AVGO','AMD','AMAT','GEV','CAT','PLTR','ORCL'],
  },
  IDIO: {
    label:  'Idiosyncratic',
    desc:   'Management change, turnaround, or business transformation',
    sub:    'Company-specific catalyst that can work in any quad. The thesis is about the business change, not the macro.',
    detail: 'An Idiosyncratic name has a company-specific catalyst — new CEO, spin-off, balance sheet restructuring, product turnaround — that can generate alpha independent of the macro quad. The thesis is not "this sector is in favor"; it\'s "this company is in the middle of a fundamental business change." Because the catalyst is internal, macro headwinds matter less, but you must size conservatively and hedge macro exposure separately.',
    color:  '#7A5C00',
    bg:     '#FFF8E1',
    border: '#D4A017',
    tickers: new Set(['C','SBUX','CZR','CF','NKE','INTC','WBD','PFE','PARA','MGM','HLT','MAR']),
    sectors: new Set(['GLL','Restaurants','Healthcare','Energy','Consumer Staples']),
    industryKw: ['casino','hotel','lodging','restaurant','food service','pharmaceutical','oil','gas','turnaround'],
    quadCompatibility: { Q1:'neutral', Q2:'neutral', Q3:'neutral', Q4:'neutral' },
    addWhen: 'Any quad — the catalyst is company-specific; hedge macro exposure separately',
    chartPos: { x: 0.28, y: 0.22 },
    exampleTickers: ['C','SBUX','NKE','INTC','MGM','HLT','PFE','WBD'],
  },
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

// ── Quad compatibility badge metadata ────────────────────────────────
const QUAD_COMPAT_META = {
  strong:  { label: '✓ STRONG',  color: '#27500A', bg: '#EAF3DE', border: '#7AB648' },
  neutral: { label: '— NEUTRAL', color: '#7A5C00', bg: '#FFF8E1', border: '#D4A017' },
  caution: { label: '⚠ CAUTION', color: '#B35A00', bg: '#FFF0E0', border: '#E0901A' },
  avoid:   { label: '✗ AVOID',   color: '#C8302A', bg: '#FCEBEB', border: '#E07070' },
};

// ── 2×2 Bucket Positioning Chart ─────────────────────────────────────
const BucketPositioningChart = ({ activeBucket }) => {
  const W = 480, H = 270;
  const PL = 50, PR = 12, PT = 14, PB = 44;
  const CW = W - PL - PR;
  const CH = H - PT - PB;
  const toX = v => PL + v * CW;
  const toY = v => PT + (1 - v) * CH;

  const qBgs = [
    { x:0,   y:0.5, w:0.5, h:0.5, fill:'#EAF3DE', label:'Secular Compounder',  lx:0.01, ly:0.98, anchor:'start' },
    { x:0.5, y:0.5, w:0.5, h:0.5, fill:'#E4EDF8', label:'Cyclical Growth',      lx:0.99, ly:0.98, anchor:'end'   },
    { x:0,   y:0,   w:0.5, h:0.5, fill:'#FFF8E1', label:'Event-Driven',         lx:0.01, ly:0.02, anchor:'start' },
    { x:0.5, y:0,   w:0.5, h:0.5, fill:'#F5F3EF', label:'Macro Play',           lx:0.99, ly:0.02, anchor:'end'   },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block', maxWidth:480, fontFamily:'IBM Plex Mono,monospace'}}>
      {/* Quadrant backgrounds */}
      {qBgs.map((q, i) => (
        <g key={i}>
          <rect
            x={toX(q.x)} y={toY(q.y + q.h)}
            width={q.w * CW} height={q.h * CH}
            fill={q.fill} opacity={0.3}
          />
          <text
            x={toX(q.lx)} y={toY(q.ly)}
            textAnchor={q.anchor} fill="#B0ADA5"
            fontSize={7.5} letterSpacing="0.06em" fontWeight={500}
          >{q.label}</text>
        </g>
      ))}

      {/* Axis border + midlines */}
      <line x1={PL} y1={PT} x2={PL} y2={PT+CH} stroke="#C8C5BE" strokeWidth={1} />
      <line x1={PL} y1={PT+CH} x2={PL+CW} y2={PT+CH} stroke="#C8C5BE" strokeWidth={1} />
      <line x1={PL+CW/2} y1={PT} x2={PL+CW/2} y2={PT+CH} stroke="#C8C5BE" strokeWidth={0.5} strokeDasharray="4,3" />
      <line x1={PL} y1={PT+CH/2} x2={PL+CW} y2={PT+CH/2} stroke="#C8C5BE" strokeWidth={0.5} strokeDasharray="4,3" />

      {/* Bucket zones */}
      {Object.entries(BUCKETS).map(([key, b]) => {
        const cx = toX(b.chartPos.x);
        const cy = toY(b.chartPos.y);
        const isActive = key === activeBucket;
        const rx = isActive ? 48 : 38;
        const ry = isActive ? 32 : 25;
        return (
          <g key={key}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
              fill={isActive ? b.bg : '#F5F3EF'}
              stroke={isActive ? b.border : '#C8C5BE'}
              strokeWidth={isActive ? 2 : 1}
              opacity={isActive ? 1 : 0.75}
            />
            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
              fill={isActive ? b.color : '#9A9790'}
              fontSize={isActive ? 9.5 : 8.5}
              fontWeight={isActive ? 700 : 500}
              letterSpacing="0.07em"
            >{b.label.toUpperCase()}</text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={PL + CW/2} y={H - 8} textAnchor="middle" fill="#7A7770" fontSize={8} fontWeight={600} letterSpacing="0.1em">
        GROWTH DEPENDENCY →
      </text>
      <text x={13} y={PT + CH/2} textAnchor="middle" fill="#7A7770" fontSize={8} fontWeight={600} letterSpacing="0.1em"
        transform={`rotate(-90, 13, ${PT + CH/2})`}>
        MACRO SENSITIVITY →
      </text>

      {/* Axis LOW/HIGH hints */}
      <text x={PL+3}    y={PT+CH-4} textAnchor="start" fill="#C8C5BE" fontSize={6.5}>LOW</text>
      <text x={PL+CW-3} y={PT+CH-4} textAnchor="end"   fill="#C8C5BE" fontSize={6.5}>HIGH</text>
      <text x={PL+3}    y={PT+10}   textAnchor="start" fill="#C8C5BE" fontSize={6.5}>HIGH</text>
      <text x={PL+3}    y={PT+CH-14} textAnchor="start" fill="#C8C5BE" fontSize={6.5}>LOW</text>
    </svg>
  );
};

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
  console.log('[AnalyzerTab] FMP key:', qs.fmpKey ? 'SET' : 'NOT SET', '| live SSS tickers:', liveSssTickers.size || 'none');
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

      {/* Empty state */}
      {!showResults && !loading && (
        <div style={{padding:'0 0 40px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
            letterSpacing:'0.12em', color:'#C8C5BE', textTransform:'uppercase', marginBottom:16}}>
            Sam Rahman's Investment Process — Bucket Guide
          </div>

          {/* 3 bucket cards — clickable to expand */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14}}>
            {Object.entries(BUCKETS).map(([key, b]) => {
              const isOpen = expandedBucket === key;
              return (
                <div key={key}
                  onClick={() => setExpandedBucket(isOpen ? null : key)}
                  style={{background: isOpen ? b.bg : '#fff',
                    border:`1px solid ${isOpen ? b.border : '#E4E1DA'}`,
                    borderRadius:8, padding:'14px 16px', cursor:'pointer',
                    transition:'all 0.15s ease'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:13, fontWeight:700,
                        color: isOpen ? b.color : '#1A1A18', marginBottom:4, letterSpacing:'0.06em'}}>
                        {b.label.toUpperCase()}
                      </div>
                      <div style={{fontSize:10, color: isOpen ? b.color : '#7A7770', lineHeight:1.5}}>
                        {b.desc}
                      </div>
                    </div>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                      color: isOpen ? b.color : '#C8C5BE', marginLeft:8, flexShrink:0}}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded bucket detail panel */}
          {expandedBucket && (() => {
            const b = BUCKETS[expandedBucket];
            return (
              <div style={{background:b.bg, border:`1px solid ${b.border}`,
                borderRadius:8, padding:'18px 20px', marginBottom:14}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:20, alignItems:'start'}}>

                  {/* Left: description + add-when */}
                  <div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700,
                      color:b.color, marginBottom:8, letterSpacing:'0.06em'}}>
                      {b.label.toUpperCase()} — DEFINITION
                    </div>
                    <div style={{fontSize:12, color:'#333', lineHeight:1.75, marginBottom:14}}>
                      {b.detail}
                    </div>
                    <div style={{borderTop:`1px solid ${b.border}40`, paddingTop:12, marginBottom:12}}>
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:b.color,
                        fontWeight:700, letterSpacing:'0.1em', marginBottom:5}}>WHEN TO ADD</div>
                      <div style={{fontSize:11, color:'#444', lineHeight:1.6}}>{b.addWhen}</div>
                    </div>
                    <div>
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:b.color,
                        fontWeight:700, letterSpacing:'0.1em', marginBottom:6}}>EXAMPLE NAMES</div>
                      <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
                        {b.exampleTickers.map(t => (
                          <span key={t} onClick={e => { e.stopPropagation(); setInput(t); }}
                            style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
                              padding:'3px 8px', background:b.border + '22',
                              border:`1px solid ${b.border}`, borderRadius:4,
                              color:b.color, cursor:'pointer'}}
                            title={`Click to analyze ${t}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: quad compatibility grid */}
                  <div style={{minWidth:160}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:b.color,
                      fontWeight:700, letterSpacing:'0.1em', marginBottom:8}}>QUAD COMPATIBILITY</div>
                    <div style={{display:'flex', flexDirection:'column', gap:5}}>
                      {['Q1','Q2','Q3','Q4'].map(q => {
                        const compat = b.quadCompatibility[q];
                        const cm = QUAD_COMPAT_META[compat];
                        const qd = window.HE.QUADS[q];
                        return (
                          <div key={q} style={{display:'flex', alignItems:'center', gap:8,
                            background:cm.bg, border:`1px solid ${cm.border}`,
                            borderRadius:5, padding:'5px 10px'}}>
                            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                              fontWeight:700, color:qd.color, minWidth:20}}>{q}</span>
                            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8,
                              fontWeight:600, color:cm.color}}>{cm.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 2×2 positioning chart */}
          <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:'16px 20px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
              letterSpacing:'0.12em', color:'#7A7770', marginBottom:12, textTransform:'uppercase'}}>
              Bucket Positioning — Growth vs Macro Sensitivity
            </div>
            <BucketPositioningChart activeBucket={expandedBucket} />
            <div style={{marginTop:10, fontSize:10, color:'#9A9790', lineHeight:1.7}}>
              Click a bucket above to highlight it on the chart. Enter a ticker in the search bar to run a full analysis.
            </div>
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
                  <div style={{fontSize:11, color:'#555', lineHeight:1.7, marginBottom:12}}>
                    {bucket.sub}
                  </div>
                  {/* When to add */}
                  <div style={{fontSize:10, color:'#444', lineHeight:1.6,
                    background:bucket.bg, borderRadius:5, padding:'8px 10px', marginBottom:10}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:700,
                      color:bucket.color, letterSpacing:'0.08em'}}>WHEN TO ADD · </span>
                    {bucket.addWhen}
                  </div>
                  {/* Quad compatibility grid */}
                  <div style={{borderTop:'1px solid #F5F3EF', paddingTop:10}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#9A9790',
                      letterSpacing:'0.08em', marginBottom:6, fontWeight:600}}>QUAD COMPATIBILITY</div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:4}}>
                      {['Q1','Q2','Q3','Q4'].map(q => {
                        const compat = bucket.quadCompatibility[q];
                        const cm = QUAD_COMPAT_META[compat];
                        const qd = window.HE.QUADS[q];
                        const isActive = q === currentQuad;
                        return (
                          <div key={q} style={{
                            display:'flex', alignItems:'center', gap:6,
                            background: isActive ? cm.bg : '#F9F8F5',
                            border: `1px solid ${isActive ? cm.border : '#E4E1DA'}`,
                            borderRadius:4, padding:'4px 8px',
                          }}>
                            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                              fontWeight:700, color: isActive ? qd.color : '#9A9790'}}>{q}</span>
                            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:7,
                              fontWeight:600, color: isActive ? cm.color : '#C8C5BE'}}>
                              {compat === 'strong' ? '✓' : compat === 'avoid' ? '✗' : compat === 'caution' ? '⚠' : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{color:'#9A9790', fontSize:11, lineHeight:1.7}}>
                  Could not classify <strong style={{color:'#1A1A18'}}>{ticker}</strong> into a bucket.
                  Bucket assignment uses known tickers, Hedgeye sector, and FMP industry data.
                  {!fmpKey && (
                    <div style={{marginTop:10, fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                      color:'#9A9790', borderTop:'1px solid #F5F3EF', paddingTop:8}}>
                      Add FMP key in ⚙ Settings for industry-based classification
                    </div>
                  )}
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
                    letterSpacing:'0.1em', margi