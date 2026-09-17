async function uploadMaterialForm(fd){return HousesAppwrite.uploadMaterial(fd,pct=>{const p=document.getElementById('uploadProgress');if(p)p.textContent='Enviando: '+pct+'%';});}
function setupWeeklyUpload(){
  const form=document.getElementById('weeklyMaterialForm');
  if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();
    const file=document.getElementById('weeklyMaterialFile').files[0],progress=document.getElementById('uploadProgress');
    if(!file)return;
    if(file.size>20*1024*1024){progress.textContent='Arquivo acima de 20 MB. Comprima antes de publicar.';progress.className='hint upload-error';return;}
    const btn=e.submitter||form.querySelector('button[type="submit"],button');
    if(btn){btn.disabled=true;btn.textContent='Enviando…'}
    progress.textContent='Enviando para armazenamento protegido…';progress.className='hint';
    try{
      const fd=new FormData();
      fd.append('file',file);
      fd.append('title',document.getElementById('weeklyMaterialTitle').value);
      fd.append('description',document.getElementById('weeklyMaterialDescription').value);
      fd.append('week_start',document.getElementById('weeklyMaterialWeek').value||'');
      fd.append('category',document.getElementById('weeklyMaterialCategory').value);
      fd.append('personalization_mode',document.getElementById('weeklyMaterialPersonalization').value);
      fd.append('network_id',document.getElementById('weeklyMaterialNetwork').value||'');
      fd.append('house_id',document.getElementById('weeklyMaterialHouse').value||'');
      fd.append('license_note',document.getElementById('weeklyMaterialLicense').value);
      fd.append('allow_download',document.getElementById('weeklyMaterialDownload').checked?'true':'false');
      await uploadMaterialForm(fd);
      progress.textContent='Material enviado e publicado com sucesso.';progress.className='hint upload-ok';
      form.reset();document.getElementById('weeklyMaterialDownload').checked=true;setDefaultWeekStart();
      await load();decorateExistingMaterials();renderPastoralWeek();
    }catch(err){progress.textContent='Erro: '+err.message;progress.className='hint upload-error'}
    finally{if(btn){btn.disabled=false;btn.textContent='Enviar e publicar'}}
  };
}
function decorateExistingMaterials(){
  const root=document.getElementById('materialsAdmin');if(!root)return;
  root.querySelectorAll('.admin-item').forEach(card=>{
    if(card.querySelector('.js-link-file'))return;
    const del=card.querySelector('.js-delete-material');if(!del)return;
    const id=del.dataset.id;
    const wrap=document.createElement('div');wrap.className='admin-actions';
    wrap.innerHTML=`<input class="js-link-file" data-id="${id}" type="file" accept="application/pdf,image/jpeg,image/png" style="max-width:240px"><button type="button" class="js-link-upload" data-id="${id}">Vincular arquivo</button><span class="js-link-status" data-id="${id}"></span>`;
    card.appendChild(wrap);
  });
}
const mo=new MutationObserver(()=>decorateExistingMaterials());
const target=document.getElementById('materialsAdmin');if(target)mo.observe(target,{childList:true,subtree:true});
document.addEventListener('click',async e=>{
  const b=e.target.closest('.js-link-upload');if(!b)return;
  e.preventDefault();e.stopPropagation();
  const id=b.dataset.id,input=document.querySelector(`.js-link-file[data-id="${id}"]`),status=document.querySelector(`.js-link-status[data-id="${id}"]`),file=input?.files?.[0];
  if(!file){if(status)status.textContent='Selecione o arquivo.';return;}
  if(file.size>20*1024*1024){if(status)status.textContent='Máximo 20 MB.';return;}
  b.disabled=true;b.textContent='Vinculando…';if(status)status.textContent='';
  try{const fd=new FormData();fd.append('material_id',id);fd.append('file',file);await uploadMaterialForm(fd);if(status)status.textContent='Arquivo vinculado.';await load();decorateExistingMaterials();renderPastoralWeek();}
  catch(err){if(status)status.textContent='Erro: '+err.message;}
  finally{b.disabled=false;b.textContent='Vincular arquivo';}
});
function sundayOfWeek(d=new Date()){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-x.getDay());return x}
function dateISO(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function dateLong(d){return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}
function renderPastoralWeek(){
  const weekly=document.getElementById('weekly');if(!weekly)return;
  let head=weekly.querySelector('.pastoral-week-head');
  if(!head){head=document.createElement('section');head.className='pastoral-week-head';weekly.prepend(head)}
  const start=sundayOfWeek(),end=new Date(start);end.setDate(start.getDate()+6);
  const labels=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'],today=dateISO(new Date());
  const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return `<div class="pastoral-day ${dateISO(d)===today?'today':''}"><small>${labels[i]}</small><b>${String(d.getDate()).padStart(2,'0')}</b></div>`}).join('');
  const html=`<div class="week-title"><div class="week-logo"></div><div><h2>Central da Semana</h2><p class="week-range">Domingo, ${dateLong(start)} a sábado, ${dateLong(end)}</p></div></div><div class="pastoral-days">${days}</div>`;
  if(head.innerHTML!==html)head.innerHTML=html;
  const commTitle=document.querySelector('#communicationsAdmin')?.previousElementSibling;if(commTitle&&commTitle.tagName==='H3')commTitle.textContent='Anúncios e avisos da semana';
  const matTitle=document.querySelector('#materialsAdmin')?.previousElementSibling;if(matTitle&&matTitle.tagName==='H3')matTitle.textContent='Palavras e materiais da semana';
}
function setDefaultWeekStart(){const field=document.getElementById('weeklyMaterialWeek');if(field&&!field.value)field.value=dateISO(sundayOfWeek())}
setupWeeklyUpload();decorateExistingMaterials();renderPastoralWeek();setDefaultWeekStart();

/* Redes pastorais: exibe os cadastros criados na implantação do Appwrite. */
function pastoralNetworkNumber(name){const m=String(name||'').match(/(\d+)/);return m?Number(m[1]):999}
function pastoralUniqueLeaders(list){const seen=new Set();return list.filter(v=>{const k=String(v||'').trim().toLocaleLowerCase('pt-BR');if(!k||seen.has(k))return false;seen.add(k);return true})}
function installPastoralNetworkStyles(){
  if(document.getElementById('pastoralNetworkStyles'))return;
  const s=document.createElement('style');s.id='pastoralNetworkStyles';s.textContent=`
  #networkList{display:grid;gap:12px}
  .network-accordion{border:1px solid rgba(218,175,67,.28);border-radius:18px;background:linear-gradient(180deg,rgba(24,34,47,.96),rgba(16,25,39,.96));overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,.14)}
  .network-accordion summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;min-height:72px}
  .network-accordion summary::-webkit-details-marker{display:none}
  .network-accordion summary:hover{background:rgba(218,175,67,.06)}
  .network-summary-main{display:flex;flex-direction:column;gap:5px}
  .network-summary-main b{font-size:18px;color:#fff}
  .network-summary-main small{color:#aab7c8;font-size:13px}
  .network-chevron{font-size:24px;color:#e4bb4b;transition:transform .2s ease}
  .network-accordion[open] .network-chevron{transform:rotate(180deg)}
  .network-accordion-body{border-top:1px solid rgba(255,255,255,.07);padding:16px 20px 20px}
  .network-leaders-title{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d9b24d;margin-bottom:10px}
  .network-leader-row{display:grid;grid-template-columns:minmax(110px,.7fr) minmax(0,2fr);gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06)}
  .network-leader-row:last-child{border-bottom:0}
  .network-house{font-size:13px;color:#9fb0c5}
  .network-leader-names{font-weight:700;color:#f7f8fa}
  .network-leaders-blank{min-height:22px}
  @media(max-width:640px){.network-accordion summary{padding:15px 16px}.network-accordion-body{padding:14px 16px 18px}.network-leader-row{grid-template-columns:1fr;gap:4px}}
  `;document.head.appendChild(s);
}
function renderPastoralNetworks(snapshot=data){
  const root=document.getElementById('networkList');if(!root||!snapshot)return;
  installPastoralNetworkStyles();
  const networks=(snapshot.networks||[]).slice().sort((a,b)=>pastoralNetworkNumber(a.name)-pastoralNetworkNumber(b.name)||String(a.name).localeCompare(String(b.name),'pt-BR'));
  const metrics=snapshot.byNetwork||[];
  const houses=(snapshot.houses||[]).filter(h=>h.active!==false);
  root.innerHTML=networks.map(n=>{
    const nh=houses.filter(h=>h.network_id===n.id);
    const metric=metrics.find(m=>m.id===n.id)||{};
    const rows=nh.map(h=>{
      const leaders=pastoralUniqueLeaders([...(h.leader_full_names||[]),...(h.leader_names||[])]);
      if(!leaders.length)return '';
      return `<div class="network-leader-row"><span class="network-house">${esc(h.code||'')} • ${esc(h.name||'')}</span><span class="network-leader-names">${leaders.map(esc).join(' • ')}</span></div>`;
    }).filter(Boolean).join('');
    return `<details class="network-accordion"><summary><span class="network-summary-main"><b>${esc(n.name)}</b><small>${nh.length} ${nh.length===1?'House':'Houses'} • regularidade ${metric.regularity_pct||0}%</small></span><span class="network-chevron">⌄</span></summary><div class="network-accordion-body"><div class="network-leaders-title">Líderes vinculados</div>${rows||'<div class="network-leaders-blank"></div>'}</div></details>`;
  }).join('')||'<div class="card">Nenhuma Rede.</div>';
}
async function ensurePastoralNetworks(){if(data)renderPastoralNetworks(data);}
const pastoralNetworkRoot=document.getElementById('networkList');
if(pastoralNetworkRoot)new MutationObserver(()=>{if(data&&!pastoralNetworkRoot.querySelector('.network-accordion'))setTimeout(()=>renderPastoralNetworks(data),0)}).observe(pastoralNetworkRoot,{childList:true});
document.addEventListener('click',e=>{if(e.target.closest('.tab[data-tab="networks"]'))setTimeout(()=>renderPastoralNetworks(data),60)});
setTimeout(ensurePastoralNetworks,350);