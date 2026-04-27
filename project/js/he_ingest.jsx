// he_ingest.jsx — PDF Research Ingestion Tab

const IngestTab = ({ onQuadUpdate }) => {
  const [pdfs, setPdfs] = React.useState([]);
  const [processing, setProcessing] = React.useState(false);
  const [processingName, setProcessingName] = React.useState('');
  const [error, setError] = React.useState('');
  const [selectedPdf, setSelectedPdf] = React.useState(null);
  const [dirHandle, setDirHandle] = React.useState(null);
  const dropRef = React.useRef(null);

  const HAS_FSA = typeof window.showDirectoryPicker === 'function';

  // ── PDF.js setup ──────────────────────────────────────────────────
  const getPdfjs = () => {
    if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return pdfjsLib;
  };

  // ── Text extraction + page rendering ─────────────────────────────
  const processPdfFile = async (file) => {
    const lib = getPdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: arrayBuffer }).promise;

    // Extract text from all pages
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(it => it.str).join(' ') + '\n';
    }

    // Render first 6 pages as images
    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pages.push(canvas.toDataURL('image/jpeg', 0.75));
    }

    const quads = extractQuads(fullText);
    const signals = extractSignals(fullText);

    return { name: file.name, size: file.size, text: fullText, pages, quads, signals, numPages: doc.numPages };
  };

  // ── Quad extraction ───────────────────────────────────────────────
  const extractQuads = (text) => {
    const result = { monthly: null, quarterly: null, confidence: 'low', mentions: [] };

    // High-confidence: explicit "monthly quad X" or "quarterly quad X" phrases
    const mMatch = text.match(/monthly[^.\n]{0,30}[Qq](?:uad)?\s*([1234])/i)
                || text.match(/[Qq](?:uad)?\s*([1234])[^.\n]{0,20}monthly/i);
    const qMatch = text.match(/quarterly[^.\n]{0,30}[Qq](?:uad)?\s*([1234])/i)
                || text.match(/[Qq](?:uad)?\s*([1234])[^.\n]{0,20}quarterly/i);

    if (mMatch) { result.monthly = `Q${mMatch[1]}`; result.confidence = 'high'; }
    if (qMatch) { result.quarterly = `Q${qMatch[1]}`; result.confidence = 'high'; }

    // Medium-confidence: "Tracking Quad2" or "in Quad 3" or "#Quad2"
    if (!result.monthly) {
      const trackMatch = text.match(/[Tt]racking\s+[Qq](?:uad)?\s*([1234])/);
      const hashMatch = text.match(/#[Qq]uad([1234])/);
      if (trackMatch) { result.monthly = `Q${trackMatch[1]}`; result.confidence = 'medium'; }
      else if (hashMatch) { result.monthly = `Q${hashMatch[1]}`; result.confidence = 'medium'; }
    }

    // Collect all quad mentions for display
    const allMatches = [...text.matchAll(/[Qq](?:uad)?\s*([1234])/g)];
    const counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    allMatches.forEach(m => { counts[`Q${m[1]}`] = (counts[`Q${m[1]}`] || 0) + 1; });
    result.mentions = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([q, c]) => ({ quad: q, count: c }));

    return result;
  };

  // ── Signal extraction ─────────────────────────────────────────────
  const extractSignals = (text) => {
    const signals = [];

    // CPI / inflation numbers
    const cpiMatch = text.match(/CPI[^.\n]{0,40}([\d.]+)%/i);
    if (cpiMatch) signals.push({ type: 'CPI', value: cpiMatch[1] + '%', context: cpiMatch[0].trim() });

    // GDP / growth
    const gdpMatch = text.match(/GDP[^.\n]{0,40}([\d.]+)%/i);
    if (gdpMatch) signals.push({ type: 'GDP', value: gdpMatch[1] + '%', context: gdpMatch[0].trim() });

    // USD signal
    if (/\bUSD\b[^.\n]{0,20}\b(BULL|bull)/i.test(text)) signals.push({ type: 'USD', value: 'BULLISH' });
    else if (/\bUSD\b[^.\n]{0,20}\b(BEAR|bear)/i.test(text)) signals.push({ type: 'USD', value: 'BEARISH' });

    // Rates
    const ratesMatch = text.match(/10[- ]?[Yy](?:ear|r)?[^.\n]{0,40}([\d.]+)%/);
    if (ratesMatch) signals.push({ type: '10Y', value: ratesMatch[1] + '%', context: ratesMatch[0].trim() });

    return signals;
  };

  // ── File processing pipeline ──────────────────────────────────────
  const processFiles = async (files) => {
    setProcessing(true);
    setError('');
    const results = [];
    for (const file of files) {
      try {
        setProcessingName(file.name);
        const result = await processPdfFile(file);
        results.push(result);
      } catch (e) {
        results.push({ name: file.name, error: e.message, pages: [], quads: {}, signals: [] });
      }
    }
    setPdfs(prev => {
      const existingNames = new Set(prev.map(p => p.name));
      return [...prev, ...results.filter(r => !existingNames.has(r.name))];
    });
    setProcessing(false);
    setProcessingName('');

    // Auto-apply highest-confidence quad extraction
    applyBestQuads(results);
  };

  const applyBestQuads = (results) => {
    let best = null;
    for (const r of results) {
      if (!r.quads) continue;
      const conf = r.quads.confidence;
      if (conf === 'high' && (!best || best.quads.confidence !== 'high')) best = r;
      else if (conf === 'medium' && !best) best = r;
    }
    if (best && best.quads && (best.quads.monthly || best.quads.quarterly)) {
      const { monthly, quarterly } = best.quads;
      window.HE.applyResearchQuads(monthly, quarterly, best.name);
      if (onQuadUpdate) onQuadUpdate({ monthly, quarterly, source: best.name });
    }
  };

  // ── File System Access API ────────────────────────────────────────
  const connectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      setDirHandle(handle);
      const files = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
          files.push(await entry.getFile());
        }
      }
      if (files.length === 0) { setError('No PDF files found in that folder.'); return; }
      await processFiles(files);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    }
  };

  const refreshFolder = async () => {
    if (!dirHandle) return;
    const files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push(await entry.getFile());
      }
    }
    await processFiles(files);
  };

  // ── Drag-and-drop handler ─────────────────────────────────────────
  const handleDrop = async (e) => {
    e.preventDefault();
    dropRef.current && dropRef.current.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) { setError('Please drop PDF files only.'); return; }
    await processFiles(files);
  };

  // ── Manual apply quad from a specific PDF ────────────────────────
  const applyQuadFromPdf = (pdf) => {
    if (!pdf.quads) return;
    const { monthly, quarterly } = pdf.quads;
    window.HE.applyResearchQuads(monthly, quarterly, pdf.name);
    if (onQuadUpdate) onQuadUpdate({ monthly, quarterly, source: pdf.name });
  };

  // ── Styles ────────────────────────────────────────────────────────
  const S = {
    wrap: { padding: '16px 20px', fontFamily: 'IBM Plex Mono, monospace' },
    header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
    title: { fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: '0.05em', textTransform: 'uppercase' },
    btn: { padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'IBM Plex Mono, monospace', border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer', borderRadius: 2 },
    btnOutline: { padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'IBM Plex Mono, monospace', border: '1px solid #C0BDB8', background: 'transparent', color: '#333', cursor: 'pointer', borderRadius: 2 },
    dropZone: { border: '2px dashed #C0BDB8', borderRadius: 4, padding: '28px 20px', textAlign: 'center', color: '#888', fontSize: 11, cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s', marginBottom: 16 },
    card: { background: '#fff', border: '1px solid #E4E1DA', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
    cardHeader: { padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' },
    cardName: { fontSize: 11, fontWeight: 600, color: '#111', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    badge: (color) => ({ display: 'inline-block', padding: '1px 7px', fontSize: 10, fontWeight: 700, borderRadius: 2, background: color, color: '#fff', marginLeft: 6, letterSpacing: '0.05em' }),
    pagesWrap: { display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', background: '#FAF9F6', borderTop: '1px solid #E4E1DA' },
    pageImg: { height: 220, borderRadius: 2, border: '1px solid #E4E1DA', flexShrink: 0, cursor: 'zoom-in' },
    signalsRow: { padding: '8px 14px', borderTop: '1px solid #E4E1DA', display: 'flex', flexWrap: 'wrap', gap: 6 },
    signalChip: { fontSize: 10, padding: '2px 8px', background: '#F0EDE8', border: '1px solid #DDD9D4', borderRadius: 2, color: '#333' },
    quadRow: { padding: '8px 14px', borderTop: '1px solid #E4E1DA', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    quadBadge: (q) => {
      const colors = { Q1: '#27500A', Q2: '#1A4D8F', Q3: '#B8860B', Q4: '#C8302A' };
      return { padding: '2px 10px', fontSize: 11, fontWeight: 700, background: colors[q] || '#555', color: '#fff', borderRadius: 2 };
    },
    error: { padding: '8px 12px', background: '#FFF0F0', border: '1px solid #F5C0C0', borderRadius: 3, fontSize: 11, color: '#C8302A', marginBottom: 10 },
    processing: { padding: '10px 14px', background: '#F0F4FF', border: '1px solid #C0CFF0', borderRadius: 3, fontSize: 11, color: '#1A4D8F', marginBottom: 10 },
    emptyState: { textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: 12 },
    lightLabel: { fontSize: 10, color: '#888', fontWeight: 400 },
  };

  const QUAD_COLORS = { Q1: '#27500A', Q2: '#1A4D8F', Q3: '#B8860B', Q4: '#C8302A' };
  const CONF_COLORS = { high: '#27500A', medium: '#B8860B', low: '#888' };

  return (
    <div style={S.wrap}>
      {/* ── Header ── */}
      <div style={S.header}>
        <span style={S.title}>Research Ingestion</span>
        {HAS_FSA && (
          <button style={S.btn} onClick={connectFolder} disabled={processing}>
            Connect Folder
          </button>
        )}
        {dirHandle && (
          <button style={S.btnOutline} onClick={refreshFolder} disabled={processing}>
            Refresh
          </button>
        )}
        {pdfs.length > 0 && (
          <button style={{...S.btnOutline, marginLeft: 'auto', color: '#C8302A', borderColor: '#C8302A'}}
            onClick={() => { setPdfs([]); setSelectedPdf(null); }}>
            Clear All
          </button>
        )}
      </div>

      {/* ── Status bar ── */}
      {error && <div style={S.error}>{error} <span style={{cursor:'pointer',float:'right'}} onClick={() => setError('')}>✕</span></div>}
      {processing && (
        <div style={S.processing}>
          Processing <strong>{processingName}</strong>… extracting text &amp; rendering pages
        </div>
      )}

      {/* ── Drop zone ── */}
      {!HAS_FSA && (
        <div
          ref={dropRef}
          style={S.dropZone}
          onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
          onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
          onDrop={handleDrop}
          onClick={() => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.pdf'; inp.multiple = true;
            inp.onchange = (e) => processFiles([...e.target.files]);
            inp.click();
          }}
        >
          <div style={{fontSize: 22, marginBottom: 6}}>⬇</div>
          <strong>Drop PDFs here</strong> or click to choose files<br />
          <span style={{fontSize: 10, color: '#aaa'}}>Hedgeye research PDFs — quad calls, risk ranges, and charts will be extracted</span>
        </div>
      )}

      {HAS_FSA && pdfs.length === 0 && !processing && (
        <div
          ref={dropRef}
          style={S.dropZone}
          onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
          onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
          onDrop={handleDrop}
        >
          Click <strong>Connect Folder</strong> above to watch a folder, or drag &amp; drop PDFs here
        </div>
      )}

      {/* ── PDF list ── */}
      {pdfs.length === 0 && !processing && (
        <div style={S.emptyState}>
          No research loaded yet.<br />
          <span style={{fontSize: 11}}>Connect a folder containing Hedgeye PDFs to auto-extract quad calls, signals, and charts.</span>
        </div>
      )}

      {pdfs.map((pdf, idx) => (
        <PdfCard
          key={pdf.name}
          pdf={pdf}
          expanded={selectedPdf === idx}
          onToggle={() => setSelectedPdf(selectedPdf === idx ? null : idx)}
          onApplyQuads={() => applyQuadFromPdf(pdf)}
          S={S}
          QUAD_COLORS={QUAD_COLORS}
          CONF_COLORS={CONF_COLORS}
        />
      ))}

      <style>{`
        .drag-over { border-color: #1A4D8F !important; background: #F0F4FF !important; }
      `}</style>
    </div>
  );
};

// ── PDF Card sub-component ────────────────────────────────────────────────────
const PdfCard = ({ pdf, expanded, onToggle, onApplyQuads, S, QUAD_COLORS, CONF_COLORS }) => {
  const hasQuads = pdf.quads && (pdf.quads.monthly || pdf.quads.quarterly);
  const hasError = !!pdf.error;

  return (
    <div style={S.card}>
      {/* Card header row */}
      <div style={S.cardHeader} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={S.cardName}>{pdf.name}</span>
          {hasError && <span style={S.badge('#C8302A')}>ERROR</span>}
          {hasQuads && pdf.quads.monthly && (
            <span style={{ ...S.badge(QUAD_COLORS[pdf.quads.monthly] || '#555'), marginLeft: 4 }}>
              {pdf.quads.monthly}
            </span>
          )}
          {hasQuads && pdf.quads.quarterly && pdf.quads.quarterly !== pdf.quads.monthly && (
            <span style={{ fontSize: 10, color: QUAD_COLORS[pdf.quads.quarterly] || '#555', marginLeft: 2 }}>
              ({pdf.quads.quarterly} qtrly)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pdf.numPages && <span style={S.lightLabel}>{pdf.numPages}pp</span>}
          {hasQuads && (
            <button
              style={{ ...S.btn, fontSize: 10, padding: '3px 8px', background: '#1A4D8F', borderColor: '#1A4D8F' }}
              onClick={(e) => { e.stopPropagation(); onApplyQuads(); }}
            >
              Apply Quads
            </button>
          )}
          <span style={{ color: '#888', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Error state */}
      {hasError && expanded && (
        <div style={{ padding: '8px 14px', fontSize: 11, color: '#C8302A', borderTop: '1px solid #E4E1DA' }}>
          {pdf.error}
        </div>
      )}

      {/* Quad extraction results */}
      {expanded && !hasError && hasQuads && (
        <div style={S.quadRow}>
          <span style={S.lightLabel}>Extracted:</span>
          {pdf.quads.monthly && (
            <span style={S.quadBadge(pdf.quads.monthly)}>
              Monthly {pdf.quads.monthly}
            </span>
          )}
          {pdf.quads.quarterly && (
            <span style={S.quadBadge(pdf.quads.quarterly)}>
              Quarterly {pdf.quads.quarterly}
            </span>
          )}
          <span style={{ fontSize: 10, color: CONF_COLORS[pdf.quads.confidence] || '#888', marginLeft: 4 }}>
            {pdf.quads.confidence} confidence
          </span>
          {pdf.quads.mentions && pdf.quads.mentions.length > 0 && (
            <span style={S.lightLabel}>
              · mentions: {pdf.quads.mentions.map(m => `${m.quad}×${m.count}`).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Extracted signals */}
      {expanded && !hasError && pdf.signals && pdf.signals.length > 0 && (
        <div style={S.signalsRow}>
          <span style={S.lightLabel}>Signals:</span>
          {pdf.signals.map((sig, i) => (
            <span key={i} style={S.signalChip}>
              <strong>{sig.type}</strong> {sig.value}
            </span>
          ))}
        </div>
      )}

      {/* Page thumbnails */}
      {expanded && !hasError && pdf.pages && pdf.pages.length > 0 && (
        <div style={S.pagesWrap}>
          {pdf.pages.map((imgData, i) => (
            <img
              key={i}
              src={imgData}
              style={S.pageImg}
              alt={`Page ${i + 1}`}
              title={`Page ${i + 1} of ${pdf.numPages}`}
              onClick={() => {
                const w = window.open();
                w.document.write(`<img src="${imgData}" style="max-width:100%;display:block;margin:auto">`);
              }}
            />
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
