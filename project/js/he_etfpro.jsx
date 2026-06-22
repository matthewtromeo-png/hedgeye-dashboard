// he_etfpro.jsx — ETF Pro active book

const ETFProTab = ({macroCtx}) => {
  const {dates, tickers} = window.HE.ETF_STREAK;
  const reranks = window.HE.ETF_RERANKS;
  const [bookView,   setBookView]   = React.useState('all');   // 'all' | 'longs' | 'shorts'
  const [legacyOpen, setLegacyOpen] = React.useState(false);
  const [livePrices,  setLivePrices]  = React.useState({});
  const [priceStatus, setPriceStatus] = React.useState('idle'); // 'idle' | 'loading' | 'ok' | 'error'

  // ── Active book data — from parsed Excel, top-level macro_context keys ────
  const bookLongs  = macroCtx?.active_longs  || [];
  const bookShorts = macroCtx?.active_shorts || [];
  const bookAsOf   = macroCtx?.etf_pro_as_of || '';
  const etfSource  = macroCtx?.sources_used?.etf_pro || '';

  const etfStale = (() => {
    if (!bookAsOf) return true;
    return (Date.now() - new Date(bookAsOf).getTime()) > 2 * 86400000;
  })();

  // ── Live price fetch ──────────────────────────────────────────────────────
  React.useEffect(() => {
    const tickers = [...bookLongs, ...bookShorts].map(p => p.ticker);
    if (!tickers.length) return;
    setPriceStatus('loading');
    fetch(window.HE.apiUrl.yfQuote(tickers), {signal: AbortSignal.timeout(14000)})
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
  }, [bookLongs.length + bookShorts.length]);

  const longsTagged  = bookLongs.map(p  => ({...p, call:'LONG'}));
  const shortsTagged = bookShorts.map(p => ({...p, call:'SHORT'}));

  const visiblePositions =
    bookView === 'longs'  ? longsTagged  :
    bookView === 'shorts' ? shortsTagged :
    [...longsTagged, ...shortsTagged];

  // ── Helpers ───────────────────────────────────────────────────────────────
  const perfColor = v => v == null ? '#9A9790' : v > 0 ? '#27500A' : v < 0 ? '#C8302A' : '#7A7770';
  const fmtPct    = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  const fmtPrice  = v => v == null ? '—' : '$' + Number(v).toFixed(2);
  const fmtDate   = s => (s && s.length >= 10) ? s.slice(0, 10) : (s || '—');
  const fmtDateShort = s => (s && s.length >= 10) ? s.slice(5, 10) : (s || '—');

  const TH = ({align, children}) => (
    <th style={{textAlign: align || 'left', padding:'8px 10px 8px 0', fontSize:10,
      color:'#9A9790', whiteSpace:'nowrap', fontWeight:600, letterSpacing:'0.05em'}}>
      {children}
    </th>
  );

  const CallBadge = ({call}) => (
    <span style={{
      display:'inline-block', fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
      padding:'2px 7px', borderRadius:3, letterSpacing:'0.06em',
      background: call === 'LONG' ? '#EAF3DE' : '#FDECEA',
      color:       call === 'LONG' ? '#27500A' : '#C8302A',
      border:     `1px solid ${call === 'LONG' ? '#7AB648' : '#E8A09D'}`,
    }}>{call}</span>
  );

  // ── Legacy streak helpers ─────────────────────────────────────────────────
  const rankColor = r => r === 1 ? '#27500A' : r === 2 ? '#1A4D8F' : '#7A5C00';
  const rankBg    = r => r === 1 ? '#EAF3DE' : r === 2 ? '#E4EDF8' : '#FFF8E1';
  const sorted    = Object.entries(tickers).sort((a,b) => b[1].appearances - a[1].appearances);

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{marginBottom:16}}>
        <div style={{display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap', marginBottom:6}}>
          <SectionTitle mono style={{margin:0}}>Active ETF Pro Book</SectionTitle>
          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:12, color:'#333', fontWeight:600}}>
            {bookLongs.length + bookShorts.length} total · {bookLongs.length}L · {bookShorts.length}S
          </span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
          {bookAsOf ? (
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10,
              color:      etfStale ? '#C8302A' : '#27500A',
              background: etfStale ? '#FDECEA' : '#EAF3DE',
              border:     `1px solid ${etfStale ? '#E8A09D' : '#7AB648'}`,
              padding:'2px 8px', borderRadius:3}}>
              {etfStale ? '⚠ stale · ' : ''}as of {bookAsOf}
            </span>
          ) : (
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#C8302A',
              background:'#FDECEA', border:'1px solid #E8A09D', padding:'2px 8px', borderRadius:3}}>
              ⚠ no data — run build_macro_context.py --stage1-only
            </span>
          )}
          {etfSource && (
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#9A9790',
              background:'#F4F3EF', border:'1px solid #E4E1DA', padding:'2px 8px', borderRadius:3,
              maxWidth:360, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
              title={etfSource}>
              {etfSource}
            </span>
          )}
          {priceStatus === 'ok' && (
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#27500A',
              background:'#EAF3DE', border:'1px solid #7AB648', padding:'2px 8px', borderRadius:3}}>
              LIVE ✓
            </span>
          )}
          {priceStatus === 'error' && (
            <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#C8302A',
              background:'#FDECEA', border:'1px solid #E8A09D', padding:'2px 8px', borderRadius:3}}>
              LIVE PRICES UNAVAILABLE
            </span>
          )}
        </div>
      </div>

      {/* ── Active book card ───────────────────────────────────────────────── */}
      <div style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8,
        padding:20, marginBottom:20}}>

        {/* All / Longs / Shorts toggle */}
        <div style={{display:'flex', gap:4, marginBottom:16}}>
          {[
            ['all',    `ALL (${bookLongs.length + bookShorts.length})`, '#333',    '#F4F3EF', '#C0BBB0'],
            ['longs',  `LONGS (${bookLongs.length})`,                   '#27500A', '#EAF3DE', '#7AB648'],
            ['shorts', `SHORTS (${bookShorts.length})`,                 '#C8302A', '#FDECEA', '#E8A09D'],
          ].map(([v, label, col, bg, border]) => (
            <button key={v} onClick={() => setBookView(v)}
              style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600,
                padding:'5px 14px', borderRadius:4, cursor:'pointer',
                border: `1px solid ${bookView === v ? border : '#E4E1DA'}`,
                background: bookView === v ? bg : '#fff',
                color:      bookView === v ? col : '#9A9790'}}>
              {label}
            </button>
          ))}
        </div>

        {visiblePositions.length === 0 ? (
          <div style={{color:'#9A9790', fontSize:12, padding:'24px 0', textAlign:'center',
            fontFamily:'IBM Plex Mono,monospace'}}>
            No positions loaded — run: python scripts\build_macro_context.py --stage1-only
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse',
              fontFamily:'IBM Plex Mono,monospace', fontSize:12}}>
              <thead>
                <tr style={{borderBottom:'2px solid #E4E1DA'}}>
                  <TH>CALL</TH>
                  <TH>TICKER</TH>
                  <TH>ASSET CLASS</TH>
                  <TH align="right">LAST PRICE</TH>
                  <TH align="right">LIVE PRICE</TH>
                  <TH align="right">TODAY %</TH>
                  <TH align="right">ABS %</TH>
                  <TH align="right">SPY %</TH>
                  <TH align="right">REL %</TH>
                  <TH align="right">DAYS</TH>
                  <TH>DATE ADDED</TH>
                  <TH>AS OF</TH>
                  <TH>LAST PUB</TH>
                </tr>
              </thead>
              <tbody>
                {visiblePositions.map((pos, i) => {
                  const isLong = pos.call === 'LONG';
                  const lv     = livePrices[pos.ticker];
                  const rowBg  = bookView === 'all'
                    ? (isLong
                        ? (i % 2 === 0 ? '#F8FEFC' : '#F0FAF4')
                        : (i % 2 === 0 ? '#FFFAFA' : '#FFF3F3'))
                    : (i % 2 === 0 ? '#fff' : '#FAFAF8');
                  return (
                    <tr key={pos.ticker} style={{borderBottom:'1px solid #F5F3EF', background:rowBg}}>
                      {/* Call badge */}
                      <td style={{padding:'9px 10px 9px 0', whiteSpace:'nowrap'}}>
                        <CallBadge call={pos.call} />
                      </td>
                      {/* Ticker + ETF name */}
                      <td style={{padding:'9px 10px 9px 0'}}>
                        <div style={{fontWeight:700, fontSize:13, color:'#1A1A18'}}>{pos.ticker}</div>
                        <div style={{fontSize:10, color:'#7A7770', marginTop:1, maxWidth:180,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {pos.name || pos.etf || ''}
                        </div>
                      </td>
                      {/* Asset class */}
                      <td style={{padding:'9px 10px 9px 0', fontSize:11, color:'#5A5750', whiteSpace:'nowrap'}}>
                        {pos.asset_class || '—'}
                      </td>
                      {/* Last price */}
                      <td style={{padding:'9px 10px 9px 0', textAlign:'right', fontWeight:600, color:'#1A1A18'}}>
                        {fmtPrice(pos.last_price)}
                      </td>
                      {/* Live price */}
                      <td style={{padding:'9px 10px 9px 0', textAlign:'right', fontWeight:700,
                        color: lv ? '#1A1A18' : '#C0BBB0'}}>
                        {lv ? fmtPrice(lv.price) : (
                          priceStatus === 'loading'
                          ? <span style={{fontSize:9, color:'#C0BBB0'}}>…</span>
                          : <span style={{fontSize:9, color:'#C0BBB0'}}>—</span>
                        )}
                      </td>
                      {/* Today % */}
                      <td style={{padding:'9px 10px 9px 0', textAlign:'right',
                        fontWeight:700, color: lv ? perfColor(lv.chg) : '#C0BBB0'}}>
                        {lv ? fmtPct(lv.chg) : <span style={{fontSize:9}}>—</span>}
                      </td>
                      {/* Absolute perf */}
                      <td style={{padding:'9px 10px 9px 0', textAlign:'right',
                        fontWeight:700, color:perfColor(pos.abs_perf)}}>
                        {fmtPct(pos.abs_perf)}
                      </td>
                      {/* SPY perf */}
                      <td style={{padding:'9px 10px 9px 0', textAlign:'right',
                        fontWeight:500, color:perfColor(pos.sp500)}}>
                        {fmtPct(pos.sp500)}
                      </td>
                      {/* Relative perf */}
                      <td style={{padding:'9px 10px 9px 0', textAlign:'right',
                        fontWeight:700, color:perfColor(pos.rel_perf)}}>
                        {fmtPct(pos.rel_perf)}
                      </td>
                      {/* Days held */}
                      <td style={{padding:'9px 10px 9px 0', textAlign:'right', color:'#7A7770'}}>
                        {pos.days_held ?? '—'}
                      </td>
                      {/* Date added */}
                      <td style={{padding:'9px 10px 9px 0', color:'#9A9790', fontSize:10, whiteSpace:'nowrap'}}>
                        {fmtDate(pos.date_added)}
                      </td>
                      {/* As of */}
                      <td style={{padding:'9px 10px 9px 0', color:'#9A9790', fontSize:10, whiteSpace:'nowrap'}}>
                        {fmtDateShort(pos.as_of)}
                      </td>
                      {/* Last published */}
                      <td style={{padding:'9px 0', color:'#C0BBB0', fontSize:10, whiteSpace:'nowrap'}}>
                        {fmtDateShort(pos.last_published)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Legacy Re-Rank / Streak (collapsed by default) ─────────────────── */}
      <div style={{border:'1px solid #E4E1DA', borderRadius:8, overflow:'hidden'}}>
        <button
          onClick={() => setLegacyOpen(o => !o)}
          style={{width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'12px 20px', background:'#F4F3EF', border:'none', cursor:'pointer',
            fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#5A5750', textAlign:'left'}}>
          <span style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
            <strong style={{fontSize:12}}>Legacy Re-Rank History</strong>
            <span style={{fontSize:9, color:'#C8302A', background:'#FDECEA',
              border:'1px solid #E8A09D', padding:'1px 6px', borderRadius:3, fontWeight:700}}>
              STALE · THROUGH 5/27 ONLY
            </span>
            <span style={{fontSize:10, color:'#9A9790'}}>
              sourced from Portfolio Solutions PDFs — not the ETF Pro active book
            </span>
          </span>
          <span style={{fontSize:12, color:'#9A9790', marginLeft:12, flexShrink:0}}>
            {legacyOpen ? '▲ collapse' : '▼ expand'}
          </span>
        </button>

        {legacyOpen && (
          <div style={{padding:20, background:'#fff'}}>

            {/* Streak heatmap */}
            <div style={{marginBottom:24}}>
              <SectionTitle mono>Streak Grid — Top-3 Appearances by Date (4/8–5/27)</SectionTitle>
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse', fontFamily:'IBM Plex Mono,monospace',
                  fontSize:11, width:'100%'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', padding:'6px 12px 6px 0', borderBottom:'1px solid #E4E1DA',
                        fontSize:10, color:'#9A9790', whiteSpace:'nowrap', minWidth:200}}>ETF</th>
                      {dates.map(d => (
                        <th key={d} style={{textAlign:'center', padding:'6px 6px',
                          borderBottom:'1px solid #E4E1DA', fontSize:9, color:'#9A9790',
                          whiteSpace:'nowrap', minWidth:50}}>{d}</th>
                      ))}
                      <th style={{textAlign:'center', padding:'6px 8px',
                        borderBottom:'1px solid #E4E1DA', fontSize:9, color:'#9A9790',
                        minWidth:50}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(([sym, info]) => (
                      <tr key={sym} style={{borderBottom:'1px solid #F5F3EF'}}>
                        <td style={{padding:'7px 12px 7px 0', whiteSpace:'nowrap'}}>
                          <span style={{fontWeight:700, fontSize:12}}>{sym}</span>
                          <span style={{fontSize:10, color:'#9A9790', marginLeft:8}}>
                            {info.desc.slice(0,28)}
                          </span>
                        </td>
                        {dates.map(d => {
                          const rank = info.data[d];
                          return (
                            <td key={d} style={{padding:'5px 3px', textAlign:'center'}}>
                              {rank ? (
                                <span style={{display:'inline-flex', alignItems:'center',
                                  justifyContent:'center', width:26, height:20, borderRadius:3,
                                  background:rankBg(rank), color:rankColor(rank),
                                  fontWeight:700, fontSize:10}}>
                                  #{rank}
                                </span>
                              ) : (
                                <span style={{color:'#E4E1DA', fontSize:10}}>·</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{padding:'5px 8px', textAlign:'center'}}>
                          <span style={{fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:3,
                            background: info.appearances >= 4 ? '#EAF3DE' : info.appearances >= 2 ? '#E4EDF8' : '#F1EFE8',
                            color:      info.appearances >= 4 ? '#27500A' : info.appearances >= 2 ? '#1A4D8F' : '#7A7770'}}>
                            {info.appearances}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:10, fontSize:10, color:'#9A9790', display:'flex', gap:14, flexWrap:'wrap'}}>
                <span><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                  width:20,height:16,borderRadius:3,background:'#EAF3DE',color:'#27500A',
                  fontWeight:700,fontSize:9,marginRight:4}}>#1</span>Top mover</span>
                <span><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                  width:20,height:16,borderRadius:3,background:'#E4EDF8',color:'#1A4D8F',
                  fontWeight:700,fontSize:9,marginRight:4}}>#2</span>2nd mover</span>
                <span><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                  width:20,height:16,borderRadius:3,background:'#FFF8E1',color:'#7A5C00',
                  fontWeight:700,fontSize:9,marginRight:4}}>#3</span>3rd mover</span>
              </div>
            </div>

            {/* Daily re-rank cards */}
            <SectionTitle mono>Daily Re-Rank History (4/8–5/27)</SectionTitle>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(158px,1fr))', gap:8}}>
              {reranks.map((r, i) => (
                <div key={i} style={{border:'1px solid #E4E1DA', borderRadius:6, padding:10,
                  background: i === 0 ? '#F9F8F5' : '#fff'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#9A9790'}}>
                      {r.date}
                    </span>
                    {i === 0 && (
                      <span style={{fontSize:8, background:'#EAF3DE', color:'#27500A',
                        padding:'1px 5px', borderRadius:3, fontWeight:600,
                        fontFamily:'IBM Plex Mono,monospace'}}>LATEST</span>
                    )}
                  </div>
                  {r.topMovers.map((m, j) => (
                    <div key={j} style={{display:'flex', justifyContent:'space-between',
                      alignItems:'center', padding:'3px 0',
                      borderBottom: j < r.topMovers.length - 1 ? '1px solid #F5F3EF' : 'none'}}>
                      <div style={{display:'flex', alignItems:'center', gap:5}}>
                        <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700,
                          color:rankColor(j+1), background:rankBg(j+1),
                          width:16, height:15, borderRadius:2, display:'inline-flex',
                          alignItems:'center', justifyContent:'center'}}>
                          {j+1}
                        </span>
                        <span style={{fontFamily:'IBM Plex Mono,monospace', fontWeight:700, fontSize:13}}>
                          {m.ticker}
                        </span>
                      </div>
                      <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:12,
                        color:'#27500A', fontWeight:600}}>{m.pts}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

Object.assign(window, {ETFProTab});
