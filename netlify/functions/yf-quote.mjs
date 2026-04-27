// Netlify Function — Yahoo Finance quote proxy
// Primary: v7 quote API with crumb/session auth
// Fallback: v8 chart API (per-symbol, no auth required)

const YF_QUOTE = 'https://query1.finance.yahoo.com/v7/finance/quote';
const YF_CHART = 'https://query2.finance.yahoo.com/v8/finance/chart';
const YF_CRUMB = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const YF_HOME  = 'https://finance.yahoo.com/';
const DEFAULT_FIELDS = 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,shortName';

const UA   = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

// Module-level cache — reused across warm Lambda invocations
let _creds = null;

async function getCreds() {
  if (_creds) return _creds;

  console.log('[yf-quote] fetching session cookie from finance.yahoo.com...');
  const r1 = await fetch(YF_HOME, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  console.log(`[yf-quote] finance.yahoo.com → ${r1.status}`);

  // getSetCookie() (Node 18+) returns an array; fall back to splitting the header string
  const rawCookies = typeof r1.headers.getSetCookie === 'function'
    ? r1.headers.getSetCookie()
    : (r1.headers.get('set-cookie') || '').split(/,(?=[A-Za-z_-]+=)/).map(s => s.trim());

  const cookieStr = rawCookies.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  console.log(`[yf-quote] cookies: ${rawCookies.length} parsed, string length ${cookieStr.length}`);

  const r2 = await fetch(YF_CRUMB, {
    headers: { 'User-Agent': UA, 'Cookie': cookieStr, 'Accept': '*/*' },
    signal: AbortSignal.timeout(5000),
  });
  console.log(`[yf-quote] crumb endpoint → ${r2.status}`);
  const crumb = (await r2.text()).trim();
  console.log(`[yf-quote] crumb value: "${crumb.slice(0, 30)}" (len=${crumb.length})`);

  if (!crumb || crumb.startsWith('<') || crumb.startsWith('{') || crumb.length < 3) {
    throw new Error(`invalid crumb: "${crumb.slice(0, 80)}"`);
  }

  _creds = { cookieStr, crumb };
  return _creds;
}

// v8 chart fallback — one request per symbol, no auth needed
async function fetchV8(symbols) {
  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  console.log(`[yf-quote] v8 fallback: fetching ${symList.length} symbols in parallel`);

  const settled = await Promise.allSettled(symList.map(async (sym) => {
    const url = `${YF_CHART}/${encodeURIComponent(sym)}?interval=1d&range=2d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.log(`[yf-quote] v8 ${sym} → ${res.status}`); return null; }
    const d = await res.json();
    const meta = d.chart?.result?.[0]?.meta;
    if (!meta) { console.log(`[yf-quote] v8 ${sym}: no meta`); return null; }

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
  console.log(`[yf-quote] v8 returned ${result.length}/${symList.length} symbols`);
  return { quoteResponse: { result, error: null } };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const { symbols, fields } = event.queryStringParameters || {};
  if (!symbols) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'symbols param required' }) };

  // ── Try v7 with crumb auth ────────────────────────────────────────
  try {
    const { cookieStr, crumb } = await getCreds();
    const f   = fields || DEFAULT_FIELDS;
    const url = `${YF_QUOTE}?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}&fields=${f}`;
    console.log(`[yf-quote] v7 request for symbols="${symbols.slice(0, 60)}..."`);

    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Cookie': cookieStr, 'Referer': YF_HOME },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[yf-quote] v7 → ${res.status}`);

    if (res.ok) {
      const data  = await res.json();
      const count = data.quoteResponse?.result?.length ?? 0;
      console.log(`[yf-quote] v7 success: ${count} symbols`);
      if (count > 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
          body: JSON.stringify(data),
        };
      }
      console.log('[yf-quote] v7 returned 0 results — falling through to v8');
    } else {
      _creds = null;
      const detail = await res.text().catch(() => '');
      console.log(`[yf-quote] v7 error body: ${detail.slice(0, 200)}`);
    }
  } catch (e) {
    _creds = null;
    console.error(`[yf-quote] v7 threw: ${e.message}`);
  }

  // ── v8 chart fallback ─────────────────────────────────────────────
  try {
    const data = await fetchV8(symbols);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
      body: JSON.stringify(data),
    };
  } catch (e) {
    console.error(`[yf-quote] v8 also failed: ${e.message}`);
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: `v7 and v8 both failed. Last: ${e.message}` }),
    };
  }
};
