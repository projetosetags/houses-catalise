const endpoint='https://fra.cloud.appwrite.io/v1';
const projectId='6aabcd0b000c5d1298ab';
const origin='https://projetosetags.github.io';
const hostname='projetosetags.github.io';
const apiKey=process.env.APPWRITE_API_KEY||'';

function assert(ok,message){if(!ok)throw new Error(message)}
function adminHeaders(){return {'Content-Type':'application/json','X-Appwrite-Project':projectId,'X-Appwrite-Key':apiKey,'X-Appwrite-Response-Format':'2.0.0'}}

async function ensureWebPlatform(){
  if(!apiKey){console.log('DIAG: APPWRITE_API_KEY não disponível no smoke; pulando autorreparo da plataforma.');return}
  const list=await fetch(`${endpoint}/project/platforms`,{headers:adminHeaders()});
  const text=await list.text();
  if(!list.ok){console.log(`DIAG: não foi possível listar plataformas: HTTP ${list.status} ${text.slice(0,500)}`);return}
  let data={};try{data=JSON.parse(text)}catch{}
  const platforms=data.platforms||data.documents||[];
  console.log('DIAG: plataformas web:',platforms.map(p=>({id:p.$id||p.id,type:p.type,hostname:p.hostname,name:p.name})));
  const exists=platforms.some(p=>String(p.hostname||'').toLowerCase()===hostname);
  if(exists){console.log(`DIAG: plataforma ${hostname} já existe.`);return}
  const create=await fetch(`${endpoint}/project/platforms/web`,{
    method:'POST',headers:adminHeaders(),body:JSON.stringify({platformId:'github_pages',name:'Houses Catalise - GitHub Pages',hostname})
  });
  const body=await create.text();
  if(create.ok||create.status===409)console.log(`DIAG: plataforma ${hostname} criada/confirmada (HTTP ${create.status}).`);
  else console.log(`DIAG: falha ao criar plataforma: HTTP ${create.status} ${body.slice(0,500)}`);
}

async function inspectFunction(functionId){
  if(!apiKey)return;
  const r=await fetch(`${endpoint}/functions/${functionId}`,{headers:adminHeaders()});
  const text=await r.text();
  if(!r.ok){console.log(`DIAG: GET function ${functionId}: HTTP ${r.status} ${text.slice(0,500)}`);return}
  let f={};try{f=JSON.parse(text)}catch{}
  console.log(`DIAG: function ${functionId}:`,{id:f.$id||f.id,name:f.name,execute:f.execute,enabled:f.enabled,deploymentId:f.deploymentId,scopes:f.scopes});
}

async function preflight(functionId){
  const url=`${endpoint}/functions/${functionId}/executions`;
  const r=await fetch(url,{
    method:'OPTIONS',
    headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-appwrite-project,x-appwrite-response-format'}
  });
  const allow=r.headers.get('access-control-allow-origin')||'';
  console.log(`DIAG: preflight ${functionId}: HTTP ${r.status}; allow-origin=${allow||'ausente'}`);
  assert(r.ok||r.status===204,`CORS preflight falhou: HTTP ${r.status}`);
  assert(allow===origin||allow==='*',`Origem GitHub Pages não autorizada no preflight (allow-origin=${allow||'ausente'})`);
}

async function execute(functionId,path){
  const r=await fetch(`${endpoint}/functions/${functionId}/executions`,{
    method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json','X-Appwrite-Project':projectId,'X-Appwrite-Response-Format':'2.0.0'},
    body:JSON.stringify({body:'',async:false,path,method:'GET'})
  });
  const allow=r.headers.get('access-control-allow-origin')||'';
  const text=await r.text();
  console.log(`DIAG: POST ${functionId}: HTTP ${r.status}; allow-origin=${allow||'ausente'}; body=${text.slice(0,1200)}`);
  let execution={};try{execution=JSON.parse(text)}catch{}
  assert(r.ok,`${functionId}: execução não criada: ${execution.message||r.status}`);
  assert(allow===origin||allow==='*',`Resposta sem CORS para ${functionId} (allow-origin=${allow||'ausente'})`);
  const status=Number(execution.responseStatusCode)||0;
  let data={};try{data=JSON.parse(execution.responseBody||'{}')}catch{}
  assert(status>=200&&status<300,`${functionId}: API respondeu ${status}: ${data.error||execution.responseBody||''}`);
  return data;
}

await ensureWebPlatform();
await inspectFunction('houses-api');
await preflight('houses-api');
const pub=await execute('houses-api','/?public=1');
assert(pub?.config?.church_name==='Catalise Church','Configuração pública não foi retornada corretamente.');
console.log('SMOKE OK: Appwrite público + CORS + configuração Catalise Church.');
