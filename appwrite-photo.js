/* House Líderes — uma foto por reunião, armazenada no Appwrite. */
(()=>{
  const form=document.getElementById('report');
  if(!form)return;

  const notes=document.getElementById('notes')?.closest('label');
  if(!document.getElementById('meeting_photo')){
    const label=document.createElement('label');
    label.id='meetingPhotoField';
    label.innerHTML='Foto da reunião <small style="display:block;margin:4px 0 8px;opacity:.75">1 foto por encontro • JPG, PNG ou WEBP • até 8 MB</small><input id="meeting_photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment">';
    if(notes)notes.insertAdjacentElement('afterend',label);else form.querySelector('button[type="submit"]')?.insertAdjacentElement('beforebegin',label);
  }

  function toDataURL(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(reader.error||new Error('Não foi possível ler a foto'));
      reader.readAsDataURL(file);
    });
  }

  form.onsubmit=async e=>{
    e.preventDefault();
    const btn=e.submitter||form.querySelector('button[type="submit"]');
    btn.disabled=true;btn.textContent='Registrando…';
    const msg=document.getElementById('formMsg');msg.textContent='';
    try{
      const photo=document.getElementById('meeting_photo')?.files?.[0]||null;
      if(photo&&photo.size>8*1024*1024)throw new Error('A foto deve ter no máximo 8 MB.');
      if(photo&&!['image/jpeg','image/png','image/webp'].includes(photo.type))throw new Error('Use uma foto JPG, PNG ou WEBP.');
      const body={
        meeting_date:document.getElementById('meeting_date').value,
        status,
        attendance_total:status==='realizado'?+document.getElementById('attendance').value:0,
        first_time:status==='realizado'?+document.getElementById('first_time').value:0,
        children:status==='realizado'?+document.getElementById('children_input').value:0,
        decisions_for_jesus:status==='realizado'?+document.getElementById('decisions_input').value:0,
        cancellation_reason:status==='cancelado'?document.getElementById('reason').value:null,
        leader_message:document.getElementById('leader_message').value,
        notes:document.getElementById('notes').value,
        photo_data_url:photo?await toDataURL(photo):null,
        photo_name:photo?.name||null
      };
      const r=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Não foi possível registrar.');
      msg.textContent=status==='cancelado'?'Data adiada registrada. Obrigado por informar.':'Encontro registrado com sucesso!';
      const photoInput=document.getElementById('meeting_photo');if(photoInput)photoInput.value='';
      await load();
      setTimeout(()=>tab('inicio'),900);
    }catch(error){
      msg.textContent=error?.message||'Não foi possível registrar. Tente novamente.';
    }finally{
      btn.disabled=false;btn.textContent='Registrar';
    }
  };
})();
