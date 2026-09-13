const MATERIAL_UPLOAD_API='https://zvutbyenkkaqyzgmhwew.supabase.co/functions/v1/material-upload';
async function uploadMaterialForm(fd){
  const r=await fetch(`${MATERIAL_UPLOAD_API}?token=${encodeURIComponent(token||'')}`,{method:'POST',body:fd});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||'Erro ao enviar arquivo');
  return j;
}
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