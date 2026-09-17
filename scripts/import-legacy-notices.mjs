import { Client, TablesDB } from 'node-appwrite';
import { createHash } from 'node:crypto';

const endpoint=process.env.APPWRITE_ENDPOINT||'https://fra.cloud.appwrite.io/v1';
const project=process.env.APPWRITE_PROJECT_ID||'6aabcd0b000c5d1298ab';
const key=process.env.APPWRITE_API_KEY;
if(!key)throw new Error('APPWRITE_API_KEY não configurada.');

const client=new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const tables=new TablesDB(client);
const DB='houses_catalise';
const LEGACY='https://zvutbyenkkaqyzgmhwew.supabase.co/functions/v1/houses-api?public=1';

function overlapsOctober(c){
  const start=String(c.starts_on||'0000-01-01').slice(0,10);
  const end=String(c.ends_on||'9999-12-31').slice(0,10);
  return start<='2026-10-31'&&end>='2026-10-01';
}

async function ensure(rowId,data){
  try{return await tables.createRow({databaseId:DB,tableId:'communications',rowId,data})}
  catch(e){if(e?.code===409)return null;throw e}
}

try{
  const r=await fetch(LEGACY,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(20000)});
  if(!r.ok){console.warn(`Backend legado respondeu HTTP ${r.status}; importação de outubro ignorada.`);process.exit(0)}
  const j=await r.json();
  const all=Array.isArray(j.communications)?j.communications:[];
  console.log('Avisos públicos encontrados no legado:',all.map(c=>({title:c.title,starts_on:c.starts_on,ends_on:c.ends_on}))); 
  const october=all.filter(overlapsOctober);
  let created=0;
  for(const c of october){
    const signature=[c.title,c.message,c.starts_on,c.ends_on].join('|');
    const id='legacy_oct_'+createHash('sha256').update(signature).digest('hex').slice(0,20);
    const row=await ensure(id,{
      title:String(c.title||'Aviso').trim(),
      message:String(c.message||'').trim(),
      starts_on:c.starts_on||null,
      ends_on:c.ends_on||null,
      network_id:null,
      house_id:null,
      priority:Number(c.priority)||0,
      active:c.active!==false
    });
    if(row)created++;
  }
  console.log(`Importação legado outubro/2026: ${october.length} aviso(s) encontrado(s), ${created} novo(s) criado(s) no Appwrite.`);
}catch(e){
  console.warn('Não foi possível consultar o backend legado para os avisos de outubro:',e.message);
}
