(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateISO=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
  const sunday=d=>{const x=new Date(`${d}T12:00:00`);x.setDate(x.getDate()-x.getDay());return x};
  const fmt=d=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
  const short=d=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  const currentSunday=()=>sunday(dateISO(new Date()));
  function weekKey(m){return m.week_start?dateISO(sunday(m.week_start)):'sem-data'}
  function weekLabel(key){if(key==='sem-data')return 'Materiais sem período definido';const s=new Date(`${key}T12:00:00`),e=new Date(s);e.setDate(e.getDate()+6);return `Semana ${String(s.getDate()).padStart(2,'0')} a ${String(e.getDate()).padStart(2,'0')} de ${e.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`}
  const usable=v=>!!(v&&!/^data:[^,]*;base64,$/i.test(v));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bcolorido\b|\bp&b\b|\bpb\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  const isColor=m=>/colorid|com versicul/i.test(String(m.description||''))||/(?:^|[ _.-])c(?:[ _.-]|\.pdf$)/i.test(String(m.file_name||''));
  function guideKey(m){
    // Mesmo título + mesma semana = um único Guia, com variantes Original/Colorido.
    return `${weekKey(m)}|${norm(m.title)}`;
  }
  function mergeGuides(list){
    const map=new Map();
    (list||[]).forEach(m=>{
      const k=guideKey(m);
      if(!map.has(k))map.set(k,{base:m,original:null,colored:null});
      const g=map.get(k);
      if(isColor(m))g.colored=m; else g.original=m;
      // Prefere o P&B como registro-base; se ainda não houver, mantém o primeiro.
      if(!isColor(m))g.base=m;
    });
    return [...map.values()].map(g=>{
      const o=g.original,c=g.colored,b=g.base;
      const original=o?(o.download_url||o.material_url||o.view_url):'';
      const colored=c?(c.download_url||c.material_url||c.view_url):'';
      return {...b,
        original_download_url:original,
        colored_download_url:colored,
        colored_material_id:c?.id||'',
        allow_download:Boolean((o?.allow_download??true)||(c?.allow_download??true)),
        description:o?.description||b.description||''
      };
    });
  }
  function renderCard(m){
    const cat=m.category==='kids'?'Material Kids':m.category==='principal'?'Material Principal':m.category==='lideranca'?'Liderança':'Material';
    const original=m.original_download_url||'';
    const colored=m.colored_download_url||'';
    const hasOriginal=usable(original);
    const hasColored=usable(colored);
    const isPdf=m.mime_type==='application/pdf'||/\.pdf(?:$|\?)/i.test(String(original||colored||''));
    return `<article class="material-card week-material-card">
      <span class="cat">${esc(cat)}</span>
      <h3>${esc(m.title)}</h3>
      ${m.description?`<p>${esc(m.description)}</p>`:''}
      ${m.license_note?`<p class="material-warn">${esc(m.license_note)}</p>`:''}
      <div class="material-actions leader-downloads">
        ${hasOriginal?`<button type="button" class="solid js-direct-download" data-url="${esc(original)}">Baixar Original</button>`:`<button type="button" disabled>Baixar Original</button>`}
        ${hasColored?`<button type="button" class="solid js-direct-download" data-url="${esc(colored)}">Baixar Colorido</button>`:`<button type="button" disabled>Baixar Colorido</button>`}
        ${isPdf&&hasColored?`<button class="special js-personalize" type="button" data-material="${esc(m.colored_material_id||m.id)}" data-color-url="${esc(colored)}">Baixar com nome da House & Líderes</button>`:''}
      </div>
      ${!hasColored?`<small class="material-hint">Original P&B disponível. A versão colorida ainda não foi publicada.</small>`:''}
    </article>`;
  }
  window.renderMaterials=function(target,list){
    const box=$(target);if(!box)return;
    const guides=mergeGuides(list);
    const groups=new Map();
    guides.forEach(m=>{const k=weekKey(m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)});
    const keys=[...groups.keys()].sort((a,b)=>a==='sem-data'?1:b==='sem-data'?-1:b.localeCompare(a));
    const current=dateISO(currentSunday());
    box.innerHTML=keys.length?keys.map(k=>{
      const items=groups.get(k)||[],isCurrent=k===current;
      return `<section class="leader-week-group ${isCurrent?'current-week':''}"><div class="leader-week-head"><div><strong>${weekLabel(k)}</strong><small>${isCurrent?'SEMANA ATUAL':'PERÍODO'}</small></div><span>${items.length} ${items.length===1?'material':'materiais'}</span></div><div class="leader-week-items">${items.map(renderCard).join('')}</div></section>`;
    }).join(''):'<div class="empty-material">Nenhum material publicado.</div>';
  };
})();
document.addEventListener('click',e=>{
  const b=e.target.closest('.js-direct-download');if(!b)return;
  const a=document.createElement('a');a.href=b.dataset.url;a.download='';document.body.appendChild(a);a.click();a.remove();
});
