// he_etfpro.jsx — ETF Pro dedicated tab

const ETFProTab = ({macroCtx}) => {
  const {dates, tickers} = window.HE.ETF_STREAK;
  const reranks = window.HE.ETF_RERANKS;
  const [livePrices,  setLivePrices]  = React.useState({});
  const [priceStatus, setPriceStatus] = React.useState('idle');
  const [bookView,    setBookView]    = React.useState('longs'); // 'longs' | 'shorts'

  // Active book from macro_context
  const etfBook    = macroCtx?.etf_pro || {};
  const bookLongs  = etfBook.longs  || [];
  const bookShorts = etfBook.shorts || [];
  const bookAsOf   = etfBook.as_of  || '';

  // Position sizing lookup by ticker
  const sizingPositions = macroCtx?.position_sizing?.positions || [];
  const sizingMap = {};
  sizingPositions.forEach(p => { sizingMap[p.ticker] = p; });

  // Freshness
  const latestDate   = reranks[0]?.date;
  const paCommentary = macroCtx?.pdf?.etf_rerank_commentary ?? null;

  // Fetch prices for all active book tickers
  const allBookTickers = [...bookLongs, ...bookShorts].map(p => p.ticker);
  React.useEffect(() => {
    if (!allBookTickers.length) return;
    setPriceStatus('loading');
    fetch(window.HE.apiUrl.yfQuote(allBookTickers), {signal: AbortSignal.timeout(14000)})
      .then(r => r.json())
      .then(d => {
        const m = {};
        (d.quoteResponse?.result || []).forEach(q => {
          m[q.symbol] = {price: q.regularMarketPrice, chg: q.regularMarketChangePercent};
        });
        setLivePrices(m);
        setPriceStatus(Object.keys(m).length > 0 ? 'ok' : 'error');
      })
      .catch(() => setPriceStatus('error'));
  }, []);

  const rankColor = r => r === 1 ? '#27500A' : r === 2 ? '#1A4D8F' : '#7A5C00';
  const rankBg   = r => r === 1 ? '#EAF3DE' : r === 2 ? '#E4EDF8' : '#FFF8E1';

  const perfColor = v => v > 0 ? '#27500A' : v < 0 ? '#C8302A' : '#7A7770';
  const fmtPct    = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

  // Tier pill
  const TierPill = ({tier}) => {
    const colors = {
      min: {bg:'#F1EFE8', color:'#7A7770'},
      mid: {bg:'#FFF3CD', color:'#7A5C00'},
      max: {bg:'#EAF3DE', color:'#27500A'},
    };
    const c = colors[tier?.toLowerCase()] || colors.min;
    return (
      <span style={{fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:3,
        background:c.bg, color:c.color, fontFamily:'IBM Plex Mono,monospace',
        textTransform:'uppercase', letterSpacing:'0.05em'}}>
        {tier?.toUpperCase() || 'MIN'}
      </span>
    );
  };

  // Render one book table (longs or shorts)
  const BookTable = ({positions, isShort}) => {
    if (!positions.length) return <div style={{color:'#9A9790', fontSize:12, padding:'16px 0'}}>No {isShort ? 'short' : 'long'} positions</div>;

    return (
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'IBM Plex Mono,monospace', fontSize:12}}>
          <thead>
            <tr style={{borderBottom:'2px solid #E4E1DA'}}>
              <th style={{textAlign:'left', padding:'8px 12px 8px 0', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>RANK</th>
              <th style={{textAlign:'left', padding:'8px 12px 8px 0', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>TICKER</th>
              <th style={{textAlign:'left', padding:'8px 12px 8px 0', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>ASSET CLASS</th>
              <th style={{textAlign:'right', padding:'8px 0', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>SIZE</th>
              <th style={{textAlign:'center', padding:'8px 8px', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>TIER</th>
              <th style={{textAlign:'right', padding:'8px 0', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>LAST</th>
              <th style={{textAlign:'right', padding:'8px 0 8px 12px', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>ABS %</th>
              <th style={{textAlign:'right', padding:'8px 0 8px 12px', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>vs SPY</th>
              <th style={{textAlign:'right', padding:'8px 0 8px 12px', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>DAYS</th>
              <th style={{textAlign:'left', padding:'8px 0 8px 12px', fontSize:10, color:'#9A9790', whiteSpace:'nowrap'}}>ENTRY</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const sz = sizingMap[pos.ticker];
              const lv = livePrices[pos.ticker];
              const isAboveThreshold = sz?.above_hyg_threshold;
              return (
                <tr key={pos.ticker} style={{
                  borderBottom:'1px solid #F5F3EF',
                  background: i % 2 === 0 ? '#fff' : '#FAFAF8',
                }}>
                  {/* Rank */}
                  <td style={{padding:'10px 12px 10px 0'}}>
                    {sz ? (
                      <div style={{display:'flex', alignItems:'center', gap:6}}>
                        <span style={{fontWeight:700, fontSize:13, color: isAboveThreshold ? '#1A4D8F' : '#9A9790'}}>
                          #{sz.rank}
                        </span>
                        {sz.rerank_1w != null && sz.rerank_1w !== 0 && (
                          <span style={{fontSize:9, color: sz.rerank_1w > 0 ? '#27500A' : '#C8302A', fontWeight:600}}>
                            {sz.rerank_1w > 0 ? '▲' : '▼'}{Math.abs(sz.rerank_1w)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{color:'#ccc', fontSize:11}}>—</span>
                    )}
                  </td>
                  {/* Ticker + name */}
                  <td style={{padding:'10px 12px 10px 0'}}>
                    <div style={{fontWeight:700, fontSize:14, color:'#1A1A18'}}>{pos.ticker}</div>
                    <div style={{fontSize:10, color:'#9A9790', marginTop:1, maxWidth:160, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{pos.name}</div>
                  </td>
                  {/* Asset class */}
                  <td style={{padding:'10px 12px 10px 0', fontSize:11, color:'#5A5750', whiteSpace:'nowrap'}}>
                    {pos.asset_class}
                  </td>
                  {/* Size % */}
                  <td style={{padding:'10px 8px', textAlign:'right'}}>
                    {sz ? (
                      <span style={{fontWeight:700, fontSize:13,
                        color: isAboveThreshold ? '#1A4D8F' : '#9A9790'}}>
                        {sz.estimated_pct?.toFixed(1)}%
                      </span>
                    ) : <span style={{color:'#ccc'}}>—</span>}
                  </td>
                  {/* Tier */}
                  <td style={{padding:'10px 8px', textAlign:'center'}}>
                    {sz ? <TierPill tier={sz.tier} /> : <span style={{color:'#ccc', fontSize:10}}>—</span>}
                  </td>
                  {/* Last price */}
                  <td style={{padding:'10px 0', textAlign:'right'}}>
                    {lv ? (
                      <div>
                        <div style={{fontWeight:600, fontSize:12}}>${lv.price?.toFixed(2)}</div>
                        <div style={{fontSize:10, color: perfColor(lv.chg), marginTop:1}}>
                          {fmtPct(lv.chg)}
                        </div>
                      </div>
                    ) : (
                      <span style={{color:'#ccc', fontSize:10}}>{priceStatus === 'loading' ? '…' : '—'}</span>
                    )}
                  </td>
                  {/* Abs perf since entry */}
                  <td style={{padding:'10px 0 10px 12px', textAlign:'right',
                    fontWeight:600, color: perfColor(pos.abs_perf)}}>
                    {fmtPct(pos.abs_perf)}
                  </td>
                  {/* Rel perf vs SPY */}
                  <td style={{padding:'10px 0 10px 12px', textAlign:'right',
                    fontWeight:600, color: perfColor(pos.rel_perf)}}>
                    {fmtPct(pos.rel_perf)}
                  </td>
                  {/* Days held */}
                  <td style={{padding:'10px 0 10px 12px', textAlign:'right', color:'#7A7770'}}>
                    {pos.days_held ?? '—'}
                  </td>
                  {/* Entry date */}
                  <td style={{padding:'10px 0 10px 12px', color:'#9A9790', fontSize:10, whiteSpace:'nowrap'}}>
                    {pos.date_added ? pos.date_added.slice(5) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Sort tickers by appearances desc for streak grid
  const sorted = Object.entries(tickers).sort((a,b) => b[1].appearances - a[1].appearances);

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>

      {/* ── Active Book ──────────────────────────────────────────────────────── */}
      <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:20, marginBottom:20}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10}}>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <SectionTitle mono style={{margin:0}}>Active Book</SectionTitle>
            {bookAsOf && (
              <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#27500A',
                background:'#EAF3DE', border:'1px solid #7AB648', padding:'2px 8px', borderRadius:3}}>
                as of {bookAsOf}
              </span>
            )}
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#5A5750'}}>
              {bookLongs.length}L · {bookShorts.length}S
            </span>
          </div>
          {/* Long / Short toggle */}
          <div style={{display:'flex', gap:4}}>
            {[['longs','LONGS','#27500A','#EAF3DE'], ['shorts','SHORTS','#C8302A','#FDECEA']].map(([v,label,col,bg]) => (
              <button key={v} onClick={() => setBookView(v)}
                style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600,
                  padding:'5px 14px', borderRadius:4, cursor:'pointer', border:'1px solid',
                  borderColor: bookView===v ? col : '#E4E1DA',
                  background: bookView===v ? bg : '#fff',
                  color: bookView===v ? col : '#9A9790'}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Threshold banner */}
        {macroCtx?.position_sizing?.threshold_ticker && (
          <div style={{background:'#FFFBF0', border:'1px solid #F0D060', borderRadius:5,
            padding:'8px 12px', marginBottom:14, fontSize:11, color:'#7A5C00',
            fontFamily:'IBM Plex Mono,monospace'}}>
            ⚡ Anchor: {macroCtx.position_sizing.threshold_ticker} (rank #{macroCtx.position_sizing.threshold_rank}) at min {macroCtx.position_sizing.threshold_pct}% — positions ranked above are confirmed >{macroCtx.position_sizing.threshold_pct}%
          </div>
        )}

        <BookTable
          positions={bookView === 'longs' ? bookLongs : bookShorts}
          isShort={bookView === 'shorts'}
        />
      </div>

      {/* ── Freshness bar + PA commentary ───────────────────────────────────── */}
      <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:12, flexWrap:'wrap'}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#5A5750',
          background:'#F4F3EF', border:'1px solid #E4E1DA', padding:'3px 10px', borderRadius:3}}>
          STREAK GRID: {latestDate} · {dates.length} trading days
        </div>
      </div>

      {paCommentary && (
        <div style={{background:'#fff', border:'1px solid #E4E1DA', borderLeft:'3px solid #1A4D8F',
          borderRadius:6, padding:'12px 16px', marginBottom:16}}>
          <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:8, fontWeight:700,
            color:'#1A4D8F', letterSpacing:'0.1em', marginBottom:5}}>KEITH'S PA — {latestDate}</div>
          <div style={{fontSize:11, color:'#333', lineHeight:1.7}}>{paCommentary}</div>
        </div>
      )}

      {/* ── Streak heatmap ───────────────────────────────────────────────────── */}
      <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:20, marginBottom:20}}>
        <SectionTitle mono>Streak Grid — Top-3 Appearances by Date</SectionTitle>
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse', fontFamily:'IBM Plex Mono,monospace', fontSize:11, width:'100%'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'6px 12px 6px 0', borderBottom:'1px solid #E4E1DA',
                  fontSize:10, color:'#9A9790', whiteSpace:'nowrap', minWidth:200}}>ETF</th>
                {dates.map(d => (
                  <th key={d} style={{textAlign:'center', padding:'6px 8px', borderBottom:'1px solid #E4E1DA',
                    fontSize:9, color:'#9A9790', whiteSpace:'nowrap', minWidth:54}}>{d}</th>
                ))}
                <th style={{textAlign:'center', padding:'6px 8px', borderBottom:'1px solid #E4E1DA',
                  fontSize:9, color:'#9A9790', minWidth:60}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(([sym, info]) => (
                <tr key={sym} style={{borderBottom:'1px solid #F5F3EF'}}>
                  <td style={{padding:'8px 12px 8px 0', whiteSpace:'nowrap'}}>
                    <span style={{fontWeight:700, fontSize:12}}>{sym}</span>
                    <span style={{fontSize:10, color:'#9A9790', marginLeft:8}}>{info.desc.slice(0,28)}</span>
                  </td>
                  {dates.map(d => {
                    const rank = info.data[d];
                    return (
                      <td key={d} style={{padding:'6px 4px', textAlign:'center'}}>
                        {rank ? (
                          <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center',
                            width:28, height:22, borderRadius:4,
                            background: rankBg(rank), color: rankColor(rank),
                            fontWeight:700, fontSize:11}}>
                            #{rank}
                          </span>
                        ) : (
                          <span style={{color:'#E4E1DA', fontSize:10}}>·</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{padding:'6px 8px', textAlign:'center'}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700,
                      padding:'2px 8px', borderRadius:3,
                      background: info.appearances >= 4 ? '#EAF3DE' : info.appearances >= 2 ? '#E4EDF8' : '#F1EFE8',
                      color: info.appearances >= 4 ? '#27500A' : info.appearances >= 2 ? '#1A4D8F' : '#7A7770'}}>
                      {info.appearances}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:12, fontSize:11, color:'#9A9790', fontFamily:'IBM Plex Mono,monospace',
          display:'flex', gap:16, flexWrap:'wrap'}}>
          <span><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:18,borderRadius:3,background:'#EAF3DE',color:'#27500A',fontWeight:700,fontSize:10,marginRight:4}}>#1</span>Top mover</span>
          <span><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:18,borderRadius:3,background:'#E4EDF8',color:'#1A4D8F',fontWeight:700,fontSize:10,marginRight:4}}>#2</span>2nd mover</span>
          <span><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:18,borderRadius:3,background:'#FFF8E1',color:'#7A5C00',fontWeight:700,fontSize:10,marginRight:4}}>#3</span>3rd mover</span>
        </div>
      </div>

      {/* ── Daily re-rank history ────────────────────────────────────────────── */}
      <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8, padding:20}}>
        <SectionTitle mono>Daily Re-Rank History</SectionTitle>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10}}>
          {reranks.map((r, i) => (
            <div key={i} style={{border:'1px solid #E4E1DA', borderRadius:6, padding:12,
              background: i === 0 ? '#F9F8F5' : '#fff'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#9A9790'}}>{r.date}</span>
                {i === 0 && <span style={{fontSize:8, background:'#EAF3DE', color:'#27500A',
                  padding:'1px 6px', borderRadius:3, fontWeight:600, fontFamily:'IBM Plex Mono,monospace'}}>LATEST</span>}
              </div>
              {r.topMovers.map((m, j) => (
                <div key={j} style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'4px 0', borderBottom: j < r.topMovers.length - 1 ? '1px solid #F5F3EF' : 'none'}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
                      color: rankColor(j+1), background: rankBg(j+1),
                      width:18, height:16, borderRadius:2, display:'inline-flex',
                      alignItems:'center', justifyContent:'center'}}>
                      {j+1}
                    </span>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontWeight:700, fontSize:13}}>{m.ticker}</span>
                  </div>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:12,
                    color:'#27500A', fontWeight:600}}>{m.pts}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

Object.assign(window, {ETFProTab});
