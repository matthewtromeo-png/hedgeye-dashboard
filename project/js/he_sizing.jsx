// he_sizing.jsx — Position Sizing tab
// Reads position_sizing block from macro_context.json
// Data built by scripts/parse_position_sizing.py from Portfolio Solutions PDFs + ETF Pro rank table
// Key rule: positions ranked above HYG (rank 21) are confirmed above 3%

const SizingTab = ({ macroCtx }) => {
  const [sortBy, setSortBy] = React.useState('rank');   // 'rank' | 'size' | 'room'
  const [filter, setFilter]  = React.useState('all');   // 'all' | 'above' | 'below'

  const ps = macroCtx?.position_sizing;
  if (!ps) return (
    <div style={{padding:40,textAlign:'center',color:'#999',fontFamily:'IBM Plex Mono,monospace',fontSize:13}}>
      No position sizing data — run scripts/parse_position_sizing.py
    </div>
  );

  const { positions = [], threshold_ticker, threshold_rank, threshold_pct, threshold_note, as_of_date } = ps;
  const active = positions.filter(p => p.estimated_pct > 0);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sorted = [...active].sort((a, b) => {
    if (sortBy === 'size') return b.estimated_pct - a.estimated_pct;
    if (sortBy === 'room') return b.room_to_add - a.room_to_add;
    return a.rank - b.rank;
  });

  const filtered = filter === 'above' ? sorted.filter(p => p.above_hyg_threshold)
                 : filter === 'below' ? sorted.filter(p => !p.above_hyg_threshold)
                 : sorted;

  // ── Portfolio summary ──────────────────────────────────────────────────────
  const totalDeployed  = active.reduce((s, p) => s + p.estimated_pct, 0);
  const aboveThreshold = active.filter(p => p.above_hyg_threshold).length;
  const avgFill        = active.length
    ? Math.round(active.reduce((s, p) => s + p.fill_pct, 0) / active.length)
    : 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const TIER_STYLE = {
    max: { bg:'#276749', color:'#fff',    label:'MAX' },
    mid: { bg:'#D97706', color:'#fff',    label:'MID' },
    min: { bg:'#E2E8F0', color:'#4A5568', label:'MIN' },
  };

  const dirIcon = d =>
    d === 'adding'   ? <span style={{color:'#276749',fontWeight:700}}>↑</span>
  : d === 'trimming' ? <span style={{color:'#C53030',fontWeight:700}}>↓</span>
  : d === 'closed'   ? <span style={{color:'#999'}}>✕</span>
  :                    <span style={{color:'#ccc'}}>—</span>;

  const rkIcon = v =>
    v == null  ? <span style={{color:'#ccc',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>—</span>
  : v > 0      ? <span style={{color:'#276749',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>↑{v}</span>
  : v < 0      ? <span style={{color:'#C53030',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>↓{Math.abs(v)}</span>
  :              <span style={{color:'#999',fontFamily:'IBM Plex Mono,monospace',fontSize:10}}>—</span>;

  const fmtDate = d => d ? d.slice(5).replace('-','/') : '—';

  // ── Size bar component ─────────────────────────────────────────────────────
  const SizeBar = ({ p }) => {
    const { min_pct, max_pct, estimated_pct, size_source, above_hyg_threshold } = p;
    if (max_pct === 0) return null;
    const fillPct  = Math.min(100, (estimated_pct / max_pct) * 100);
    const minMark  = (min_pct / max_pct) * 100;
    const barColor = above_hyg_threshold ? '#276749' : '#718096';
    const isFloor  = size_source === 'rank_floor';

    return (
      <div style={{display:'flex',alignItems:'center',gap:6,minWidth:160}}>
        {/* Bar track */}
        <div style={{flex:1,position:'relative',height:8,borderRadius:4,
          background:'#E2E8F0',overflow:'visible'}}>
          {/* Min marker */}
          <div style={{position:'absolute',left:`${minMark}%`,top:-2,width:2,height:12,
            background:'#A0AEC0',borderRadius:1,zIndex:2}} title={`Min: ${min_pct}%`} />
          {/* Fill */}
          <div style={{position:'absolute',left:0,top:0,height:'100%',
            width:`${fillPct}%`,borderRadius:4,
            background: isFloor ? `repeating-linear-gradient(45deg,${barColor},${barColor} 3px,${barColor}aa 3px,${barColor}aa 6px)` : barColor,
            transition:'width 0.4s ease'}} />
        </div>
        {/* Label */}
        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,
          color: above_hyg_threshold ? '#276749' : '#4A5568',
          fontWeight:600,minWidth:38,textAlign:'right'}}>
          {estimated_pct.toFixed(1)}%
          {isFloor && <span style={{fontSize:9,color:'#999',marginLeft:2}}>≥</span>}
        </span>
      </div>
    );
  };

  // ── Size anchor divider (dynamic — based on current minimum-sized position) ──
  const AnchorDivider = () => (
    <tr>
      <td colSpan={9} style={{padding:'4px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{flex:1,height:1,background:'#C53030',opacity:0.35}} />
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
            color:'#C53030',fontWeight:700,whiteSpace:'nowrap',letterSpacing:'0.08em'}}>
            ▼ {threshold_ticker || 'ANCHOR'} AT MIN ({threshold_pct || '—'}%) — BELOW THIS: UNDER {threshold_pct || '—'}%
          </span>
          <div style={{flex:1,height:1,background:'#C53030',opacity:0.35}} />
        </div>
      </td>
    </tr>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const COL = { color:'#718096', fontSize:10, fontFamily:'IBM Plex Mono,monospace',
                letterSpacing:'0.06em', textTransform:'uppercase', padding:'6px 10px',
                whiteSpace:'nowrap', userSelect:'none' };
  const SortBtn = ({ field, label }) => (
    <span onClick={() => setSortBy(field)} style={{
      ...COL, cursor:'pointer',
      color: sortBy === field ? '#1A1A18' : '#718096',
      borderBottom: sortBy === field ? '2px solid #1A1A18' : '2px solid transparent',
    }}>{label}</span>
  );

  let hygDividerShown = false;

  return (
    <div style={{fontFamily:'IBM Plex Sans,sans-serif',padding:'0 0 40px'}}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{padding:'20px 20px 12px',borderBottom:'1px solid #E2E8F0'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:'#1A1A18',marginBottom:4}}>
              Position Sizing Tracker
            </div>
            <div style={{fontSize:11,color:'#718096',fontFamily:'IBM Plex Mono,monospace'}}>
              Source: Portfolio Solutions commentary + ETF Pro rank &nbsp;·&nbsp; as of {as_of_date}
            </div>
          </div>
          {/* Summary pills */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              { label:'Active Positions', value: active.length },
              { label:'Above 3% Threshold', value: aboveThreshold, color:'#276749' },
              { label:'Avg Fill', value: avgFill+'%' },
              { label:'Total Deployed', value: totalDeployed.toFixed(1)+'%' },
            ].map(pill => (
              <div key={pill.label} style={{background:'#fff',border:'1px solid #E2E8F0',
                borderRadius:6,padding:'6px 12px',textAlign:'center',minWidth:100}}>
                <div style={{fontSize:18,fontWeight:700,color:pill.color||'#1A1A18',
                  fontFamily:'IBM Plex Mono,monospace',lineHeight:1}}>
                  {pill.value}
                </div>
                <div style={{fontSize:9,color:'#999',marginTop:2,letterSpacing:'0.06em',
                  textTransform:'uppercase'}}>{pill.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic threshold callout */}
        {threshold_ticker && (
          <div style={{marginTop:12,padding:'8px 12px',background:'#FFFBEB',border:'1px solid #FCD34D',
            borderRadius:6,fontSize:11,color:'#92400E',fontFamily:'IBM Plex Mono,monospace',
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:14}}>⚡</span>
            <span>
              <strong>Today's anchor:</strong> {threshold_ticker} (rank #{threshold_rank}) is at minimum ({threshold_pct}%).
              &nbsp;Positions ranked above it are confirmed &gt;{threshold_pct}%.
              &nbsp;This anchor shifts daily as Keith adds/trims.
              &nbsp;Hatched bars = rank-floor estimate · Solid = confirmed from commentary.
            </span>
          </div>
        )}

        {/* Filter + sort controls */}
        <div style={{marginTop:12,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:4}}>
            {[['all','All'],['above','Above 3%'],['below','Below 3%']].map(([val,label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                padding:'4px 10px',border:'1px solid #E2E8F0',borderRadius:4,cursor:'pointer',
                fontSize:11,background: filter===val ? '#1A1A18' : '#fff',
                color: filter===val ? '#fff' : '#4A5568',
              }}>{label}</button>
            ))}
          </div>
          <div style={{fontSize:10,color:'#999',marginLeft:'auto'}}>
            Sort by: <SortBtn field="rank" label="Rank" /> <SortBtn field="size" label="Size" /> <SortBtn field="room" label="Room" />
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'#F8F7F4',borderBottom:'2px solid #E2E8F0'}}>
              <th style={{...COL,textAlign:'left'}}>Rank</th>
              <th style={{...COL,textAlign:'left'}}>Ticker</th>
              <th style={{...COL,textAlign:'left'}}>Class</th>
              <th style={{...COL,textAlign:'left',minWidth:200}}>Size ← min · max →</th>
              <th style={{...COL,textAlign:'center'}}>Tier</th>
              <th style={{...COL,textAlign:'center'}}>1W ▲▼</th>
              <th style={{...COL,textAlign:'center'}}>Dir</th>
              <th style={{...COL,textAlign:'right'}}>Room</th>
              <th style={{...COL,textAlign:'right'}}>Entry</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const ts = TIER_STYLE[p.tier] || TIER_STYLE.min;
              const showDivider = !hygDividerShown && threshold_rank && p.rank > threshold_rank && sortBy === 'rank' && filter !== 'above';
              if (showDivider) hygDividerShown = true;

              return (
                <React.Fragment key={p.ticker}>
                  {showDivider && <AnchorDivider />}
                  <tr style={{
                    borderBottom:'1px solid #EEF0F0',
                    background: p.above_hyg_threshold ? 'rgba(39,103,73,0.03)' : '#fff',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F4F3EF'}
                  onMouseLeave={e => e.currentTarget.style.background =
                    p.above_hyg_threshold ? 'rgba(39,103,73,0.03)' : '#fff'}>

                    {/* Rank */}
                    <td style={{padding:'9px 10px',fontFamily:'IBM Plex Mono,monospace',
                      fontSize:11,color:'#999'}}>
                      {p.rank}
                    </td>

                    {/* Ticker */}
                    <td style={{padding:'9px 10px'}}>
                      <span style={{fontWeight:700,fontSize:13,letterSpacing:'0.02em',
                        color:'#1A1A18'}}>
                        {p.ticker}
                      </span>
                    </td>

                    {/* Class */}
                    <td style={{padding:'9px 10px',fontSize:11,color:'#718096',whiteSpace:'nowrap'}}>
                      {p.asset_class}
                    </td>

                    {/* Size bar */}
                    <td style={{padding:'9px 10px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                          color:'#999',minWidth:22,textAlign:'right'}}>
                          {p.min_pct}%
                        </span>
                        <SizeBar p={p} />
                        <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,
                          color:'#999',minWidth:22}}>
                          {p.max_pct}%
                        </span>
                      </div>
                    </td>

                    {/* Tier badge */}
                    <td style={{padding:'9px 10px',textAlign:'center'}}>
                      <span style={{display:'inline-block',padding:'2px 7px',borderRadius:4,
                        fontSize:10,fontWeight:700,fontFamily:'IBM Plex Mono,monospace',
                        letterSpacing:'0.06em',background:ts.bg,color:ts.color}}>
                        {ts.label}
                      </span>
                    </td>

                    {/* 1W re-rank */}
                    <td style={{padding:'9px 10px',textAlign:'center'}}>
                      {rkIcon(p.rerank_1w)}
                    </td>

                    {/* Direction */}
                    <td style={{padding:'9px 10px',textAlign:'center',fontSize:14}}>
                      {dirIcon(p.last_direction)}
                    </td>

                    {/* Room */}
                    <td style={{padding:'9px 10px',textAlign:'right',
                      fontFamily:'IBM Plex Mono,monospace',fontSize:11,
                      color: p.room_to_add > 2 ? '#276749' : '#999'}}>
                      +{p.room_to_add.toFixed(1)}%
                    </td>

                    {/* Entry date */}
                    <td style={{padding:'9px 10px',textAlign:'right',
                      fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#999'}}>
                      {fmtDate(p.entry_date)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div style={{padding:'16px 20px',borderTop:'1px solid #E2E8F0',marginTop:8,
        display:'flex',gap:24,flexWrap:'wrap',fontSize:10,color:'#999',
        fontFamily:'IBM Plex Mono,monospace'}}>
        <span>■ <span style={{color:'#276749'}}>GREEN</span> = above anchor (≥{threshold_pct}%)</span>
        <span>■ <span style={{color:'#718096'}}>GRAY</span> = below threshold (&lt;3%)</span>
        <span>╱╱ HATCHED = rank-floor estimate (exact bps not in parsed PDFs)</span>
        <span>MIN marker = vertical line in bar</span>
        <span>↑ DIR = last commentary move was an add &nbsp;·&nbsp; ↓ = trim</span>
        <span style={{marginLeft:'auto'}}>
          {ps.source_pdfs} PDFs parsed &nbsp;·&nbsp; {positions.length} ranked positions
        </span>
      </div>
    </div>
  );
};
