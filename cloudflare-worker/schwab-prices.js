// Cloudflare Worker — Schwab Developer API quotes + CoinGecko (BTC)
// Schwab: single batch call for all symbols except BTC-USD.
// CoinGecko: parallel free API call for BTC-USD.
// Token cached in module scope — persists across requests within the same isolate.
//
// Deploy: cd cloudflare-worker && wrangler deploy
// Secrets: wrangler secret put SCHWAB_CLIENT_ID
//          wrangler secret put SCHWAB_CLIENT_SECRET

const SCHWAB_TOKEN_URL  = 'https://api.schwabapi.com/v1/oauth/token';
const SCHWAB_QUOTES_URL = 'https://api.schwabapi.com/marketdata/v1/quotes';
const COINGECKO_URL     = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const YF_TO_SCHWAB = { '^GSPC': '$SPX', '^TNX': '$TNX' };
const SCHWAB_TO_YF = Object.fromEntries(Object.entries(YF_TO_SCHWAB).map(([y, s]) => [s, y]));
const VIX_FORMATS  = ['VIX', '/VIX', '$VIX'];

// Module-level token cache — survives warm isolate reuse
let _token       = null;
let _tokenExpiry = 0;

async function getToken(clientId, clientSecret) {
  if (_token && Date.now() < _tokenExpiry) return _token;
  // btoa() is available in all CF Worker runtimes (no Buffer needed)
  const creds = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body:   'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth failed HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token: ${JSON.stringify(data).slice(0, 200)}`);
  _token       = data.access_token;
  _tokenExpiry = Date.now() + Math.max(0, (data.expires_in ?? 1800) - 60) * 1000;
  return _token;
}

function parseQuote(schwabSym, data) {
  if (!data?.quote) return null;
  const q      = data.quote;
  const ref    = data.reference || {};
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

async function fetchSchwabRaw(schwabSyms, token) {
  const url = `${SCHWAB_QUOTES_URL}?symbols=${encodeURIComponent(schwabSyms.join(','))}&fields=quote,reference`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    signal:  AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) { _token = null; _tokenExpiry = 0; }
    throw new Error(`Schwab HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function fetchBtcPrice() {
  const res = await fetch(COINGECKO_URL, {
    headers: { 'Accept': 'application/json' },
    signal:  AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data   = await res.json();
  const usd    = data.bitcoin?.usd;
  if (!usd) throw new Error('CoinGecko returned no BTC price');
  const chgPct = data.bitcoin?.usd_24h_change ?? 0;
  const chg    = usd * chgPct / 100;
  return {
    symbol:                     'BTC-USD',
    shortName:                  'Bitcoin USD',
    regularMarketPrice:         usd,
    regularMarketChange:        chg,
    regularMarketChangePercent: chgPct,
    regularMarketPreviousClose: usd - chg,
    regularMarketDayHigh:       usd,
    regularMarketDayLow:        usd,
    regularMarketVolume:        0,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const clientId     = env.SCHWAB_CLIENT_ID;
    const clientSecret = env.SCHWAB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return json({ error: 'SCHWAB_CLIENT_ID / SCHWAB_CLIENT_SECRET not configured' }, 503);
    }

    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');
    if (!symbols) return json({ error: 'symbols param required' }, 400);

    const yfSyms     = symbols.split(',').map(s => s.trim()).filter(Boolean);
    const hasBtc     = yfSyms.includes('BTC-USD');
    const hasVix     = yfSyms.includes('^VIX');
    const coreYfSyms = yfSyms.filter(s => s !== 'BTC-USD' && s !== '^VIX');
    const schwabSyms = [
      ...coreYfSyms.map(s => YF_TO_SCHWAB[s] || s),
      ...(hasVix ? VIX_FORMATS : []),
    ];

    try {
      const [tokenResult, btcResult] = await Promise.allSettled([
        getToken(clientId, clientSecret),
        hasBtc ? fetchBtcPrice() : Promise.resolve(null),
      ]);

      if (tokenResult.status === 'rejected') throw tokenResult.reason;
      const token = tokenResult.value;

      const raw    = schwabSyms.length > 0 ? await fetchSchwabRaw(schwabSyms, token) : {};
      const result = coreYfSyms
        .map(yfSym => parseQuote(YF_TO_SCHWAB[yfSym] || yfSym, raw[YF_TO_SCHWAB[yfSym] || yfSym]))
        .filter(Boolean);

      if (hasVix) {
        const winner = VIX_FORMATS
          .map(fmt => ({ fmt, entry: raw[fmt] }))
          .find(({ entry }) => entry?.quote?.lastPrice != null);
        if (winner) {
          const q = parseQuote(winner.fmt, winner.entry);
          if (q) { q.symbol = '^VIX'; q.shortName = q.shortName || 'CBOE Volatility Index'; result.push(q); }
        }
      }

      if (hasBtc && btcResult.status === 'fulfilled' && btcResult.value) result.push(btcResult.value);
      if (hasBtc && btcResult.status === 'rejected') console.warn(`CoinGecko failed: ${btcResult.reason?.message}`);

      return json({ quoteResponse: { result, error: null } });
    } catch (e) {
      console.error(e.message);
      return json({ error: e.message }, 502);
    }
  },
};
