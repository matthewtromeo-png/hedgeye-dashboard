// Netlify Function — stock quote proxy via Twelve Data
// Fetches symbols sequentially with 500ms gaps to stay within free-tier rate limits.
// Requires TWELVE_DATA_KEY env var (free at twelvedata.com).

const TD_BASE = 'https://api.twelvedata.com/quote';
const CORS    = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

// Yahoo Finance symbol → Twelve Data symbol
const TD_MAP = {
  '^VIX':    'VIX',
  '^GSPC':   'SPX',
  '^TNX':    'US10Y',
  'BTC-USD': 'BTC/USD',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchOne(yfSym, apiKey) {
  const tdSym = TD_MAP[yfSym] || yfSym;
  const url = `${TD_BASE}?symbol=${encodeURIComponent(tdSym)}&apikey=${apiKey}&dp=4`;
  console.log(`[yf-quote] → ${yfSym} (TD: ${tdSym})`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HedgeyeDashboard/1.0' },
    signal: AbortSignal.timeout(7000),
  });
  console.log(`[yf-quote] ← ${yfSym} HTTP ${res.status}`);
  if (!res.ok) return null;
  const q = await res.json();
  if (q.status === 'error') { console.warn(`[yf-quote] TD error for ${yfSym}: ${q.message}`); return null; }
  if (!q.close) { console.warn(`[yf-quote] No close for ${yfSym}:`, JSON.stringify(q).slice(0, 200)); return null; }

  const cur  = parseFloat(q.close)          || 0;
  const prev = parseFloat(q.previous_close) || 0;
  const chg  = cur - prev;
  return {
    symbol:                     yfSym,
    shortName:                  q.name || yfSym,
    regularMarketPrice:         cur,
    regularMarketChange:        chg,
    regularMarketChangePercent: parseFloat(q.percent_change) || 0,
    regularMarketPreviousClose: prev,
    regularMarketDayHigh:       parseFloat(q.high) || cur,
    regularMarketDayLow:        parseFloat(q.low)  || cur,
    regularMarketVolume:        parseInt(q.volume)  || 0,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const tdKey = process.env.TWELVE_DATA_KEY;
  console.log(`[yf-quote] TWELVE_DATA_KEY: ${tdKey ? `set (len=${tdKey.length}, prefix="${tdKey.slice(0,4)}")` : 'NOT SET'}`);
  if (!tdKey) return {
    statusCode: 503,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'TWELVE_DATA_KEY not configured in Netlify environment variables' }),
  };

  const { symbols } = event.queryStringParameters || {};
  if (!symbols) return {
    statusCode: 400,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'symbols param required' }),
  };

  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  console.log(`[yf-quote] Fetching ${symList.length} symbols sequentially (500ms gaps): ${symList.join(', ')}`);

  const result = [];
  for (let i = 0; i < symList.length; i++) {
    if (i > 0) await sleep(500);
    try {
      const q = await fetchOne(symList[i], tdKey);
      if (q) result.push(q);
    } catch (e) {
      console.error(`[yf-quote] ${symList[i]} threw: ${e.message}`);
    }
  }

  console.log(`[yf-quote] Done: ${result.length}/${symList.length} succeeded`);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
    body: JSON.stringify({ quoteResponse: { result, error: null } }),
  };
};
