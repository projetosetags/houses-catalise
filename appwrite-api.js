/* Houses Catalise — cliente público para executar as Functions do Appwrite.
   Não contém API key. A chave de infraestrutura fica somente no GitHub Actions. */
(()=>{
  const endpoint='https://fra.cloud.appwrite.io/v1';
  const projectId='6aabcd0b000c5d1298ab';

  async function execute(functionId,{method='GET',path='/',body=''}={}){
    const payload={
      body:typeof body==='string'?body:JSON.stringify(body||{}),
      async:false,
      path,
      method
    };
    const response=await fetch(`${endpoint}/functions/${encodeURIComponent(functionId)}/executions`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Appwrite-Project':projectId,
        'X-Appwrite-Response-Format':'2.0.0'
      },
      body:JSON.stringify(payload),
      cache:'no-store'
    });
    const execution=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(execution.message||`Erro Appwrite ${response.status}`);
    const status=Number(execution.responseStatusCode)||500;
    let data=null;
    try{data=JSON.parse(execution.responseBody||'null')}catch{data={error:execution.responseBody||execution.errors||'Resposta inválida'}}
    if(status<200||status>=300)throw new Error(data?.error||`Erro da API (${status})`);
    return data;
  }

  async function houseGet(query=''){return execute('houses-api',{method:'GET',path:`/${query}`})}
  async function housePost(query='',body={}){return execute('houses-api',{method:'POST',path:`/${query}`,body})}
  async function pastoralGet(query=''){return execute('pastoral-api',{method:'GET',path:`/${query}`})}
  async function pastoralPost(query='',body={}){return execute('pastoral-api',{method:'POST',path:`/${query}`,body})}

  window.HousesAppwrite={endpoint,projectId,execute,houseGet,housePost,pastoralGet,pastoralPost};
})();
