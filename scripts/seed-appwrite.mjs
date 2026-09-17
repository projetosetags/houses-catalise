import { Client, TablesDB } from 'node-appwrite';
import { createHash } from 'node:crypto';

const endpoint=process.env.APPWRITE_ENDPOINT||'https://fra.cloud.appwrite.io/v1';
const project=process.env.APPWRITE_PROJECT_ID||'6aabcd0b000c5d1298ab';
const key=process.env.APPWRITE_API_KEY;
const adminToken=process.env.HOUSES_ADMIN_TOKEN;
if(!key)throw new Error('APPWRITE_API_KEY não configurada.');
if(!adminToken)throw new Error('HOUSES_ADMIN_TOKEN não configurado.');

const client=new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const tables=new TablesDB(client);const DB='houses_catalise';

async function put(tableId,rowId,data){
  try{return await tables.updateRow({databaseId:DB,tableId,rowId,data})}
  catch(e){if(e?.code!==404)throw e;return tables.createRow({databaseId:DB,tableId,rowId,data})}
}

for(let n=1;n<=4;n++){
  await put('networks',`network_${String(n).padStart(2,'0')}`,{name:`Rede ${String(n).padStart(2,'0')}`,leader_name:null,coordinator_name:null,active:true});
}
await put('app_config','main',{
  church_name:'Catalise Church',
  slogan:'Houses que transformam vidas',
  purpose_text:'Pessoas • Houses • Propósito',
  verse_text:'Pois onde estiverem dois ou três reunidos em meu nome, ali estou no meio deles.',
  verse_ref:'Mateus 18:20',
  active:true
});
await put('admin_access','primary',{
  label:'Admin Pastoral',
  token_hash:createHash('sha256').update(adminToken).digest('hex'),
  active:true
});

// Registra a origem do GitHub Pages para o navegador conversar com a API Appwrite.
try{
  const r=await fetch(`${endpoint}/project/platforms/web`,{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Appwrite-Project':project,'X-Appwrite-Key':key,'X-Appwrite-Response-Format':'2.0.0'},
    body:JSON.stringify({platformId:'github_pages',name:'Houses Catalise - GitHub Pages',hostname:'projetosetags.github.io'})
  });
  if(!r.ok&&r.status!==409)console.warn('Plataforma web não criada automaticamente:',r.status,await r.text());
}catch(e){console.warn('Plataforma web pendente:',e.message)}

console.log('Seed Appwrite concluído: Redes 01–04, configuração e acesso pastoral.');
