/* Mantém os avisos do Houses Pastores iguais aos avisos públicos do House Líderes. */
(()=>{
  const ENDPOINT='https://fra.cloud.appwrite.io/v1';
  const PROJECT='6aabcd0b000c5d1298ab';
  async function currentCommunications(){
    const payload={body:'',async:false,path:'/?public=1&refresh=1',method:'GET'};
    const r=await fetch(ENDPOINT+'/functions/houses-api/executions',{method:'POST',headers:{'Content-Type':'application/json','X-Appwrite-Project':PROJECT,'X-Appwrite-Response-Format':'2.0.0'},body:JSON.stringify(payload),cache:'no-store'});
    const ex=await r.json().catch(()=>({}));
    if(!r.ok||Number(ex.responseStatusCode)!==200)throw new Error('Falha ao atualizar avisos');
    const j=JSON.parse(ex.responseBody||'{}');
    return Array.isArray(j.communications)?j.communications:[];
  }
  async function sync(){
    if(!window.data)return;
    try{
      const list=await currentCommunications();
      window.data.communications=list;
      if(typeof renderWeekly==='function')renderWeekly();
      document.dispatchEvent(new CustomEvent('houses-communications-synced'));
    }catch(e){console.warn('Avisos: usando dados já carregados.',e)}
  }
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(window.data){clearInterval(timer);sync()}
    else if(tries>40)clearInterval(timer);
  },250);
  document.getElementById('reload')?.addEventListener('click',()=>setTimeout(sync,700));
  document.querySelector('.tab[data-tab="weekly"]')?.addEventListener('click',()=>setTimeout(sync,100));
})();
