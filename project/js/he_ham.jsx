// he_ham.jsx — HAM Holdings tab

const HAMTab = ({myPositions, onMyPositionsChange}) => {
  const [hamData, setHamData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [activeFund, setActiveFund] = React.useState('HEFT');
  const [showLongs, setShowLongs] = React.useState(true);
  const [subTab, setSubTab] = React.useState('holdings');
  const [myInput, setMyInput] = React.useState(myPositions || '');

  React.useEffect(() => {
    fetch(window.__resources?.hamCsv || './data/ham_holdings_latest.csv')
      .then(r => r.text())
      .then(txt => {
        const rows = window.HE.parseCSV(txt);
        const funds = {};
        rows.forEach(r => {
          const f = r.Account; if (!f) return;
          if (!funds[f]) funds[f] = [];
          const wPct = parseFloat((r.Weightings||'0').replace('%','')) || 0;
          const w = wPct / 100;
          funds[f].push({
            ticker: r.StockTicker,
            name: r.SecurityName,
            weight: w,
            price: parseFloat(r.Price)||0,
            mv: parseFloat(r.MarketValue)||0,
            isLong: w > 0,
            isShort: w < 0,
            isCash: r.StockTicker === 'Cash&Other' || r.MoneyMarketFlag === 'Y',
            isSwap: (r.StockTicker||'').includes('-TRS-'),
          });
        });

        // Overlap map (longs only, real equities)
        const tickerMap = {};
        Object.entries(funds).forEach(([fund, holdings]) => {
          holdings
            .filter(h => h.isLong && !h.isCash && !h.isSwap)
            .forEach(h => {
              if (!tickerMap[h.ticker]) tickerMap[h.ticker] = {ticker:h.ticker, name:h.name, funds:{}};
              tickerMap[h.ticker].funds[fund] = h.weight;
            });
        });

        const overlaps = Object.values(tickerMap)
          .filter(t => Object.keys(t.funds).length >= 2)
          .sort((a,b) => Object.keys(b.funds).length - Object.keys(a.funds).length
            || Object.values(b.funds).reduce((x,y)=>x+y,0) - Object.values(a.funds).reduce((x,y)=>x+y,0));

        setHamData({ funds, tickerMap, overlaps });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner msg="Loading HAM holdings…" />;
  if (!hamData) return <div style={{padding:40,color:'#C8302A',fontFamily:'IBM Plex Mono,monospace',fontSize:12}}>Could not load HAM data.</div>;

  const { funds, tickerMap, overlaps } = hamData;
  const FUNDS = ['HECA','HEFT','HGRO','HELS'].filter(f => funds[f]);
  const myTickers = myInput.split(/[\s,\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  const sssSet = new Set(window.HE.SSS.map(s => s.ticker));
  const pct = w => w === 0 ? '—' : (w > 0 ? '+' : '') + (w*100).toFixed(2) + '%';
  const fundColors = {HECA:'#1A4D8F',HEFT:'#27500A',HGRO:'#B8860B',HELS:'#C8302A'};

  const FundSummary = () => (
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
      {FUNDS.map(f => {
        const longs = (funds[f]||[]).filter(h => h.isLong && !h.isCash && !h.isSwap);
        const shorts = (funds[f]||[]).filter(h => h.isShort && !h.isSwap);
        const nav = (funds[f]||[]).filter(h=>!h.isSwap).reduce((s,h) => s+Math.abs(h.mv), 0);
        return (
          <div key={f} onClick={() => { setActiveFund(f); setSubTab('holdings'); }}
            style={{background:'#fff',border:`1px solid ${activeFund===f && subTab==='holdings'?fundColors[f]:'#E4E1DA'}`,
              borderRadius:8,padding:'14px 16px',cursor:'pointer',transition:'border-color 0.15s',
              borderLeft:`3px solid ${fundColors[f]}`}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,fontWeight:700,
              letterSpacing:'0.1em',color:fundColors[f],marginBottom:4}}>{f}</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:'IBM Plex Mono,monospace',
              color:'#1A1A18',lineHeight:1,marginBottom:4}}>${(nav/1e6).toFixed(0)}M</div>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770'}}>
              {longs.length}L / {shorts.length}S
            </div>
          </div>
        );
      })}
    </div>
  );

  const HoldingsTable = ({fund}) => {
    const holdings = (funds[fund]||[])
      .filter(h => !h.isCash && !h.isSwap && (showLongs ? h.isLong : h.isShort))
      .sort((a,b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 60);
    return (
      <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
        <thead>
          <tr><TH>Ticker</TH><TH>Name</TH><TH right>Weight</TH><TH right>Price</TH><TH right>Mkt Value</TH><TH>SSS</TH><TH>My Book</TH></tr>
        </thead>
        <tbody>
          {holdings.map((h,i) => {
            const inSSS = sssSet.has(h.ticker);
            const isMine = myTickers.includes(h.ticker);
            const sssInfo = inSSS ? window.HE.SSS.find(s=>s.ticker===h.ticker) : null;
            return (
              <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                background: isMine?'rgba(26,77,143,0.05)':inSSS?'rgba(39,80,10,0.03)':i%2===0?'#fff':'#FAFAF8'}}>
                <TD><span style={{fontWeight:700}}>{h.ticker}</span></TD>
                <TD style={{color:'#7A7770',fontSize:10,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.name}</TD>
                <TD right style={{fontWeight:600,color:h.isLong?'#27500A':'#C8302A'}}>{pct(h.weight)}</TD>
                <TD right>${h.price.toFixed(2)}</TD>
                <TD right style={{color:'#7A7770'}}>${(Math.abs(h.mv)/1e6).toFixed(2)}M</TD>
                <TD>{inSSS?<span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 6px',borderRadius:3}}>
                  {sssInfo.days}d +{sssInfo.pct>0?'+':''}{sssInfo.pct.toFixed(1)}%
                </span>:''}</TD>
                <TD>{isMine?<span style={{fontSize:9,background:'#E4EDF8',color:'#1A4D8F',padding:'1px 6px',borderRadius:3,fontWeight:600}}>MY</span>:''}</TD>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const OverlapsTable = () => (
    <div>
      <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',marginBottom:12}}>
        {overlaps.length} tickers held across 2+ HAM funds (longs only) · as of Apr 17, 2026
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
          <thead>
            <tr>
              <TH>Ticker</TH><TH>Name</TH>
              {FUNDS.map(f=><TH key={f} right>{f}</TH>)}
              <TH>Funds</TH><TH>SSS</TH><TH>My Book</TH>
            </tr>
          </thead>
          <tbody>
            {overlaps.map((o,i) => {
              const cnt = Object.keys(o.funds).length;
              const inSSS = window.HE.SSS.find(s=>s.ticker===o.ticker);
              const isMine = myTickers.includes(o.ticker);
              return (
                <tr key={i} style={{borderBottom:'1px solid #F5F3EF',
                  background:isMine?'rgba(26,77,143,0.05)':cnt===FUNDS.length?'rgba(39,80,10,0.05)':i%2===0?'#fff':'#FAFAF8'}}>
                  <TD><span style={{fontWeight:700}}>{o.ticker}</span></TD>
                  <TD style={{color:'#7A7770',fontSize:10,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.name}</TD>
                  {FUNDS.map(f=>(
                    <TD key={f} right style={{fontWeight:o.funds[f]?600:400,color:o.funds[f]?'#27500A':'#ccc'}}>
                      {o.funds[f]?`${(o.funds[f]*100).toFixed(2)}%`:'—'}
                    </TD>
                  ))}
                  <TD>
                    <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:3,
                      background:cnt===FUNDS.length?'#EAF3DE':'#E4EDF8',
                      color:cnt===FUNDS.length?'#27500A':'#1A4D8F'}}>
                      {cnt}/{FUNDS.length}
                    </span>
                  </TD>
                  <TD>{inSSS?<span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 6px',borderRadius:3}}>
                    ✓ {inSSS.days}d +{inSSS.pct.toFixed(1)}%
                  </span>:''}</TD>
                  <TD>{isMine?<span style={{fontSize:9,background:'#E4EDF8',color:'#1A4D8F',padding:'1px 6px',borderRadius:3,fontWeight:600}}>MY</span>:''}</TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const MyBookTab = () => (
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#7A7770',marginBottom:6}}>
          Enter your tickers (space, comma, or line separated):
        </div>
        <textarea value={myInput}
          onChange={e=>{setMyInput(e.target.value); onMyPositionsChange&&onMyPositionsChange(e.target.value);}}
          placeholder="e.g. AAPL NVDA CASY XOM TSN SWBI"
          style={{width:'100%',padding:10,border:'1px solid #E4E1DA',borderRadius:6,
            fontFamily:'IBM Plex Mono,monospace',fontSize:12,color:'#1A1A18',
            background:'#FAFAF8',resize:'vertical',minHeight:72,outline:'none'}} />
      </div>
      {myTickers.length > 0 && (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'IBM Plex Mono,monospace',fontSize:11}}>
            <thead>
              <tr>
                <TH>Ticker</TH>
                {FUNDS.map(f=><TH key={f} right>{f}</TH>)}
                <TH>Overlap</TH><TH>SSS Signal</TH>
              </tr>
            </thead>
            <tbody>
              {myTickers.map((ticker,i) => {
                const info = tickerMap[ticker];
                const sssInfo = window.HE.SSS.find(s=>s.ticker===ticker);
                const cnt = info ? Object.keys(info.funds).length : 0;
                return (
                  <tr key={i} style={{borderBottom:'1px solid #F5F3EF',background:i%2===0?'#fff':'#FAFAF8'}}>
                    <TD><span style={{fontWeight:700}}>{ticker}</span></TD>
                    {FUNDS.map(f=>{
                      const w = info?.funds[f];
                      return <TD key={f} right style={{fontWeight:w?600:400,color:w?'#27500A':'#ccc'}}>{w?`${(w*100).toFixed(2)}%`:'—'}</TD>;
                    })}
                    <TD>
                      {cnt===0 ? (
                        <span style={{fontSize:9,background:'#F1EFE8',color:'#888',padding:'1px 7px',borderRadius:3}}>Not held</span>
                      ) : (
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:3,
                          background:cnt===FUNDS.length?'#EAF3DE':cnt>=3?'#E4EDF8':'#FFF8E1',
                          color:cnt===FUNDS.length?'#27500A':cnt>=3?'#1A4D8F':'#B8860B'}}>
                          {cnt===FUNDS.length?'All 4 funds':`${cnt}/${FUNDS.length} funds`}
                        </span>
                      )}
                    </TD>
                    <TD>
                      {sssInfo ? (
                        <span style={{fontSize:9,background:'#EAF3DE',color:'#27500A',padding:'1px 7px',borderRadius:3}}>
                          {sssInfo.days}d · +{sssInfo.pct.toFixed(1)}% · {sssInfo.sector}
                        </span>
                      ) : <span style={{color:'#ccc',fontSize:10}}>—</span>}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      <FundSummary />
      {/* Sub-tabs */}
      <div style={{display:'flex',gap:6,marginBottom:16}}>
        {[['holdings','Holdings'],['overlaps','Fund Overlaps'],['mybook','My Book']].map(([k,v])=>(
          <button key={k} onClick={()=>setSubTab(k)} style={{
            padding:'6px 16px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',
            fontFamily:'IBM Plex Mono,monospace',fontSize:11,
            background:subTab===k?'#1A1A18':'#fff',
            color:subTab===k?'#fff':'#7A7770',fontWeight:subTab===k?500:400}}>
            {v}
          </button>
        ))}
        {subTab === 'holdings' && (
          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
            <button onClick={()=>setShowLongs(true)} style={{padding:'5px 14px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontSize:11,background:showLongs?'#EAF3DE':'#fff',color:showLongs?'#27500A':'#7A7770'}}>LONG</button>
            <button onClick={()=>setShowLongs(false)} style={{padding:'5px 14px',border:'1px solid #E4E1DA',borderRadius:4,cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontSize:11,background:!showLongs?'#FCEBEB':'#fff',color:!showLongs?'#C8302A':'#7A7770'}}>SHORT</button>
          </div>
        )}
      </div>

      <div style={{background:'#fff',border:'1px solid #E4E1DA',borderRadius:8,padding:20}}>
        {subTab==='holdings' && (
          <>
            <div style={{display:'flex',gap:6,marginBottom:16}}>
              {FUNDS.map(f=>(
                <button key={f} onClick={()=>setActiveFund(f)} style={{
                  padding:'5px 16px',border:`1px solid ${activeFund===f?fundColors[f]:'#E4E1DA'}`,
                  borderRadius:4,cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontSize:11,
                  background:activeFund===f?fundColors[f]:'#fff',
                  color:activeFund===f?'#fff':'#7A7770',fontWeight:activeFund===f?600:400}}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{overflowX:'auto'}}><HoldingsTable fund={activeFund} /></div>
          </>
        )}
        {subTab==='overlaps' && <OverlapsTable />}
        {subTab==='mybook' && <MyBookTab />}
      </div>
    </div>
  );
};

Object.assign(window, {HAMTab});
