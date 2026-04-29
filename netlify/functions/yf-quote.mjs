// Netlify Function — market quote proxy via Schwab Developer API + CoinGecko (BTC)
// Schwab: single batch call for all symbols except BTC-USD.
// CoinGecko: parallel free API call for BTC-USD.
// Token cached in module scope (~30 min lifetime).
// Requires: SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET in Netlify env vars.

const SCHWAB_TOKEN_URL  = 'https://api.schwabapi.com/v1/oauth/token';
const SCHWAB_QUOTES_URL = 'https://api.schwabapi.com/marketdata/v1/quotes';
const COINGECKO_URL     = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

// YF/dashboard symbol → Schwab symbol
const YF_TO_SCHWAB = {
  '^GSPC': '$SPX',
  '^TNX':  '$TNX',
};
const SCHWAB_TO_YF = Object.fromEntries(
  Object.entries(YF_TO_SCHWAB).map(([yf, sw]) => [sw, yf])
);

// Try all three VIX formats in the same batch so logs show exactly what Schwab returns for each
const VIX_FORMATS = ['VIX', '/VIX', '$VIX'];

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
  const yfSym  = SCHWAB_TO_YF[schwabSym] || schwabSym;
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

// Returns the raw Schwab response object (caller does parsing + VIX resolution)
async function fetchSchwabRaw(schwabSyms, token) {
  const url = `${SCHWAB_QUOTES_URL}?symbols=${encodeURIComponent(schwabSyms.join(','))}&fields=quote,reference`;
  console.log(`[yf-quote] Schwab batch: ${schwabSyms.join(', ')}`);
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  console.log(`[yf-quote] Schwab HTTP ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) { _token = null; _tokenExpiry = 0; }
    throw new Error(`Schwab HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  console.log(`[yf-quote] Schwab response keys: ${Object.keys(data).join(', ')}`);
  if (data.errors) console.log(`[yf-quote] Schwab errors array: ${JSON.stringify(data.errors)}`);
  return data;
}

async function fetchBtcPrice() {
  console.log('[yf-quote] CoinGecko: fetching BTC-USD');
  const res = await fetch(COINGECKO_URL, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  console.log(`[yf-quote] CoinGecko HTTP ${res.status}`);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  const usd    = data.bitcoin?.usd;
  if (!usd) throw new Error('CoinGecko returned no BTC price');
  const chgPct = data.bitcoin?.usd_24h_change ?? 0;
  const chg    = usd * chgPct / 100;
  const prev   = usd - chg;
  console.log(`[yf-quote] BTC: $${usd} (${chgPct.toFixed(2)}%)`);
  return {
    symbol:                     'BTC-USD',
    shortName:                  'Bitcoin USD',
    regularMarketPrice:         usd,
    regularMarketChange:        chg,
    regularMarketChangePercent: chgPct,
    regularMarketPreviousClose: prev,
    regularMarketDayHigh:       usd,
    regularMarketDayLow:        usd,
    regularMarketVolume:        0,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const clientId     = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
  console.log(`[yf-quote] SCHWAB_CLIENT_ID: ${clientId ? `set (len=${clientId.length})` : 'NOT SET'}`);
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

  const yfSyms       = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const hasBtc       = yfSyms.includes('BTC-USD');
  const hasVix       = yfSyms.includes('^VIX');
  const coreYfSyms   = yfSyms.filter(s => s !== 'BTC-USD' && s !== '^VIX');
  const schwabSyms   = [
    ...coreYfSyms.map(s => YF_TO_SCHWAB[s] || s),
    ...(hasVix ? VIX_FORMATS : []),   // probe all 3 VIX formats in one batch
  ];

  console.log(`[yf-quote] ${yfSyms.length} YF symbols → Schwab: [${schwabSyms.join(', ')}] + ${hasBtc ? 'CoinGecko' : ''}`);

  try {
    // Token fetch runs in parallel with CoinGecko (no dependency between them)
    const [tokenResult, btcResult] = await Promise.allSettled([
      getToken(clientId, clientSecret),
      hasBtc ? fetchBtcPrice() : Promise.resolve(null),
    ]);

    if (tokenResult.status === 'rejected') throw tokenResult.reason;
    const token = tokenResult.value;

    const raw = schwabSyms.length > 0 ? await fetchSchwabRaw(schwabSyms, token) : {};

    // Parse standard (non-VIX) symbols
    const result = coreYfSyms
      .map(yfSym => parseQuote(YF_TO_SCHWAB[yfSym] || yfSym, raw[YF_TO_SCHWAB[yfSym] || yfSym]))
      .filter(Boolean);

    // Probe VIX formats — log every variant so we can see which Schwab accepts
    if (hasVix) {
      for (const fmt of VIX_FORMATS) {
        const entry = raw[fmt];
        console.log(`[yf-quote] VIX format "${fmt}": ${entry ? JSON.stringify(entry).slice(0, 400) : 'NOT IN RESPONSE'}`);
      }
      const winner = VIX_FORMATS.map(fmt => ({ fmt, entry: raw[fmt] }))
        .find(({ entry }) => entry?.quote?.lastPrice != null);
      if (winner) {
        const q = parseQuote(winner.fmt, winner.entry);
        if (q) { q.symbol = '^VIX'; q.shortName = q.shortName || 'CBOE Volatility Index'; result.push(q); }
        console.log(`[yf-quote] VIX resolved via format "${winner.fmt}"`);
      } else {
        console.warn('[yf-quote] VIX: none of the 3 formats returned valid quote data');
      }
    }

    // Append BTC
    if (hasBtc && btcResult.status === 'fulfilled' && btcResult.value) result.push(btcResult.value);
    if (hasBtc && btcResult.status === 'rejected') console.warn(`[yf-quote] CoinGecko failed: ${btcResult.reason?.message}`);

    console.log(`[yf-quote] Total: ${result.length}/${yfSyms.length} symbols succeeded`);
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
