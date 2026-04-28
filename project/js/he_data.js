// he_data.js — plain JS, loaded before React components
window.HE = window.HE || {};

// ── Signal Strength Stocks (Apr 20, 2026) ──────────────────────────
window.HE.SSS = [
  {days:337,ticker:'FIVE',signalDate:'2025-05-18',priorClose:106.50,lastClose:236.30,pct:121.8,sector:'Retail',analyst:'Brian McGough'},
  {days:329,ticker:'CAT',signalDate:'2025-05-26',priorClose:343.40,lastClose:794.70,pct:131.4,sector:'Industrials',analyst:'Jay Van Sciver'},
  {days:224,ticker:'ROST',signalDate:'2025-09-08',priorClose:151.00,lastClose:227.80,pct:50.9,sector:'Retail',analyst:'Brian McGough'},
  {days:154,ticker:'OUT',signalDate:'2025-11-17',priorClose:22.10,lastClose:30.00,pct:35.9,sector:'Communications',analyst:'Andrew Freedman'},
  {days:98,ticker:'SPHR',signalDate:'2026-01-12',priorClose:95.20,lastClose:135.70,pct:42.5,sector:'Communications',analyst:'Andrew Freedman'},
  {days:91,ticker:'CASY',signalDate:'2026-01-19',priorClose:640.40,lastClose:754.70,pct:17.8,sector:'Consumer Staples',analyst:'Daniel Biolsi'},
  {days:77,ticker:'STKL',signalDate:'2026-02-02',priorClose:4.60,lastClose:6.50,pct:41.3,sector:'Consumer Staples',analyst:'Daniel Biolsi'},
  {days:70,ticker:'AMAT',signalDate:'2026-02-09',priorClose:322.50,lastClose:396.90,pct:23.1,sector:'Global Tech',analyst:'Felix Wang'},
  {days:62,ticker:'TJX',signalDate:'2026-02-17',priorClose:154.50,lastClose:160.70,pct:4.0,sector:'Retail',analyst:'Brian McGough'},
  {days:56,ticker:'ENB',signalDate:'2026-02-23',priorClose:51.50,lastClose:52.70,pct:2.2,sector:'Energy',analyst:'Fernando Valle'},
  {days:56,ticker:'DAR',signalDate:'2026-02-23',priorClose:7.00,lastClose:7.10,pct:1.4,sector:'Energy',analyst:'Fernando Valle'},
  {days:49,ticker:'CAVA',signalDate:'2026-03-02',priorClose:82.50,lastClose:94.80,pct:14.9,sector:'Restaurants',analyst:'Bennett Cheer'},
  {days:49,ticker:'ACHC',signalDate:'2026-03-02',priorClose:23.40,lastClose:27.00,pct:15.2,sector:'Healthcare',analyst:'Tom Tobin'},
  {days:42,ticker:'CHRD',signalDate:'2026-03-09',priorClose:121.40,lastClose:123.60,pct:1.8,sector:'Energy',analyst:'Fernando Valle'},
  {days:42,ticker:'MUSA',signalDate:'2026-03-09',priorClose:438.40,lastClose:491.10,pct:12.0,sector:'Consumer Staples',analyst:'Daniel Biolsi'},
  {days:42,ticker:'LOTMY',signalDate:'2026-03-09',priorClose:28.80,lastClose:33.00,pct:14.3,sector:'GLL',analyst:'Sean Jenkins'},
  {days:42,ticker:'SWBI',signalDate:'2026-03-09',priorClose:14.00,lastClose:14.90,pct:6.1,sector:'Retail',analyst:'Brian McGough'},
  {days:35,ticker:'RSI',signalDate:'2026-03-16',priorClose:20.30,lastClose:22.90,pct:13.0,sector:'GLL',analyst:'Sean Jenkins'},
  {days:35,ticker:'CZR',signalDate:'2026-03-16',priorClose:28.10,lastClose:27.20,pct:-3.9,sector:'GLL',analyst:'Sean Jenkins'},
  {days:35,ticker:'PBR',signalDate:'2026-03-16',priorClose:18.60,lastClose:20.50,pct:10.1,sector:'Energy',analyst:'Fernando Valle'},
  {days:28,ticker:'FCFS',signalDate:'2026-03-23',priorClose:192.10,lastClose:206.80,pct:7.6,sector:'Financials',analyst:'Josh Steiner'},
  {days:21,ticker:'MGM',signalDate:'2026-03-30',priorClose:36.30,lastClose:38.60,pct:6.3,sector:'GLL',analyst:'Sean Jenkins'},
  {days:21,ticker:'ONTO',signalDate:'2026-03-30',priorClose:204.20,lastClose:290.80,pct:42.4,sector:'Global Tech',analyst:'Felix Wang'},
  {days:21,ticker:'TSSI',signalDate:'2026-03-30',priorClose:11.70,lastClose:14.90,pct:27.4,sector:'Global Tech',analyst:'Felix Wang'},
  {days:21,ticker:'TSN',signalDate:'2026-03-30',priorClose:63.90,lastClose:64.80,pct:1.4,sector:'Consumer Staples',analyst:'Daniel Biolsi'},
  {days:21,ticker:'SFD',signalDate:'2026-03-30',priorClose:26.70,lastClose:29.00,pct:8.7,sector:'Consumer Staples',analyst:'Daniel Biolsi'},
  {days:21,ticker:'JBS',signalDate:'2026-03-30',priorClose:17.00,lastClose:17.70,pct:4.0,sector:'Consumer Staples',analyst:'Daniel Biolsi'},
  {days:21,ticker:'ULS',signalDate:'2026-03-30',priorClose:83.90,lastClose:91.70,pct:9.3,sector:'Industrials',analyst:'Jay Van Sciver'},
  {days:14,ticker:'QSR',signalDate:'2026-04-06',priorClose:76.60,lastClose:78.30,pct:2.3,sector:'Restaurants',analyst:'Bennett Cheer'},
  {days:10,ticker:'GRMN',signalDate:'2026-04-10',priorClose:256.90,lastClose:267.40,pct:4.1,sector:'Retail',analyst:'Brian McGough'},
  {days:10,ticker:'MAR',signalDate:'2026-04-10',priorClose:354.10,lastClose:377.90,pct:6.7,sector:'GLL',analyst:'Sean Jenkins'},
  {days:10,ticker:'HLT',signalDate:'2026-04-10',priorClose:323.40,lastClose:341.00,pct:5.4,sector:'GLL',analyst:'Sean Jenkins'},
  {days:10,ticker:'ARCO',signalDate:'2026-04-10',priorClose:8.50,lastClose:9.00,pct:5.4,sector:'Restaurants',analyst:'Bennett Cheer'},
  {days:10,ticker:'CSX',signalDate:'2026-04-10',priorClose:42.20,lastClose:43.30,pct:2.6,sector:'Industrials',analyst:'Jay Van Sciver'},
  {days:10,ticker:'RTO',signalDate:'2026-04-10',priorClose:492.70,lastClose:496.30,pct:0.7,sector:'Industrials',analyst:'Jay Van Sciver'},
  {days:10,ticker:'MRVL',signalDate:'2026-04-10',priorClose:128.50,lastClose:139.70,pct:8.7,sector:'Global Tech',analyst:'Felix Wang'},
  {days:10,ticker:'PVH',signalDate:'2026-04-10',priorClose:90.70,lastClose:94.20,pct:3.8,sector:'Retail',analyst:'Brian McGough'},
  {days:10,ticker:'LRCX',signalDate:'2026-04-10',priorClose:263.70,lastClose:267.60,pct:1.5,sector:'Global Tech',analyst:'Felix Wang'},
  {days:10,ticker:'POET',signalDate:'2026-04-10',priorClose:7.00,lastClose:7.30,pct:3.1,sector:'Global Tech',analyst:'Felix Wang'},
  {days:10,ticker:'SITM',signalDate:'2026-04-10',priorClose:420.30,lastClose:503.60,pct:19.8,sector:'Global Tech',analyst:'Felix Wang'},
  {days:10,ticker:'NVDA',signalDate:'2026-04-10',priorClose:188.60,lastClose:201.70,pct:6.9,sector:'Global Tech',analyst:'Felix Wang'},
  {days:10,ticker:'AMZN',signalDate:'2026-04-10',priorClose:238.40,lastClose:250.60,pct:5.1,sector:'Retail',analyst:'Brian McGough'},
  {days:7,ticker:'YUM',signalDate:'2026-04-13',priorClose:160.10,lastClose:162.80,pct:1.7,sector:'Restaurants',analyst:'Bennett Cheer'},
  {days:7,ticker:'CFG',signalDate:'2026-04-13',priorClose:63.60,lastClose:64.50,pct:1.3,sector:'Financials',analyst:'Josh Steiner'},
  {days:7,ticker:'VIK',signalDate:'2026-04-13',priorClose:77.10,lastClose:85.80,pct:11.3,sector:'GLL',analyst:'Sean Jenkins'},
  {days:6,ticker:'CRCL',signalDate:'2026-04-14',priorClose:107.20,lastClose:105.90,pct:-1.2,sector:'Digital Assets',analyst:'Josh Steiner'},
  {days:6,ticker:'PFE',signalDate:'2026-04-14',priorClose:27.30,lastClose:27.60,pct:1.0,sector:'Healthcare',analyst:'Tom Tobin'},
  {days:5,ticker:'META',signalDate:'2026-04-15',priorClose:674.20,lastClose:688.60,pct:2.1,sector:'Communications',analyst:'Andrew Freedman'},
  {days:5,ticker:'JPM',signalDate:'2026-04-15',priorClose:306.20,lastClose:310.30,pct:1.3,sector:'Financials',analyst:'Josh Steiner'},
  {days:5,ticker:'CRWV',signalDate:'2026-04-15',priorClose:116.90,lastClose:116.90,pct:0.0,sector:'Global Tech',analyst:'Felix Wang'},
  {days:5,ticker:'TXG',signalDate:'2026-04-15',priorClose:25.50,lastClose:26.10,pct:2.3,sector:'Healthcare',analyst:'Tom Tobin'},
  {days:4,ticker:'JBHT',signalDate:'2026-04-16',priorClose:240.20,lastClose:245.10,pct:2.0,sector:'Industrials',analyst:'Jay Van Sciver'},
  {days:4,ticker:'GOOGL',signalDate:'2026-04-16',priorClose:337.60,lastClose:341.70,pct:1.2,sector:'Communications',analyst:'Andrew Freedman'},
  {days:4,ticker:'AAPL',signalDate:'2026-04-16',priorClose:262.50,lastClose:270.20,pct:2.9,sector:'Global Tech',analyst:'Felix Wang'},
  {days:4,ticker:'PEP',signalDate:'2026-04-16',priorClose:158.10,lastClose:157.70,pct:-0.3,sector:'Consumer Staples',analyst:'Daniel Biolsi'},
  {days:4,ticker:'LYV',signalDate:'2026-04-16',priorClose:159.40,lastClose:156.60,pct:-1.8,sector:'Communications',analyst:'Andrew Freedman'},
  {days:3,ticker:'WRBY',signalDate:'2026-04-17',priorClose:24.90,lastClose:24.90,pct:0.0,sector:'Retail',analyst:'Brian McGough'},
  {days:3,ticker:'REAL',signalDate:'2026-04-17',priorClose:55.00,lastClose:55.00,pct:0.0,sector:'Retail',analyst:'Brian McGough'},
];

// ── Quad Framework ─────────────────────────────────────────────────
window.HE.QUADS = {
  Q1:{name:'Goldilocks',color:'#27500A',bg:'#EAF3DE',desc:'Growth ↑  Inflation ↑',
      bestAssets:'Equities, Credit, Commodities, FX',worstAssets:'Fixed Income, USD',
      bestSectors:'Tech, Cons. Disc., Materials, Industrials, Telecom',
      worstSectors:'Utilities, REITs, Staples, Financials, Energy'},
  Q2:{name:'Reflation',color:'#B8860B',bg:'#FFF8E1',desc:'Growth ↑↑  Inflation ↑↑',
      bestAssets:'Commodities, Equities, Credit, FX',worstAssets:'Fixed Income, USD',
      bestSectors:'Tech, Cons. Disc., Industrials, Energy, Financials',
      worstSectors:'Telecom, Utilities, REITs, Staples, Health Care'},
  Q3:{name:'Stagflation',color:'#C8302A',bg:'#FCEBEB',desc:'Growth ↓  Inflation ↑',
      bestAssets:'Gold, Commodities, Fixed Income',worstAssets:'Credit',
      bestSectors:'Utilities, Tech, Energy, Industrials, Cons. Disc.',
      worstSectors:'Financials, REITs, Materials, Telecom, Staples'},
  Q4:{name:'Deflation',color:'#1A4D8F',bg:'#E4EDF8',desc:'Growth ↓  Inflation ↓',
      bestAssets:'Fixed Income, Gold, USD',worstAssets:'Commodities, Equities, Credit, FX',
      bestSectors:'Staples, Utilities, REITs, Health Care, Telecom',
      worstSectors:'Energy, Tech, Industrials, Financials, Materials'},
};

// ── ETF Re-Ranks ───────────────────────────────────────────────────
window.HE.ETF_RERANKS = [
  {date:'Apr 21',topMovers:[{ticker:'AAAU',pts:'+3'},{ticker:'XTL',pts:'+2'},{ticker:'EQRR',pts:'+1'}]},
  {date:'Apr 20',topMovers:[{ticker:'GII',pts:'+11'},{ticker:'ARGT',pts:'+7'},{ticker:'EQRR',pts:'+2'}]},
  {date:'Apr 17',topMovers:[{ticker:'AAAU',pts:'+5'},{ticker:'ARGT',pts:'+4'},{ticker:'XLU',pts:'+4'}]},
  {date:'Apr 16',topMovers:[{ticker:'AAAU',pts:'+8'},{ticker:'ARGT',pts:'+8'},{ticker:'YCS',pts:'+6'}]},
  {date:'Apr 14',topMovers:[{ticker:'TPYP',pts:'+11'},{ticker:'XLU',pts:'+7'},{ticker:'AAAU',pts:'+7'}]},
  {date:'Apr 13',topMovers:[{ticker:'AAAU',pts:'+8'},{ticker:'XLU',pts:'+7'},{ticker:'XTL',pts:'+4'}]},
  {date:'Apr 10',topMovers:[{ticker:'XTL',pts:'+9'},{ticker:'NORW',pts:'+5'},{ticker:'XLU',pts:'+4'}]},
  {date:'Apr 9', topMovers:[{ticker:'XTL',pts:'+9'},{ticker:'NORW',pts:'+7'},{ticker:'XLE',pts:'+6'}]},
  {date:'Apr 8', topMovers:[{ticker:'COM',pts:'+11'},{ticker:'XTL',pts:'+8'},{ticker:'NORW',pts:'+3'}]},
];

// ── ETF Streak (appearances in top-3 re-rank) ──────────────────────
window.HE.ETF_STREAK = {
  dates: ['Apr 8','Apr 9','Apr 10','Apr 13','Apr 14','Apr 16','Apr 17','Apr 20','Apr 21'],
  tickers: {
    AAAU: {desc:'Physical Gold ETF',appearances:5,
      data:{'Apr 13':1,'Apr 14':3,'Apr 16':1,'Apr 17':1,'Apr 21':1}},
    XTL:  {desc:'S&P Telecom ETF — defensive',appearances:5,
      data:{'Apr 8':2,'Apr 9':1,'Apr 10':1,'Apr 13':3,'Apr 21':2}},
    XLU:  {desc:'Utilities Select Sector ETF',appearances:4,
      data:{'Apr 10':3,'Apr 13':2,'Apr 14':2,'Apr 17':3}},
    ARGT: {desc:'Global X MSCI Argentina ETF',appearances:3,
      data:{'Apr 16':2,'Apr 17':2,'Apr 20':2}},
    NORW: {desc:'iShares MSCI Norway ETF',appearances:3,
      data:{'Apr 8':3,'Apr 9':2,'Apr 10':2}},
    EQRR: {desc:'ProShares Equities for Rising Rates',appearances:2,
      data:{'Apr 20':3,'Apr 21':3}},
    GII:  {desc:'Global Infrastructure ETF',appearances:1,
      data:{'Apr 20':1}},
    TPYP: {desc:'Tortoise North American Pipeline ETF',appearances:1,
      data:{'Apr 14':1}},
    COM:  {desc:'Direxion Auspice Broad Commodity ETF',appearances:1,
      data:{'Apr 8':1}},
    YCS:  {desc:'ProShares Ultra Short Yen',appearances:1,
      data:{'Apr 16':3}},
    XLE:  {desc:'Energy Select Sector ETF',appearances:1,
      data:{'Apr 9':3}},
  },
};

// ── Research Library ───────────────────────────────────────────────
window.HE.RESEARCH = [
  {category:"Founder's Choice",color:'#8B2252',pinned:true,files:[
    {name:'Global Technology — Best Idea Longs & Shorts (Felix Wang)',date:'Apr 2026',
      projectPath: (window.__resources?.foundersTech    || 'pdfs/founders_tech.pdf')},
    {name:'Financials — Best Idea Longs & Shorts (Josh Steiner)',date:'Apr 2026',
      projectPath: (window.__resources?.foundersFinancials || 'pdfs/founders_financials.pdf')},
  ]},
  {category:'Early Look',color:'#1A4D8F',files:[
    {name:'#Quad2 Peace & Love = ATH',date:'Apr 16'},
    {name:'#Quad2 Squeeze Continues',date:'Apr 16'},
    {name:'#Quad2 Breakout, It Was',date:'Apr 13'},
    {name:'2 Kinds of #Quad3',date:''},{name:'Is There A Cease Fire For #Quad3?',date:''},
    {name:'Oil, Energy Stocks & Bonds Confirm Bullish TREND',date:''},
    {name:'The Horse and the Rider',date:''},{name:'The Matthew Effect',date:''},
    {name:"The Process Doesn't Care About Your Thesis",date:''},
  ]},
  {category:'Macro Show',color:'#7A5C00',files:[
    {name:'KM/MC — Apr 21',date:'Apr 21'},{name:'KM/DJ — Apr 20',date:'Apr 20'},
    {name:'RR/RPK — Apr 17',date:'Apr 17'},{name:'SR/RPK — Apr 16',date:'Apr 16'},
    {name:'RR/RPK — Apr 14',date:'Apr 14'},{name:'KM/DJ — Apr 14',date:'Apr 14'},
    {name:'KM/DJ — Apr 13',date:'Apr 13'},{name:'KM/MC — Apr 10',date:'Apr 10'},
    {name:'KM/MC — Apr 9',date:'Apr 9'},{name:'KM/EV — Apr 8',date:'Apr 8'},
    {name:'David Salem — Apr 7',date:'Apr 7'},{name:'KM/DJ — Apr 6',date:'Apr 6'},
  ]},
  {category:'Macro Research',color:'#4A4A40',files:[
    {name:'2Q26 Macro Themes Deck',date:'Apr 2026'},
    {name:'Quads/GIP Update — Updated 2Q26 Macro Themes',date:'Apr 2026'},
    {name:'1Q26 Mid-Quarter Update',date:''},
    {name:'Monthly Inflation Nowcast',date:''},
    {name:'Industrial Activity — Flowers, Togas & Old Guys',date:''},
    {name:'The RoC Report — Stag On A Lag',date:''},
    {name:'ETF Pro Plus: April Update Q2 2026',date:'Apr 2026'},
    {name:'Iran Flash Call — Geopolitics: Spanning The Globe',date:'Apr 2026'},
  ]},
  {category:'Market Situation Reports',color:'#C8302A',files:[
    {name:'Weekly Game Plan Apr 20–25',date:'Apr 20'},{name:'April OpEx',date:'Apr 17'},
    {name:'Volatility Compression',date:'Apr 16'},{name:'Counter To The Trend',date:'Apr 14'},
    {name:'Weekly Game Plan Apr 13–17',date:'Apr 13'},
    {name:'Stark Contrast In Positioning',date:'Apr 10'},
    {name:'An Atypical Selloff',date:'Apr 9'},
  ]},
  {category:'Investing Ideas',color:'#27500A',files:[
    {name:'Newsletter — Apr 20, 2026',date:'Apr 20'},
    {name:'Newsletter — Apr 13, 2026',date:'Apr 13'},
  ]},
  {category:'Portfolio Solutions — ETF Re-Ranks',color:'#285C8C',files:[
    {name:'4/21 — AAAU +3, XTL +2, EQRR +1',date:'Apr 21'},
    {name:'4/20 — GII +11, ARGT +7, EQRR +2',date:'Apr 20'},
    {name:'4/17 — AAAU +5, ARGT +4, XLU +4',date:'Apr 17'},
    {name:'4/16 — AAAU +8, ARGT +8, YCS +6',date:'Apr 16'},
    {name:'4/14 — TPYP +11, XLU +7, AAAU +7',date:'Apr 14'},
    {name:'4/13 — AAAU +8, XLU +7, XTL +4',date:'Apr 13'},
    {name:'4/10 — XTL +9, NORW +5, XLU +4',date:'Apr 10'},
    {name:'4/9 — XTL +9, NORW +7, XLE +6',date:'Apr 9'},
    {name:'4/8 — COM +11, XTL +8, NORW +3',date:'Apr 8'},
  ]},
  {category:'MOMO Tracker',color:'#5C2D8C',files:[
    {name:'April 21st — Intraday Mean Reversion',date:'Apr 21'},
    {name:'Mag7 +2.5%, AAPL=BULL, ATHs, Peace & Love',date:'Apr 20'},
    {name:'Mag7 +2.6%, 7/9 Downside/Upside, Quad3 Confirms',date:''},
    {name:'Mag7 +3%, META=BULL, "Fastest Pace Ever"',date:''},
    {name:'Mag7 +1%, AAPL=BULL, $USD Breakdown',date:''},
  ]},
  {category:'Crypto / BTC Tracker',color:'#B8860B',files:[
    {name:'BTC +0.7%, COIN=BULL + Agentic Market Launch',date:''},
    {name:'BTC +1.3%, AVAX/XRP=BULL',date:''},{name:'BTC +3.3%, Crypto Allocation',date:''},
    {name:'BTC -0.6%, Pre-IPO Markets',date:''},{name:'BTC -2.1%, ETFs=+$954M WoW',date:''},
    {name:'BTC -2.7%, MSTR=BULL, COIN=NEUT',date:''},
    {name:'BTC/IBIT/BLOK=BULL, Warsh Crypto Positions',date:''},
  ]},
  {category:'The Call — Summaries',color:'#1A4D8F',files:[
    {name:'The Call — 4/20/2026',date:'Apr 20'},{name:'The Call — 4/17/2026',date:'Apr 17'},
    {name:'The Call — 4/16/2026',date:'Apr 16'},{name:'The Call — 4/14/2026',date:'Apr 14'},
    {name:'The Call — 4/13/2026',date:'Apr 13'},{name:'The Call — 4/10/2026',date:'Apr 10'},
    {name:'The Call — 4/9/2026',date:'Apr 9'},
  ]},
];

// ── API URL Builder (Netlify proxy on hosted, corsproxy.io on file://) ────────
window.HE.apiUrl = {
  _isFile: () => window.location.protocol === 'file:',
  _cp: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,

  yfQuote(symbols) {
    const syms = Array.isArray(symbols) ? symbols.join(',') : symbols;
    return `/api/yf-quote?symbols=${encodeURIComponent(syms)}`;
  },

  yfChart(symbol, interval = '1d', range = '3mo') {
    if (this._isFile()) return this._cp(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`);
    return `/api/yf-chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`;
  },

  yfSummary(symbol, modules) {
    const m = Array.isArray(modules) ? modules.join(',') : (modules || 'defaultKeyStatistics,financialData,summaryDetail,earningsTrend,recommendationTrend,assetProfile');
    if (this._isFile()) return this._cp(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${m}`);
    return `/api/yf-summary?symbol=${encodeURIComponent(symbol)}&modules=${m}`;
  },

  fmp(path, apikey) {
    if (this._isFile()) {
      if (!apikey) return null;
      const sep = path.includes('?') ? '&' : '?';
      return `https://financialmodelingprep.com/api${path}${sep}apikey=${apikey}`;
    }
    const p = new URLSearchParams({ path });
    if (apikey) p.set('apikey', apikey);
    return `/api/fmp?${p}`;
  },
};

// ── Quad State (localStorage, updated by research ingestion) ──────────────────
window.HE.loadQuadState = function() {
  try {
    return JSON.parse(localStorage.getItem('he_quad_state') || 'null') || {};
  } catch { return {}; }
};

window.HE.saveQuadState = function(patch) {
  try {
    const s = window.HE.loadQuadState();
    Object.assign(s, patch);
    localStorage.setItem('he_quad_state', JSON.stringify(s));
    return s;
  } catch { return patch; }
};

// Dispatch event so App component can react to research-driven quad updates
window.HE.applyResearchQuads = function(monthly, quarterly, source) {
  const patch = { researchSource: source, researchDate: new Date().toISOString() };
  if (monthly) patch.monthly = monthly;
  if (quarterly) patch.quarterly = quarterly;
  window.HE.saveQuadState(patch);
  window.dispatchEvent(new CustomEvent('he_quad_updated', { detail: patch }));
};

// ── HAM Holdings Cache ─────────────────────────────────────────────────────────
window.HE._hamCache = null;

window.HE.loadHamCache = async function() {
  if (window.HE._hamCache) return window.HE._hamCache;
  try {
    const txt = await fetch(window.__resources?.hamCsv || './data/ham_holdings_latest.csv').then(r => r.text());
    const rows = window.HE.parseCSV(txt);
    const cache = {};
    rows.forEach(r => {
      const w = parseFloat((r.Weightings || '0').replace('%', '')) / 100 || 0;
      if (w > 0 && !(r.StockTicker || '').includes('-TRS-') && r.StockTicker !== 'Cash&Other' && r.MoneyMarketFlag !== 'Y') {
        if (!cache[r.StockTicker]) cache[r.StockTicker] = {};
        cache[r.StockTicker][r.Account] = w;
      }
    });
    window.HE._hamCache = cache;
    return cache;
  } catch { return {}; }
};

// ── CSV Parser ─────────────────────────────────────────────────────
window.HE.parseCSV = function(text) {
  const lines = text.replace(/\r/g,'').trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    vals.push(cur.trim());
    return Object.fromEntries(headers.map((h,i) => [h, vals[i]||'']));
  });
};

// ── RTA Stats Calculator ───────────────────────────────────────────
window.HE.computeRTAStats = function(trades) {
  const closed = trades.filter(t => t['Close Date'] && t['Realized Return'] !== '');
  const returns = closed.map(t => parseFloat(t['Realized Return'])||0);
  const wins = returns.filter(r => r > 0).length;
  const losses = returns.filter(r => r <= 0).length;

  // By year
  const byYear = {};
  closed.forEach(t => {
    const y = (t['Close Date']||'').slice(0,4);
    if (!y || y.length !== 4 || isNaN(+y)) return;
    if (!byYear[y]) byYear[y] = {count:0,wins:0,sumReturn:0,best:-Infinity,worst:Infinity};
    const r = parseFloat(t['Realized Return'])||0;
    byYear[y].count++;
    if (r > 0) byYear[y].wins++;
    byYear[y].sumReturn += r;
    if (r > byYear[y].best) byYear[y].best = r;
    if (r < byYear[y].worst) byYear[y].worst = r;
  });

  // Cumulative P&L — last 600 trades by close date
  const chronological = [...closed]
    .sort((a,b) => new Date(a['Close Date']) - new Date(b['Close Date']))
    .slice(-600);
  let cum = 0;
  const cumPnl = chronological.map(t => {
    cum += parseFloat(t['Realized Return'])||0;
    return {date:(t['Close Date']||'').slice(0,10), cum, r:parseFloat(t['Realized Return'])||0};
  });

  // Best/worst
  const sorted = [...closed].sort((a,b) =>
    (parseFloat(b['Realized Return'])||0) - (parseFloat(a['Realized Return'])||0));

  return {
    total: closed.length,
    wins, losses,
    winRate: closed.length ? wins/closed.length : 0,
    avgReturn: returns.length ? returns.reduce((a,b)=>a+b,0)/returns.length : 0,
    byYear,
    cumPnl,
    best: sorted[0],
    worst: sorted[sorted.length-1],
    recentTrades: [...closed]
      .sort((a,b) => new Date(b['Close Date']) - new Date(a['Close Date']))
      .slice(0,300),
  };
};
