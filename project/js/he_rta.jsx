// he_rta.jsx — RTA performance tab

const RTATab = () => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState({pos:'all', year:'all', search:''});
  const [page, setPage] = React.useState(0);
  const chartRef = React.useRef(null);
  const chartInst = React.useRef(null);

  React.useEffect(() => {
    fetch(window.__resources?.rtaCsv || './data/rta_latest.csv')
      .then(r => r.text())
      .then(txt => { setData(window.HE.computeRTAStats(window.HE.parseCSV(txt))); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (!data || !chartRef.current) return;
    if (chartInst.current) chartInst.current.destroy();
    // Thin data for performance
    const pts = data.cumPnl.filter((_,i) => i % 2 === 0);
    chartInst.current = new Chart(chartRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels: pts.map(p => p.date.slice(0,7)),
        datasets: [{
          data: pts.map(p => p.cum * 100),
          borderColor: '#27500A', backgroundColor: 'rgba(39,80,10,0.07)',
          borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.15,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: {display:false}, tooltip: {
          callbacks: { label: ctx => `${ctx.raw.toFixed(1)}% cumulative` },
          titleFont: {family:'IBM Plex Mono'}, bodyFont: {family:'IBM Plex Mono'},
        }},
        scales: {
          x: { ticks: {font:{family:'IBM Plex Mono',size:9},color:'#9A9790',maxTicksLimit:14}, grid:{color:'#F0EDE8'} },
          y: { ticks: {font:{family:'IBM Plex Mono',size:9},color:'#9A9790',callback:v=>`${v.toFixed(0)}%`}, grid:{color:'#F0EDE8'} },
        }
      }
    });
    return () => chartInst.current && chartInst.current.destroy();
  }, [data]);

  if (loading) return <LoadingSpinner msg="Parsing RTA history (8,800+ trades)…" />;
  if (!data) return <div style={{padding:40,color:'#C8302A',fontFamily:'IBM Plex Mono,monospace',fontSize:12}}>Could not load RTA data.</div>;

  const fmt = n => isNaN(n) ? '—' : (n >= 0 ? '+' : '') + (n*100).toFixed(1) + '%';
  const fmtA = n => (n >= 0 ? '+' : '') + (n*100).toFixed(2) + '%';

  const years = Object.keys(data.byYear).sort().reverse();
  const filtered = data.recentTrades.filter(t => {
    if (filter.pos !== 'all' && (t.Position||'').toLowerCase() !== filter.pos) return false;
    if (filter.year !== 'all' && !(t['Close Date']||'').startsWith(filter.year)) return false;
    if (filter.search && !(t.Symbol||'').toUpperCase().includes(filter.search.toUpperCase())) return false;
    return true;
  });
  const PAGE = 30;
  const pages = Math.ceil(filtered.length / PAGE);
  const rows = filtered.slice(page * PAGE, (page+1) * PAGE);

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      {/* Stats row */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20}}>
        <StatCard label="Total Trades" value={data.total.toLocaleString()} sub="closed positions" />
        <StatCard label="Win Rate" value={`${(data.winRate*100).toFixed(1)}%`} sub={`${data.wins}W / ${data.losses}L`} accent="#27500A" color="#27500A" />
        <StatCard label="Avg Return" value={fmtA(data.avgReturn)} sub="per trade (equal weight)" accent={data.avgReturn>=0?'#27500A':'#C8302A'} color={data.avgReturn>=0?'#27500A':'#C8302A'} />
        <StatCard label="Best Trade" value={fmt(parseFloat(data.best?.['Realized Return']))} sub={`${data.best?.Symbol} · ${(data.best?.['Close Date']||'').slice(0,10)}`} accent="#27500A" color="#27500A" />
        <StatCard label="Worst Trade" value={fmt(parseFloat(data.worst?.['Realized Return']))} sub={`${data.worst?.Symbol} · ${(data.worst?.['Close Date']||'').slice(0,10)}`} accent="#C8302A" color="#C8302A" />
      </div>

      {/* Chart */}
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20,marginBottom:20}}>
        <SectionTitle mono>Cumulative Return — Last 600 Closed Trades (Equal Weight)</SectionTitle>
        <div style={{height:220}}><canvas ref={chartRef} /></div>
      </div>

      {/* By Year */}
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20,marginBottom:20}}>
        <SectionTitle mono>Performance by Year</SectionTitle>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
            <thead>
              <tr><TH>Year</TH><TH>Trades</TH><TH>Win Rate</TH><TH>Avg Return</TH><TH>Total Return</TH><TH>Best</TH><TH>Worst</TH></tr>
            </thead>
            <tbody>
              {years.slice(0,12).map(y => {
                const s = data.byYear[y];
                const wr = s.wins/s.count;
                const avg = s.sumReturn/s.count;
                const total = s.sumReturn;
                return (
                  <tr key={y} style={{borderBottom:'1px solid #F5F3EF'}}>
                    <TD><span style={{fontWeight:600}}>{y}</span></TD>
                    <TD>{s.count}</TD>
                    <TD style={{color:wr>0.5?'#27500A':'#C8302A',fontWeight:600}}>{(wr*100).toFixed(1)}%</TD>
                    <TD style={{color:avg>0?'#27500A':'#C8302A',fontWeight:600}}>{fmtA(avg)}</TD>
                    <TD style={{color:total>0?'#27500A':'#C8302A',fontWeight:700}}>{total>0?'+':''}{(total*100).toFixed(1)}%</TD>
                    <TD style={{color:'#27500A'}}>{fmt(s.best===Infinity?0:s.best)}</TD>
                    <TD style={{color:'#C8302A'}}>{fmt(s.worst===-Infinity?0:s.worst)}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade log */}
      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20}}>
        <SectionTitle mono>Trade Log — Most Recent First</SectionTitle>
        {/* Filters */}
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
          <input value={filter.search} onChange={e=>{setFilter(f=>({...f,search:e.target.value}));setPage(0);}}
            placeholder="Search ticker…"
            style={{padding:'6px 10px',border:'1px solid #E4E1DA',borderRadius:4,fontFamily:'IBM Plex Mono,monospace',
              fontSize:12,width:150,outline:'none',color:'#1A1A18'}} />
          {['all','long','short'].map(p => (
            <button key={p} onClick={()=>{setFilter(f=>({...f,pos:p}));setPage(0);}}
              style={{padding:'5px 12px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
                fontFamily:'IBM Plex Mono,monospace',fontSize:11,
                background:filter.pos===p?'#1A1A18':'#fff',
                color:filter.pos===p?'#fff':'#7A7770'}}>
              {p==='all'?'All':p.charAt(0).toUpperCase()+p.slice(1)}
            </button>
          ))}
          <select value={filter.year} onChange={e=>{setFilter(f=>({...f,year:e.target.value}));setPage(0);}}
            style={{padding:'5px 10px',border:'1px solid #E4E1DA',borderRadius:4,fontFamily:'IBM Plex Mono,monospace',
              fontSize:11,background:'#fff',color:'#1A1A18',cursor:'pointer',outline:'none'}}>
            <option value="all">All Years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#9A9790',marginLeft:'auto'}}>
            {filtered.length} trades
          </span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
            <thead>
              <tr><TH>Symbol</TH><TH>Direction</TH><TH>Opened</TH><TH>Open $</TH><TH>Closed</TH><TH>Close $</TH><TH right>Return</TH><TH>Duration</TH></tr>
            </thead>
            <tbody>
              {rows.map((t,i) => {
                const r = parseFloat(t['Realized Return'])||0;
                return (
                  <tr key={i} style={{borderBottom:'1px solid #F5F3EF',background:i%2===0?'#fff':'#FAFAF8'}}>
                    <TD><span style={{fontWeight:700}}>{t.Symbol}</span></TD>
                    <TD><SignalBadge signal={t.Position} /></TD>
                    <TD style={{color:'#7A7770',fontSize:10}}>{(t['Open Date']||'').slice(0,10)}</TD>
                    <TD style={{fontFamily:'IBM Plex Mono,monospace'}}>${parseFloat(t['Open Price']||0).toFixed(2)}</TD>
                    <TD style={{color:'#7A7770',fontSize:10}}>{(t['Close Date']||'').slice(0,10)}</TD>
                    <TD style={{fontFamily:'IBM Plex Mono,monospace'}}>${parseFloat(t['Close Price']||0).toFixed(2)}</TD>
                    <TD right style={{fontWeight:700,color:r>0?'#27500A':r<0?'#C8302A':'#7A7770'}}>{fmt(r)}</TD>
                    <TD style={{color:'#7A7770',fontSize:10,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.Duration}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:14,alignItems:'center'}}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
              style={{padding:'4px 12px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
                fontFamily:'IBM Plex Mono,monospace',fontSize:10,background:page===0?'#F5F3EF':'#fff'}}>←</button>
            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770'}}>{page+1} / {pages}</span>
            <button onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1}
              style={{padding:'4px 12px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
                fontFamily:'IBM Plex Mono,monospace',fontSize:10,background:page===pages-1?'#F5F3EF':'#fff'}}>→</button>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, {RTATab});
