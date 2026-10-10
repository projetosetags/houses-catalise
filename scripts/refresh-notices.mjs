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
  message:'01.10 - CULTO DE HOMENS\n08.10 - THE CHOSEN\n12.10 - DIA DA FAMÍLIA - HOTEL TERMAS DO RIO DO POUSO\n18.10 - CULTO ESPECIAL - PASTOR PAULO MAZONI\n29.10 - CULTO DE MULHERES',
  starts_on:'2026-09-29',
  ends_on:'2026-10-31',
  network_id:null,
  house_id:null,
  priority:20,
  active:true
});

await upsert('notice_braco_norte_202609',{
  title:'Agenda Braço do Norte',
  message:'01.10 - CULTO DE HOMENS - CATALISE TUBARÃO\n06.10 - ESCOLA DO DISCÍPULO\n08.10 - THE CHOSEN - CATALISE TUBARÃO\n12.10 - DIA DA FAMÍLIA - HOTEL TERMAS DO RIO DO POUSO\n29.10 - CULTO DE MULHERES - CATALISE TUBARÃO\n31.10 - CORRIDA DE CARRETILHA',
  starts_on:'2026-09-29',
  ends_on:'2026-10-31',
  network_id:null,
  house_id:null,
  priority:10,
  active:true
});

console.log('Avisos de outubro restaurados até 31/10/26.');
