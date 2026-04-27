// Netlify Function — Yahoo Finance quote proxy (avoids browser CORS restrictions)
const YF_BASE = 'https://query1.finance.yahoo.com/v7/finance/quote';
const DEFAULT_FIELDS = 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,shortName,longName,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap,trailingPE,forwardPE';

export const handler = async (event) => {
  const { symbols, fields } = event.queryStringParameters || {};
  if (!symbols) return { statusCode: 400, body: JSON.stringify({ error: 'symbols required' }) };

  const url = `${YF_BASE}?symbols=${encodeURIComponent(symbols)}&fields=${fields || DEFAULT_FIELDS}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return { statusCode: 502, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: e.message }) };
  }
};
