// Netlify Function — stock quote proxy
// Primary:  Yahoo Finance v8 chart (no auth, per-symbol parallel)
// Fallback: Twelve Data batch quote (requires TWELVE_DATA_KEY env var)
//
// To enable Twelve Data: add TWELVE_DATA_KEY to Netlify environment variables.
// Free key at https://twelvedata.com (800 API credits/day, no credit card).

const YF_CHART = 'https://query2.finance.yahoo.com/v8/finance/chart';
const TD_BASE  = 'https://api.twelvedata.com/quote';

const UA   = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

// Yahoo Finance uses ^ prefix for indices; Twelve Data uses different symbols
const TD_SYMBOL_MAP = {
  '^VIX':  'VIX',
  '^GSPC': 'SPX',
  '^TNX':  'US10Y',
  'BTC-USD': 'BTC/USD',
};

// ── Yahoo Finance v8 ─────────────────────────────────────────────────────────
async function fetchYFv8(symbols) {
  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  console.log(`[yf-quote] YF v8: fetching ${symList.length} symbols in parallel`);

  const settled = await Promise.allSettled(symList.map(async (sym) => {
    const url = `${YF_CHART}/${encodeURIComponent(sym)}?interval=1d&range=2d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.log(`[yf-quote] YF v8 ${sym} → ${res.status}`); return null; }
    const d = await res.json();
    const meta = d.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prev = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    const cur  = meta.regularMarketPrice ?? 0;
    const chg  = cur - prev;
    return {
      symbol: sym,
      shortName: meta.shortName || sym,
      regularMarketPrice:          cur,
      regularMarketChange:         chg,
      regularMarketChangePercent:  prev ? (chg / prev * 100) : 0,
      regularMarketPreviousClose:  prev,
      regularMarketDayHigh:        meta.regularMarketDayHigh ?? cur,
      regularMarketDayLow:         meta.regularMarketDayLow  ?? cur,
      regularMarketVolume:         meta.regularMarketVolume  ?? 0,
    };
  }));

  const result = settled.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  console.log(`[yf-quote] YF v8 got ${result.length}/${symList.length} symbols`);
  return result;
}

// ── Twelve Data ──────────────────────────────────────────────────────────────
async function fetchTwelveData(symbols, apiKey) {
  const yfSyms = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const tdSyms = yfSyms.map(s => TD_SYMBOL_MAP[s] || s);
  const url    = `${TD_BASE}?symbol=${tdSyms.join(',')}&apikey=${apiKey}&dp=4`;

  console.log(`[yf-quote] Twelve Data: requesting ${yfSyms.length} symbols`);
  console.log(`[yf-quote] TD URL (key redacted): ${url.replace(apiKey, 'REDACTED')}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HedgeyeDashboard/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  console.log(`[yf-quote] TD HTTP status: ${res.status}`);
  const rawBody = await res.text();
  console.log(`[yf-quote] TD response body (first 500 chars): ${rawBody.slice(0, 500)}`);
  if (!res.ok) throw new Error(`TD HTTP ${res.status}: ${rawBody.slice(0, 200)}`);
  const data = JSON.parse(rawBody);
  if (data.code && data.status === 'error') throw new Error(`TD: ${data.message}`);

  const result = yfSyms.map((yfSym, i) => {
    const tdSym = tdSyms[i];
    // Single-symbol response is the object itself; batch is keyed by symbol
    const q = yfSyms.length === 1 ? data : data[tdSym];
    if (!q || q.status === 'error' || !q.close) return null;
    const cur  = parseFloat(q.close)          || 0;
    const prev = parseFloat(q.previous_close) || 0;
    const chg  = cur - prev;
    return {
      symbol:  yfSym,
      shortName: q.name || yfSym,
      regularMarketPrice:          cur,
      regularMarketChange:         chg,
      regularMarketChangePercent:  parseFloat(q.percent_change) || 0,
      regularMarketPreviousClose:  prev,
      regularMarketDayHigh:        parseFloat(q.high) || cur,
      regularMarketDayLow:         parseFloat(q.low)  || cur,
      regularMarketVolume:         parseInt(q.volume)  || 0,
    };
  }).filter(Boolean);

  console.log(`[yf-quote] Twelve Data got ${result.length}/${yfSyms.length} symbols`);
  return result;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // ── DEBUG: environment check ──────────────────────────────────────
  const tdKey = process.env.TWELVE_DATA_KEY;
  console.log(`[yf-quote] ENV check — TWELVE_DATA_KEY: ${tdKey ? `set (length=${tdKey.length}, starts="${tdKey.slice(0,4)}...")` : 'NOT SET'}`);
  console.log(`[yf-quote] All env keys: ${Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('TOKEN')).join(', ')}`);

  const { symbols } = event.queryStringParameters || {};
  if (!symbols) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'symbols param required' }) };
  console.log(`[yf-quote] Request for symbols: "${symbols.slice(0, 80)}"`);

  // 1. Try Yahoo Finance v8 (no auth needed)
  try {
    const result = await fetchYFv8(symbols);
    if (result.length > 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
        body: JSON.stringify({ quoteResponse: { result, error: null } }),
      };
    }
    console.log('[yf-quote] YF v8 returned 0 results — trying Twelve Data');
  } catch (e) {
    console.error(`[yf-quote] YF v8 threw: ${e.message}`);
  }

  // 2. Twelve Data fallback (requires TWELVE_DATA_KEY env var)
  if (tdKey) {
    try {
      const result = await fetchTwelveData(symbols, tdKey);
      if (result.length > 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
          body: JSON.stringify({ quoteResponse: { result, error: null } }),
        };
      }
      console.log('[yf-quote] Twelve Data returned 0 results');
    } catch (e) {
      console.error(`[yf-quote] Twelve Data threw: ${e.message}`);
    }
  } else {
    console.log('[yf-quote] No TWELVE_DATA_KEY set — skipping TD fallback');
  }

  return {
    statusCode: 502,
    headers: CORS,
    body: JSON.stringify({
      error: 'All price sources failed.',
      hint: 'Set TWELVE_DATA_KEY in Netlify environment variables (free at twelvedata.com) to enable reliable fallback.',
    }),
  };
};
