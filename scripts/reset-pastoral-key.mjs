import { Client, TablesDB } from 'node-appwrite';

const endpoint=process.env.APPWRITE_ENDPOINT||'https://fra.cloud.appwrite.io/v1';
const project=process.env.APPWRITE_PROJECT_ID||'6aabcd0b000c5d1298ab';
const key=process.env.APPWRITE_API_KEY;
if(!key)throw new Error('APPWRITE_API_KEY não configurada.');

const client=new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const tables=new TablesDB(client);

await tables.updateRow({
  databaseId:'houses_catalise',
  tableId:'admin_access',
  rowId:'primary',
  data:{
    label:'Admin Pastoral',
    token_hash:'726dba962f267ff632f1ac2ec4318cd849336f15fff5009757d253c1b52368e0',
    active:true
  }
});

console.log('Chave pastoral redefinida com sucesso.');
