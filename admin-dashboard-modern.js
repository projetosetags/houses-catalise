(()=>{
  const $=s=>document.querySelector(s);
  function reorderTop(){
    const app=$('#app'),hero=app?.querySelector(':scope>.hero'),nav=app?.querySelector(':scope>nav'),kpis=app?.querySelector(':scope>.kpis');
    if(!app||!hero||!nav||!kpis)return;
    if(nav.nextElementSibling!==kpis){app.insertBefore(nav,kpis)}
  }
  function getData(){
    try{return typeof data!=='undefined'&&data?data:null}catch(e){return null}
  }
  function lineChart(){
    const box=$('#weekChart'),d=getData();
    if(!box||!d?.weeks?.length)return;
    const wk=d.weeks.slice(-8),vals=wk.map(x=>Number(x.attendance||0));
    const W=760,H=220,L=42,R=26,T=28,B=38,max=Math.max(10,...vals);
    const x=i=>L+(W-L-R)*(wk.length===1?0.5:i/(wk.length-1));
    const y=v=>T+(H-T-B)*(1-v/(max||1));
    const pts=vals.map((v,i)=>[x(i),y(v)]);
    const path=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area=path+` L ${pts[pts.length-1][0].toFixed(1)} ${H-B} L ${pts[0][0].toFixed(1)} ${H-B} Z`;
    const grid=[0,.25,.5,.75,1].map(f=>{const yy=T+(H-T-B)*f;return `<line class="gridline" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/>`}).join('');
    const dots=pts.map((p,i)=>`<circle class="point" cx="${p[0]}" cy="${p[1]}" r="4.6"/><text class="value" x="${p[0]}" y="${Math.max(15,p[1]-11)}" text-anchor="middle">${vals[i]}</text><text class="label" x="${p[0]}" y="${H-12}" text-anchor="middle">${String(wk[i].label||'').slice(0,5)}</text>`).join('');
    box.classList.add('modern-ready');
    box.innerHTML=`<svg class="modern-line-chart" viewBox="0 0 ${W} ${H}" aria-label="Evolução semanal de participações"><defs><linearGradient id="weeklyArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa" stop-opacity=".32"/><stop offset="100%" stop-color="#60a5fa" stop-opacity=".03"/></linearGradient></defs>${grid}<path class="area" d="${area}"/><path class="line" d="${path}"/>${dots}</svg>`;
    const card=box.closest('.card');
    if(card&&!card.querySelector('.modern-chart-legend')){const leg=document.createElement('div');leg.className='modern-chart-legend';leg.innerHTML='<span>Participações registradas por semana</span><b>Últimas 8 semanas</b>';card.insertBefore(leg,box)}
  }
  let t;
  function apply(){reorderTop();lineChart()}
  const obs=new MutationObserver(()=>{clearTimeout(t);t=setTimeout(apply,80)});
  obs.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',e=>{if(e.target.closest('.tab[data-tab="overview"]'))setTimeout(lineChart,100)});
  setTimeout(apply,350);
})();