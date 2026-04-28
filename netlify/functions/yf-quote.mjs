// Netlify Function — market quote proxy via Schwab Developer API
// Single batch request; token cached in module scope (~30 min lifetime).
// Requires: SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET in Netlify env vars.

const SCHWAB_TOKEN_URL  = 'https://api.schwabapi.com/v1/oauth/token';
const SCHWAB_QUOTES_URL = 'https://api.schwabapi.com/marketdata/v1/quotes';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

// YF/dashboard symbol → Schwab symbol (indices use $X.X format)
const YF_TO_SCHWAB = {
  '^VIX':  '$VIX.X',
  '^GSPC': '$SPX.X',
  '^TNX':  '$TNX.X',
};
// Reverse map for response parsing
const SCHWAB_TO_YF = Object.fromEntries(
  Object.entries(YF_TO_SCHWAB).map(([yf, sw]) => [sw, yf])
);

// Module-level token cache — survives warm Lambda invocations
let _token = null;
let _tokenExpiry = 0;

async function getToken(clientId, clientSecret) {
  if (_token && Date.now() < _tokenExpiry) {
    console.log('[yf-quote] Using cached token');
    return _token;
  }
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  console.log('[yf-quote] Fetching new OAuth token');
  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000),
  });
  console.log(`[yf-quote] Token HTTP ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth failed HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token in response: ${JSON.stringify(data).slice(0, 200)}`);
  _token = data.access_token;
  _tokenExpiry = Date.now() + Math.max(0, (data.expires_in ?? 1800) - 60) * 1000;
  console.log(`[yf-quote] Token cached, expires_in=${data.expires_in}s`);
  return _token;
}

function parseQuote(schwabSym, data) {
  if (!data?.quote) {
    console.warn(`[yf-quote] No quote block for ${schwabSym}`);
    return null;
  }
  const q   = data.quote;
  const ref = data.reference || {};
  const yfSym = SCHWAB_TO_YF[schwabSym] || schwabSym;
  const cur    = q.lastPrice ?? q.mark ?? 0;
  const prev   = q.closePrice ?? 0;
  const chg    = q.netChange ?? (cur - prev);
  const chgPct = q.netPercentChange ?? (prev ? (chg / prev * 100) : 0);
  return {
    symbol:                     yfSym,
    shortName:                  ref.description || yfSym,
    regularMarketPrice:         cur,
    regularMarketChange:        chg,
    regularMarketChangePercent: chgPct,
    regularMarketPreviousClose: prev,
    regularMarketDayHigh:       q.highPrice ?? cur,
    regularMarketDayLow:        q.lowPrice  ?? cur,
    regularMarketVolume:        q.totalVolume ?? 0,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const clientId     = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
  console.log(`[yf-quote] SCHWAB_CLIENT_ID: ${clientId ? `set (len=${clientId.length})` : 'NOT SET'}`);
  console.log(`[yf-quote] SCHWAB_CLIENT_SECRET: ${clientSecret ? 'set' : 'NOT SET'}`);
  if (!clientId || !clientSecret) {
    return {
      statusCode: 503,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'SCHWAB_CLIENT_ID / SCHWAB_CLIENT_SECRET not configured' }),
    };
  }

  const { symbols } = event.queryStringParameters || {};
  if (!symbols) return {
    statusCode: 400,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'symbols param required' }),
  };

  const yfSyms     = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const schwabSyms = yfSyms.map(s => YF_TO_SCHWAB[s] || s);
  console.log(`[yf-quote] YF:     ${yfSyms.join(', ')}`);
  console.log(`[yf-quote] Schwab: ${schwabSyms.join(', ')}`);

  try {
    const token = await getToken(clientId, clientSecret);
    const url   = `${SCHWAB_QUOTES_URL}?symbols=${encodeURIComponent(schwabSyms.join(','))}&fields=quote,reference`;
    console.log(`[yf-quote] GET ${url}`);
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[yf-quote] Quotes HTTP ${res.status}`);
    if (!res.ok) {
      const body = await res.text();
      // If 401, invalidate cached token so next request re-auths
      if (res.status === 401) { _token = null; _tokenExpiry = 0; }
      throw new Error(`Schwab quotes HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    console.log(`[yf-quote] Response keys: ${Object.keys(data).join(', ')}`);

    const result = schwabSyms
      .map(sym => parseQuote(sym, data[sym]))
      .filter(Boolean);

    console.log(`[yf-quote] Parsed ${result.length}/${schwabSyms.length} symbols`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ quoteResponse: { result, error: null } }),
    };
  } catch (e) {
    console.error(`[yf-quote] ${e.message}`);
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
