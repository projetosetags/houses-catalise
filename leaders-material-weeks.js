(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateISO=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
  const sunday=d=>{const x=new Date(`${d}T12:00:00`);x.setDate(x.getDate()-x.getDay());return x};
  const currentSunday=()=>sunday(dateISO(new Date()));
  function weekKey(m){return m.week_start?dateISO(sunday(m.week_start)):'sem-data'}
  function weekLabel(key){if(key==='sem-data')return 'Materiais sem período definido';const s=new Date(`${key}T12:00:00`),e=new Date(s);e.setDate(e.getDate()+6);return `Semana ${String(s.getDate()).padStart(2,'0')} a ${String(e.getDate()).padStart(2,'0')} de ${e.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`}
  const usable=v=>!!(v&&!/^data:[^,]*;base64,$/i.test(v));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bcolorido\b|\bp&b\b|\bpb\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  const isKids=m=>m.category==='kids'||/^kids\b|\bkids\b/i.test(String(m.title||''));
  const isColor=m=>/colorid|com versicul/i.test(String(m.description||''))||/(?:^|[ _.-])c(?:[ _.-]|\.pdf$)/i.test(String(m.file_name||''));
  function guideKey(m){return `${weekKey(m)}|${norm(m.title)}`}
  function urlOf(m){return m?(m.download_url||m.material_url||m.view_url||''):''}
  function mergeGuides(list){
    const out=[],map=new Map();
    (list||[]).forEach(m=>{
      if(isKids(m)){out.push({...m,_kids:true,single_download_url:urlOf(m)});return;}
      const k=guideKey(m);if(!map.has(k))map.set(k,{base:m,original:null,colored:null});
      const g=map.get(k);if(isColor(m))g.colored=m;else{g.original=m;g.base=m}
    });
    map.forEach(g=>{const o=g.original,c=g.colored,b=g.base;out.push({...b,original_download_url:urlOf(o),colored_download_url:urlOf(c),colored_material_id:c?.id||'',allow_download:Boolean((o?.allow_download??true)||(c?.allow_download??true)),description:o?.description||b.description||''})});
    return out;
  }
  function renderCard(m){
    const cat=isKids(m)?'Material Kids':m.category==='principal'?'Material Principal':m.category==='lideranca'?'Liderança':'Material';
    if(m._kids){const u=m.single_download_url||'';return `<article class="material-card week-material-card"><span class="cat">${esc(cat)}</span><h3>${esc(m.title)}</h3>${m.description?`<p>${esc(m.description)}</p>`:''}<div class="material-actions leader-downloads">${usable(u)?`<button type="button" class="solid js-direct-download" data-url="${esc(u)}">Baixar Material Kids</button>`:`<button type="button" disabled>Material indisponível</button>`}</div></article>`;}
    const original=m.original_download_url||'',colored=m.colored_download_url||'',hasOriginal=usable(original),hasColored=usable(colored);
    return `<article class="material-card week-material-card"><span class="cat">${esc(cat)}</span><h3>${esc(m.title)}</h3>${m.description?`<p>${esc(m.description)}</p>`:''}${m.license_note?`<p class="material-warn">${esc(m.license_note)}</p>`:''}<div class="material-actions leader-downloads">${hasOriginal?`<button type="button" class="solid js-direct-download" data-url="${esc(original)}">Baixar P&B</button>`:`<button type="button" disabled>Baixar P&B</button>`}${hasColored?`<button type="button" class="solid js-direct-download" data-url="${esc(colored)}">Baixar Colorido</button>`:`<button type="button" disabled>Colorido ainda não publicado</button>`}</div>${!hasColored?`<small class="material-hint">P&B disponível. O colorido aparecerá aqui quando estiver publicado.</small>`:''}</article>`;
  }
  window.renderMaterials=function(target,list){const box=$(target);if(!box)return;const guides=mergeGuides(list),groups=new Map();guides.forEach(m=>{const k=weekKey(m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)});const keys=[...groups.keys()].sort((a,b)=>a==='sem-data'?1:b==='sem-data'?-1:b.localeCompare(a)),current=dateISO(currentSunday());box.innerHTML=keys.length?keys.map(k=>{const items=groups.get(k)||[],isCurrent=k===current;if(isCurrent)return `<section class="leader-week-group current-week"><div class="leader-week-head"><div><strong>${weekLabel(k)}</strong><small>SEMANA ATUAL</small></div><span>${items.length} ${items.length===1?'material':'materiais'}</span></div><div class="leader-week-items">${items.map(renderCard).join('')}</div></section>`;return `<details class="leader-week-group archived-week"><summary class="leader-week-head"><div><strong>${weekLabel(k)}</strong><small>SEMANA ANTERIOR • TOQUE PARA ABRIR</small></div><span>${items.length} ${items.length===1?'material':'materiais'}</span></summary><div class="leader-week-items">${items.map(renderCard).join('')}</div></details>`}).join(''):'<div class="empty-material">Nenhum material publicado.</div>'};
})();
document.addEventListener('click',e=>{const b=e.target.closest('.js-direct-download');if(!b)return;e.preventDefault();const url=b.dataset.url;if(!url)return;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();});
