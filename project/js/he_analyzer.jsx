// he_analyzer.jsx — Stock Analyzer (Sam Rahman's investment process)

const CF_WORKER = 'https://schwab-prices.hedgeye-dashboard.workers.dev';

// ── Sam's three buckets ──────────────────────────────────────────────
const BUCKETS = {
  MOAT: {
    label:  'Moat',
    desc:   'Durable competitive advantage, multi-year compounder',
    sub:    'Consistent FCF growth, pricing power, secular market dominance. These are businesses you hold for years through quad shifts.',
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
    color:  '#7A5C00',
    bg:     '#FFF8E1',
    border: '#D4A017',
    tickers: new Set(['C','SBUX','CZR','CF','NKE','INTC','WBD','PFE','PARA','MGM','HLT','MAR']),
    sectors: new Set(['GLL','Restaurants','Healthcare','Energy','Consumer Staples']),
    industryKw: ['casino','hotel','lodging','restaurant','food service','pharmaceutical','oil','gas','turnaround'],
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

// ── Analyzer Tab ─────────────────────────────────────────────────────
const AnalyzerTab = ({macroCtx}) => {
  const [input,     setInput]     = React.useState('');
  const [ticker,    setTicker]    = React.useState('');
  const [loading,   setLoading]   = React.useState(false);
  const [priceData, setPriceData] = React.useState(null);
  const [fmpData,   setFmpData]   = React.useState(null);
  const [fmpErr,    setFmpErr]    = React.useState('');
  const [fetchErr,  setFetchErr]  = React.useState('');

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
        <div style={{textAlign:'center', padding:'40px 0 60px'}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600,
            letterSpacing:'0.1em', color:'#C8C5BE', textTransform:'uppercase', marginBottom:16}}>
            Sam Rahman's Investment Process
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:600, margin:'0 auto 24px', textAlign:'left'}}>
            {Object.entries(BUCKETS).map(([key, b]) => (
              <div key={key} style={{background:b.bg, border:`1px solid ${b.border}`, borderRadius:8,
                padding:'14px 16px'}}>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:13, fontWeight:700,
                  color:b.color, marginBottom:4}}>{b.label.toUpperCase()}</div>
                <div style={{fontSize:10, color:b.color, lineHeight:1.5}}>{b.desc}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11, color:'#9A9790', lineHeight:1.8, maxWidth:520, margin:'0 auto'}}>
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
              ) : (
                <div style={{marginBottom:14, fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                  color:'#9A9790', padding:'8px 0'}}>
                  Revenue data unavailable — quarterly income statements may require FMP plan upgrade
                </div>
              )}

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
            {(!fmpKey || fmpErr) && (
              <div style={{marginTop:10, borderTop:'1px solid #F5F3EF', paddingTop:8,
                fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                color: fmpErr ? '#C8302A' : '#9A9790'}}>
                {fmpErr || 'Add an FMP API key in ⚙ Settings to unlock Fundamentals (financialmodelingprep.com free tier)'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

Object.assign(window, { AnalyzerTab });
