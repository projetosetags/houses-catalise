(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parseDateLine=line=>{
    const raw=String(line||'').trim();
    const m=raw.match(/^\s*(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?\s*(?:[|\-–—:]\s*)?(.*)$/);
    if(!m)return null;
    const dd=String(m[1]).padStart(2,'0'),mm=String(m[2]).padStart(2,'0'),yy=m[3]?String(m[3]).slice(-2):String(new Date().getFullYear()).slice(-2);
    return {date:`${dd}/${mm}/${yy}`,subject:(m[4]||'').trim()};
  };
  const notices=c=>{
    const out=[];
    for(const raw of String(c?.message||'').split(/\r?\n/)){
      const line=raw.trim(); if(!line)continue;
      const d=parseDateLine(line);
      if(d)out.push(d);
      else if(out.length)out[out.length-1].subject+=(out[out.length-1].subject?'\n':'')+line;
      else {const m=String(c.ends_on||'').match(/^(\d{4})-(\d{2})-(\d{2})/);out.push({date:m?`${m[3]}/${m[2]}/${m[1].slice(2)}`:'',subject:line});}
    }
    return out;
  };
  const active=n=>{
    if(!n.date)return true;
    const m=n.date.match(/^(\d{2})\/(\d{2})\/(\d{2})$/); if(!m)return true;
    const d=new Date(2000+Number(m[3]),Number(m[2])-1,Number(m[1])); d.setHours(0,0,0,0);
    const t=new Date(); t.setHours(0,0,0,0); return d>=t;
  };
  window.renderCommunications=function(target,list,compact=false){
    const box=document.querySelector(target); if(!box)return;
    const grouped=new Map();
    for(const c of list||[]){
      const rows=notices(c).filter(active);
      if(!rows.length)continue;
      const title=String(c.title||'Agenda').trim();
      const key=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
      if(!grouped.has(key))grouped.set(key,{title,_notices:[]});
      grouped.get(key)._notices.push(...rows);
    }
    const order=n=>n.date?n.date.split('/').reverse().join('-'):'';
    const cards=[...grouped.values()].map(c=>({...c,_notices:c._notices.sort((a,b)=>order(a).localeCompare(order(b)))}));
    box.innerHTML=cards.length?cards.map(c=>{
      const body=c._notices.map(n=>`<div class="comm-row comm-notice"><span class="comm-date">${esc(n.date)}</span><span class="comm-subject">${esc(n.subject).replace(/\n/g,'<br>')}</span></div>`).join('');
      return `<article class="comm-card"><small>COMUNICAÇÕES</small><b>${esc(c.title)}</b><div class="comm-lines">${body}</div></article>`;
    }).join(''):(compact?'<div class="comm-card"><p>Nenhum comunicado para esta semana.</p></div>':'');
  };
  try{sessionStorage.removeItem('housesPublicCacheV2')}catch{}
})();