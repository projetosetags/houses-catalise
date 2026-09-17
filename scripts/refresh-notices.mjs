import { Client, TablesDB } from 'node-appwrite';

const endpoint=process.env.APPWRITE_ENDPOINT||'https://fra.cloud.appwrite.io/v1';
const project=process.env.APPWRITE_PROJECT_ID||'6aabcd0b000c5d1298ab';
const key=process.env.APPWRITE_API_KEY;
if(!key)throw new Error('APPWRITE_API_KEY não configurada.');

const client=new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const tables=new TablesDB(client);
const DB='houses_catalise';

async function upsert(rowId,data){
  try{return await tables.updateRow({databaseId:DB,tableId:'communications',rowId,data})}
  catch(e){if(e?.code!==404)throw e;return tables.createRow({databaseId:DB,tableId:'communications',rowId,data})}
}

await upsert('notice_tubarao_202609',{
  title:'Agenda Tubarão',
  message:'22/09/26 | ESCOLA DO DISCÍPULO\n24/09/26 | CULTO DE MULHERES\n01/10/26 | CULTO DE HOMENS',
  starts_on:'2026-09-17',
  ends_on:'2026-10-01',
  network_id:null,
  house_id:null,
  priority:20,
  active:true
});

await upsert('notice_braco_norte_202609',{
  title:'Agenda Braço do Norte',
  message:'24/09/26 | CULTO DE MULHERES – CATALISE TUBARÃO\n01/10/26 | CULTO DE HOMENS – CATALISE TUBARÃO',
  starts_on:'2026-09-17',
  ends_on:'2026-10-01',
  network_id:null,
  house_id:null,
  priority:10,
  active:true
});

console.log('Avisos restaurados no formato dd/mm/aa, incluindo 01/10/26.');
