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

  // Portfolio signals — no FMP needed
  const hamHoldings   = HE.getHamArray(macroCtx);
  const hamEntry      = ticker ? hamHoldings.find(h => h.ticker === ticker) : null;
  const investLongs   = macroCtx?.pdf?.investing_ideas?.longs  ?? {};
  const investShorts  = macroCtx?.pdf?.investing_ideas?.shorts ?? {};
  const investNeutral = macroCtx?.pdf?.investing_ideas?.neutral ?? [];
  const levelData     = ticker ? (macroCtx?.levels?.[ticker] ?? null) : null;
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
                      color: levelData.signal === 'BULLISH' ? '#27500A' : '#C8302A'}}>
                      {levelData.signal ?? '—'}
                    </div>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#7A7770'}}>
                      LRR <span style={{fontWeight:700, color:'#1A1A18'}}>${levelData.lrr ?? '—'}</span>
                      {'  '}TRR <span style={{fontWeight:700, color:'#1A1A18'}}>${levelData.trr ?? '—'}</span>
                    </div>
                    {levelData.close && (
                      <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790'}}>
                        Close <span style={{fontWeight:700, color:'#1A1A18'}}>${levelData.close}</span>
                        <span style={{marginLeft:6, color: levelData.close >= levelData.lrr ? '#27500A' : '#C8302A', fontWeight:700}}>
                          {levelData.close >= (levelData.trr||0) ? '▲ ABOVE TRR'
                           : levelData.close >= (levelData.lrr||0) ? '✓ IN RANGE'
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

Object.assign(window, { AnalyzerTab });
