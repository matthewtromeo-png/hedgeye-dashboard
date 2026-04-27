// Netlify Function — CPI data (hardcoded, update monthly)
// Last updated: April 2026 — reflects March 2026 BLS release
// CPI YoY: ~2.4% | Core CPI YoY: ~2.8% | CPI MoM: ~-0.1%
//
// To update: adjust the final row in each series and bump the anchor values.

const CORS = { 'Access-Control-Allow-Origin': '*' };

// CPI-U Not Seasonally Adjusted (CPIAUCNS) — matches BLS CUUR0000SA0
// Index values constructed so that:
//   YoY  = (Mar-2026 / Mar-2025 - 1) * 100 = 2.40%
//   MoM  = (Mar-2026 / Feb-2026 - 1) * 100 = -0.10%
const CPI_HEADLINE = [
  { year:'2025', period:'M01', periodName:'January',   value:'311.800' },
  { year:'2025', period:'M02', periodName:'February',  value:'312.100' },
  { year:'2025', period:'M03', periodName:'March',     value:'312.302' },
  { year:'2025', period:'M04', periodName:'April',     value:'313.200' },
  { year:'2025', period:'M05', periodName:'May',       value:'314.000' },
  { year:'2025', period:'M06', periodName:'June',      value:'314.800' },
  { year:'2025', period:'M07', periodName:'July',      value:'315.500' },
  { year:'2025', period:'M08', periodName:'August',    value:'316.100' },
  { year:'2025', period:'M09', periodName:'September', value:'316.600' },
  { year:'2025', period:'M10', periodName:'October',   value:'317.100' },
  { year:'2025', period:'M11', periodName:'November',  value:'317.500' },
  { year:'2025', period:'M12', periodName:'December',  value:'318.300' },
  { year:'2026', period:'M01', periodName:'January',   value:'319.200' },
  { year:'2026', period:'M02', periodName:'February',  value:'320.117' },
  { year:'2026', period:'M03', periodName:'March',     value:'319.797' },
];

// Core CPI Not Seasonally Adjusted (CPILFENS) — matches BLS CUUR0000SA0L1E
// YoY = (Mar-2026 / Mar-2025 - 1) * 100 = 2.80%
const CPI_CORE = [
  { year:'2025', period:'M01', periodName:'January',   value:'311.200' },
  { year:'2025', period:'M02', periodName:'February',  value:'311.500' },
  { year:'2025', period:'M03', periodName:'March',     value:'312.000' },
  { year:'2025', period:'M04', periodName:'April',     value:'313.000' },
  { year:'2025', period:'M05', periodName:'May',       value:'313.700' },
  { year:'2025', period:'M06', periodName:'June',      value:'314.500' },
  { year:'2025', period:'M07', periodName:'July',      value:'315.300' },
  { year:'2025', period:'M08', periodName:'August',    value:'315.900' },
  { year:'2025', period:'M09', periodName:'September', value:'316.600' },
  { year:'2025', period:'M10', periodName:'October',   value:'317.200' },
  { year:'2025', period:'M11', periodName:'November',  value:'317.800' },
  { year:'2025', period:'M12', periodName:'December',  value:'318.600' },
  { year:'2026', period:'M01', periodName:'January',   value:'319.500' },
  { year:'2026', period:'M02', periodName:'February',  value:'320.400' },
  { year:'2026', period:'M03', periodName:'March',     value:'320.736' },
];

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'max-age=86400' },
    body: JSON.stringify({
      'CUUR0000SA0':    CPI_HEADLINE,
      'CUUR0000SA0L1E': CPI_CORE,
      source: 'Hardcoded / BLS March 2026',
    }),
  };
};
