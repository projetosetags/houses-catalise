'use strict';
const fs=require('node:fs');
const {admin,ensure,available}=require('./appwrite-admin.cjs');
const {TABLES}=require('../functions/appwrite.cjs');
async function main(){
 const {sdk,client,config:c}=admin(),db=new sdk.TablesDB(client),storage=new sdk.Storage(client),functions=new sdk.Functions(client);
 const project=new sdk.Project(client),platforms=await project.listPlatforms({queries:[sdk.Query.limit(100)],total:false});
 if(!platforms.platforms.some(p=>p.type==='web'&&p.hostname==='projetosetags.github.io'))await project.createWebPlatform({platformId:'houses-web',name:'Houses GitHub Pages',hostname:'projetosetags.github.io'});
 await project.updateAuthMethod({methodId:sdk.ProjectAuthMethodId.Emailpassword,enabled:true});
 await project.updateAuthMethod({methodId:sdk.ProjectAuthMethodId.Jwt,enabled:true});
 // One shared/serverless database, one bucket and two functions fit Free.
 // This script never provisions dedicated databases or changes billing.
 await ensure(()=>db.get({databaseId:c.database}),()=>db.create({databaseId:c.database,name:'Houses Catalise',specification:'serverless',replicas:0}));
 for(const tableId of TABLES){
  const base={databaseId:c.database,tableId};
  await ensure(()=>db.getTable(base),()=>db.createTable({...base,name:tableId,permissions:[],rowSecurity:false}));
  await db.updateTable({...base,permissions:[],rowSecurity:false});
  await ensure(()=>db.getColumn({...base,key:'payload'}),()=>db.createMediumtextColumn({...base,key:'payload',required:true}));
  await available(()=>db.getColumn({...base,key:'payload'}),tableId+'.payload');
 }
 const reports={databaseId:c.database,tableId:'reports'};
 for(const [key,size] of [['house_id',36],['meeting_date',10]]){
  await ensure(()=>db.getColumn({...reports,key}),()=>db.createVarcharColumn({...reports,key,size,required:true}));
  await available(()=>db.getColumn({...reports,key}),key);
  await ensure(()=>db.getIndex({...reports,key:'by_'+key}),()=>db.createIndex({...reports,key:'by_'+key,type:sdk.TablesDBIndexType.Key,columns:[key]}));
  await available(()=>db.getIndex({...reports,key:'by_'+key}),'by_'+key);
 }
 const bucket={bucketId:c.bucket,name:'Materiais e fotos das Houses',permissions:[],fileSecurity:true,maximumFileSize:20*1024*1024,allowedFileExtensions:['pdf','jpg','png','bin'],compression:sdk.Compression.None,encryption:true,antivirus:true,transformations:false};
 await ensure(()=>storage.getBucket({bucketId:c.bucket}),()=>storage.createBucket(bucket));await storage.updateBucket(bucket);
 const functionId='houses-api',scopes=['rows.read','rows.write','files.read','files.write','tokens.write','users.read','users.write','sessions.write'];
 const settings={functionId,name:'Houses API',runtime:sdk.Runtime.Node22,execute:[sdk.Role.users()],events:[],schedule:'',timeout:120,enabled:true,logging:true,entrypoint:'index.cjs',commands:'npm ci --omit=dev',scopes};
 await ensure(()=>functions.get({functionId}),()=>functions.create(settings));await functions.update(settings);
 const vars=await functions.listVariables({functionId});
 for(const [key,value] of [['HOUSES_DATABASE_ID',c.database],['HOUSES_BUCKET_ID',c.bucket]]){
  const old=vars.variables.find(v=>v.key===key);if(old)await functions.updateVariable({functionId,variableId:old.$id,key,value,secret:false});else await functions.createVariable({functionId,variableId:sdk.ID.unique(),key,value,secret:false});
 }
 const cleanup={...settings,functionId:'houses-cleanup',name:'Limpeza de envios incompletos',execute:[],schedule:'17 */6 * * *',entrypoint:'cleanup.cjs',scopes:['rows.read','rows.write','files.read','files.write']};
 await ensure(()=>functions.get({functionId:cleanup.functionId}),()=>functions.create(cleanup));await functions.update(cleanup);
 const cleanupVars=await functions.listVariables({functionId:cleanup.functionId});
 for(const [key,value] of [['HOUSES_DATABASE_ID',c.database],['HOUSES_BUCKET_ID',c.bucket]]){
  const old=cleanupVars.variables.find(v=>v.key===key);if(old)await functions.updateVariable({functionId:cleanup.functionId,variableId:old.$id,key,value,secret:false});else await functions.createVariable({functionId:cleanup.functionId,variableId:sdk.ID.unique(),key,value,secret:false});
 }
 fs.writeFileSync('appwrite-config.js','// Public identifiers only. No API key.\nwindow.HOUSES_APPWRITE_CONFIG='+JSON.stringify({endpoint:c.endpoint,projectId:c.project,functionId})+';\n');
 console.log('Banco, tabelas privadas, bucket, API e limpeza de arquivos temporários configurados. Nenhuma alteração de plano.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
