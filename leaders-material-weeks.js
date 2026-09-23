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
  function renderCard(m){
    const cat=m.category==='kids'?'Material Kids':m.category==='principal'?'Material Principal':m.category==='lideranca'?'Liderança':'Material';
    const view=m.view_url||m.material_url,down=m.download_url||m.material_url;
    const usable=v=>!!(v&&!/^data:[^,]*;base64,$/i.test(v));
    const hasView=usable(view),hasDown=m.allow_download&&usable(down),canPers=m.mime_type==='application/pdf'&&m.personalization_mode&&m.personalization_mode!=='none'&&hasView;
    const isPdf=m.mime_type==='application/pdf'||/\.pdf(?:$|\?)/i.test(String(view||''));
    const originalActions=`${hasView?`<button type="button" class="js-material-view" data-material="${m.id}">Visualizar original</button>`:'<button disabled>Arquivo em processamento</button>'}${hasDown?`<button type="button" class="solid js-material-download" data-material="${m.id}">Baixar original</button>`:''}`;
    const colorView=m.color_view_url||m.colored_pdf_url||m.color_url||'';
    const colorDown=m.color_download_url||colorView;
    const hasColor=usable(colorView);
    const colorPanel=isPdf?`<div class="pdf-color-panel"><div class="pdf-color-title"><b>PDF Colorido + Versículos</b><small>Padrão oficial House: página 1 colorida + versículos completos na página 2</small></div><div class="material-actions">${hasColor?`<button type="button" class="js-color-view" data-url="${esc(colorView)}">Visualizar colorido</button><button type="button" class="solid js-color-download" data-url="${esc(colorDown)}">Baixar colorido</button>`:`<button type="button" class="special js-color-pdf" data-material="${m.id}">Preparar colorido</button>`}</div><small class="js-color-status" data-material="${m.id}">${hasColor?'Versão colorida pronta.':'Aguardando a versão colorida deste Guia.'}</small></div>`:'';
    return `<article class="material-card week-material-card"><span class="cat">${esc(cat)}</span><h3>${esc(m.title)}</h3>${m.description?`<p>${esc(m.description)}</p>`:''}${m.license_note?`<p class="material-warn">${esc(m.license_note)}</p>`:''}<div class="pdf-choice"><section class="pdf-original-panel"><b>PDF Original (P&B)</b><small>Arquivo enviado pelo Houses Pastores</small><div class="material-actions">${originalActions}</div></section>${colorPanel}</div>${canPers?`<div class="material-actions"><button class="special js-personalize" type="button" data-material="${m.id}">Baixar para minha House</button></div>`:''}</article>`;
  }
  window.renderMaterials=function(target,list){
    const box=$(target);if(!box)return;
    const groups=new Map();
    (list||[]).forEach(m=>{const k=weekKey(m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)});
    const keys=[...groups.keys()].sort((a,b)=>a==='sem-data'?1:b==='sem-data'?-1:b.localeCompare(a));
    const current=dateISO(currentSunday());
    box.innerHTML=keys.length?keys.map(k=>{
      const items=groups.get(k)||[],isCurrent=k===current;
      return `<section class="leader-week-group ${isCurrent?'current-week':''}"><div class="leader-week-head"><div><strong>${weekLabel(k)}</strong><small>${isCurrent?'SEMANA ATUAL':'PERÍODO'}</small></div><span>${items.length} ${items.length===1?'material':'materiais'}</span></div><div class="leader-week-items">${items.map(renderCard).join('')}</div></section>`;
    }).join(''):'<div class="empty-material">Nenhum material publicado.</div>';
  };
})();
document.addEventListener('click',async e=>{
  const view=e.target.closest('.js-color-view');if(view){window.open(view.dataset.url,'_blank','noopener');return}
  const down=e.target.closest('.js-color-download');if(down){const a=document.createElement('a');a.href=down.dataset.url;a.download='';document.body.appendChild(a);a.click();a.remove();return}
  const b=e.target.closest('.js-color-pdf');if(!b)return;
  const id=b.dataset.material,status=document.querySelector('.js-color-status[data-material="'+id+'"]');
  if(status)status.textContent='A versão colorida é publicada junto ao Guia pelo Houses Pastores.';
});
