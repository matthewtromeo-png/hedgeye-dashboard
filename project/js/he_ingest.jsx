// he_ingest.jsx — Hedgeye Research Ingestion Tab (v2)
// Recursively scans connected folder, classifies by filename,
// processes newest file per category, updates tab data in memory.

// ── Module-level state (survives IngestTab remounts on tab switch) ────────────
let _gDirHandle = null;
let _gPollId    = null;

// ── Storage keys ──────────────────────────────────────────────────────────────
const INGEST_META_KEY = 'he_ingest_meta';
const SSS_LIVE_KEY    = 'he_sss_live';
const RTA_LIVE_KEY    = 'he_rta_live';
const HAM_LIVE_KEY    = 'he_ham_live';
const RI_KEY          = 'he_research_intel';

// ── Per-file ingestion metadata ───────────────────────────────────────────────
const readIngestMeta = () => {
  try { return JSON.parse(localStorage.getItem(INGEST_META_KEY) || '{}'); } catch { return {}; }
};
const setFileMeta = (filename, lastModified) => {
  try {
    const meta = readIngestMeta();
    meta[filename] = { lastModified, processedAt: new Date().toISOString() };
    localStorage.setItem(INGEST_META_KEY, JSON.stringify(meta));
  } catch (e) { console.warn('[ingest] setFileMeta:', e.message); }
};
const needsProcessing = (file) => {
  const s = readIngestMeta()[file.name];
  return !s || file.lastModified > s.lastModified;
};

// ── File classification ───────────────────────────────────────────────────────
const CATS = {
  sss:      { label: 'Signal Strength',  color: '#1A4D8F', bg: '#E4EDF8', desc: 'SSS stock signals · PDF'      },
  rta:      { label: 'Real-Time Alerts', color: '#27500A', bg: '#EAF3DE', desc: 'Trade history · CSV'          },
  ham:      { label: 'HAM Holdings',     color: '#27500A', bg: '#EAF3DE', desc: 'Fund holdings · CSV'          },
  etfpro:   { label: 'ETF Pro',          color: '#B8860B', bg: '#FFF8E1', desc: 'ETF rankings · CSV/PDF'       },
  macro:    { label: 'Macro Research',   color: '#B8860B', bg: '#FFF8E1', desc: 'Early Look / TMS · PDF'       },
  research: { label: 'The Call',         color: '#6B6860', bg: '#F1EFE8', desc: 'Call summaries · PDF'         },
  ideas:    { label: 'Investing Ideas',  color: '#8B2252', bg: '#F5EAF0', desc: 'Investment ideas · PDF'       },
};

function classifyFile(name) {
  const f = name.toLowerCase();
  if (/signal.?strength|[\s_-]sss[\s_.-]|sss[\d_\s]/.test(f)) return 'sss';
  if (/\brta\b|real.?time.?alert|realtimealerts/.test(f))       return 'rta';
  if (/etf.?pro|etfpro/.test(f))                                return 'etfpro';
  if (/etf.?holdings|ham.?hold|\bham\b/.test(f))                return 'ham';
  if (/early.?look|\btms\b|macro.?show|morning.?brief/.test(f)) return 'macro';
  if (/\bthe.?call\b|call.?summ/.test(f))                       return 'research';
  if (/investing.?ideas|inv\.?\s?ideas/.test(f))                return 'ideas';
  return null;
}

// ── Recursive directory scanner ───────────────────────────────────────────────
async function* scanRecursive(handle, depth = 0) {
  if (depth > 5) return;
  try {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        yield* scanRecursive(entry, depth + 1);
      } else if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop().toLowerCase();
        if (!['pdf', 'csv', 'xlsx', 'xls'].includes(ext)) continue;
        const cat = classifyFile(entry.name);
        if (!cat) continue;
        const file = await entry.getFile();
        yield { file, cat };
      }
    }
  } catch (e) {
    if (e.name !== 'NotAllowedError') console.warn('[ingest] scanRecursive:', e.message);
  }
}

async function getNewestByCategory(handle) {
  const best = {};
  for await (const { file, cat } of scanRecursive(handle)) {
    if (!best[cat] || file.lastModified > best[cat].lastModified) {
      best[cat] = file;
    }
  }
  return best; // { [category]: File }
}

// ── Safe localStorage write ───────────────────────────────────────────────────
function trySave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') console.warn('[ingest] quota exceeded for', key);
    else console.warn('[ingest] trySave:', e.message);
    return false;
  }
}

// ── SSS extraction ────────────────────────────────────────────────────────────
// PDF row format: "352 FIVE 5/18/2025 $106.5 $227.8 113.9% Retail Brian McGough [optional rank]"
// Fields: days  ticker  date  $entryPrice  $lastPrice  pct%  sector  analyst  [rank]
const NOT_TICKERS = new Set([
  'THE','AND','FOR','WITH','FROM','THAT','THIS','HAVE','BEEN','WILL','ARE','HAS',
  'USD','BTC','CPI','GDP','ETF','RTA','HAM','SSS','GIP','YTD','EPS','TTM','YOY',
  'MOM','PDF','QTD','FCF','FED','ECB','PMI','ISM','NFP','ADP','WTI','TLT',
  'VIX','SPX','SPY','QQQ','IWM','GLD','DXY','IRS','SEC','CEO','CFO','COO','CAP',
  'ALL','NEW','TOP','KEY','LOW','HIGH','BUY','SELL','LONG','SHORT','BEST','RISK',
]);

// Known Hedgeye sectors — sorted longest-first so the regex alternation is greedy-safe
const _SSS_SECTORS = [
  'Consumer Staples','Digital Assets','Global Tech','Communications',
  'Industrials','Financials','Healthcare','Restaurants','Retail','Energy','GLL',
].sort((a, b) => b.length - a.length);
const _SECTOR_ALT = _SSS_SECTORS.join('|');

// Rank suffixes that sometimes appear after the analyst name
const _RANK_SUFFIX = /\s+(?:\d+\/\d+|KM\s+Signal|Bench)\s*$/;

function extractSssEntries(text) {
  const results = [], seen = new Set();

  // Debug: show raw PDF text so we can see what pdf.js actually produces
  console.log('[SSS debug] raw text (first 500 chars):', JSON.stringify(text.slice(0, 500)));

  // Primary: strict row pattern matching the exact PDF column order
  const lineRe = /^(\d{1,4})\s+([A-Z]{1,5})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+\$?([\d.]+)\s+\$?([\d.]+)\s+([\d.-]+)%\s+(.+)$/gm;
  // Splits the trailing "Retail Brian McGough [4/15]" into sector + analyst
  const saRe = new RegExp(`^(${_SECTOR_ALT})\\s+(.+?)\\s*$`);

  for (const m of text.matchAll(lineRe)) {
    const ticker = m[2];
    if (seen.has(ticker) || NOT_TICKERS.has(ticker)) continue;
    const days = parseInt(m[1]);
    if (days < 1 || days > 3000) continue;

    const remaining = m[7].trim().replace(_RANK_SUFFIX, '');
    const sa        = remaining.match(saRe);

    seen.add(ticker);
    results.push({
      ticker,
      days,
      signalDate: normaliseDate(m[3]),
      priorClose: parseFloat(m[4]),   // entry price
      lastClose:  parseFloat(m[5]),   // most recent price
      pct:        parseFloat(m[6]),   // gain % as number (e.g. 113.9 not 1.139)
      sector:     sa ? sa[1] : '',
      analyst:    sa ? sa[2].replace(_RANK_SUFFIX, '').trim() : '',
    });
  }

  // Fallback: loose pattern for older PDF layouts (no $ prefix, 2-digit year)
  if (results.length < 3) {
    const looseRe = /\b([A-Z]{2,5})\s+(\d{1,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([\d.]+)\s+([\d.]+)\s+([+-]?[\d.]+)/g;
    for (const m of text.matchAll(looseRe)) {
      const ticker = m[1];
      if (seen.has(ticker) || NOT_TICKERS.has(ticker)) continue;
      const days = parseInt(m[2]);
      if (days < 1 || days > 3000) continue;
      seen.add(ticker);
      results.push({
        ticker, days, signalDate: normaliseDate(m[3]),
        priorClose: parseFloat(m[4]), lastClose: parseFloat(m[5]), pct: parseFloat(m[6]),
        sector: '', analyst: '',
      });
    }
  }

  // Last-resort fallback: any uppercase word preceded by a line-leading number
  // e.g. "352 FIVE\n5/18/2025 …" where pdf.js splits columns across lines
  if (results.length < 3) {
    const lineStartRe = /^\d+\s+([A-Z]{2,5})\b/gm;
    const candidates = [...text.matchAll(lineStartRe)]
      .map(m => m[1])
      .filter(t => !NOT_TICKERS.has(t) && !seen.has(t));
    if (candidates.length > 5) {
      console.log('[SSS debug] line-start fallback matched:', candidates);
      for (const ticker of candidates) {
        seen.add(ticker);
        results.push({ ticker, days: 0, signalDate: '', priorClose: 0, lastClose: 0, pct: 0, sector: '', analyst: '' });
      }
    }
  }

  return results.length >= 3 ? results : null;
}

function normaliseDate(raw) {
  const p = raw.split('/');
  if (p.length !== 3) return raw;
  const [m, d, y] = p;
  return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function applySssUpdate(entries, source) {
  if (!entries?.length) return;
  try {
    const current  = Array.isArray(window.HE.SSS) ? [...window.HE.SSS] : [];
    const byTicker = Object.fromEntries(current.map(s => [s.ticker, s]));
    for (const e of entries) {
      if (byTicker[e.ticker]) {
        byTicker[e.ticker] = {
          ...byTicker[e.ticker], days: e.days, pct: e.pct,
          ...(e.lastClose  ? { lastClose:  e.lastClose  } : {}),
          ...(e.priorClose ? { priorClose: e.priorClose } : {}),
          ...(e.signalDate ? { signalDate: e.signalDate } : {}),
        };
      } else if (e.priorClose > 0) {
        byTicker[e.ticker] = { ...e, sector: e.sector || 'Unknown', analyst: e.analyst || '' };
      }
    }
    const merged = Object.values(byTicker).sort((a, b) => b.days - a.days);
    window.HE.SSS = merged;
    trySave(SSS_LIVE_KEY, { entries: merged, source, updatedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('he_sss_updated', { detail: { source, count: entries.length } }));
    console.log(`[ingest] SSS updated: ${entries.length} entries from ${source}`);
  } catch (e) { console.warn('[ingest] applySssUpdate:', e.message); }
}

// ── Intel extraction helpers ──────────────────────────────────────────────────
function firstMatch(text, patterns) {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (!m) continue;
    const val = parseFloat(m[1] ?? m[2] ?? m[3]);
    if (!isNaN(val) && Math.abs(val) < 50)
      return { value: val, context: m[0].trim().slice(0, 120) };
  }
  return null;
}

function extractIntel(text, filename) {
  const intel = {
    filename, ingestedAt: new Date().toISOString(),
    cpi: { headline: null, core: null, mom: null, nowcast: null },
    gdp: { growth: null, nowcast: null },
    riskRanges: [], keyPoints: [], signals: { usd: null, btc: null }, quads: null,
  };

  intel.cpi.headline = firstMatch(text, [
    /(?:headline\s+)?CPI[^.\n]{0,40}[Yy][Oo][Yy][^.\n]{0,20}([+-]?\d+\.?\d*)\s*%/,
    /(?:headline\s+)?CPI\s+[Yy]o[Yy][:\s=]+([+-]?\d+\.?\d*)\s*%/i,
    /CPI\s+(?:is|at|came?\s*in)[^.\n]{0,20}([+-]?\d+\.?\d*)\s*%/i,
    /([+-]?\d+\.?\d*)\s*%[^.\n]{0,15}(?:headline\s+)?CPI/i,
  ]);
  intel.cpi.core = firstMatch(text, [
    /[Cc]ore\s+CPI[^.\n]{0,40}([+-]?\d+\.?\d*)\s*%/,
    /([+-]?\d+\.?\d*)\s*%[^.\n]{0,15}[Cc]ore\s+(?:CPI|inflation)/,
  ]);
  intel.cpi.mom = firstMatch(text, [
    /CPI[^.\n]{0,20}[Mm][Oo][Mm][:\s=]+([+-]?\d+\.?\d*)\s*%/,
    /([+-]?\d+\.?\d*)\s*%[^.\n]{0,10}CPI[^.\n]{0,10}[Mm][Oo][Mm]/,
  ]);
  intel.cpi.nowcast = firstMatch(text, [
    /(?:CPI|inflation)\s+[Nn]owcast[:\s=]+([+-]?\d+\.?\d*)\s*%/,
    /[Nn]owcast[^.\n]{0,20}([+-]?\d+\.?\d*)\s*%/,
  ]);
  intel.gdp.growth = firstMatch(text, [
    /(?:real\s+)?GDP[^.\n]{0,20}(?:growth|rate)[:\s=]+([+-]?\d+\.?\d*)\s*%/i,
    /GDP[:\s=]+([+-]?\d+\.?\d*)\s*%/i,
  ]);
  intel.gdp.nowcast = firstMatch(text, [
    /GDP\s+[Nn]owcast[:\s=]+([+-]?\d+\.?\d*)\s*%/i,
    /[Nn]owcast[^.\n]{0,15}GDP[:\s=]+([+-]?\d+\.?\d*)\s*%/i,
  ]);

  if      (/\bUSD\b[^.\n]{0,40}\b(?:BULL|[Bb]ullish)\b/.test(text)) intel.signals.usd = 'BULLISH';
  else if (/\bUSD\b[^.\n]{0,40}\b(?:BEAR|[Bb]earish)\b/.test(text)) intel.signals.usd = 'BEARISH';
  if      (/\bBTC\b[^.\n]{0,40}\b(?:BULL|[Bb]ullish)\b/.test(text)) intel.signals.btc = 'BULLISH';
  else if (/\bBTC\b[^.\n]{0,40}\b(?:BEAR|[Bb]earish)\b/.test(text)) intel.signals.btc = 'BEARISH';

  for (const m of text.matchAll(/\b([A-Z]{1,5})\b[^.\n]{0,40}(?:risk\s+range|range|R\/R)[^.\n]{0,20}\$?(\d{2,5}(?:\.\d+)?)\s*[-–to]+\s*\$?(\d{2,5}(?:\.\d+)?)/gi)) {
    const lo = parseFloat(m[2]), hi = parseFloat(m[3]);
    if (lo < hi && hi / lo < 2.5 && intel.riskRanges.length < 8)
      intel.riskRanges.push({ symbol: m[1], low: lo, high: hi, context: m[0].trim().slice(0, 100) });
  }

  const kwRe = /quad|inflation|recession|stagflat|bullish|bearish|accelerat|decelerat|nowcast|tailwind|headwind/i;
  const seenKp = new Set();
  for (const s of text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/)) {
    const c = s.trim().replace(/\s+/g, ' ');
    if (c.length < 40 || c.length > 220 || !kwRe.test(c)) continue;
    const key = c.slice(0, 40);
    if (seenKp.has(key)) continue;
    seenKp.add(key);
    intel.keyPoints.push(c);
    if (intel.keyPoints.length >= 8) break;
  }

  const quads = { monthly: null, quarterly: null, confidence: 'low', mentions: [] };
  const mM = text.match(/monthly[^.\n]{0,30}[Qq](?:uad)?\s*([1234])/i) || text.match(/[Qq](?:uad)?\s*([1234])[^.\n]{0,20}monthly/i);
  const qM = text.match(/quarterly[^.\n]{0,30}[Qq](?:uad)?\s*([1234])/i) || text.match(/[Qq](?:uad)?\s*([1234])[^.\n]{0,20}quarterly/i);
  if (mM) { quads.monthly   = `Q${mM[1]}`; quads.confidence = 'high'; }
  if (qM) { quads.quarterly = `Q${qM[1]}`; quads.confidence = 'high'; }
  if (!quads.monthly) {
    const tM = text.match(/[Tt]racking\s+[Qq](?:uad)?\s*([1234])/);
    const hM = text.match(/#[Qq]uad([1234])/);
    if      (tM) { quads.monthly = `Q${tM[1]}`; quads.confidence = 'medium'; }
    else if (hM) { quads.monthly = `Q${hM[1]}`; quads.confidence = 'medium'; }
  }
  const cnt = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  [...text.matchAll(/[Qq](?:uad)?\s*([1234])/g)].forEach(m => { cnt[`Q${m[1]}`]++; });
  quads.mentions = Object.entries(cnt).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([q, c]) => ({ quad: q, count: c }));
  intel.quads = quads;

  return intel;
}

// ── CSV processing ────────────────────────────────────────────────────────────
async function processCSV(file, cat) {
  let text;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS not loaded — drop CSV instead');
    const ab   = await file.arrayBuffer();
    const wb   = XLSX.read(ab, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_csv(ws);
    text = data;
  } else {
    text = await file.text();
  }

  const rows       = window.HE.parseCSV(text);
  const modifiedAt = new Date(file.lastModified).toISOString();
  const storedAt   = new Date().toISOString();
  const base       = { source: file.name, modifiedAt, storedAt };

  if (cat === 'rta') {
    const stats = window.HE.computeRTAStats?.(rows);
    if (stats) {
      trySave(RTA_LIVE_KEY, { stats, ...base });
      window.HE.setLiveSource?.('rta', { ...base, summary: `${rows.length.toLocaleString()} trades` });
    }
  } else if (cat === 'ham') {
    // Cap at 5000 rows to stay within quota
    trySave(HAM_LIVE_KEY, { rows: rows.slice(0, 5000), ...base });
    window.HE.setLiveSource?.('ham', { ...base, summary: `${rows.length} holdings` });
  } else if (cat === 'etfpro') {
    trySave('he_etfpro_live', { rows, ...base });
    window.HE.setLiveSource?.('etfpro', { ...base, summary: `${rows.length} entries` });
  }

  return { ...base, rowCount: rows.length };
}

// ── PDF.js helper ─────────────────────────────────────────────────────────────
const getPdfjs = () => {
  if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js not loaded');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return pdfjsLib;
};

// ── PDF processing ────────────────────────────────────────────────────────────
async function processPDF(file, cat) {
  console.log('[processPDF] called:', file.name, '| category:', cat);
  const lib  = getPdfjs();
  const doc  = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    text += (await page.getTextContent()).items.map(it => it.str).join(' ') + '\n';
  }

  const modifiedAt = new Date(file.lastModified).toISOString();
  const storedAt   = new Date().toISOString();
  const base       = { source: file.name, modifiedAt, storedAt };

  if (cat === 'sss') {
    const entries = extractSssEntries(text);
    const count   = entries?.length ?? 0;
    if (entries) applySssUpdate(entries, file.name);
    window.HE.setLiveSource?.('sss', { ...base, summary: `${count} tickers` });
    return { ...base, tickerCount: count };
  }

  const intel = extractIntel(text, file.name);

  // Persist research intel
  try {
    const store = JSON.parse(localStorage.getItem(RI_KEY) || '{}');
    if (!store.pdfs) store.pdfs = {};
    store.pdfs[file.name] = intel;
    store.latestFilename  = file.name;
    store.lastUpdated     = intel.ingestedAt;
    trySave(RI_KEY, store);
    window.dispatchEvent(new CustomEvent('he_research_updated', { detail: { filename: file.name } }));
  } catch {}

  // Apply quad calls if found
  if (intel.quads?.monthly || intel.quads?.quarterly) {
    window.HE.applyResearchQuads?.(intel.quads.monthly, intel.quads.quarterly, file.name);
  }

  const summaryParts = [
    intel.quads?.monthly    && `${intel.quads.monthly}`,
    intel.cpi?.headline     && 'CPI',
    intel.gdp?.growth       && 'GDP',
    intel.keyPoints?.length && `${intel.keyPoints.length} pts`,
  ].filter(Boolean);

  window.HE.setLiveSource?.(cat, { ...base, summary: summaryParts.join(' · ') || 'processed' });
  return { ...base };
}

// ── IngestTab ─────────────────────────────────────────────────────────────────
const IngestTab = ({ onQuadUpdate }) => {
  const [syncStatus,     setSyncStatus]     = React.useState(null);
  const [processingName, setProcessingName] = React.useState('');
  const [catStatus,      setCatStatus]      = React.useState(() => {
    const s = {};
    for (const cat of Object.keys(CATS)) s[cat] = window.HE.getLiveSource?.(cat) || null;
    return s;
  });
  const [error,     setError]     = React.useState('');
  const [hasFolder, setHasFolder] = React.useState(!!_gDirHandle);
  const [toast,     setToast]     = React.useState(null);
  const dropRef  = React.useRef(null);
  const HAS_FSA  = typeof window.showDirectoryPicker === 'function';

  // Resume polling if folder was connected before tab switch
  React.useEffect(() => {
    if (_gDirHandle) {
      startPolling();
      scanAndIngest(_gDirHandle, false);
    }
  }, []);

  // Auto-dismiss toast
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  function startPolling() {
    if (_gPollId) clearInterval(_gPollId);
    _gPollId = setInterval(() => { if (_gDirHandle) scanAndIngest(_gDirHandle, true); }, 60000);
  }

  async function scanAndIngest(handle, silent) {
    try {
      const newest    = await getNewestByCategory(handle);
      const toProcess = Object.entries(newest).filter(([, file]) => needsProcessing(file));

      if (!toProcess.length) {
        setSyncStatus({ doneAt: new Date(), count: 0 });
        return;
      }

      if (silent) {
        setToast({
          msg:    `Auto-syncing ${toProcess.length} file${toProcess.length > 1 ? 's' : ''}`,
          detail: toProcess.map(([, f]) => f.name.slice(0, 32)).join(', '),
        });
      }

      setSyncStatus('syncing');
      let count = 0;

      for (const [cat, file] of toProcess) {
        setProcessingName(file.name);
        try {
          const ext = file.name.split('.').pop().toLowerCase();
          await (['csv', 'xlsx', 'xls'].includes(ext) ? processCSV(file, cat) : processPDF(file, cat));
          setFileMeta(file.name, file.lastModified);
          setCatStatus(prev => ({
            ...prev,
            [cat]: window.HE.getLiveSource?.(cat) || { source: file.name, modifiedAt: new Date(file.lastModified).toISOString(), storedAt: new Date().toISOString() },
          }));
          count++;
        } catch (e) {
          console.warn(`[ingest] ${cat}: ${e.message}`);
          setCatStatus(prev => ({ ...prev, [cat]: { ...(prev[cat] || {}), source: file.name, error: e.message } }));
        }
      }

      setProcessingName('');
      setSyncStatus({ doneAt: new Date(), count });

      // Bubble best quad to parent
      for (const [, file] of toProcess) {
        const cat = classifyFile(file.name);
        if (cat === 'macro' || cat === 'research') {
          const ri = (() => { try { return JSON.parse(localStorage.getItem(RI_KEY) || '{}'); } catch { return {}; } })();
          const intel = ri.pdfs?.[file.name];
          if (intel?.quads?.monthly && onQuadUpdate) {
            onQuadUpdate({ monthly: intel.quads.monthly, quarterly: intel.quads.quarterly, source: file.name });
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') { console.warn('[ingest] scan:', e.message); setError(e.message); }
      setSyncStatus({ doneAt: new Date(), count: 0 });
    }
  }

  const handleForceReprocess = async (cat) => {
    // Clear this category's entries from the ingest-meta cache so needsProcessing() returns true
    try {
      const meta = readIngestMeta();
      for (const filename of Object.keys(meta)) {
        if (classifyFile(filename) === cat) delete meta[filename];
      }
      localStorage.setItem(INGEST_META_KEY, JSON.stringify(meta));
    } catch {}

    if (!_gDirHandle) {
      setToast({ msg: `Cache cleared for ${CATS[cat].label}`, detail: 'Drop or reconnect the folder to reprocess' });
      setCatStatus(prev => ({ ...prev, [cat]: null }));
      return;
    }

    setSyncStatus('syncing');
    try {
      const newest = await getNewestByCategory(_gDirHandle);
      const file   = newest[cat];
      if (!file) {
        setToast({ msg: `No ${CATS[cat].label} file found`, detail: 'Check that the file is in the connected folder' });
        setSyncStatus({ doneAt: new Date(), count: 0 });
        return;
      }
      setProcessingName(file.name);
      const ext = file.name.split('.').pop().toLowerCase();
      await (['csv', 'xlsx', 'xls'].includes(ext) ? processCSV(file, cat) : processPDF(file, cat));
      setFileMeta(file.name, file.lastModified);
      setCatStatus(prev => ({
        ...prev,
        [cat]: window.HE.getLiveSource?.(cat) || { source: file.name, modifiedAt: new Date(file.lastModified).toISOString(), storedAt: new Date().toISOString() },
      }));
      setSyncStatus({ doneAt: new Date(), count: 1 });
    } catch (e) {
      console.warn(`[ingest] force ${cat}: ${e.message}`);
      setError(e.message);
      setSyncStatus({ doneAt: new Date(), count: 0 });
    }
    setProcessingName('');
  };

  const connectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      _gDirHandle  = handle;
      setHasFolder(true);
      startPolling();
      await scanAndIngest(handle, false);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    }
  };

  const refreshFolder = () => { if (_gDirHandle) scanAndIngest(_gDirHandle, false); };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ['pdf', 'csv', 'xlsx', 'xls'].includes(ext) && classifyFile(f.name);
    });
    if (!files.length) { setError('No recognised Hedgeye files dropped.'); return; }
    setSyncStatus('syncing');
    let count = 0;
    for (const file of files) {
      const cat = classifyFile(file.name);
      if (!cat) continue;
      setProcessingName(file.name);
      try {
        const ext = file.name.split('.').pop().toLowerCase();
        await (['csv', 'xlsx', 'xls'].includes(ext) ? processCSV(file, cat) : processPDF(file, cat));
        setFileMeta(file.name, file.lastModified);
        setCatStatus(prev => ({ ...prev, [cat]: window.HE.getLiveSource?.(cat) || { source: file.name, modifiedAt: new Date(file.lastModified).toISOString(), storedAt: new Date().toISOString() } }));
        count++;
      } catch (e) {
        console.warn(`[ingest] drop ${cat}: ${e.message}`);
      }
    }
    setProcessingName('');
    setSyncStatus({ doneAt: new Date(), count });
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const isSyncing = syncStatus === 'syncing';

  const syncLabel = (() => {
    if (!syncStatus || isSyncing) return null;
    if (syncStatus.doneAt) {
      const t = syncStatus.doneAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return syncStatus.count > 0
        ? `↑ Synced ${syncStatus.count} file${syncStatus.count > 1 ? 's' : ''} · ${t}`
        : `✓ Up to date · ${t}`;
    }
    return null;
  })();

  const totalSynced = Object.values(catStatus).filter(Boolean).length;

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    wrap:       { padding: '16px 20px', fontFamily: 'IBM Plex Mono, monospace' },
    header:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
    title:      { fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: '0.05em', textTransform: 'uppercase' },
    btn:        { padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'IBM Plex Mono, monospace', border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer', borderRadius: 2 },
    btnOut:     { padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'IBM Plex Mono, monospace', border: '1px solid #C0BDB8', background: 'transparent', color: '#333', cursor: 'pointer', borderRadius: 2 },
    grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10, marginBottom: 20 },
    card:       { background: '#fff', border: '1px solid #E4E1DA', borderRadius: 6, padding: '14px 16px' },
    dropZone:   { border: '2px dashed #C0BDB8', borderRadius: 4, padding: '28px 20px', textAlign: 'center', color: '#888', fontSize: 11, cursor: 'pointer', marginBottom: 16 },
    error:      { padding: '8px 12px', background: '#FFF0F0', border: '1px solid #F5C0C0', borderRadius: 3, fontSize: 11, color: '#C8302A', marginBottom: 10 },
    emptyState: { textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: 12 },
  };

  return (
    <div style={S.wrap}>

      {/* Toast */}
      {toast && (
        <div onClick={() => setToast(null)} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1A4D8F', color: '#fff', borderRadius: 6, padding: '12px 18px',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, maxWidth: 440,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', cursor: 'pointer' }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{toast.msg}</div>
          {toast.detail && <div style={{ fontSize: 10, color: '#a8c4f0' }}>{toast.detail}</div>}
          <div style={{ fontSize: 9, color: '#a8c4f0', marginTop: 4 }}>Click to dismiss</div>
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>Research Ingestion</span>

        {isSyncing ? (
          <span style={{ fontSize: 10, color: '#1A4D8F', background: '#E4EDF8', padding: '2px 8px', borderRadius: 2,
            display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              border: '1.5px solid #1A4D8F', borderTopColor: 'transparent',
              animation: 'spin 0.7s linear infinite' }} />
            Syncing{processingName ? ` · ${processingName.slice(0, 30)}` : '…'}
          </span>
        ) : syncLabel ? (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 2,
            color: syncStatus.count > 0 ? '#27500A' : '#7A7770',
            background: syncStatus.count > 0 ? '#EAF3DE' : '#F5F3EF' }}>
            {syncLabel}
          </span>
        ) : hasFolder ? (
          <span style={{ fontSize: 10, color: '#27500A', background: '#EAF3DE', padding: '2px 8px', borderRadius: 2 }}>
            ● Polling every 60s
          </span>
        ) : null}

        {totalSynced > 0 && !hasFolder && (
          <span style={{ fontSize: 10, color: '#7A7770', background: '#F5F3EF', padding: '2px 8px', borderRadius: 2 }}>
            {totalSynced}/{Object.keys(CATS).length} categories loaded
          </span>
        )}

        {HAS_FSA && (
          <button style={S.btn} onClick={connectFolder} disabled={isSyncing}>
            {hasFolder ? 'Reconnect Folder' : 'Connect Folder'}
          </button>
        )}
        {hasFolder && (
          <button style={S.btnOut} onClick={refreshFolder} disabled={isSyncing}>Refresh</button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={S.error}>
          {error}
          <span style={{ cursor: 'pointer', float: 'right' }} onClick={() => setError('')}>✕</span>
        </div>
      )}

      {/* Drop zone — shown when no folder connected */}
      {!hasFolder && (
        <div ref={dropRef} style={S.dropZone}
          onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
          onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
          onDrop={handleFileDrop}
          onClick={!HAS_FSA ? () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.pdf,.csv,.xlsx'; inp.multiple = true;
            inp.onchange = e => handleFileDrop({ preventDefault: ()=>{}, dataTransfer: { files: e.target.files } });
            inp.click();
          } : undefined}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📂</div>
          {HAS_FSA
            ? <>Click <strong>Connect Folder</strong> to recursively scan your Hedgeye downloads<br />
                or drag &amp; drop individual files here</>
            : <><strong>Drop files here</strong> or click to choose (PDF, CSV, XLSX)</>}
          <br />
          <span style={{ fontSize: 10, color: '#aaa' }}>
            Scans all subfolders · SSS · RTA · HAM · ETF Pro · Early Look · The Call · Investing Ideas
          </span>
        </div>
      )}

      {/* Category grid */}
      <div style={S.grid}>
        {Object.entries(CATS).map(([cat, info]) => {
          const status  = catStatus[cat];
          const hasData = !!status && !status.error;
          const modDate = status?.modifiedAt ? new Date(status.modifiedAt) : null;
          const modStr  = modDate ? modDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) : null;

          return (
            <div key={cat} style={{ ...S.card, borderLeft: `3px solid ${hasData ? info.color : '#E4E1DA'}` }}>
              {/* Category label + status dot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: info.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {info.label}
                </span>
                {hasData && (
                  <span style={{ fontSize: 8, background: '#EAF3DE', color: '#27500A',
                    padding: '1px 5px', borderRadius: 2, fontWeight: 700 }}>✓</span>
                )}
                {status?.error && (
                  <span style={{ fontSize: 8, background: '#FCEBEB', color: '#C8302A',
                    padding: '1px 5px', borderRadius: 2, fontWeight: 700 }}>ERR</span>
                )}
              </div>

              {/* Description */}
              <div style={{ fontSize: 9, color: '#9A9790', marginBottom: 8 }}>{info.desc}</div>

              {/* Status content */}
              {status?.error ? (
                <div style={{ fontSize: 9, color: '#C8302A' }}>{status.error.slice(0, 70)}</div>
              ) : hasData ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#1A1A18',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}
                    title={status.source}>
                    {status.source}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {status.summary && (
                      <span style={{ fontSize: 10, color: info.color, fontWeight: 600 }}>{status.summary}</span>
                    )}
                    {modStr && (
                      <span style={{ fontSize: 9, color: '#9A9790' }}>{modStr}</span>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 10, color: '#C0BDB8', fontStyle: 'italic' }}>
                  {hasFolder ? 'No matching file found' : 'Connect folder to scan'}
                </div>
              )}

              {/* Force Reprocess button — only shown when there's cached data or a folder is connected */}
              {(hasData || hasFolder) && (
                <div style={{ marginTop: 8, borderTop: '1px solid #F0EDE8', paddingTop: 6 }}>
                  <button
                    disabled={isSyncing}
                    onClick={() => handleForceReprocess(cat)}
                    style={{ fontSize: 9, padding: '2px 7px', border: '1px solid #C0BDB8',
                      background: 'transparent', color: '#7A7770', cursor: 'pointer',
                      borderRadius: 2, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em' }}>
                    Force Reprocess
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state when nothing loaded */}
      {!hasFolder && totalSynced === 0 && (
        <div style={S.emptyState}>
          No data loaded yet.<br />
          <span style={{ fontSize: 11 }}>
            Connect your Hedgeye downloads folder to auto-extract macro intelligence.
          </span>
        </div>
      )}

      <style>{`
        .drag-over { border-color: #1A4D8F !important; background: #F0F4FF !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
