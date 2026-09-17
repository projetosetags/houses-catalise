(()=>{
  const $=s=>document.querySelector(s);
  const todayISO=()=>{const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
  const br2iso=v=>{const m=String(v||'').match(/^(\d{2})\/(\d{2})\/(\d{2})$/);if(!m)return'';return `20${m[3]}-${m[2]}-${m[1]}`};
  const iso2br=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1].slice(2)}`:''};
  const stripDate=s=>String(s||'').replace(/^\s*\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\s*[-–—:]?\s*/,'').trim();

  function maskDate(inp){let v=inp.value.replace(/\D/g,'').slice(0,6);if(v.length>4)v=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);else if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);inp.value=v}

  function buildCommunicationForm(){
    const old=$('#commTitle');
    if(old&&old.tagName!=='SELECT'){
      const sel=document.createElement('select');sel.id='commTitle';sel.required=true;
      sel.innerHTML=`<option value="">Selecione o título</option><option>Agenda Tubarão</option><option>Agenda Braço do Norte</option><option>Aviso da Semana</option><option>Comunicado Pastoral</option><option>Evento Especial</option><option>Informação Importante</option>`;
      old.replaceWith(sel);
    }
    const form=$('#communicationForm'),msg=$('#commMessage'),start=$('#commStart'),end=$('#commEnd');
    if(msg){msg.placeholder='Assunto / comunicado (sem a data)';msg.rows=3}
    if(start&&!start.value)start.value=todayISO();
    if(form&&end&&!$('#commEventDate')){
      end.type='hidden';
      const wrap=document.createElement('label');wrap.className='comm-event-date-wrap';wrap.innerHTML='<span>Data do evento</span><input id="commEventDate" inputmode="numeric" maxlength="8" placeholder="dd/mm/aa" autocomplete="off" required>';
      msg.insertAdjacentElement('beforebegin',wrap);
      const vis=$('#commEventDate');if(end.value)vis.value=iso2br(end.value);
      vis.addEventListener('input',()=>{maskDate(vis);end.value=br2iso(vis.value)});
      vis.addEventListener('blur',()=>{const iso=br2iso(vis.value);vis.setCustomValidity(iso?'':'Use o formato dd/mm/aa');end.value=iso});
    }
    if(form&&!form.dataset.dateSeparated){
      form.dataset.dateSeparated='1';
      const oldRow=start?.closest('.two');if(oldRow)oldRow.style.display='none';
      form.addEventListener('submit',e=>{const vis=$('#commEventDate');if(vis){const iso=br2iso(vis.value);if(!iso){e.preventDefault();vis.setCustomValidity('Use o formato dd/mm/aa');vis.reportValidity();return}end.value=iso}if(msg)msg.value=stripDate(msg.value);setTimeout(()=>{if(start)start.value=todayISO();if(vis)vis.value='';if(end)end.value=''},700)});
    }
  }

  function decoratePublished(){
    const commRoot=$('#communicationsAdmin');
    if(commRoot){
      [...commRoot.querySelectorAll('.admin-item')].forEach((card,i)=>{
        card.classList.add('published-communication');
        const list=(typeof data!=='undefined'&&data?.communications)||[];const c=list[i];
        const p=card.querySelector('p');
        if(p&&c&&!p.querySelector('.admin-comm-date')){const d=iso2br(c.ends_on)||'--/--/--';p.innerHTML=`<span class="admin-comm-date">${d}</span><span class="admin-comm-subject">${esc(stripDate(c.message))}</span>`;p.classList.add('admin-comm-row')}
        const del=card.querySelector('.js-delete-comm');
        if(del&&!del.classList.contains('windows-close')){del.textContent='×';del.title='Excluir anúncio';del.setAttribute('aria-label','Excluir anúncio');del.classList.add('windows-close');const actions=del.closest('.admin-actions');card.appendChild(del);if(actions&&!actions.children.length)actions.remove()}
      });
    }
    const matRoot=$('#materialsAdmin');
    if(matRoot){[...matRoot.querySelectorAll('.admin-item')].forEach(card=>{card.classList.add('published-material');const del=card.querySelector('.js-delete-material');if(del&&!del.classList.contains('windows-close')){del.textContent='×';del.title='Excluir material';del.setAttribute('aria-label','Excluir material');del.classList.add('windows-close');card.appendChild(del)}})}
  }

  function headings(){const form=$('#communicationForm');const card=form?.closest('.card');if(card){const h=card.querySelector('h3');if(h)h.textContent='Publicar nova comunicação';const hint=card.querySelector('.hint');if(hint)hint.textContent='Escolha a agenda, informe a data no padrão dd/mm/aa e escreva o assunto/comunicado separadamente.'}}

  const style=document.createElement('style');style.textContent=`.comm-event-date-wrap{display:block;margin-bottom:10px}.comm-event-date-wrap>span{display:block;font-size:11px;font-weight:800;margin-bottom:5px;color:#cbd5e1}.comm-event-date-wrap input{font-variant-numeric:tabular-nums}.admin-comm-row{display:grid!important;grid-template-columns:72px 1fr;gap:9px;align-items:start}.admin-comm-date{font-weight:900;color:#f0c94f;font-variant-numeric:tabular-nums}.admin-comm-subject{min-width:0}@media(max-width:560px){.admin-comm-row{grid-template-columns:68px 1fr}}`;document.head.appendChild(style);

  let applying=false;function apply(){if(applying)return;applying=true;try{buildCommunicationForm();headings();decoratePublished()}finally{applying=false}}apply();
  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(apply,25)});const comm=$('#communicationsAdmin'),mats=$('#materialsAdmin');if(comm)observer.observe(comm,{subtree:true,childList:true});if(mats)observer.observe(mats,{subtree:true,childList:true});document.addEventListener('click',e=>{if(e.target.closest('.tab[data-tab="weekly"]'))setTimeout(apply,50)});
})();