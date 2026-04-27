// Netlify Function — Yahoo Finance quoteSummary proxy (fundamentals, analyst data)
const YF_BASE = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';
const DEFAULT_MODULES = 'defaultKeyStatistics,financialData,summaryDetail,earningsTrend,recommendationTrend,assetProfile';

export const handler = async (event) => {
  const { symbol, modules } = event.queryStringParameters || {};
  if (!symbol) return { statusCode: 400, body: JSON.stringify({ error: 'symbol required' }) };

  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?modules=${modules || DEFAULT_MODULES}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
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
