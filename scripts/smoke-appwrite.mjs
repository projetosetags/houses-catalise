const endpoint='https://fra.cloud.appwrite.io/v1';
const projectId='6aabcd0b000c5d1298ab';
const origin='https://projetosetags.github.io';
const hostname='projetosetags.github.io';
const platformId='houses_github_pages_2026';
const apiKey=process.env.APPWRITE_API_KEY||'';

function assert(ok,message){if(!ok)throw new Error(message)}
function adminHeaders(){return {'Content-Type':'application/json','X-Appwrite-Project':projectId,'X-Appwrite-Key':apiKey,'X-Appwrite-Response-Format':'2.0.0'}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function ensureWebPlatform(){
  if(!apiKey){console.log('DIAG: APPWRITE_API_KEY não disponível no smoke; pulando autorreparo da plataforma.');return}
  const get=await fetch(`${endpoint}/project/platforms/${platformId}`,{headers:adminHeaders()});
  const getText=await get.text();
  if(get.ok){
    let p={};try{p=JSON.parse(getText)}catch{}
    console.log('DIAG: plataforma dedicada encontrada:',{id:p.$id||p.id,type:p.type,hostname:p.hostname,name:p.name});
    if(String(p.hostname||'').toLowerCase()!==hostname||p.type!=='web'){
      const up=await fetch(`${endpoint}/project/platforms/web/${platformId}`,{method:'PUT',headers:adminHeaders(),body:JSON.stringify({name:'Houses Catalise - GitHub Pages',hostname})});
      const upText=await up.text();
      assert(up.ok,`Não foi possível atualizar plataforma web: HTTP ${up.status} ${upText.slice(0,500)}`);
      console.log('DIAG: plataforma dedicada atualizada para',hostname);
    }
  }else if(get.status===404){
    const create=await fetch(`${endpoint}/project/platforms/web`,{method:'POST',headers:adminHeaders(),body:JSON.stringify({platformId,name:'Houses Catalise - GitHub Pages',hostname})});
    const body=await create.text();
    assert(create.ok,`Não foi possível criar plataforma web dedicada: HTTP ${create.status} ${body.slice(0,500)}`);
    console.log(`DIAG: plataforma web dedicada criada: ${hostname}`);
  }else throw new Error(`Não foi possível consultar plataforma web: HTTP ${get.status} ${getText.slice(0,500)}`);
  await sleep(1200);
}

async function inspectFunction(functionId){
  if(!apiKey)return;
  const r=await fetch(`${endpoint}/functions/${functionId}`,{headers:adminHeaders()});
  const text=await r.text();
  if(!r.ok){console.log(`DIAG: GET function ${functionId}: HTTP ${r.status} ${text.slice(0,500)}`);return}
  let f={};try{f=JSON.parse(text)}catch{}
  console.log(`DIAG: function ${functionId}:`,{id:f.$id||f.id,name:f.name,execute:f.execute,enabled:f.enabled,deploymentId:f.deploymentId,scopes:f.scopes});
}

async function executionDetails(functionId,executionId){
  if(!apiKey||!executionId)return null;
  const r=await fetch(`${endpoint}/functions/${functionId}/executions/${executionId}`,{headers:adminHeaders()});
  const text=await r.text();
  console.log(`DIAG: execution detail ${executionId}: HTTP ${r.status}; ${text.slice(0,4000)}`);
  if(!r.ok)return null;
  try{return JSON.parse(text)}catch{return null}
}

async function preflight(functionId){
  const r=await fetch(`${endpoint}/functions/${functionId}/executions`,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-appwrite-project,x-appwrite-response-format'}});
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
  console.log(`DIAG: POST ${functionId}: HTTP ${r.status}; allow-origin=${allow||'ausente'}; body=${text.slice(0,1600)}`);
  let execution={};try{execution=JSON.parse(text)}catch{}
  assert(r.ok,`${functionId}: execução não criada: ${execution.message||r.status}`);
  assert(allow===origin||allow==='*',`Resposta sem CORS para ${functionId} (allow-origin=${allow||'ausente'})`);
  const status=Number(execution.responseStatusCode)||0;
  let data={};try{data=JSON.parse(execution.responseBody||'{}')}catch{}
  if(status<200||status>=300){
    const detail=await executionDetails(functionId,execution.$id);
    const extra=detail?.errors||detail?.logs||execution.errors||'';
    throw new Error(`${functionId}: API respondeu ${status}: ${data.error||execution.responseBody||extra||'sem detalhe'}`);
  }
  return data;
}

await ensureWebPlatform();
await inspectFunction('houses-api');
await preflight('houses-api');
const pub=await execute('houses-api','/?public=1');
assert(pub?.config?.church_name==='Catalise Church','Configuração pública não foi retornada corretamente.');
console.log('SMOKE OK: Appwrite público + CORS + configuração Catalise Church.');
