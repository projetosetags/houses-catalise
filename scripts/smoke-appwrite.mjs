const endpoint='https://fra.cloud.appwrite.io/v1';
const projectId='6aabcd0b000c5d1298ab';
const origin='https://projetosetags.github.io';

function assert(ok,message){if(!ok)throw new Error(message)}

async function preflight(functionId){
  const url=`${endpoint}/functions/${functionId}/executions`;
  const r=await fetch(url,{
    method:'OPTIONS',
    headers:{
      Origin:origin,
      'Access-Control-Request-Method':'POST',
      'Access-Control-Request-Headers':'content-type,x-appwrite-project,x-appwrite-response-format'
    }
  });
  const allow=r.headers.get('access-control-allow-origin')||'';
  assert(r.ok||r.status===204,`CORS preflight falhou: HTTP ${r.status}`);
  assert(allow===origin||allow==='*',`Origem GitHub Pages não autorizada no Appwrite (allow-origin=${allow||'ausente'})`);
}

async function execute(functionId,path){
  const r=await fetch(`${endpoint}/functions/${functionId}/executions`,{
    method:'POST',
    headers:{
      Origin:origin,
      'Content-Type':'application/json',
      'X-Appwrite-Project':projectId,
      'X-Appwrite-Response-Format':'2.0.0'
    },
    body:JSON.stringify({body:'',async:false,path,method:'GET'})
  });
  const allow=r.headers.get('access-control-allow-origin')||'';
  assert(allow===origin||allow==='*',`Resposta sem CORS para ${functionId} (allow-origin=${allow||'ausente'})`);
  const execution=await r.json().catch(()=>({}));
  assert(r.ok,`${functionId}: execução não criada: ${execution.message||r.status}`);
  const status=Number(execution.responseStatusCode)||0;
  let data={};
  try{data=JSON.parse(execution.responseBody||'{}')}catch{}
  assert(status>=200&&status<300,`${functionId}: API respondeu ${status}: ${data.error||execution.responseBody||''}`);
  return data;
}

await preflight('houses-api');
const pub=await execute('houses-api','/?public=1');
assert(pub?.config?.church_name==='Catalise Church','Configuração pública não foi retornada corretamente.');
console.log('SMOKE OK: Appwrite público + CORS + configuração Catalise Church.');
