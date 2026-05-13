'use strict';

// ── SOURCE CONFIG — mirrors Python cache windows ───────────────────────────────
const RS_SOURCES = [
  { key:'etf_pro',          label:'ETF Pro',          cache:2,    freq:'daily',   stage:1 },
  { key:'ham_holdings',     label:'HAM Holdings',     cache:2,    freq:'daily',   stage:1 },
  { key:'rta',              label:'RTA Trades',       cache:2,    freq:'daily',   stage:1 },
  { key:'macro_show',       label:'Macro Show',       cache:2,    freq:'daily',   stage:2 },
  { key:'msr',              label:'MSR / Game Plan',  cache:2,    freq:'daily',   stage:2 },
  { key:'sss',              label:'Signal Strength',  cache:2,    freq:'daily',   stage:2 },
  { key:'momo',             label:'MOMO Tracker',     cache:2,    freq:'daily',   stage:2 },
  { key:'early_look',       label:'Early Look',       cache:2,    freq:'daily',   stage:2 },
  { key:'portfolio',        label:'Portfolio',        cache:2,    freq:'daily',   stage:2 },
  { key:'btc',  alias:'crypto', label:'Crypto / BTC', cache:2,   freq:'daily',   stage:2 },
  { key:'call_summary',     label:'Call Summary',     cache:2,    freq:'daily',   stage:2 },
  { key:'macro_show_notes', label:'Show Notes',       cache:2,    freq:'daily',   stage:2 },
  { key:'investing_ideas',  label:'Investing Ideas',  cache:14,   freq:'weekly',  stage:2 },
  { key:'founders_choice',  label:'Founders Choice',  cache:14,   freq:'weekly',  stage:2 },
  { key:'from_desk',        label:'From the Desk',    cache:14,   freq:'weekly',  stage:2 },
  { key:'macro_research', alias:'gip', label:'Macro Research', cache:null, freq:'special', stage:2 },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────

function rsFmtTs(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
  catch { return iso.slice(0, 16); }
}

function rsAgeDays(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function rsTrunc(s, n = 36) {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// resolve source ID / PDF data accounting for legacy key aliases
function rsSid(src, sourcesUsed)  { return sourcesUsed[src.key] ?? sourcesUsed[src.alias] ?? null; }
function rsPdf(src, pdf)          { return pdf[src.key] ?? pdf[src.alias] ?? null; }

function rsStatus(sid, cacheDays, genAt) {
  if (!sid) return { icon:'🔴', label:'Missing',  color:'#C53030' };
  if (cacheDays === null) return { icon:'✅', label:'No expiry', color:'#276749' };
  const age = rsAgeDays(genAt);
  if (age > cacheDays)     return { icon:'🔴', label:`${Math.floor(age)}d old`,          color:'#C53030' };
  if (age > cacheDays * 0.5) return { icon:'⚠️', label:`${age.toFixed(1)}d / ${cacheDays}d`, color:'#B7791F' };
  return { icon:'✅', label:'Fresh', color:'#276749' };
}

function rsKeyData(src, data) {
  const pdf = data.pdf || {};
  const d   = rsPdf(src, pdf);
  switch (src.key) {
    case 'etf_pro':
      return `${(data.etf_rerank||[]).length} tickers · ${(data.active_longs||[]).length}L / ${(data.active_shorts||[]).length}S`;
    case 'ham_holdings':
      return `${(data.ham_holdings||[]).length} holdings`;
    case 'rta': {
      const rt = data.rta || {};
      const wr = rt.stats?.win_rate_long;
      return `${(rt.recent_trades||[]).length} trades 90d · win ${wr != null ? (wr * 100).toFixed(0) + '%' : '—'}`;
    }
    case 'macro_show': {
      if (!d) return '—';
      const q = d.quad || {};
      return `Quad ${q.monthly ?? '?'}/${q.quarterly ?? '?'} · VIX ${d.vix?.current ?? '—'} ${d.vix?.bucket ?? ''}`;
    }
    case 'msr':
      return d ? `Gamma ${d.gamma_exposure ?? '—'} · ${d.strategic_allocation ?? '—'}` : '—';
    case 'sss':
      return d ? `${d.count ?? '—'} tickers · +${(d.added||[]).length} added · −${(d.removed||[]).length} removed` : '—';
    case 'momo':
      return d ? `${Object.keys(d).length} tickers` : '—';
    case 'early_look':
      return d ? `VIX ${d.vix_level ?? '—'} · ${(d.keith_notes||[]).length} notes` : '—';
    case 'portfolio':
      return d ? `${(d.positions||[]).length} positions` : '—';
    case 'btc': {
      if (!d) return '—';
      const b = d.BTC || {};
      return `BTC ${b.signal ?? '—'} ${b.lrr ?? ''}–${b.trr ?? ''}`;
    }
    case 'call_summary':
      return d ? `${(d.key_points||[]).length} points · Quad ${d.quad ?? '—'}` : '—';
    case 'macro_show_notes':
      return d ? `${(d.key_points||[]).length} key points` : '—';
    case 'investing_ideas':
      return d ? `${Object.keys(d.longs||{}).length}L / ${Object.keys(d.shorts||{}).length}S` : '—';
    case 'founders_choice': {
      if (!d) return '—';
      return Object.entries(d).map(([s, v]) => `${s}: ${(v.longs||[]).length}L/${(v.shorts||[]).length}S`).join(' · ') || '—';
    }
    case 'from_desk':
      return d ? `${d.risk_tone ?? '—'} · ${(d.key_points||[]).length} points` : '—';
    case 'macro_research':
      return d ? `CPI ${d.cpi_nowcast ?? '—'}% ${d.cpi_trend ?? ''} · Quad ${d.monthly_quad ?? '—'}` : '—';
    default: return '—';
  }
}

// ── SHARED MINI-COMPONENTS ────────────────────────────────────────────────────

const SIGNAL_COLORS = {
  BULLISH:  { bg:'#EAF3DE', color:'#276749' },
  BEARISH:  { bg:'#FFF5F5', color:'#C53030' },
  NEUTRAL:  { bg:'#EDF2F7', color:'#2C5282' },
  RISK_ON:  { bg:'#EAF3DE', color:'#276749' },
  RISK_OFF: { bg:'#FFF5F5', color:'#C53030' },
};
const QUAD_COLORS = {
  1:{ bg:'#EBF8FF', color:'#2B6CB0' },
  2:{ bg:'#EAF3DE', color:'#276749' },
  3:{ bg:'#FFF5F5', color:'#C53030' },
  4:{ bg:'#FFFFF0', color:'#744210' },
};

function RSBadge({ v, colorMap }) {
  const cfg = (colorMap || SIGNAL_COLORS)[v] || { bg:'#F4F3EF', color:'#888' };
  return (
    <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
      padding:'1px 6px', borderRadius:3, background:cfg.bg, color:cfg.color, letterSpacing:'0.04em' }}>
      {v ?? '—'}
    </span>
  );
}

function RSKv({ label, value, mono, color }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'baseline', marginBottom:4 }}>
      <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#888',
        minWidth:130, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12, fontFamily: mono ? 'IBM Plex Mono,monospace' : undefined,
        color: color || '#1A1A18', fontWeight: mono ? 500 : 400 }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function RSSection({ children }) {
  return <div style={{ display:'flex', flexDirection:'column', gap:2 }}>{children}</div>;
}

function RSSectionTitle({ children }) {
  return (
    <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888',
      letterSpacing:'0.05em', marginBottom:6, marginTop:2 }}>{children}</div>
  );
}

function RSCollapsible({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ border:'1px solid #E4E1DA', borderRadius:6, overflow:'hidden', marginBottom:8 }}>
      <div onClick={() => setOpen(!open)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 14px', background:'#fff', cursor:'pointer', userSelect:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600,
            letterSpacing:'0.05em' }}>{title}</span>
          {badge && (
            <span style={{ fontSize:10, background:'#EAF3DE', color:'#276749',
              padding:'1px 6px', borderRadius:3, fontFamily:'IBM Plex Mono,monospace' }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{ color:'#7A7770', fontSize:11 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding:'12px 14px', background:'#FAFAF8', borderTop:'1px solid #E4E1DA' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── EXTRACTED DATA PANELS ─────────────────────────────────────────────────────

function MacroStatePanel({ data }) {
  const ms  = data.pdf?.macro_show || {};
  const msr = data.pdf?.msr        || {};
  const gip = data.pdf?.macro_research || data.pdf?.gip || {};
  const q   = ms.quad || {};
  const fq  = gip.forward_quads || {};

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <RSSection>
        <RSSectionTitle>QUAD / REGIME</RSSectionTitle>
        <RSKv label="Monthly Quad"    value={q.monthly   ? <RSBadge v={`QUAD ${q.monthly}`}   colorMap={{ [`QUAD ${q.monthly}`]: QUAD_COLORS[q.monthly] }} />   : null} />
        <RSKv label="Quarterly Quad"  value={q.quarterly ? <RSBadge v={`QUAD ${q.quarterly}`} colorMap={{ [`QUAD ${q.quarterly}`]: QUAD_COLORS[q.quarterly] }} /> : null} />
        <RSKv label="Quad Sequence"   value={ms.quad_sequence} mono />
        <RSKv label="Growth RoC"      value={ms.growth_roc}    color={ms.growth_roc    === 'ACCELERATING' ? '#276749' : ms.growth_roc    ? '#C53030' : undefined} />
        <RSKv label="Inflation RoC"   value={ms.inflation_roc} color={ms.inflation_roc === 'ACCELERATING' ? '#C53030' : ms.inflation_roc ? '#276749' : undefined} />
        {ms.high_beta_1m != null && <RSKv label="High Beta 1M" value={`${ms.high_beta_1m > 0 ? '+' : ''}${ms.high_beta_1m}%`} color={ms.high_beta_1m > 0 ? '#276749' : '#C53030'} />}
        {ms.low_beta_1m  != null && <RSKv label="Low Beta 1M"  value={`${ms.low_beta_1m  > 0 ? '+' : ''}${ms.low_beta_1m}%`}  color={ms.low_beta_1m  > 0 ? '#276749' : '#C53030'} />}
      </RSSection>

      <RSSection>
        <RSSectionTitle>MARKET STRUCTURE</RSSectionTitle>
        {ms.vix?.current != null && <RSKv label="VIX" value={`${ms.vix.current}${ms.vix.bucket ? '  ' + ms.vix.bucket : ''}`} />}
        {msr.strategic_allocation && <RSKv label="Strategic" value={<RSBadge v={msr.strategic_allocation} />} />}
        {msr.gamma_exposure    && <RSKv label="Gamma"      value={msr.gamma_exposure}    color={msr.gamma_exposure === 'POSITIVE' ? '#276749' : msr.gamma_exposure === 'NEGATIVE' ? '#C53030' : '#2C5282'} />}
        {msr.systematic_flow   && <RSKv label="Systematic" value={msr.systematic_flow} />}
        {msr.pv_band           && <RSKv label="PV Band"    value={msr.pv_band} />}
        {msr.realized_vol_10d != null && <RSKv label="Realized Vol 10d" value={`${msr.realized_vol_10d}%`} />}
        {msr.gvt              != null && <RSKv label="GVT" value={msr.gvt} mono />}
      </RSSection>

      {(gip.cpi_nowcast != null || Object.keys(fq).length > 0) && (
        <div style={{ gridColumn:'1/-1' }}>
          <RSSectionTitle>CPI / GIP NOWCAST</RSSectionTitle>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom: Object.keys(fq).length ? 10 : 0 }}>
            {gip.cpi_nowcast != null && <RSKv label="CPI Nowcast" value={`${gip.cpi_nowcast}%`} />}
            {gip.cpi_trend   && <RSKv label="CPI Trend" value={gip.cpi_trend} color={gip.cpi_trend === 'ACCELERATING' ? '#C53030' : '#276749'} />}
          </div>
          {Object.keys(fq).length > 0 && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {Object.entries(fq).map(([qtr, v]) => (
                <div key={qtr} style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:4, padding:'6px 10px', minWidth:96 }}>
                  <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888', marginBottom:3 }}>{qtr}</div>
                  <RSBadge v={`Q${v.quad}`} colorMap={{ [`Q${v.quad}`]: QUAD_COLORS[v.quad] }} />
                  <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#555', marginTop:3 }}>
                    GDP {v.gdp_qoq != null ? `${v.gdp_qoq}%` : '—'} · CPI {v.cpi_yoy != null ? `${v.cpi_yoy}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(ms.keith_commentary || []).length > 0 && (
        <div style={{ gridColumn:'1/-1' }}>
          <RSSectionTitle>KEITH COMMENTARY</RSSectionTitle>
          {ms.keith_commentary.map((b, i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:5 }}>
              <span style={{ color:'#B7791F', flexShrink:0 }}>·</span>
              <span style={{ fontSize:11, color:'#333', lineHeight:1.5 }}>{b}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SSSPanel({ data }) {
  const s = data.pdf?.sss;
  if (!s) return <span style={{ color:'#888', fontSize:12 }}>No SSS data extracted.</span>;
  return (
    <div>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:12 }}>
        <RSKv label="Total Count" value={s.count} mono />
        <RSKv label="Added"   value={(s.added  || []).join(', ') || 'None'} color="#276749" />
        <RSKv label="Removed" value={(s.removed || []).join(', ') || 'None'} color="#C53030" />
      </div>
      {(s.tickers || []).length > 0 && (
        <>
          <RSSectionTitle>ALL TICKERS ({s.tickers.length})</RSSectionTitle>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {s.tickers.map(t => (
              <span key={t} style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                background:'#EAF3DE', color:'#276749', padding:'2px 6px', borderRadius:3 }}>
                {t}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InvestingIdeasPanel({ data }) {
  const ii = data.pdf?.investing_ideas;
  if (!ii) return <span style={{ color:'#888', fontSize:12 }}>No Investing Ideas data extracted.</span>;
  const sides = [
    ['LONGS',  Object.entries(ii.longs  || {}), '#276749', '#EAF3DE'],
    ['SHORTS', Object.entries(ii.shorts || {}), '#C53030', '#FFF5F5'],
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      {sides.map(([side, entries, color, bg]) => (
        <div key={side}>
          <RSSectionTitle>{side} ({entries.length})</RSSectionTitle>
          {entries.map(([ticker, pos]) => (
            <div key={ticker} style={{ marginBottom:8, padding:'6px 8px', background:'#fff',
              border:'1px solid #E4E1DA', borderRadius:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600, color }}>{ticker}</span>
                <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#555' }}>
                  {pos.lrr}–{pos.trr}
                </span>
              </div>
              {pos.thesis && <p style={{ fontSize:10, color:'#555', lineHeight:1.4, margin:0 }}>{pos.thesis}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MomoPanel({ data }) {
  const m = data.pdf?.momo;
  if (!m) return <span style={{ color:'#888', fontSize:12 }}>No MOMO Tracker data extracted.</span>;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:8 }}>
      {Object.entries(m).map(([ticker, d]) => (
        <div key={ticker} style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:4, padding:'8px 10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:600 }}>{ticker}</span>
            <RSBadge v={d.signal} />
          </div>
          <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#555' }}>
            {d.lrr} – {d.trr}
          </div>
          {d.close != null && (
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888', marginTop:2 }}>
              close {d.close}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ETFPositionsPanel({ data }) {
  const longs  = data.active_longs  || [];
  const shorts = data.active_shorts || [];
  const sides  = [['LONGS', longs, '#276749', '#EAF3DE'], ['SHORTS', shorts, '#C53030', '#FFF5F5']];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      {sides.map(([side, entries, color, bg]) => (
        <div key={side}>
          <RSSectionTitle>{side} ({entries.length})</RSSectionTitle>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {entries.map(e => (
              <span key={e.ticker}
                title={`${e.etf} · ${e.days_held ?? '?'}d held · $${e.last_price ?? '?'}`}
                style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                  background:bg, color, padding:'2px 6px', borderRadius:3, cursor:'default' }}>
                {e.ticker}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CryptoPanel({ data }) {
  const c = data.pdf?.btc || data.pdf?.crypto;
  if (!c) return <span style={{ color:'#888', fontSize:12 }}>No crypto data extracted.</span>;
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {Object.entries(c).map(([sym, d]) => (
        <div key={sym} style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:4, padding:'8px 12px', minWidth:115 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:600 }}>{sym}</span>
            <RSBadge v={d.signal} />
          </div>
          <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#555' }}>
            {d.lrr != null ? d.lrr.toLocaleString() : '—'} – {d.trr != null ? d.trr.toLocaleString() : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShowNotesPanel({ data }) {
  const n = data.pdf?.macro_show_notes;
  if (!n) return <span style={{ color:'#888', fontSize:12 }}>No notes extracted.</span>;
  const rows = [
    ['KEY POINTS',           n.key_points,           '#1A4D8F'],
    ['POSITIONING CHANGES',  n.positioning_changes,   '#B7791F'],
    ["KEITH'S WATCHING",     n.keith_watching,        '#276749'],
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
      {rows.map(([title, items, color]) => (
        <div key={title}>
          <RSSectionTitle>{title}</RSSectionTitle>
          {!(items || []).length
            ? <span style={{ fontSize:11, color:'#888' }}>None</span>
            : (items || []).map((pt, i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:4 }}>
                  <span style={{ color, flexShrink:0, fontSize:11 }}>·</span>
                  <span style={{ fontSize:11, color:'#333', lineHeight:1.5 }}>{pt}</span>
                </div>
              ))
          }
        </div>
      ))}
    </div>
  );
}

// ── SOURCE STATUS TABLE ROW ───────────────────────────────────────────────────

function RSRow({ src, sourcesUsed, data, genAt }) {
  const sid  = rsSid(src, sourcesUsed);
  const st   = rsStatus(sid, src.cache, genAt);
  const kd   = rsKeyData(src, data);

  // display filename: first part of pipe-joined multi-file sources
  let dispFile = '—';
  if (sid) {
    const parts = sid.split('|');
    dispFile    = rsTrunc(parts[0], 36) + (parts.length > 1 ? ` +${parts.length - 1}` : '');
  }

  const freqColor = src.freq === 'weekly' ? '#2C5282' : src.freq === 'special' ? '#744210' : '#276749';

  return (
    <tr>
      <td style={{ padding:'6px 12px', borderBottom:'1px solid #E4E1DA', whiteSpace:'nowrap' }}>
        <div style={{ fontSize:12, fontWeight:500 }}>{src.label}</div>
        <div style={{ display:'flex', gap:6, marginTop:2 }}>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:freqColor,
            background:`${freqColor}18`, padding:'0 4px', borderRadius:2 }}>{src.freq}</span>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888' }}>s{src.stage}</span>
        </div>
      </td>
      <td style={{ padding:'6px 12px', borderBottom:'1px solid #E4E1DA', maxWidth:220 }}>
        <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#555',
          wordBreak:'break-all' }} title={sid || ''}>
          {dispFile}
        </span>
      </td>
      <td style={{ padding:'6px 12px', borderBottom:'1px solid #E4E1DA', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:11, color:'#555' }}>{rsFmtTs(genAt)}</span>
      </td>
      <td style={{ padding:'6px 12px', borderBottom:'1px solid #E4E1DA', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:11, color:st.color, fontWeight:500 }}>{st.icon} {st.label}</span>
      </td>
      <td style={{ padding:'6px 12px', borderBottom:'1px solid #E4E1DA', color:'#555', fontSize:11 }}>
        {kd}
      </td>
    </tr>
  );
}

// ── MAIN TAB ──────────────────────────────────────────────────────────────────

function ResearchStatusTab() {
  const [ctx,     setCtx]     = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState(null);

  React.useEffect(() => {
    fetch('./data/macro_context.json?t=' + Date.now())
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d  => { setCtx(d);         setLoading(false); })
      .catch(e => { setLoadErr(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}>
      <LoadingSpinner msg="Loading macro context…" />
    </div>
  );
  if (loadErr) return (
    <div style={{ margin:24, padding:16, background:'#FFF5F5', border:'1px solid #FEB2B2',
      borderRadius:6, color:'#C53030', fontSize:12 }}>
      Failed to load macro_context.json: {loadErr}
    </div>
  );
  if (!ctx) return null;

  const sourcesUsed = ctx.sources_used || {};
  const genAt       = ctx.generated_at;
  const pdf         = ctx.pdf || {};
  const hasPdf      = Object.keys(pdf).length > 0;

  // Overall banner
  let staleCnt = 0, missingCnt = 0;
  for (const src of RS_SOURCES) {
    const { icon } = rsStatus(rsSid(src, sourcesUsed), src.cache, genAt);
    if (icon === '🔴') { if (!rsSid(src, sourcesUsed)) missingCnt++; else staleCnt++; }
    else if (icon === '⚠️') staleCnt++;
  }
  const issueCount = staleCnt + missingCnt;
  const allGreen   = issueCount === 0;
  const bannerBg   = issueCount > 3 ? '#FFF5F5' : issueCount > 0 ? '#FFFFF0' : '#EAF3DE';
  const bannerClr  = issueCount > 3 ? '#C53030' : issueCount > 0 ? '#B7791F' : '#276749';
  const bannerIcon = allGreen ? '✅' : issueCount > 3 ? '🔴' : '⚠️';
  const bannerMsg  = allGreen
    ? `All sources fresh — last updated ${rsFmtTs(genAt)}`
    : `${issueCount} source${issueCount !== 1 ? 's' : ''} stale or missing — run update_levels.ps1 to refresh`;

  return (
    <div style={{ padding:'16px 20px', maxWidth:1200, margin:'0 auto', animation:'fadeIn 0.2s ease' }}>

      {/* FRESHNESS BANNER */}
      <div style={{ background:bannerBg, border:`1px solid ${bannerClr}50`, borderRadius:6,
        padding:'8px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:15 }}>{bannerIcon}</span>
        <span style={{ fontSize:12, color:bannerClr, fontWeight:500 }}>{bannerMsg}</span>
      </div>

      {/* PIPELINE HEADER CARDS */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        {[
          ['LAST UPDATED',  rsFmtTs(genAt)],
          ['SOURCE DATE',   ctx.source_date || '—'],
          ['PDF SOURCES',   hasPdf ? `${Object.keys(pdf).length} extracted` : 'Stage 1 only'],
          ['STATUS',        allGreen ? 'All green' : `${issueCount} issue${issueCount !== 1 ? 's' : ''}`],
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:6,
            padding:'10px 14px', flex:'1 1 140px' }}>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888',
              letterSpacing:'0.05em', marginBottom:4 }}>{lbl}</div>
            <div style={{ fontSize:13, fontWeight:500,
              color: lbl === 'STATUS' ? bannerClr : '#1A1A18' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* SOURCE STATUS TABLE */}
      <div style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:6,
        overflow:'hidden', marginBottom:20 }}>
        <div style={{ padding:'8px 14px', borderBottom:'1px solid #E4E1DA',
          fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
          letterSpacing:'0.05em', color:'#555' }}>
          SOURCE STATUS
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#FAFAF8' }}>
                {['Source', 'Last File Used', 'Extracted', 'Status', 'Key Data'].map(h => (
                  <th key={h} style={{ padding:'6px 12px', borderBottom:'1px solid #E4E1DA',
                    textAlign:'left', fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                    color:'#888', fontWeight:600, letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RS_SOURCES.map(src => (
                <RSRow key={src.key} src={src} sourcesUsed={sourcesUsed} data={ctx} genAt={genAt} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KEY EXTRACTED DATA PANELS */}
      {hasPdf ? (
        <div>
          <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
            letterSpacing:'0.05em', color:'#555', marginBottom:10 }}>
            KEY EXTRACTED DATA
          </div>

          <RSCollapsible title="MACRO STATE" defaultOpen={true}
            badge={(() => {
              const q = pdf.macro_show?.quad || {};
              const b = pdf.macro_show?.vix?.bucket;
              return `Quad ${q.monthly ?? '?'}/${q.quarterly ?? '?'}${b ? ' · ' + b : ''}`;
            })()}>
            <MacroStatePanel data={ctx} />
          </RSCollapsible>

          {pdf.sss && (
            <RSCollapsible title="SIGNAL STRENGTH"
              badge={`${pdf.sss.count ?? '?'} tickers · +${(pdf.sss.added || []).length} added`}>
              <SSSPanel data={ctx} />
            </RSCollapsible>
          )}

          {pdf.investing_ideas && (
            <RSCollapsible title="INVESTING IDEAS"
              badge={`${Object.keys(pdf.investing_ideas.longs || {}).length}L / ${Object.keys(pdf.investing_ideas.shorts || {}).length}S`}>
              <InvestingIdeasPanel data={ctx} />
            </RSCollapsible>
          )}

          {pdf.momo && (
            <RSCollapsible title="MAG7 / MOMO RANGES"
              badge={`${Object.keys(pdf.momo).length} tickers`}>
              <MomoPanel data={ctx} />
            </RSCollapsible>
          )}

          <RSCollapsible title="ETF POSITIONS"
            badge={`${(ctx.active_longs || []).length}L / ${(ctx.active_shorts || []).length}S`}>
            <ETFPositionsPanel data={ctx} />
          </RSCollapsible>

          {(pdf.btc || pdf.crypto) && (
            <RSCollapsible title="CRYPTO / BTC"
              badge={(pdf.btc || pdf.crypto)?.BTC?.signal ?? null}>
              <CryptoPanel data={ctx} />
            </RSCollapsible>
          )}

          {pdf.macro_show_notes && (
            <RSCollapsible title="MACRO SHOW NOTES"
              badge={`${(pdf.macro_show_notes.key_points || []).length} points`}>
              <ShowNotesPanel data={ctx} />
            </RSCollapsible>
          )}
        </div>
      ) : (
        <div style={{ padding:16, background:'#FFFFF0', border:'1px solid #F6E05E',
          borderRadius:6, fontSize:12, color:'#744210' }}>
          PDF extraction has not run yet. Execute{' '}
          <code style={{ fontFamily:'IBM Plex Mono,monospace' }}>update_levels.ps1</code>{' '}
          without <code style={{ fontFamily:'IBM Plex Mono,monospace' }}>--stage1-only</code>{' '}
          to extract PDF data.
        </div>
      )}
    </div>
  );
}
