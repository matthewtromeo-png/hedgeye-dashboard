// Netlify Function — Financial Modeling Prep proxy (injects API key server-side)
const FMP_BASE = 'https://financialmodelingprep.com/api';

export const handler = async (event) => {
  const { path, apikey } = event.queryStringParameters || {};
  if (!path) return { statusCode: 400, body: JSON.stringify({ error: 'path required' }) };

  // Use caller-supplied key, fall back to env var
  const key = apikey || process.env.FMP_API_KEY;
  if (!key) {
    return {
      statusCode: 401,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'FMP API key not configured. Set FMP_API_KEY env var on Netlify, or enter your key in dashboard settings.' }),
    };
  }

  // Append apikey to path — path already includes query string (e.g. /v3/analyst-estimates/AAPL?limit=4)
  const separator = path.includes('?') ? '&' : '?';
  const url = `${FMP_BASE}${path}${separator}apikey=${key}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HedgeyeDashboard/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=300' },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return { statusCode: 502, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: e.message }) };
  }
};
