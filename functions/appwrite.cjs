'use strict';
const {Client,TablesDB,Storage,Users,Tokens,Account,ID,Query}=require('node-appwrite');
const {InputFile}=require('node-appwrite/file');
const crypto=require('node:crypto');
const m=require('./model.cjs');
const TABLES=['networks','houses','users','reports','materials','communications','care','uploads','locks'];
const uid=()=>crypto.randomBytes(16).toString('hex');
const stamp=()=>new Date().toISOString();
const keyFor=value=>'k'+crypto.createHash('sha256').update(value).digest('hex').slice(0,32);
const config=()=>({endpoint:process.env.APPWRITE_FUNCTION_API_ENDPOINT||process.env.APPWRITE_ENDPOINT,project:process.env.APPWRITE_FUNCTION_PROJECT_ID||process.env.APPWRITE_PROJECT_ID,database:process.env.HOUSES_DATABASE_ID||'houses',bucket:process.env.HOUSES_BUCKET_ID||'house-files'});
function clientFor(key){const c=config();if(!c.endpoint||!c.project||!key)throw Error('Appwrite não configurado.');return new Client().setEndpoint(c.endpoint).setProject(c.project).setKey(key);}
class Store{
 constructor(api,database,transactionId){this.api=api;this.database=database;this.transactionId=transactionId;}
 params(table,id){return {databaseId:this.database,tableId:table,...(id?{rowId:m.id(id)}:{}),...(this.transactionId?{transactionId:this.transactionId}:{})};}
 decode(row){return {...JSON.parse(row.payload),id:row.$id};}
 encode(table,value){const data={payload:JSON.stringify(value)};if(table==='reports'){data.house_id=value.house_id;data.meeting_date=value.meeting_date;}return data;}
 async get(table,id,optional=false){try{return this.decode(await this.api.getRow(this.params(table,id)));}catch(e){if(e.code===404){if(optional)return null;m.fail('Cadastro não encontrado.','not-found');}throw e;}}
 async list(table,filters=[]){let after,all=[];do{const queries=[Query.limit(100),Query.orderAsc('$id'),...filters.map(([op,k,v])=>op==='gte'?Query.greaterThanEqual(k,v):Query.equal(k,v))];if(after)queries.push(Query.cursorAfter(after));const page=await this.api.listRows({...this.params(table),queries,total:false});all.push(...page.rows.map(row=>this.decode(row)));after=page.rows.length===100?page.rows.at(-1).$id:null;}while(after);return all;}
 async create(table,id,value){try{return this.decode(await this.api.createRow({...this.params(table,id),data:this.encode(table,value),permissions:[]}));}catch(e){if(e.code===409)m.fail('Este registro já existe.','already-exists');throw e;}}
 async put(table,id,value){return this.decode(await this.api.upsertRow({...this.params(table,id),data:this.encode(table,value),permissions:[]}));}
 async patch(table,id,value){const old=await this.get(table,id);return this.put(table,id,{...old,...value});}
 async remove(table,id){try{await this.api.deleteRow(this.params(table,id));}catch(e){if(e.code!==404)throw e;}}
 async atomic(callback){const tx=await this.api.createTransaction({ttl:60});try{const result=await callback(new Store(this.api,this.database,tx.$id));await this.api.updateTransaction({transactionId:tx.$id,commit:true});return result;}catch(e){await this.api.updateTransaction({transactionId:tx.$id,rollback:true}).catch(()=>{});throw e;}}
 async lock(resource,callback){const key=keyFor(resource);const old=await this.get('locks',key,true);if(old&&Date.parse(old.expires_at)<Date.now())await this.remove('locks',key);try{await this.create('locks',key,{expires_at:new Date(Date.now()+180000).toISOString()});}catch(e){if(e.code==='already-exists')m.fail('Há um envio em andamento. Aguarde e tente novamente.','conflict');throw e;}try{return await callback();}finally{await this.remove('locks',key);}}
}
function services(key){
 const c=config(),client=clientFor(key),storage=new Storage(client),users=new Users(client),tokens=new Tokens(client);
 return {store:new Store(new TablesDB(client),c.database),
  files:{
   async write(id,bytes,name,folder){return storage.createFile({bucketId:c.bucket,fileId:id,file:InputFile.fromBuffer(bytes,name),permissions:[],folder});},
   async bytes(id){return Buffer.from(await storage.getFileDownload({bucketId:c.bucket,fileId:id}));},
   async remove(id){if(!id)return;try{await storage.deleteFile({bucketId:c.bucket,fileId:id});}catch(e){if(e.code!==404)throw e;}},
   async link(id){const token=await tokens.createFileToken({bucketId:c.bucket,fileId:id,expire:new Date(Date.now()+5*60000).toISOString()});const url=new URL(c.endpoint+'/storage/buckets/'+encodeURIComponent(c.bucket)+'/files/'+encodeURIComponent(id)+'/download');url.searchParams.set('project',c.project);url.searchParams.set('token',token.secret);return url.toString();}
  },
  accounts:{
   async ensure(email,name){const found=await users.list({queries:[Query.equal('email',[email]),Query.limit(1)],total:false});return found.users[0]||users.create({userId:ID.unique(),email,name});},
   async activate(id){await users.updateStatus({userId:id,status:true});},
   async disable(id){await users.updateStatus({userId:id,status:false});await users.deleteSessions({userId:id});}
  }
 };
}
async function authenticated(req){const jwt=req.headers['x-appwrite-user-jwt'];if(!jwt)m.fail('Entre na sua conta para continuar.','unauthenticated');const c=config();const client=new Client().setEndpoint(c.endpoint).setProject(c.project).setJWT(jwt);try{const user=await new Account(client).get();if(!user.status)m.fail('Acesso desativado.','permission-denied');return user.$id;}catch(e){if(e.code===401||e.code===403)m.fail('Entre na sua conta para continuar.','unauthenticated');throw e;}}
module.exports={Store,TABLES,services,authenticated,clientFor,config,uid,stamp,keyFor};
