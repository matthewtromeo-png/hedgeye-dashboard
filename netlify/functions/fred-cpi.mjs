// Netlify Function — FRED CPI proxy
// Fetches CPIAUCNS (headline) and CPILFENS (core) from FRED graph CSV endpoint.
// No API key required. Returns data shaped to match the BLS series format the
// dashboard already understands.

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
const CORS = { 'Access-Control-Allow-Origin': '*' };

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function parseCSV(text) {
  return text.trim().split('\n').slice(1).map(line => {
    const [date, val] = line.split(',');
    return { date: (date || '').trim(), value: parseFloat(val) };
  }).filter(r => r.date && !isNaN(r.value));
}

// Convert FRED rows (YYYY-MM-DD, value) → BLS-shaped objects
function toBlsFormat(rows) {
  return rows.map(({ date, value }) => {
    const [year, month] = date.split('-');
    return {
      year,
      period:     `M${month}`,
      periodName: MONTH_NAMES[parseInt(month, 10) - 1] || month,
      value:      String(value),
    };
  });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const [r1, r2] = await Promise.all([
      fetch(FRED_CSV + 'CPIAUCNS', { headers: { 'User-Agent': 'HedgeyeDashboard/1.0' }, signal: AbortSignal.timeout(8000) }),
      fetch(FRED_CSV + 'CPILFENS', { headers: { 'User-Agent': 'HedgeyeDashboard/1.0' }, signal: AbortSignal.timeout(8000) }),
    ]);

    if (!r1.ok) throw new Error(`FRED CPIAUCNS: HTTP ${r1.status}`);
    if (!r2.ok) throw new Error(`FRED CPILFENS: HTTP ${r2.status}`);

    const [csv1, csv2] = await Promise.all([r1.text(), r2.text()]);

    // Last 15 months — enough for 13-month YoY + 2 MoM calculations
    const series1 = toBlsFormat(parseCSV(csv1).slice(-15));
    const series2 = toBlsFormat(parseCSV(csv2).slice(-15));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'max-age=3600' },
      body: JSON.stringify({
        'CUUR0000SA0':    series1,
        'CUUR0000SA0L1E': series2,
        source: 'FRED',
      }),
    };
  } catch (e) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
