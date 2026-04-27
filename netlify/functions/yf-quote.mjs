// Netlify Function — Yahoo Finance quote proxy with crumb/session auth
const YF_QUOTE  = 'https://query1.finance.yahoo.com/v7/finance/quote';
const YF_CRUMB  = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const YF_HOME   = 'https://finance.yahoo.com/';
const DEFAULT_FIELDS = 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,shortName';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

// Module-level cache — survives warm Lambda invocations
let _creds = null;

async function getCreds() {
  if (_creds) return _creds;

  // Visit Yahoo Finance to get a session cookie
  const r1 = await fetch(YF_HOME, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });

  // Parse Set-Cookie headers (Node 18 has getSetCookie(); fall back to header string split)
  const rawCookies = r1.headers.getSetCookie
    ? r1.headers.getSetCookie()
    : (r1.headers.get('set-cookie') || '').split(/,(?=[A-Za-z_-]+=)/).map(s => s.trim());

  const cookieStr = rawCookies.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');

  // Fetch crumb using the session cookie
  const r2 = await fetch(YF_CRUMB, {
    headers: { 'User-Agent': UA, 'Cookie': cookieStr, 'Accept': '*/*' },
    signal: AbortSignal.timeout(5000),
  });
  const crumb = (await r2.text()).trim();

  if (!crumb || crumb.startsWith('<') || crumb.startsWith('{')) {
    throw new Error(`Bad crumb response: ${crumb.slice(0, 80)}`);
  }

  _creds = { cookieStr, crumb };
  return _creds;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const { symbols, fields } = event.queryStringParameters || {};
  if (!symbols) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'symbols param required' }) };
  }

  try {
    const { cookieStr, crumb } = await getCreds();
    const f = fields || DEFAULT_FIELDS;
    // symbols is already URL-decoded by Netlify's query param parser
    const url = `${YF_QUOTE}?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}&fields=${f}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookieStr,
        'Referer': YF_HOME,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      _creds = null; // invalidate cache on auth failure so next call retries
      const detail = await res.text().catch(() => '');
      return {
        statusCode: res.status,
        headers: CORS,
        body: JSON.stringify({ error: `YF returned ${res.status}`, detail: detail.slice(0, 300) }),
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
      body: JSON.stringify(data),
    };
  } catch (e) {
    _creds = null;
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
