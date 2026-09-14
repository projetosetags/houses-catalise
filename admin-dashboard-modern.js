(()=>{
  const $=s=>document.querySelector(s);
  function reorderTop(){
    const app=$('#app'),hero=app?.querySelector(':scope>.hero'),nav=app?.querySelector(':scope>nav'),kpis=app?.querySelector(':scope>.kpis');
    if(!app||!hero||!nav||!kpis)return;
    if(nav.nextElementSibling!==kpis){app.insertBefore(nav,kpis)}
  }
  function lineChart(){
    const box=$('#weekChart'); if(!box||!window.data?.weeks?.length)return;
    const wk=window.data.weeks.slice(-8), vals=wk.map(x=>Number(x.attendance||0));
    const W=760,H=210,L=36,R=22,T=22,B=34, max=Math.max(10,...vals), min=0;
    const x=i=>L+(W-L-R)*(wk.length===1?0.5:i/(wk.length-1));
    const y=v=>T+(H-T-B)*(1-(v-min)/(max-min||1));
    const pts=vals.map((v,i)=>[x(i),y(v)]);
    const path=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area=path+` L ${pts[pts.length-1][0].toFixed(1)} ${H-B} L ${pts[0][0].toFixed(1)} ${H-B} Z`;
    const grid=[0,.25,.5,.75,1].map(f=>{const yy=T+(H-T-B)*f;return `<line class="gridline" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/>`}).join('');
    const dots=pts.map((p,i)=>`<circle class="point" cx="${p[0]}" cy="${p[1]}" r="4.8"/><text class="value" x="${p[0]}" y="${Math.max(12,p[1]-10)}" text-anchor="middle">${vals[i]}</text><text class="label" x="${p[0]}" y="${H-11}" text-anchor="middle">${String(wk[i].label||'').slice(0,5)}</text>`).join('');
    box.innerHTML=`<svg class="modern-line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Evolução semanal de participações"><defs><linearGradient id="weeklyArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d4a733" stop-opacity=".30"/><stop offset="100%" stop-color="#d4a733" stop-opacity=".02"/></linearGradient></defs>${grid}<path class="area" d="${area}"/><path class="line" d="${path}"/>${dots}</svg>`;
    const card=box.closest('.card');if(card&&!card.querySelector('.modern-chart-legend')){const leg=document.createElement('div');leg.className='modern-chart-legend';leg.innerHTML='<span>Participações registradas por semana</span><b>Tendência das últimas 8 semanas</b>';card.insertBefore(leg,box)}
  }
  let t;
  function apply(){reorderTop();lineChart()}
  const obs=new MutationObserver(()=>{clearTimeout(t);t=setTimeout(apply,60)});
  obs.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',e=>{if(e.target.closest('.tab[data-tab="overview"]'))setTimeout(lineChart,80)});
  setTimeout(apply,250);
})();