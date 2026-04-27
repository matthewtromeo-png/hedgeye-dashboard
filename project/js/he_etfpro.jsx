// he_etfpro.jsx — ETF Pro dedicated tab

const ETFProTab = () => {
  const {dates, tickers} = window.HE.ETF_STREAK;
  const reranks = window.HE.ETF_RERANKS;
  const [livePrices, setLivePrices] = React.useState({});
  const [priceStatus, setPriceStatus] = React.useState('idle');

  // Fetch prices for ETF Pro tickers
  const etfSymbols = Object.keys(tickers);
  React.useEffect(() => {
    setPriceStatus('loading');
    const syms = etfSymbols.join(',');
    const url = `https://corsproxy.io/?${encodeURIComponent(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms}&fields=regularMarketPrice,regularMarketChangePercent`
    )}`;
    fetch(url, {signal: AbortSignal.timeout(8000)})
      .then(r => r.json())
      .then(d => {
        const m = {};
        (d.quoteResponse?.result || []).forEach(q => {
          m[q.symbol] = {price: q.regularMarketPrice, chg: q.regularMarketChangePercent};
        });
        setLivePrices(m);
        setPriceStatus('ok');
      })
      .catch(() => setPriceStatus('error'));
  }, []);

  const rankColor = r => r === 1 ? '#27500A' : r === 2 ? '#1A4D8F' : '#7A5C00';
  const rankBg   = r => r === 1 ? '#EAF3DE' : r === 2 ? '#E4EDF8' : '#FFF8E1';

  // Sort tickers by appearances desc
  const sorted = Object.entries(tickers).sort((a,b) => b[1].appearances - a[1].appearances);

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      {/* Leaderboard */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10, marginBottom:20}}>
        {sorted.slice(0,6).map(([sym, info]) => {
          const p = livePrices[sym];
          return (
            <div key={sym} style={{background:'#fff', border:'1px solid #E4E1DA', borderRadius:8,
              padding:'14px 16px', borderLeft:`3px solid ${info.appearances>=4?'#27500A':info.appearances>=2?'#1A4D8F':'#E4E1DA'}`}}>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#7A7770',
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3}}>{info.appearances}× in top-3</div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:22, fontWeight:700,
                color:'#1A1A18', marginBottom:2}}>{sym}</div>
              <div style={{fontSize:10, color:'#7A7770', marginBottom:8, lineHeight:1.4}}>{info.desc}</div>
              {p ? (
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:14, fontWeight:600}}>${p.price?.toFixed(2)}</span>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:600,
                    color: p.chg >= 0 ? '#27500A' : '#C8302A'}}>
                    {p.chg >= 0 ? '+' : ''}{p.chg?.toFixed(2)}%
                  </span>
                </div>
              ) : (
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#ccc'}}>
                  {priceStatus === 'loading' ? 'fetching…' : '—'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Streak heatmap */}
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

      {/* Full re-rank history */}
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
