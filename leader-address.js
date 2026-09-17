(()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='leader-address.css?v=20260914-2';document.head.appendChild(css);
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function profile(){return data?.house_profile||null}
  function mapsUrl(addr){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
  function wazeUrl(addr){return `https://www.waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`}
  function mount(){
    const host=$('#houseFullProfile'); if(!host||$('#leaderAddressEditor')) return;
    const p=profile(); if(!p) return;
    const wrap=document.createElement('section'); wrap.id='leaderAddressEditor'; wrap.className='address-editor';
    wrap.innerHTML=`<h3>Endereço da House</h3><p class="address-hint">Rua/Av, nº, bairro, CEP e Cidade/UF.</p><form id="addressForm" class="address-form"><div class="address-line"><input id="addrStreet" placeholder="Rua/Av, nº" value="${esc(p.address_line||'')}"><input id="addrNeighborhood" placeholder="Bairro" value="${esc(p.neighborhood||'')}"><input id="addrPostal" placeholder="CEP" value="${esc(p.postal_code||'')}"><input id="addrCity" placeholder="Cidade" value="${esc(p.city||'')}"><input id="addrState" placeholder="UF" maxlength="2" value="${esc(p.state||'SC')}"><button type="submit" class="address-save">Salvar</button></div><p id="addressMsg" class="address-msg"></p></form><div class="route-actions"><button type="button" id="openWaze">Abrir no Waze</button><button type="button" id="openMaps">Abrir no Google Maps</button></div>`;
    host.insertAdjacentElement('afterend',wrap);
    $('#addressForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter,msg=$('#addressMsg');btn.disabled=true;msg.textContent='Salvando…';try{const body={action:'update_address',address_line:$('#addrStreet').value,neighborhood:$('#addrNeighborhood').value,postal_code:$('#addrPostal').value,city:$('#addrCity').value,state:$('#addrState').value};const j=await HousesFirebase.request('update_address',{...body,house_id:houseId});if(j.house_profile)data.house_profile={...data.house_profile,...j.house_profile};msg.textContent='Endereço atualizado.';setTimeout(()=>msg.textContent='',2500)}catch(err){msg.textContent=err.message}finally{btn.disabled=false}};
    const current=()=>[$('#addrStreet').value,$('#addrNeighborhood').value,$('#addrPostal').value,$('#addrCity').value&&$('#addrState').value?`${$('#addrCity').value}/${$('#addrState').value}`:$('#addrCity').value||$('#addrState').value].filter(Boolean).join(', ');
    $('#openWaze').onclick=()=>{const a=current();if(a)window.open(wazeUrl(a),'_blank')};
    $('#openMaps').onclick=()=>{const a=current();if(a)window.open(mapsUrl(a),'_blank')};
  }
  const obs=new MutationObserver(()=>mount()); obs.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',e=>{if(e.target.closest('.go-house')||e.target.closest('[data-tab="housePanel"]'))setTimeout(mount,80)});
  setTimeout(mount,600);
})();