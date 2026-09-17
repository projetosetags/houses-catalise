'use strict';
const fs=require('node:fs');
const {admin}=require('./appwrite-admin.cjs');
const {services,stamp}=require('../functions/appwrite.cjs');
const m=require('../functions/model.cjs');
async function main(){
 admin();const {store,accounts}=services(process.env.APPWRITE_API_KEY);
 const email=m.text(process.env.HOUSES_ADMIN_EMAIL,254,true).toLowerCase(),name=m.text(process.env.HOUSES_ADMIN_NAME||'Administrador Houses',128,true);
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Defina HOUSES_ADMIN_EMAIL com o e-mail do proprietário.');
 const seed=process.env.HOUSES_SEED_FILE?JSON.parse(fs.readFileSync(process.env.HOUSES_SEED_FILE,'utf8')):{houses:[]};
 for(let i=1;i<=4;i++){const n=String(i).padStart(2,'0'),id='rede-'+n;if(!await store.get('networks',id,true))await store.create('networks',id,{name:'Rede '+n,active:true,created_at:stamp()});}
 const permitted=['code','name','network_id','leader_names','leader_full_names','address_line','neighborhood','city','state','postal_code','meeting_day','meeting_time'];
 for(const h of seed.houses||[]){
  const id=m.id(h.id);if(!/^\d{4}$/.test(id)||h.code!=='H-'+id)throw Error('Código de House inválido na carga privada.');
  await store.get('networks',m.id(h.network_id));
  if(!await store.get('houses',id,true))await store.create('houses',id,{...Object.fromEntries(permitted.filter(k=>h[k]!==undefined).map(k=>[k,h[k]])),active:true,created_at:stamp()});
 }
 const user=await accounts.ensure(email,name),existing=await store.get('users',user.$id,true);
 if(existing&&existing.role!=='admin')throw Error('O proprietário já possui outro perfil. Revise o vínculo antes de promover.');
 if(!existing)await store.create('users',user.$id,{name,email,role:'admin',active:true,house_ids:[],network_ids:[],created_at:stamp()});
 console.log('Redes 01–04 e '+(seed.houses||[]).length+' Houses verificadas. O proprietário define a senha pela recuperação do próprio aplicativo.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
