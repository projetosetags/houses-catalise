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
      else out.push({date:'',subject:line});
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
    const cards=(list||[]).map(c=>({...c,_notices:notices(c).filter(active)})).filter(c=>c._notices.length);
    box.innerHTML=cards.length?cards.map(c=>{
      const body=c._notices.map(n=>`<div class="comm-row comm-notice"><span class="comm-date">${esc(n.date)}</span><span class="comm-subject">${esc(n.subject).replace(/\n/g,'<br>')}</span></div>`).join('');
      return `<article class="comm-card"><small>COMUNICAÇÕES</small><b>${esc(c.title)}</b><div class="comm-lines">${body}</div></article>`;
    }).join(''):(compact?'<div class="comm-card"><p>Nenhum comunicado para esta semana.</p></div>':'');
  };
  try{sessionStorage.removeItem('housesPublicCacheV2')}catch{}
})();