// he_ingest.jsx — PDF Research Ingestion Tab
// Extracts CPI, GDP, quad calls, risk ranges, key points, and SSS entries from Hedgeye PDFs.
// Stores structured intel in localStorage ('he_research_intel').
// Tracks per-file lastModified timestamps ('he_ingest_meta') for incremental sync.
// Auto-polls connected folder every 60 seconds; only re-processes changed files.

// ── Module-level state (survives IngestTab remounts on tab switch) ─────────────
let _gDirHandle = null;   // FileSystemDirectoryHandle — kept alive across remounts
let _gPollId    = null;   // setInterval handle for background polling

// ── Research Intel storage ────────────────────────────────────────────────────
const RI_KEY  = 'he_research_intel';
const readRI  = () => { try { return JSON.parse(localStorage.getItem(RI_KEY) || '{}'); } catch { return {}; } };
const writeRI = (filename, intel) => {
  try {
    const store = readRI();
    if (!store.pdfs) store.pdfs = {};
    store.pdfs[filename] = intel;
    store.latestFilename = filename;
    store.lastUpdated    = intel.ingestedAt;
    localStorage.setItem(RI_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('he_research_updated', { detail: { filename } }));
  } catch (e) { console.warn('[ingest] writeRI:', e.message); }
};

// ── Per-file ingestion metadata (timestamps for incremental sync) ─────────────
const INGEST_META_KEY = 'he_ingest_meta';
const readIngestMeta  = () => { try { return JSON.parse(localStorage.getItem(INGEST_META_KEY) || '{}'); } catch { return {}; } };
const setFileMeta     = (filename, lastModified) => {
  try {
    const meta = readIngestMeta();
    meta[filename] = { lastModified, processedAt: new Date().toISOString() };
    localStorage.setItem(INGEST_META_KEY, JSON.stringify(meta));
  } catch (e) { console.warn('[ingest] setFileMeta:', e.message); }
};
const needsProcessing = (file) => {
  const stored = readIngestMeta()[file.name];
  if (!stored) return true;
  // Re-process if the file has been modified since we last ingested it
  return file.lastModified > stored.lastModified;
};

// ── PDF type classification (by filename patterns) ────────────────────────────
function classifyPdf(name) {
  const f = name.toLowerCase();
  if (/signal.?strength|[\s_-]sss[\s_.-]|sss\d/.test(f))                return 'sss';
  if (/\bgip\b|quad.?call|early.?look|morning.?brief|macro.?call/.test(f)) return 'macro';
  return 'research'; // call summaries, sector reports, etc.
}

// ── SSS extraction from Signal Strength PDFs ─────────────────────────────────
const SSS_LIVE_KEY = 'he_sss_live';
// Words that look like tickers but aren't
const NOT_TICKERS = new Set([
  'THE','AND','FOR','WITH','FROM','THAT','THIS','HAVE','BEEN','WILL','ARE','HAS',
  'USD','BTC','CPI','GDP','ETF','RTA','HAM','SSS','GIP','YTD','EPS','TTM','YOY',
  'MOM','PDF','QTD','FCF','EPS','FED','ECB','PMI','ISM','NFP','ADP','WTI','TLT',
  'VIX','SPX','SPY','QQQ','IWM','GLD','DXY','IRS','SEC','CEO','CFO','COO','CAP',
  'ALL','NEW','TOP','KEY','LOW','HIGH','BUY','SELL','LONG','SHORT','BEST','RISK',
]);

function extractSssEntries(text) {
  const results  = [];
  const seen     = new Set();

  // Pattern A — full row: TICKER DAYS DATE PRIOR_CLOSE LAST_CLOSE PCT
  // Matches: "AAPL 4 04/16/26 262.50 270.20 2.9"
  const fullRe = /\b([A-Z]{1,5})\s+(\d{1,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+([+-]?\d+\.?\d*)/g;
  for (const m of text.matchAll(fullRe)) {
    const t = m[1];
    if (seen.has(t) || NOT_TICKERS.has(t)) continue;
    const days = parseInt(m[2]);
    if (days < 1 || days > 3000) continue;
    seen.add(t);
    results.push({
      ticker:     t,
      days,
      signalDate: normaliseDate(m[3]),
      priorClose: parseFloat(m[4]),
      lastClose:  parseFloat(m[5]),
      pct:        parseFloat(m[6]),
      sector:     '',
      analyst:    '',
    });
  }

  // Pattern B — ticker + day count only (looser)
  if (results.length < 3) {
    const looseRe = /\b([A-Z]{2,5})\s+(\d{1,4})\s*d(?:ays?)?\b/g;
    for (const m of text.matchAll(looseRe)) {
      const t = m[1];
      if (seen.has(t) || NOT_TICKERS.has(t)) continue;
      const days = parseInt(m[2]);
      if (days < 1 || days > 3000) continue;
      seen.add(t);
      results.push({ ticker: t, days, signalDate: '', priorClose: 0, lastClose: 0, pct: 0, sector: '', analyst: '' });
    }
  }

  return results.length >= 3 ? results : null;
}

function normaliseDate(raw) {
  // "04/16/26" or "04/16/2026" → "2026-04-16"
  const p = raw.split('/');
  if (p.length !== 3) return raw;
  const [m, d, y] = p;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function applySssUpdate(entries, source) {
  if (!entries?.length) return;
  try {
    // Merge: update existing tickers, append genuinely new ones
    const current  = Array.isArray(window.HE.SSS) ? [...window.HE.SSS] : [];
    const byTicker = Object.fromEntries(current.map(s => [s.ticker, s]));
    for (const e of entries) {
      if (byTicker[e.ticker]) {
        // Update mutable fields only; keep analyst/sector from hardcoded data
        byTicker[e.ticker] = { ...byTicker[e.ticker], days: e.days, pct: e.pct,
          ...(e.lastClose  ? { lastClose:  e.lastClose }  : {}),
          ...(e.priorClose ? { priorClose: e.priorClose } : {}),
          ...(e.signalDate ? { signalDate: e.signalDate } : {}),
        };
      } else if (e.priorClose > 0) {
        // New ticker with enough data to add
        byTicker[e.ticker] = { ...e, sector: e.sector || 'Unknown', analyst: e.analyst || '' };
      }
    }
    const merged = Object.values(byTicker).sort((a, b) => b.days - a.days);
    window.HE.SSS = merged;
    localStorage.setItem(SSS_LIVE_KEY, JSON.stringify({ entries: merged, source, updatedAt: new Date().toISOString() }));
    window.dispatchEvent(new CustomEvent('he_sss_updated', { detail: { source, count: entries.length } }));
    console.log(`[ingest] SSS updated: ${entries.length} entries from ${source}`);
  } catch (e) { console.warn('[ingest] applySssUpdate:', e.message); }
}

// Apply persisted live SSS on module load (before React mounts)
;(function() {
  try {
    const live = JSON.parse(localStorage.getItem(SSS_LIVE_KEY) || '{}');
    if (live.entries?.length > 3) {
      window.HE.SSS = live.entries;
      console.log(`[ingest] Pre-loaded live SSS: ${live.entries.length} entries (${live.updatedAt})`);
    }
  } catch (e) {}
})();

// ── Extraction helpers ────────────────────────────────────────────────────────
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
    filename,
    ingestedAt:  new Date().toISOString(),
    cpi:         { headline: null, core: null, mom: null, nowcast: null },
    gdp:         { growth: null, nowcast: null },
    riskRanges:  [],
    keyPoints:   [],
    signals:     { usd: null, btc: null },
    quads:       null,
  };

  intel.cpi.headline = firstMatch(text, [
    /(?:headline\s+)?CPI[^.\n]{0,40}[Yy][Oo][Yy][^.\n]{0,20}([+-]?\d+\.?\d*)\s*%/,
    /(?:headline\s+)?CPI\s+[Yy]o[Yy][:\s=]+([+-]?\d+\.?\d*)\s*%/i,
    /CPI\s+(?:is|at|came?\s*in)[^.\n]{0,20}([+-]?\d+\.?\d*)\s*%/i,
    /([+-]?\d+\.?\d*)\s*%[^.\n]{0,15}(?:headline\s+)?CPI/i,
    /inflation[^.\n]{0,20}([+-]?\d+\.?\d*)\s*%[^.\n]{0,15}[Yy]o[Yy]/i,
  ]);

  intel.cpi.core = firstMatch(text, [
    /[Cc]ore\s+CPI[^.\n]{0,40}([+-]?\d+\.?\d*)\s*%/,
    /CPI[^.\n]{0,5}[Cc]ore[^.\n]{0,30}([+-]?\d+\.?\d*)\s*%/,
    /([+-]?\d+\.?\d*)\s*%[^.\n]{0,15}[Cc]ore\s+(?:CPI|inflation)/,
    /[Cc]ore\s+inflation[^.\n]{0,30}([+-]?\d+\.?\d*)\s*%/,
  ]);

  intel.cpi.mom = firstMatch(text, [
    /CPI[^.\n]{0,20}[Mm][Oo][Mm][:\s=]+([+-]?\d+\.?\d*)\s*%/,
    /CPI[^.\n]{0,20}[Mm]onth[- ]?[Oo]ver[- ]?[Mm]onth[^.\n]{0,15}([+-]?\d+\.?\d*)\s*%/i,
    /([+-]?\d+\.?\d*)\s*%[^.\n]{0,10}CPI[^.\n]{0,10}[Mm][Oo][Mm]/,
  ]);

  intel.cpi.nowcast = firstMatch(text, [
    /(?:CPI|inflation)\s+[Nn]owcast[:\s=]+([+-]?\d+\.?\d*)\s*%/,
    /[Nn]owcast[:\s=]+([+-]?\d+\.?\d*)\s*%[^.\n]{0,30}(?:CPI|inflation)/i,
    /[Nn]owcast[^.\n]{0,20}([+-]?\d+\.?\d*)\s*%/,
  ]);

  intel.gdp.growth = firstMatch(text, [
    /(?:real\s+)?GDP[^.\n]{0,20}(?:growth|rate)[:\s=]+([+-]?\d+\.?\d*)\s*%/i,
    /GDP[:\s=]+([+-]?\d+\.?\d*)\s*%/i,
    /([+-]?\d+\.?\d*)\s*%[^.\n]{0,8}GDP/i,
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
  const seen = new Set();
  for (const s of text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/)) {
    const c = s.trim().replace(/\s+/g, ' ');
    if (c.length < 40 || c.length > 220 || !kwRe.test(c)) continue;
    const key = c.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
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
    if (tM)      { quads.monthly = `Q${tM[1]}`; quads.confidence = 'medium'; }
    else if (hM) { quads.monthly = `Q${hM[1]}`; quads.confidence = 'medium'; }
  }
  const cnt = { Q1:0, Q2:0, Q3:0, Q4:0 };
  [...text.matchAll(/[Qq](?:uad)?\s*([1234])/g)].forEach(m => { cnt[`Q${m[1]}`]++; });
  quads.mentions = Object.entries(cnt).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]).map(([q,c])=>({quad:q,count:c}));
  intel.quads = quads;

  return intel;
}

// ── IngestTab ─────────────────────────────────────────────────────────────────
const IngestTab = ({ onQuadUpdate }) => {
  const [pdfs,           setPdfs]           = React.useState([]);
  const [syncStatus,     setSyncStatus]     = React.useState(null); // null | 'syncing' | {doneAt,count}
  const [processingName, setProcessingName] = React.useState('');
  const [error,          setError]          = React.useState('');
  const [selectedPdf,    setSelectedPdf]    = React.useState(null);
  // Mirror of _gDirHandle for render purposes
  const [hasFolder,      setHasFolder]      = React.useState(!!_gDirHandle);
  const [toast,          setToast]          = React.useState(null);
  const dropRef = React.useRef(null);

  const HAS_FSA = typeof window.showDirectoryPicker === 'function';

  // On mount: if a folder was connected before navigating away, resume sync
  React.useEffect(() => {
    if (_gDirHandle) {
      startPolling();
      // Scan immediately for any changes since we were last here
      scanAndIngest(_gDirHandle, false);
    }
    return () => {
      // Don't clear _gPollId on unmount — polling continues in background
    };
  }, []);

  // Toast auto-dismiss
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  function startPolling() {
    if (_gPollId) clearInterval(_gPollId);
    _gPollId = setInterval(() => {
      if (_gDirHandle) scanAndIngest(_gDirHandle, true);
    }, 60000);
  }

  // ── Core scan: compare lastModified vs stored, process only what changed ──
  async function scanAndIngest(handle, silent) {
    try {
      const candidates = [];
      for await (const entry of handle.values()) {
        if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.pdf')) continue;
        const file = await entry.getFile();
        if (needsProcessing(file)) candidates.push(file);
      }
      if (!candidates.length) {
        // Nothing new — just confirm up-to-date without re-rendering
        setSyncStatus({ doneAt: new Date(), count: 0 });
        return;
      }
      if (silent) {
        setToast({
          msg: `Auto-syncing ${candidates.length} new/updated PDF${candidates.length > 1 ? 's' : ''}`,
          detail: candidates.map(f => f.name.replace(/\.pdf$/i, '')).join(', '),
        });
      }
      await processFiles(candidates, silent);
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('[ingest] scan error:', e.message);
    }
  }

  // ── PDF.js ────────────────────────────────────────────────────────────────
  const getPdfjs = () => {
    if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return pdfjsLib;
  };

  const processPdfFile = async (file) => {
    const lib  = getPdfjs();
    const doc  = await lib.getDocument({ data: await file.arrayBuffer() }).promise;

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      fullText += (await page.getTextContent()).items.map(it => it.str).join(' ') + '\n';
    }

    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
      const page = await doc.getPage(i);
      const vp   = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      pages.push(canvas.toDataURL('image/jpeg', 0.75));
    }

    const type  = classifyPdf(file.name);
    const intel = extractIntel(fullText, file.name);
    writeRI(file.name, intel);

    // SSS-type PDF: attempt ticker extraction and apply
    if (type === 'sss') {
      const sssEntries = extractSssEntries(fullText);
      intel._sssExtracted = sssEntries?.length ?? 0;
      if (sssEntries) applySssUpdate(sssEntries, file.name);
    }

    return { name: file.name, size: file.size, pages, numPages: doc.numPages, intel, type };
  };

  // ── Process a batch ───────────────────────────────────────────────────────
  const processFiles = async (files, silent = false) => {
    setSyncStatus('syncing');
    if (!silent) setError('');
    const results = [];
    for (const file of files) {
      try {
        setProcessingName(file.name);
        const result = await processPdfFile(file);
        results.push(result);
      } catch (e) {
        results.push({ name: file.name, error: e.message, pages: [], intel: null, numPages: 0, type: 'unknown' });
      }
      setFileMeta(file.name, file.lastModified);
    }
    setProcessingName('');
    setPdfs(prev => {
      const existing = new Map(prev.map(p => [p.name, p]));
      results.forEach(r => existing.set(r.name, r));  // update or insert
      return [...existing.values()].sort((a, b) => {
        const ma = readIngestMeta()[a.name]?.processedAt || '';
        const mb = readIngestMeta()[b.name]?.processedAt || '';
        return mb.localeCompare(ma);
      });
    });
    setSyncStatus({ doneAt: new Date(), count: results.length });
    applyBestQuads(results);
  };

  const applyBestQuads = (results) => {
    let best = null;
    for (const r of results) {
      const q = r.intel?.quads;
      if (!q) continue;
      if (q.confidence === 'high' && best?.intel?.quads?.confidence !== 'high') best = r;
      else if (q.confidence === 'medium' && !best) best = r;
    }
    if (best?.intel?.quads && (best.intel.quads.monthly || best.intel.quads.quarterly)) {
      const { monthly, quarterly } = best.intel.quads;
      window.HE.applyResearchQuads?.(monthly, quarterly, best.name);
      if (onQuadUpdate) onQuadUpdate({ monthly, quarterly, source: best.name });
    }
  };

  const applyQuadFromPdf = (pdf) => {
    const q = pdf.intel?.quads;
    if (!q) return;
    window.HE.applyResearchQuads?.(q.monthly, q.quarterly, pdf.name);
    if (onQuadUpdate) onQuadUpdate({ monthly: q.monthly, quarterly: q.quarterly, source: pdf.name });
  };

  // ── Folder actions ────────────────────────────────────────────────────────
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

  const refreshFolder = async () => {
    if (!_gDirHandle) return;
    await scanAndIngest(_gDirHandle, false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) { setError('Please drop PDF files only.'); return; }
    await processFiles(files, false);
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    wrap:       { padding: '16px 20px', fontFamily: 'IBM Plex Mono, monospace' },
    header:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
    title:      { fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: '0.05em', textTransform: 'uppercase' },
    btn:        { padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'IBM Plex Mono, monospace', border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer', borderRadius: 2 },
    btnOutline: { padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'IBM Plex Mono, monospace', border: '1px solid #C0BDB8', background: 'transparent', color: '#333', cursor: 'pointer', borderRadius: 2 },
    dropZone:   { border: '2px dashed #C0BDB8', borderRadius: 4, padding: '28px 20px', textAlign: 'center', color: '#888', fontSize: 11, cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s', marginBottom: 16 },
    card:       { background: '#fff', border: '1px solid #E4E1DA', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
    cardHeader: { padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' },
    cardName:   { fontSize: 11, fontWeight: 600, color: '#111', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    badge:      (color) => ({ display: 'inline-block', padding: '1px 7px', fontSize: 10, fontWeight: 700, borderRadius: 2, background: color, color: '#fff', marginLeft: 6, letterSpacing: '0.05em' }),
    pagesWrap:  { display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', background: '#FAF9F6', borderTop: '1px solid #E4E1DA' },
    pageImg:    { height: 220, borderRadius: 2, border: '1px solid #E4E1DA', flexShrink: 0, cursor: 'zoom-in' },
    intelWrap:  { padding: '12px 14px', borderTop: '1px solid #E4E1DA', background: '#FAFAF8' },
    intelLabel: { fontSize: 9, color: '#9A9790', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
    chip:       { fontSize: 10, padding: '2px 8px', background: '#F0EDE8', border: '1px solid #DDD9D4', borderRadius: 2, color: '#333', display: 'inline-block' },
    error:      { padding: '8px 12px', background: '#FFF0F0', border: '1px solid #F5C0C0', borderRadius: 3, fontSize: 11, color: '#C8302A', marginBottom: 10 },
    emptyState: { textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: 12 },
    lightLabel: { fontSize: 10, color: '#888', fontWeight: 400 },
  };

  const QUAD_COLORS = { Q1: '#27500A', Q2: '#1A4D8F', Q3: '#B8860B', Q4: '#C8302A' };
  const isSyncing   = syncStatus === 'syncing';

  const syncLabel = (() => {
    if (isSyncing) return null; // shown inline near processingName
    if (!syncStatus) return null;
    if (syncStatus.doneAt) {
      const t = syncStatus.doneAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const d = syncStatus.doneAt.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const today = new Date().toDateString() === syncStatus.doneAt.toDateString();
      return syncStatus.count > 0
        ? `Synced ${syncStatus.count} PDF${syncStatus.count > 1 ? 's' : ''} · ${today ? t : d}`
        : `Up to date · ${today ? t : d}`;
    }
    return null;
  })();

  return (
    <div style={S.wrap}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1A4D8F', color: '#fff', borderRadius: 6, padding: '12px 18px',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, maxWidth: 440,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', cursor: 'pointer' }}
          onClick={() => setToast(null)}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{toast.msg}</div>
          {toast.detail && <div style={{ fontSize: 10, color: '#a8c4f0' }}>{toast.detail}</div>}
          <div style={{ fontSize: 9, color: '#a8c4f0', marginTop: 4 }}>Click to dismiss</div>
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>Research Ingestion</span>

        {/* Sync status */}
        {isSyncing ? (
          <span style={{ fontSize: 10, color: '#1A4D8F', background: '#E4EDF8', padding: '2px 8px', borderRadius: 2,
            display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              border: '1.5px solid #1A4D8F', borderTopColor: 'transparent',
              animation: 'spin 0.7s linear infinite' }} />
            Syncing{processingName ? ` · ${processingName.replace(/\.pdf$/i,'').slice(0,30)}` : '…'}
          </span>
        ) : syncLabel ? (
          <span style={{ fontSize: 10, color: syncStatus.count > 0 ? '#27500A' : '#7A7770',
            background: syncStatus.count > 0 ? '#EAF3DE' : '#F5F3EF',
            padding: '2px 8px', borderRadius: 2 }}>
            {syncStatus.count > 0 ? '↑ ' : '✓ '}{syncLabel}
          </span>
        ) : hasFolder ? (
          <span style={{ fontSize: 10, color: '#27500A', background: '#EAF3DE', padding: '2px 8px', borderRadius: 2 }}>
            ● Polling every 60s
          </span>
        ) : null}

        {HAS_FSA && (
          <button style={S.btn} onClick={connectFolder} disabled={isSyncing}>
            {hasFolder ? 'Reconnect Folder' : 'Connect Folder'}
          </button>
        )}
        {hasFolder && (
          <button style={S.btnOutline} onClick={refreshFolder} disabled={isSyncing}>Refresh</button>
        )}
        {pdfs.length > 0 && (
          <button style={{ ...S.btnOutline, marginLeft: 'auto', color: '#C8302A', borderColor: '#C8302A' }}
            onClick={() => { setPdfs([]); setSelectedPdf(null); setSyncStatus(null); }}>
            Clear All
          </button>
        )}
      </div>

      {/* Errors */}
      {error && (
        <div style={S.error}>
          {error}
          <span style={{ cursor: 'pointer', float: 'right' }} onClick={() => setError('')}>✕</span>
        </div>
      )}

      {/* Drop zone — shown when no folder connected or no PDFs yet */}
      {(!HAS_FSA || (!hasFolder && pdfs.length === 0 && !isSyncing)) && (
        <div ref={dropRef} style={S.dropZone}
          onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
          onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
          onDrop={handleDrop}
          onClick={!HAS_FSA ? () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.pdf'; inp.multiple = true;
            inp.onchange = (e) => processFiles([...e.target.files]);
            inp.click();
          } : undefined}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>⬇</div>
          {HAS_FSA
            ? <>Click <strong>Connect Folder</strong> above, or drag &amp; drop PDFs here</>
            : <><strong>Drop PDFs here</strong> or click to choose files</>}
          <br />
          <span style={{ fontSize: 10, color: '#aaa' }}>
            Auto-syncs on connect · CPI · GDP · Quad calls · SSS · Risk ranges · Key points
          </span>
        </div>
      )}

      {pdfs.length === 0 && !isSyncing && (
        <div style={S.emptyState}>
          No research loaded yet.<br />
          <span style={{ fontSize: 11 }}>Connect a folder of Hedgeye PDFs to auto-extract macro intelligence.</span>
        </div>
      )}

      {/* PDF cards — newest first */}
      {pdfs.map((pdf, idx) => (
        <PdfCard key={pdf.name} pdf={pdf}
          expanded={selectedPdf === idx}
          onToggle={() => setSelectedPdf(selectedPdf === idx ? null : idx)}
          onApplyQuads={() => applyQuadFromPdf(pdf)}
          S={S} QUAD_COLORS={QUAD_COLORS} />
      ))}

      <style>{`
        .drag-over { border-color: #1A4D8F !important; background: #F0F4FF !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ── PdfCard ───────────────────────────────────────────────────────────────────
const PdfCard = ({ pdf, expanded, onToggle, onApplyQuads, S, QUAD_COLORS }) => {
  const intel  = pdf.intel || {};
  const quads  = intel.quads || {};
  const hasCpi = !!(intel.cpi?.headline || intel.cpi?.core || intel.cpi?.mom || intel.cpi?.nowcast);
  const hasGdp = !!(intel.gdp?.growth || intel.gdp?.nowcast);
  const hasQ   = !!(quads.monthly || quads.quarterly);
  const CONF   = { high: '#27500A', medium: '#B8860B', low: '#888' };
  const valColor = v => v > 3 ? '#C8302A' : v > 2 ? '#B8860B' : v > 0 ? '#27500A' : '#1A4D8F';

  const typePill = pdf.type === 'sss'
    ? { label: 'SSS', color: '#1A4D8F' }
    : pdf.type === 'macro'
    ? { label: 'MACRO', color: '#B8860B' }
    : null;

  return (
    <div style={S.card}>
      <div style={S.cardHeader} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={S.cardName}>{pdf.name}</span>
          {pdf.error && <span style={S.badge('#C8302A')}>ERROR</span>}
          {typePill && <span style={S.badge(typePill.color)}>{typePill.label}</span>}
          {hasQ && quads.monthly && <span style={{ ...S.badge(QUAD_COLORS[quads.monthly] || '#555') }}>{quads.monthly}</span>}
          {hasQ && quads.quarterly && quads.quarterly !== quads.monthly && (
            <span style={{ fontSize: 10, color: QUAD_COLORS[quads.quarterly] || '#555' }}>({quads.quarterly} qtrly)</span>
          )}
          {hasCpi && <span style={S.badge('#27500A')}>CPI</span>}
          {intel._sssExtracted > 0 && <span style={S.badge('#1A4D8F')}>{intel._sssExtracted} tickers</span>}
          {intel.keyPoints?.length > 0 && <span style={S.badge('#6B6860')}>{intel.keyPoints.length} pts</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pdf.numPages && <span style={S.lightLabel}>{pdf.numPages}pp</span>}
          {hasQ && (
            <button style={{ ...S.btn, fontSize: 10, padding: '3px 8px', background: '#1A4D8F', borderColor: '#1A4D8F' }}
              onClick={(e) => { e.stopPropagation(); onApplyQuads(); }}>Apply Quads</button>
          )}
          <span style={{ color: '#888', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {pdf.error && expanded && (
        <div style={{ padding: '8px 14px', fontSize: 11, color: '#C8302A', borderTop: '1px solid #E4E1DA' }}>
          {pdf.error}
        </div>
      )}

      {expanded && !pdf.error && (
        <div style={S.intelWrap}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: '#7A7770', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Extracted Intelligence{typePill ? ` · ${typePill.label}` : ''}</span>
            {intel.ingestedAt && (
              <span style={{ fontWeight: 400, color: '#9A9790' }}>
                {new Date(intel.ingestedAt).toLocaleString()}
              </span>
            )}
          </div>

          {intel._sssExtracted > 0 && (
            <div style={{ marginBottom: 10, padding: '6px 10px', background: '#E4EDF8',
              border: '1px solid #5B8FD8', borderRadius: 3 }}>
              <span style={{ fontSize: 10, color: '#1A4D8F', fontWeight: 600 }}>
                SSS · {intel._sssExtracted} ticker{intel._sssExtracted > 1 ? 's' : ''} extracted and applied to Signal Strength list
              </span>
            </div>
          )}

          {hasCpi && (
            <div style={{ marginBottom: 10 }}>
              <div style={S.intelLabel}>CPI</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                {[['YoY', intel.cpi.headline], ['Core YoY', intel.cpi.core], ['MoM', intel.cpi.mom], ['Nowcast', intel.cpi.nowcast]]
                  .filter(([, v]) => v)
                  .map(([lbl, v]) => (
                    <span key={lbl} title={v.context} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                      <span style={{ fontSize: 9, color: '#9A9790', marginRight: 3 }}>{lbl}</span>
                      <strong style={{ color: valColor(v.value) }}>
                        {v.value > 0 ? '+' : ''}{v.value.toFixed(2)}%
                      </strong>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {hasGdp && (
            <div style={{ marginBottom: 10 }}>
              <div style={S.intelLabel}>GDP</div>
              <div style={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap' }}>
                {[['Growth', intel.gdp.growth], ['Nowcast', intel.gdp.nowcast]]
                  .filter(([, v]) => v)
                  .map(([lbl, v]) => (
                    <span key={lbl} title={v.context} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                      <span style={{ fontSize: 9, color: '#9A9790', marginRight: 3 }}>{lbl}</span>
                      <strong style={{ color: v.value > 2 ? '#27500A' : v.value > 0 ? '#B8860B' : '#C8302A' }}>
                        {v.value > 0 ? '+' : ''}{v.value.toFixed(1)}%
                      </strong>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {hasQ && (
            <div style={{ marginBottom: 10 }}>
              <div style={S.intelLabel}>Quad Calls</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {quads.monthly && (
                  <span style={{ padding: '2px 9px', fontSize: 11, fontWeight: 700, borderRadius: 2,
                    background: QUAD_COLORS[quads.monthly] || '#555', color: '#fff' }}>Monthly {quads.monthly}</span>
                )}
                {quads.quarterly && (
                  <span style={{ padding: '2px 9px', fontSize: 11, fontWeight: 700, borderRadius: 2,
                    background: QUAD_COLORS[quads.quarterly] || '#555', color: '#fff' }}>Quarterly {quads.quarterly}</span>
                )}
                <span style={{ fontSize: 10, color: CONF[quads.confidence] }}>{quads.confidence} confidence</span>
                {quads.mentions?.length > 0 && (
                  <span style={S.lightLabel}>· {quads.mentions.map(m => `${m.quad}×${m.count}`).join(', ')}</span>
                )}
              </div>
            </div>
          )}

          {(intel.signals?.usd || intel.signals?.btc) && (
            <div style={{ marginBottom: 10 }}>
              <div style={S.intelLabel}>Signals</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {intel.signals.usd && (
                  <span style={S.chip}>USD <strong style={{ color: intel.signals.usd === 'BULLISH' ? '#27500A' : '#C8302A' }}>{intel.signals.usd}</strong></span>
                )}
                {intel.signals.btc && (
                  <span style={S.chip}>BTC <strong style={{ color: intel.signals.btc === 'BULLISH' ? '#27500A' : '#C8302A' }}>{intel.signals.btc}</strong></span>
                )}
              </div>
            </div>
          )}

          {intel.riskRanges?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={S.intelLabel}>Risk Ranges</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {intel.riskRanges.map((r, i) => (
                  <span key={i} title={r.context} style={S.chip}>
                    <strong>{r.symbol}</strong> ${r.low}–${r.high}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intel.keyPoints?.length > 0 && (
            <div>
              <div style={S.intelLabel}>Key Points ({intel.keyPoints.length} extracted)</div>
              {intel.keyPoints.map((pt, i) => (
                <div key={i} style={{ fontSize: 11, color: '#444', lineHeight: 1.55, marginBottom: 4,
                  paddingLeft: 12, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: '#9A9790' }}>·</span>
                  {pt.slice(0, 160)}{pt.length > 160 ? '…' : ''}
                </div>
              ))}
            </div>
          )}

          {!hasCpi && !hasGdp && !hasQ && !intel.riskRanges?.length && !intel.keyPoints?.length && !intel._sssExtracted && (
            <div style={{ color: '#999', fontSize: 11 }}>No structured data extracted — try a research call PDF.</div>
          )}
        </div>
      )}

      {expanded && !pdf.error && pdf.pages?.length > 0 && (
        <div style={S.pagesWrap}>
          {pdf.pages.map((img, i) => (
            <img key={i} src={img} style={S.pageImg} alt={`Page ${i+1}`}
              title={`Page ${i+1} of ${pdf.numPages}`}
              onClick={() => { const w = window.open(); w.document.write(`<img src="${img}" style="max-width:100%;display:block;margin:auto">`); }} />
          ))}
          {pdf.numPages > 6 && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: '#aaa', fontSize: 11, flexShrink: 0 }}>
              +{pdf.numPages - 6} more pages
            </div>
          )}
        </div>
      )}
    </div>
  );
};
