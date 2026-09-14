(()=>{
  const $=s=>document.querySelector(s);
  const todayISO=()=>{const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};

  function buildCommunicationForm(){
    const old=$('#commTitle');
    if(old&&old.tagName!=='SELECT'){
      const sel=document.createElement('select');
      sel.id='commTitle';sel.required=true;
      sel.innerHTML=`<option value="">Selecione o título</option><option>Agenda Tubarão</option><option>Agenda Braço do Norte</option><option>Aviso da Semana</option><option>Comunicado Pastoral</option><option>Evento Especial</option><option>Informação Importante</option>`;
      old.replaceWith(sel);
    }
    const msg=$('#commMessage');
    if(msg){msg.placeholder='Assunto / comunicado';msg.rows=3}
    const start=$('#commStart'),end=$('#commEnd');
    if(start){start.value=start.value||todayISO();start.min=todayISO();start.setAttribute('aria-label','Início da visualização')}
    if(end){end.min=start?.value||todayISO();end.setAttribute('aria-label','Data do evento / fim da visualização')}
    const form=$('#communicationForm');
    if(form&&!form.querySelector('.comm-date-caption')){
      const dateRow=start?.closest('.two');
      if(dateRow){
        dateRow.classList.add('comm-date-row');
        dateRow.insertAdjacentHTML('beforebegin','<div class="comm-date-caption"><b>Período de visualização</b><span>Do dia do registro até a data do evento</span></div>');
        start.insertAdjacentHTML('beforebegin','<span class="field-label">Início</span>');
        end.insertAdjacentHTML('beforebegin','<span class="field-label">Evento / término</span>');
      }
      form.addEventListener('submit',()=>setTimeout(()=>{const s=$('#commStart'),e=$('#commEnd');if(s&&!s.value)s.value=todayISO();if(s)s.min=todayISO();if(e)e.min=s?.value||todayISO()},700));
    }
    if(end&&!end.dataset.bound){end.dataset.bound='1';end.addEventListener('change',()=>{if(start&&!start.value)start.value=todayISO();if(start&&end.value&&end.value<start.value)end.value=start.value})}
  }

  function decoratePublished(){
    const commRoot=$('#communicationsAdmin');
    if(commRoot){
      [...commRoot.querySelectorAll('.admin-item')].forEach(card=>{
        card.classList.add('published-communication');
        const del=card.querySelector('.js-delete-comm');
        if(del){del.textContent='×';del.title='Excluir anúncio';del.setAttribute('aria-label','Excluir anúncio');del.classList.add('windows-close');const actions=del.closest('.admin-actions');if(actions){card.appendChild(del);if(!actions.children.length)actions.remove()}}
      });
    }
    const matRoot=$('#materialsAdmin');
    if(matRoot){
      [...matRoot.querySelectorAll('.admin-item')].forEach(card=>{
        card.classList.add('published-material');
        const del=card.querySelector('.js-delete-material');
        if(del){del.textContent='×';del.title='Excluir material';del.setAttribute('aria-label','Excluir material');del.classList.add('windows-close');card.appendChild(del)}
      });
    }
  }

  function headings(){
    const form=$('#communicationForm');
    const card=form?.closest('.card');
    if(card){const h=card.querySelector('h3');if(h)h.textContent='Publicar nova comunicação';const hint=card.querySelector('.hint');if(hint)hint.textContent='Escolha a agenda, informe o assunto e a data do evento. A visualização começa hoje e termina no dia do evento.'}
  }

  function apply(){buildCommunicationForm();headings();decoratePublished()}
  apply();
  const observer=new MutationObserver(()=>apply());
  const weekly=$('#weekly');if(weekly)observer.observe(weekly,{subtree:true,childList:true});
  document.addEventListener('click',e=>{if(e.target.closest('.tab[data-tab="weekly"]'))setTimeout(apply,50)});
})();