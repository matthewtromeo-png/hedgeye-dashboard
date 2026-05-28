'use strict';

// ── HELPERS ───────────────────────────────────────────────────────────────────

function rsFmtTs(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
  catch { return iso.slice(0, 16); }
}
function rsTrunc(s, n = 40) {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const SIGNAL_COLORS = {
  BULLISH: { bg:'#EAF3DE', color:'#276749' },
  BEARISH: { bg:'#FFF5F5', color:'#C53030' },
  NEUTRAL: { bg:'#EDF2F7', color:'#2C5282' },
};
const QUAD_COLORS = {
  1:{ bg:'#EBF8FF', color:'#2B6CB0' },
  2:{ bg:'#EAF3DE', color:'#276749' },
  3:{ bg:'#FFF5F5', color:'#C53030' },
  4:{ bg:'#FFFFF0', color:'#744210' },
};

function RSBadge({ v, colorMap, size }) {
  const cfg = (colorMap || SIGNAL_COLORS)[v] || { bg:'#F4F3EF', color:'#888' };
  return (
    <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize: size || 10, fontWeight:600,
      padding:'2px 7px', borderRadius:3, background:cfg.bg, color:cfg.color, letterSpacing:'0.04em' }}>
      {v ?? '—'}
    </span>
  );
}

function RSKv({ label, value, mono, color }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'baseline', marginBottom:4 }}>
      <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#888', minWidth:140, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12, fontFamily: mono ? 'IBM Plex Mono,monospace' : undefined,
        color: color || '#1A1A18', fontWeight: mono ? 500 : 400 }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function RSSectionTitle({ children, mt }) {
  return (
    <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888',
      letterSpacing:'0.05em', marginBottom:8, marginTop: mt || 0, textTransform:'uppercase' }}>
      {children}
    </div>
  );
}

function RSCard({ children, style }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:6,
      padding:'12px 16px', ...style }}>
      {children}
    </div>
  );
}

function RSCollapsible({ title, badge, badgeColor, defaultOpen, children }) {
  const [open, setOpen] = React.useState(defaultOpen || false);
  const bc = badgeColor || { bg:'#EAF3DE', color:'#276749' };
  return (
    <div style={{ border:'1px solid #E4E1DA', borderRadius:6, overflow:'hidden', marginBottom:8 }}>
      <div onClick={() => setOpen(!open)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 14px', background:'#fff', cursor:'pointer', userSelect:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600, letterSpacing:'0.04em' }}>{title}</span>
          {badge && (
            <span style={{ fontSize:10, background:bc.bg, color:bc.color,
              padding:'1px 6px', borderRadius:3, fontFamily:'IBM Plex Mono,monospace' }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{ color:'#7A7770', fontSize:11 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding:'12px 16px', background:'#FAFAF8', borderTop:'1px solid #E4E1DA' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── CORRELATION COLOR ─────────────────────────────────────────────────────────

function corrColor(v) {
  if (v == null || v === '') return { color:'#888', fontWeight:400 };
  const n = Number(v);
  if (n >=  0.5) return { color:'#276749', fontWeight:700 };
  if (n >=  0.2) return { color:'#2F855A', fontWeight:500 };
  if (n <= -0.5) return { color:'#C53030', fontWeight:700 };
  if (n <= -0.2) return { color:'#E53E3E', fontWeight:500 };
  return { color:'#555', fontWeight:400 };
}

function corrBg(v) {
  if (v == null) return 'transparent';
  const n = Number(v);
  if (n >=  0.5) return '#EAF3DE';
  if (n >=  0.2) return '#F0FAF0';
  if (n <= -0.5) return '#FFF5F5';
  if (n <= -0.2) return '#FFF9F9';
  return 'transparent';
}

// ── USD CORRELATIONS TABLE ────────────────────────────────────────────────────

function USDCorrTable({ usdCorr }) {
  if (!usdCorr || !usdCorr.data) return <span style={{ color:'#888', fontSize:12 }}>No USD correlation data.</span>;

  const cols = ['15d', '30d', '90d', '120d', '180d'];
  const thStyle = { padding:'5px 10px', fontFamily:'IBM Plex Mono,monospace', fontSize:9,
    color:'#888', fontWeight:600, letterSpacing:'0.04em', textAlign:'right',
    borderBottom:'2px solid #E4E1DA', whiteSpace:'nowrap', background:'#FAFAF8' };
  const tdStyle = (v) => ({
    padding:'5px 10px', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
    textAlign:'right', borderBottom:'1px solid #F0EDE8',
    background: corrBg(v), ...corrColor(v)
  });

  return (
    <div>
      <div style={{ fontSize:10, color:'#888', marginBottom:8 }}>
        {usdCorr.note} · as of {usdCorr.date}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign:'left', minWidth:100 }}>Asset vs USD</th>
              {cols.map(c => <th key={c} style={thStyle}>{c}</th>)}
              <th style={thStyle}>52W High</th>
              <th style={thStyle}>52W Low</th>
              <th style={{ ...thStyle, color:'#276749' }}>% Pos</th>
              <th style={{ ...thStyle, color:'#C53030' }}>% Neg</th>
            </tr>
          </thead>
          <tbody>
            {usdCorr.data.map((row, i) => (
              <tr key={row.metric} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <td style={{ padding:'6px 10px', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  fontWeight:600, color:'#1A1A18', borderBottom:'1px solid #F0EDE8', whiteSpace:'nowrap' }}>
                  {row.metric}
                </td>
                {cols.map(c => (
                  <td key={c} style={tdStyle(row[c])}>
                    {row[c] != null ? (row[c] > 0 ? '+' : '') + row[c].toFixed(2) : '—'}
                  </td>
                ))}
                <td style={{ ...tdStyle(row.high), color: row.high >= 0.5 ? '#276749' : '#555', background:'transparent' }}>
                  {row.high != null ? (row.high > 0 ? '+' : '') + row.high.toFixed(2) : '—'}
                </td>
                <td style={{ ...tdStyle(row.low), color: row.low <= -0.5 ? '#C53030' : '#555', background:'transparent' }}>
                  {row.low != null ? row.low.toFixed(2) : '—'}
                </td>
                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:11, color:'#276749', borderBottom:'1px solid #F0EDE8', fontWeight: row.pct_pos >= 60 ? 700 : 400 }}>
                  {row.pct_pos != null ? row.pct_pos + '%' : '—'}
                </td>
                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:11, color:'#C53030', borderBottom:'1px solid #F0EDE8', fontWeight: row.pct_neg >= 60 ? 700 : 400 }}>
                  {row.pct_neg != null ? row.pct_neg + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:8, fontSize:10, color:'#888' }}>
        Green = USD positive correlation · Red = USD negative correlation
      </div>
    </div>
  );
}

// ── IMPLIED VOLATILITY TABLE ──────────────────────────────────────────────────

function IVOLTable({ ivol }) {
  if (!ivol || !ivol.us_equities) return <span style={{ color:'#888', fontSize:12 }}>No IVOL data.</span>;

  const thStyle = { padding:'5px 8px', fontFamily:'IBM Plex Mono,monospace', fontSize:9,
    color:'#888', fontWeight:600, letterSpacing:'0.04em', textAlign:'right',
    borderBottom:'2px solid #E4E1DA', background:'#FAFAF8', whiteSpace:'nowrap' };

  function zColor(z) {
    if (z == null) return '#888';
    if (z > 2)   return '#C53030';
    if (z > 1)   return '#B7791F';
    if (z < -1)  return '#276749';
    return '#555';
  }
  function premColor(prem) {
    if (prem == null) return '#555';
    if (prem > 100) return '#C53030';
    if (prem > 50)  return '#B7791F';
    if (prem < 0)   return '#276749';
    return '#555';
  }

  return (
    <div>
      <div style={{ fontSize:10, color:'#888', marginBottom:8 }}>
        {ivol.note} · as of {ivol.date}
      </div>
      {ivol.key_signals?.summary && (
        <div style={{ background:'#FFFFF0', border:'1px solid #F6E05E', borderRadius:4,
          padding:'7px 10px', marginBottom:10, fontSize:11, color:'#744210', lineHeight:1.5 }}>
          {ivol.key_signals.summary}
        </div>
      )}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign:'left', minWidth:60 }}>ETF</th>
              <th style={{ ...thStyle, color:'#2B6CB0' }}>YTD%</th>
              <th style={thStyle}>IVOL Prem%</th>
              <th style={thStyle}>IVOL/RVOL Yest</th>
              <th style={thStyle}>IVOL/RVOL 1W</th>
              <th style={thStyle}>IVOL/RVOL 1M</th>
              <th style={thStyle}>Z TTM</th>
              <th style={thStyle}>Z 3yr</th>
              <th style={thStyle}>RVOL M/M</th>
              <th style={thStyle}>IVOL M/M</th>
            </tr>
          </thead>
          <tbody>
            {ivol.us_equities.map((row, i) => (
              <tr key={row.ticker} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <td style={{ padding:'6px 8px', borderBottom:'1px solid #F0EDE8' }}>
                  <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700, color:'#1A1A18' }}>{row.ticker}</span>
                  <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888', display:'block' }}>{row.name}</span>
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: row.ytd >= 0 ? '#276749' : '#C53030', fontWeight:600 }}>
                  {row.ytd != null ? (row.ytd > 0 ? '+' : '') + row.ytd + '%' : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: premColor(row.ivol_prem) }}>
                  {row.ivol_prem != null ? (row.ivol_prem > 0 ? '+' : '') + row.ivol_prem + '%' : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: premColor(row.ivol_rvol_yest) }}>
                  {row.ivol_rvol_yest != null ? row.ivol_rvol_yest + '%' : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: premColor(row.ivol_rvol_1w) }}>
                  {row.ivol_rvol_1w != null ? row.ivol_rvol_1w + '%' : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: premColor(row.ivol_rvol_1m) }}>
                  {row.ivol_rvol_1m != null ? row.ivol_rvol_1m + '%' : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: zColor(row.z_ttm), fontWeight: Math.abs(row.z_ttm||0) > 1.5 ? 700 : 400 }}>
                  {row.z_ttm != null ? (row.z_ttm > 0 ? '+' : '') + row.z_ttm : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: zColor(row.z_3yr), fontWeight: Math.abs(row.z_3yr||0) > 1.5 ? 700 : 400 }}>
                  {row.z_3yr != null ? (row.z_3yr > 0 ? '+' : '') + row.z_3yr : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: (row.rvol_mm||0) > 0 ? '#C53030' : '#276749' }}>
                  {row.rvol_mm != null ? (row.rvol_mm > 0 ? '+' : '') + row.rvol_mm + '%' : '—'}
                </td>
                <td style={{ padding:'6px 8px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  borderBottom:'1px solid #F0EDE8', color: (row.ivol_mm||0) > 0 ? '#C53030' : '#276749' }}>
                  {row.ivol_mm != null ? (row.ivol_mm > 0 ? '+' : '') + row.ivol_mm + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── MACRO SHOW CALLOUTS ───────────────────────────────────────────────────────

function CalloutsPanel({ callouts, signalPositions }) {
  const CALLOUT_COLORS = {
    RATES:    { border:'#2C5282', bg:'#EBF8FF', label:'#2B6CB0' },
    ATHs:     { border:'#276749', bg:'#EAF3DE', label:'#276749' },
    MOMENTUM: { border:'#744210', bg:'#FFFFF0', label:'#744210' },
  };

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:10, marginBottom:12 }}>
        {(callouts || []).map((c, i) => {
          const col = CALLOUT_COLORS[c.title] || { border:'#E4E1DA', bg:'#FAFAF8', label:'#555' };
          return (
            <div key={i} style={{ border:`1px solid ${col.border}40`, borderLeft:`3px solid ${col.border}`,
              background:col.bg, borderRadius:4, padding:'10px 14px' }}>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
                color:col.label, letterSpacing:'0.06em', marginBottom:6 }}>{c.title}</div>
              <p style={{ fontSize:11, color:'#333', lineHeight:1.55, margin:0 }}>{c.detail}</p>
            </div>
          );
        })}
      </div>
      {signalPositions && signalPositions.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888', marginRight:4 }}>ACTIVE SIGNALS</span>
          {signalPositions.map((p, i) => {
            const isShort = p.toLowerCase().startsWith('short');
            return (
              <span key={i} style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
                padding:'2px 8px', borderRadius:3,
                background: isShort ? '#FFF5F5' : '#EAF3DE',
                color: isShort ? '#C53030' : '#276749' }}>
                {p}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MACRO THEMES ─────────────────────────────────────────────────────────────

function ThemesPanel({ macroResearch }) {
  if (!macroResearch || !macroResearch.themes) return <span style={{ color:'#888', fontSize:12 }}>No themes data.</span>;
  const mr = macroResearch;

  const THEME_BADGES = {
    'Flation Now, Stag-On-A-Lag':       { label:'INFLATION', bg:'#FFF5F5', color:'#C53030' },
    'Hormuz Crisis — Energy Cascade':   { label:'ENERGY',    bg:'#FFFFF0', color:'#744210' },
    "USA's Diverging Profit Cycles":    { label:'EARNINGS',  bg:'#EBF8FF', color:'#2B6CB0' },
    'Greedflation Party Over':          { label:'MARGINS',   bg:'#FFF5F5', color:'#C53030' },
    'Consumer Pain at $100 Oil':        { label:'CONSUMER',  bg:'#FFFFF0', color:'#744210' },
    'Fed Chair Warsh / Rate Path':      { label:'RATES',     bg:'#EBF8FF', color:'#2B6CB0' },
  };

  return (
    <div>
      {/* CPI estimates bar */}
      {mr.cpi_estimates && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14,
          background:'#FFF5F5', border:'1px solid #FEB2B280', borderRadius:4, padding:'8px 12px' }}>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888', alignSelf:'center', marginRight:4 }}>HEDGEYE CPI FORECAST</span>
          {[
            ['May Now', mr.cpi_estimates.may_nowcast_5_22, '#C53030'],
            ['Q2 2026', mr.cpi_estimates.Q2_2026, '#C53030'],
            ['Q3 2026', mr.cpi_estimates.Q3_2026, '#C53030'],
            ['Q4 2026', mr.cpi_estimates.Q4_2026, '#C53030'],
          ].map(([lbl, val, col]) => val != null && (
            <div key={lbl} style={{ textAlign:'center', minWidth:60 }}>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:14, fontWeight:700, color:col }}>{val}%</div>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#888' }}>{lbl}</div>
            </div>
          ))}
          <div style={{ borderLeft:'1px solid #E4E1DA', paddingLeft:12, alignSelf:'center' }}>
            <span style={{ fontSize:10, color:'#744210' }}>{mr.cpi_estimates.vs_consensus}</span>
            <div style={{ fontSize:9, color:'#888' }}>vs consensus · June 10 CPI release</div>
          </div>
        </div>
      )}

      {/* Themes */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:8, marginBottom:12 }}>
        {mr.themes.map((t, i) => {
          const badge = THEME_BADGES[t.title] || { label:'MACRO', bg:'#EDF2F7', color:'#2C5282' };
          return (
            <div key={i} style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:4,
              padding:'10px 12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
                  padding:'1px 5px', borderRadius:2, background:badge.bg, color:badge.color }}>{badge.label}</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#1A1A18' }}>{t.title}</span>
              </div>
              <p style={{ fontSize:10, color:'#555', lineHeight:1.55, margin:'0 0 6px' }}>{t.thesis}</p>
              {t.trades && t.trades.length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {t.trades.map((tr, j) => {
                    const isShort = tr.toLowerCase().startsWith('short');
                    return (
                      <span key={j} style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                        padding:'1px 5px', borderRadius:2,
                        background: isShort ? '#FFF5F5' : '#EAF3DE',
                        color: isShort ? '#C53030' : '#276749' }}>
                        {tr}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quad sequence + oil shock */}
      {mr.quad_sequence && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:4, padding:'10px 12px' }}>
            <RSSectionTitle>QUAD SEQUENCE</RSSectionTitle>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#744210', marginBottom:6 }}>
              {mr.quad_sequence.label}
            </div>
            {mr.quad_sequence.key_risk && (
              <div style={{ fontSize:10, color:'#C53030', lineHeight:1.5 }}>{mr.quad_sequence.key_risk}</div>
            )}
          </div>
          {mr.oil_shock_framework && (
            <div style={{ background:'#fff', border:'1px solid #E4E1DA', borderRadius:4, padding:'10px 12px' }}>
              <RSSectionTitle>HORMUZ / OIL SHOCK</RSSectionTitle>
              <div style={{ fontSize:10, color:'#555', lineHeight:1.55 }}>
                Supply gap <strong>{mr.oil_shock_framework.hormuz_supply_gap_mbpd}M bbl/d</strong> ·
                Storage critical <strong style={{color:'#C53030'}}>{mr.oil_shock_framework.storage_drawdown_critical}</strong>
              </div>
              <div style={{ fontSize:10, color:'#555', marginTop:4, lineHeight:1.55 }}>
                {mr.oil_shock_framework.roc_report_thesis}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SSS CHANGES PANEL ─────────────────────────────────────────────────────────

function SSSChangesPanel({ sss }) {
  if (!sss) return <span style={{ color:'#888', fontSize:12 }}>No SSS data.</span>;
  return (
    <div>
      <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginBottom:10 }}>
        <RSKv label="Total on list" value={sss.count} mono />
        <RSKv label="Date" value={sss.date} mono />
      </div>
      {(sss.added || []).length > 0 && (
        <div style={{ marginBottom:8 }}>
          <RSSectionTitle>ADDED ({sss.added.length})</RSSectionTitle>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {sss.added.map(t => (
              <span key={t} style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
                background:'#EAF3DE', color:'#276749', padding:'2px 7px', borderRadius:3 }}>{t}</span>
            ))}
          </div>
        </div>
      )}
      {(sss.removed || []).length > 0 && (
        <div style={{ marginBottom:10 }}>
          <RSSectionTitle>REMOVED ({sss.removed.length})</RSSectionTitle>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {sss.removed.map(t => (
              <span key={t} style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:600,
                background:'#FFF5F5', color:'#C53030', padding:'2px 7px', borderRadius:3 }}>{t}</span>
            ))}
          </div>
        </div>
      )}
      {(sss.tickers || []).length > 0 && (
        <div>
          <RSSectionTitle>ALL TICKERS ({sss.tickers.length})</RSSectionTitle>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {sss.tickers.map(t => {
              const isNew = (sss.added || []).includes(t);
              return (
                <span key={t} style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                  background: isNew ? '#EAF3DE' : '#F4F3EF',
                  color: isNew ? '#276749' : '#555',
                  padding:'1px 5px', borderRadius:2 }}>{t}</span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── POSITION SIZING PANEL ─────────────────────────────────────────────────────

function PositionSizingPanel({ posSizing }) {
  if (!posSizing || !posSizing.positions) return <span style={{ color:'#888', fontSize:12 }}>No position sizing data.</span>;
  const positions = posSizing.positions.sort((a, b) => a.rank - b.rank).slice(0, 15);

  return (
    <div>
      <div style={{ fontSize:10, color:'#888', marginBottom:8 }}>
        As of {posSizing.as_of_date} · HYG anchor rank {posSizing.hyg_anchor_rank ?? '—'} · {posSizing.positions.length} total positions
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'#FAFAF8' }}>
              {['Rank', 'Ticker', 'Asset Class', 'Est %', 'Min', 'Max', 'Fill %', 'Direction'].map(h => (
                <th key={h} style={{ padding:'5px 10px', fontFamily:'IBM Plex Mono,monospace', fontSize:9,
                  color:'#888', fontWeight:600, letterSpacing:'0.04em', textAlign: h === 'Rank' || h === 'Est %' || h === 'Fill %' ? 'right' : 'left',
                  borderBottom:'2px solid #E4E1DA', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={p.ticker} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:11, color:'#888', borderBottom:'1px solid #F0EDE8' }}>{p.rank}</td>
                <td style={{ padding:'5px 10px', fontFamily:'IBM Plex Mono,monospace', fontSize:11,
                  fontWeight:700, color:'#1A1A18', borderBottom:'1px solid #F0EDE8' }}>{p.ticker}</td>
                <td style={{ padding:'5px 10px', fontSize:10, color:'#555', borderBottom:'1px solid #F0EDE8' }}>{p.asset_class}</td>
                <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:11, fontWeight:600, color:'#1A1A18', borderBottom:'1px solid #F0EDE8' }}>
                  {p.estimated_pct != null ? p.estimated_pct + '%' : '—'}
                </td>
                <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:10, color:'#888', borderBottom:'1px solid #F0EDE8' }}>{p.min_pct}%</td>
                <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:10, color:'#888', borderBottom:'1px solid #F0EDE8' }}>{p.max_pct}%</td>
                <td style={{ padding:'5px 10px', borderBottom:'1px solid #F0EDE8' }}>
                  <div style={{ background:'#E4E1DA', borderRadius:2, height:4, width:'100%', overflow:'hidden' }}>
                    <div style={{ background: (p.fill_pct||0) >= 80 ? '#276749' : (p.fill_pct||0) >= 50 ? '#B7791F' : '#2B6CB0',
                      width: Math.min(p.fill_pct||0, 100) + '%', height:'100%', borderRadius:2 }} />
                  </div>
                  <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#888' }}>
                    {p.fill_pct != null ? p.fill_pct + '%' : '—'}
                  </span>
                </td>
                <td style={{ padding:'5px 10px', fontSize:10, fontFamily:'IBM Plex Mono,monospace',
                  borderBottom:'1px solid #F0EDE8',
                  color: p.last_direction === 'adding' ? '#276749' : p.last_direction === 'trimming' ? '#C53030' : '#888' }}>
                  {p.last_direction || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
      .then(d  => { setCtx(d); setLoading(false); })
      .catch(e => { setLoadErr(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}>
      <LoadingSpinner msg="Loading research intelligence…" />
    </div>
  );
  if (loadErr) return (
    <div style={{ margin:24, padding:16, background:'#FFF5F5', border:'1px solid #FEB2B2',
      borderRadius:6, color:'#C53030', fontSize:12 }}>
      Failed to load macro_context.json: {loadErr}
    </div>
  );
  if (!ctx) return null;

  const ms   = ctx.macro_state  || {};
  const pdf  = ctx.pdf          || {};
  const show = pdf.macro_show   || {};
  const sss  = pdf.sss          || null;
  const mr   = ctx.macro_research || null;
  const mq   = ms.monthly_quad;
  const qq   = ms.quarterly_quad;
  const mqLabel = ms.monthly_label   || (mq === 1 ? 'Goldilocks' : mq === 2 ? 'Reflation' : mq === 3 ? 'Stagflation' : mq === 4 ? 'Deflation' : '');
  const qqLabel = ms.quarterly_label || (qq === 1 ? 'Goldilocks' : qq === 2 ? 'Reflation' : qq === 3 ? 'Stagflation' : qq === 4 ? 'Deflation' : '');

  // Freshness tracker — every research source with its date
  const TODAY = ctx.source_date || new Date().toISOString().slice(0,10);
  function ageDays(dateStr) {
    if (!dateStr) return null;
    const d = dateStr.slice(0,10);
    return Math.floor((new Date(TODAY) - new Date(d)) / 86400000);
  }
  function freshnessStyle(age, freq) {
    if (age === null) return { dot:'○', dotColor:'#C8C5BE', label:'Missing', labelColor:'#9A9790', rowBg:'#FAFAF8' };
    const staleDay   = freq === 'weekly' ? 7  : freq === 'special' ? 999 : 1;
    const warnDay    = freq === 'weekly' ? 4  : freq === 'special' ? 999 : 0;
    if (age <= warnDay)  return { dot:'●', dotColor:'#27500A', label:'Fresh',     labelColor:'#27500A', rowBg:'#fff' };
    if (age <= staleDay) return { dot:'●', dotColor:'#B8860B', label:'Yesterday', labelColor:'#B8860B', rowBg:'#FFFDF7' };
    return                      { dot:'●', dotColor:'#C8302A', label:`${age}d old`, labelColor:'#C8302A', rowBg:'#FFF9F9' };
  }
  const SOURCES = [
    { label:'Macro Show',       freq:'daily',   date: show?.date ?? pdf.macro_show?.date,                    note: show.callouts?.length ? `${show.callouts.length} callouts` : null },
    { label:'Signal Strength',  freq:'daily',   date: sss?.date,                                             note: sss ? `${sss.count} tickers` : null },
    { label:'HAM Holdings',     freq:'daily',   date: ctx.ham_holdings?.date,                                note: ctx.ham_holdings ? `${ctx.ham_holdings.total_holdings || (ctx.ham_holdings.holdings||[]).length} positions` : null },
    { label:'Position Sizing',  freq:'daily',   date: ctx.position_sizing?.as_of_date,                      note: ctx.position_sizing?.positions ? `${ctx.position_sizing.positions.length} positions` : null },
    { label:'Call Summary',     freq:'daily',   date: pdf.call_summary?.date,                               note: pdf.call_summary?.key_points?.length ? `${pdf.call_summary.key_points.length} points` : null },
    { label:'Early Look',       freq:'daily',   date: pdf.early_look?.date,                                 note: pdf.early_look?.title ? rsTrunc(pdf.early_look.title, 40) : null },
    { label:'Show Notes',       freq:'daily',   date: pdf.macro_show_notes?.source_date,                    note: pdf.macro_show_notes?.key_points?.length ? `${pdf.macro_show_notes.key_points.length} points` : null },
    { label:'MOMO Tracker',     freq:'daily',   date: pdf.momo?.date,                                       note: pdf.momo?.headline ? rsTrunc(pdf.momo.headline, 40) : null },
    { label:'BTC / Crypto',     freq:'daily',   date: (pdf.btc || pdf.crypto)?.date,                        note: (pdf.btc || pdf.crypto)?.btc_signal ?? null },
    { label:'USD Correlations', freq:'weekly',  date: ctx.usd_correlations?.date,                           note: ctx.usd_correlations?.data ? `${ctx.usd_correlations.data.length} assets` : null },
    { label:'Implied Vol',      freq:'weekly',  date: ctx.ivol_table?.date,                                 note: ctx.ivol_table?.us_equities ? `${ctx.ivol_table.us_equities.length} ETFs` : null },
    { label:'Investing Ideas',  freq:'weekly',  date: pdf.investing_ideas?.source_date,                     note: pdf.investing_ideas ? `${Object.keys(pdf.investing_ideas.longs||{}).length}L / ${Object.keys(pdf.investing_ideas.shorts||{}).length}S` : null },
    { label:'Founders Choice',  freq:'weekly',  date: pdf.founders_choice?.source_date,                     note: pdf.founders_choice ? Object.keys(pdf.founders_choice).filter(k=>k!=='source_date').join(', ') : null },
    { label:'Macro Research',   freq:'special', date: mr ? '2026-05-27' : null,                             note: mr?.themes ? `${mr.themes.length} themes processed` : null },
  ];

  return (
    <div style={{ padding:'16px 20px', maxWidth:1280, margin:'0 auto', animation:'fadeIn 0.2s ease' }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:10, marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:700,
            letterSpacing:'0.04em', color:'#1A1A18', marginBottom:2 }}>
            RESEARCH INTELLIGENCE
          </div>
          <div style={{ fontSize:11, color:'#888' }}>
            Source date: <strong style={{color:'#1A1A18'}}>{ctx.source_date || '—'}</strong>
            {' · '}Last updated: <strong style={{color:'#1A1A18'}}>{rsFmtTs(ctx.generated_at || ctx.last_updated)}</strong>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {mq && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#888', marginBottom:2 }}>MONTHLY</div>
              <RSBadge v={`Q${mq} ${mqLabel}`} size={11}
                colorMap={{ [`Q${mq} ${mqLabel}`]: QUAD_COLORS[mq] }} />
            </div>
          )}
          {qq && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:8, color:'#888', marginBottom:2 }}>QUARTERLY</div>
              <RSBadge v={`Q${qq} ${qqLabel}`} size={11}
                colorMap={{ [`Q${qq} ${qqLabel}`]: QUAD_COLORS[qq] }} />
            </div>
          )}
        </div>
      </div>

      {/* ── MACRO SHOW CALLOUTS ── */}
      {show.callouts && show.callouts.length > 0 && (
        <RSCollapsible title="TODAY'S SIGNALS FROM KEITH" defaultOpen={true}
          badge={`${show.callouts.length} callouts`}
          badgeColor={{ bg:'#EAF3DE', color:'#276749' }}>
          <CalloutsPanel callouts={show.callouts} signalPositions={show.signal_positions} />
        </RSCollapsible>
      )}

      {/* ── MACRO THEMES ── */}
      {mr && (
        <RSCollapsible title="MACRO RESEARCH THEMES" defaultOpen={true}
          badge={`${mr.themes?.length || 0} themes`}
          badgeColor={{ bg:'#EBF8FF', color:'#2B6CB0' }}>
          <ThemesPanel macroResearch={mr} />
        </RSCollapsible>
      )}

      {/* ── SSS CHANGES ── */}
      {sss && (
        <RSCollapsible title="SIGNAL STRENGTH STOCKS"
          badge={`${sss.count} tickers · +${(sss.added||[]).length} added`}
          badgeColor={{ bg:'#EAF3DE', color:'#276749' }}>
          <SSSChangesPanel sss={sss} />
        </RSCollapsible>
      )}

      {/* ── POSITION SIZING ── */}
      {ctx.position_sizing?.positions && (
        <RSCollapsible title="PORTFOLIO SOLUTIONS — POSITION SIZING"
          badge={`${ctx.position_sizing.positions.length} positions`}
          badgeColor={{ bg:'#EDF2F7', color:'#2C5282' }}>
          <PositionSizingPanel posSizing={ctx.position_sizing} />
        </RSCollapsible>
      )}

      {/* ── FRESHNESS TRACKER ── */}
      <div style={{ marginTop:16, background:'#fff', border:'1px solid #E4E1DA', borderRadius:6,
        overflow:'hidden' }}>
        <div style={{ padding:'8px 16px', borderBottom:'1px solid #E4E1DA', background:'#FAFAF8',
          fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
          letterSpacing:'0.06em', color:'#555' }}>
          RESEARCH FRESHNESS — {TODAY}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#FAFAF8' }}>
              {['Source', 'Freq', 'Last Date', 'Age', 'Status', 'Notes'].map(h => (
                <th key={h} style={{ padding:'5px 12px', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:8, color:'#888', fontWeight:600, letterSpacing:'0.05em',
                  textAlign:'left', borderBottom:'1px solid #E4E1DA' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s, i) => {
              const age = ageDays(s.date);
              const fs  = freshnessStyle(age, s.freq);
              const freqColors = { daily:'#276749', weekly:'#2B6CB0', special:'#744210' };
              return (
                <tr key={i} style={{ background: fs.rowBg, borderBottom:'1px solid #F0EDE8' }}>
                  <td style={{ padding:'6px 12px', fontFamily:'IBM Plex Mono,monospace',
                    fontSize:11, fontWeight:600, color:'#1A1A18', whiteSpace:'nowrap' }}>
                    {s.label}
                  </td>
                  <td style={{ padding:'6px 12px' }}>
                    <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:600,
                      padding:'1px 5px', borderRadius:2,
                      background: `${freqColors[s.freq]}18`, color: freqColors[s.freq] }}>
                      {s.freq}
                    </span>
                  </td>
                  <td style={{ padding:'6px 12px', fontFamily:'IBM Plex Mono,monospace',
                    fontSize:11, color: s.date ? '#1A1A18' : '#C8C5BE' }}>
                    {s.date || '—'}
                  </td>
                  <td style={{ padding:'6px 12px', fontFamily:'IBM Plex Mono,monospace',
                    fontSize:11, color: fs.labelColor, fontWeight:600 }}>
                    {age === null ? '—' : age === 0 ? 'today' : `${age}d`}
                  </td>
                  <td style={{ padding:'6px 12px', whiteSpace:'nowrap' }}>
                    <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10,
                      fontWeight:700, color: fs.dotColor }}>
                      {fs.dot} {fs.label}
                    </span>
                  </td>
                  <td style={{ padding:'6px 12px', fontSize:10, color:'#888',
                    fontFamily:'IBM Plex Mono,monospace' }}>
                    {s.note || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
