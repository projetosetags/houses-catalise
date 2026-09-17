'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const m=require('./model.cjs');
initializeApp();
const db=getFirestore(),bucket=()=>getStorage().bucket();
const stamp=()=>FieldValue.serverTimestamp();
const rows=s=>s.docs.map(d=>({id:d.id,...d.data()}));
async function collection(name){return rows(await db.collection(name).get());}
async function document(name,key){const d=await db.collection(name).doc(m.id(key)).get();if(!d.exists)m.fail('Cadastro não encontrado.','not-found');return {id:d.id,...d.data()};}
async function profile(uid){const p=await document('users',uid);if(p.active!==true)m.fail('Acesso desativado.','permission-denied');return p;}
function admin(p){if(p.role!=='admin')m.fail('Apenas a administração pode fazer esta alteração.','permission-denied');}
function pastoral(p){if(!m.staff(p))m.fail('Acesso pastoral necessário.','permission-denied');}
async function houseAccess(p,key){const h=await document('houses',key);if(!m.allowed(p,h))m.fail('Você não tem acesso a esta House.','permission-denied');return h;}
function clean(obj){return JSON.parse(JSON.stringify(obj));}
function sortDate(list,key){return list.sort((a,b)=>String(b[key]||'').localeCompare(String(a[key]||'')));}
async function catalog(p,houses){
 const [communications,materials]=await Promise.all([collection('communications'),collection('materials')]);
 const now=m.today();
 return {communications:communications.filter(x=>x.active!==false&&m.audience(p,x,houses)&&(m.staff(p)||(!x.starts_on||x.starts_on<=now)&&(!x.ends_on||x.ends_on>=now))).sort((a,b)=>(b.priority||0)-(a.priority||0)),materials:sortDate(materials.filter(x=>x.active!==false&&x.ready&&m.audience(p,x,houses)&&(m.staff(p)||x.week_start<=now)).map(x=>({...x,view_url:'storage:'+x.storage_path,download_url:x.allow_download?'storage:'+x.storage_path:null})), 'week_start')};
}
async function snapshot(p,houseId){
 const allHouses=(await collection('houses')).filter(h=>m.allowed(p,h));
 const networks=(await collection('networks')).filter(n=>p.role==='admin'||p.network_ids?.includes(n.id)||allHouses.some(h=>h.network_id===n.id));
 const houses=allHouses.map(h=>({...h,networks:networks.find(n=>n.id===h.network_id)||null}));
 if(houseId){
  const normalized=String(houseId).replace(/^H-/i,'');const h=houses.find(h=>h.id===houseId||h.code===`H-${normalized}`);
  if(!h)m.fail('House não encontrada ou sem permissão.','permission-denied');
  const recent=sortDate(rows(await db.collection('reports').where('house_id','==',h.id).get()),'meeting_date');
  const c=await catalog(p,[h]);
  return {config:m.CONFIG,profile:p,house:{...h,network:h.networks?.name||'',leaders:h.leader_names||[]},house_profile:h,metrics:m.metrics(recent),recent,...c};
 }
 pastoral(p);
 const cutoff=new Date(m.today()+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-55);
 const allowedIds=new Set(houses.map(h=>h.id));
 const reports=sortDate(rows(await db.collection('reports').where('meeting_date','>=',cutoff.toISOString().slice(0,10)).get()).filter(r=>allowedIds.has(r.house_id)).map(r=>({...r,houses:houses.find(h=>h.id===r.house_id)})),'meeting_date');
 const houseMetrics=houses.map(h=>({id:h.id,code:h.code,name:h.name,network:h.networks?.name||'',leader_full_names:h.leader_full_names||[],leaders:h.leader_names||[],...m.metrics(reports.filter(r=>r.house_id===h.id))}));
 const byNetwork=networks.map(n=>{const ids=houses.filter(h=>h.network_id===n.id).map(h=>h.id),list=houseMetrics.filter(h=>ids.includes(h.id));return {...n,houses:ids.length,regularity_pct:list.length?Math.round(list.reduce((s,h)=>s+h.regularity_pct,0)/list.length):0,attendance:list.reduce((s,h)=>s+h.attendance,0),first_time:list.reduce((s,h)=>s+h.first_time,0),children:list.reduce((s,h)=>s+h.children,0),decisions:list.reduce((s,h)=>s+h.decisions,0)};});
 const totals={houses:houses.length,reports:reports.filter(r=>r.status==='realizado').length,attendance:houseMetrics.reduce((s,h)=>s+h.attendance,0),first_time:houseMetrics.reduce((s,h)=>s+h.first_time,0),children:houseMetrics.reduce((s,h)=>s+h.children,0)};
 const weeks=Array.from({length:8},(_,i)=>{const start=new Date(m.today()+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-start.getUTCDay()-(7-i)*7);const end=new Date(start);end.setUTCDate(start.getUTCDate()+7);const a=start.toISOString().slice(0,10),b=end.toISOString().slice(0,10);return {label:a.slice(8)+'/'+a.slice(5,7),attendance:reports.filter(r=>r.status==='realizado'&&r.meeting_date>=a&&r.meeting_date<b).reduce((s,r)=>s+r.attendance_total,0)};});
 const care=(await collection('care')).filter(c=>allowedIds.has(c.house_id)&&c.status!=='concluido').map(c=>({...c,houses:houses.find(h=>h.id===c.house_id)}));
 return {config:m.CONFIG,profile:p,houses,networks,houseMetrics,byNetwork,reports,totals,weeks,care,...await catalog(p,houses)};
}
async function verifyFile(path,mime,max){
 const file=bucket().file(path);let metadata;
 try{[metadata]=await file.getMetadata();}catch(e){if(e.code===404)m.fail('Envie o arquivo antes de concluir.','failed-precondition');throw e;}
 if(metadata.contentType!==mime||Number(metadata.size)<=0||Number(metadata.size)>max)m.fail('Formato ou tamanho de arquivo inválido.');
 const [head]=await file.download({start:0,end:7});
 const valid=mime==='application/pdf'?head.subarray(0,5).toString()==='%PDF-':mime==='image/jpeg'?head[0]===255&&head[1]===216&&head[2]===255:head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(!valid)m.fail('O conteúdo do arquivo não corresponde ao formato informado.');
 // Never return or persist tokenized public download URLs.
 if(metadata.metadata?.firebaseStorageDownloadTokens)await file.setMetadata({metadata:{firebaseStorageDownloadTokens:null}});
 return {size:Number(metadata.size),generation:String(metadata.generation)};
}
async function saveReport(p,d){
 const h=await houseAccess(p,d.house_id),r=m.report(d,h.id);
 let file=null;if(r.value.status==='realizado')file=await verifyFile(r.value.photo_path,'image/jpeg',5*1024*1024);
 const ref=db.collection('reports').doc(r.key),careRef=db.collection('care').doc(r.key);
 await db.runTransaction(async tx=>{
  const previous=await tx.get(ref);
  tx.set(ref,{...r.value,photo_size:file?.size||0,photo_generation:file?.generation||null,updated_by:p.id,updated_at:stamp(),created_at:previous.data()?.created_at||stamp()},{merge:true});
  if(r.value.leader_message)tx.set(careRef,{house_id:h.id,report_id:r.key,leader_message:r.value.leader_message,status:'pendente',updated_at:stamp()},{merge:true});
 });
 return {id:r.key,ok:true};
}
function names(v){if(!Array.isArray(v)||v.length>20)m.fail('Informe uma lista de líderes.');return [...new Set(v.map(x=>m.text(x,150,true)))];}
async function saveHouse(p,d){
 admin(p);const editing=d.action==='update_house',key=editing?m.id(d.id):m.text(d.code,6,true).replace(/^H-/i,'');
 if(!editing&&!/^\d{4}$/.test(key))m.fail('Use um código de quatro dígitos, como H-0119.');
 const ref=db.collection('houses').doc(key),old=editing?await document('houses',key):{};
 if(!editing&&(await ref.get()).exists)m.fail('Esse código de House já está cadastrado.','already-exists');
 const network=m.id(d.network_id);await document('networks',network);
 const value={name:m.text(d.name,200,true),network_id:network,leader_names:names(d.leader_names||[]),leader_full_names:names(d.leader_full_names||[]),active:true,updated_at:stamp()};
 for(const k of ['address_line','neighborhood','city','state','postal_code','meeting_time'])value[k]=m.text(d[k]||'',300);
 if(value.meeting_time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.meeting_time))m.fail('Horário inválido.');
 value.meeting_day=d.meeting_day===''||d.meeting_day==null?null:Number(d.meeting_day);if(value.meeting_day!==null&&(!Number.isInteger(value.meeting_day)||value.meeting_day<0||value.meeting_day>6))m.fail('Dia da semana inválido.');
 if(editing)await ref.update(value);else await ref.create({...value,code:`H-${key}`,created_at:stamp()});
 if(editing&&old.network_id!==network){
  const members=rows(await db.collection('users').where('house_ids','array-contains',key).get());
  for(const member of members.filter(x=>x.role==='leader')){const linked=await Promise.all(member.house_ids.map(i=>document('houses',i)));await db.collection('users').doc(member.id).update({network_ids:[...new Set(linked.map(x=>x.network_id))]});}
 }
 return {id:key};
}
async function saveCommunication(p,d){
 admin(p);const value={title:m.text(d.title,200,true),message:m.text(d.message,5000,true),starts_on:m.date(d.starts_on,false),ends_on:m.date(d.ends_on,false),network_id:d.network_id?m.id(d.network_id):null,house_id:d.house_id?m.id(d.house_id):null,priority:Number(d.priority||0),active:true,updated_at:stamp()};
 if(!Number.isFinite(value.priority)||value.priority<0||value.priority>100) m.fail('Prioridade inválida.');
 if(value.starts_on&&value.ends_on&&value.ends_on<value.starts_on)m.fail('A data final precisa ser igual ou posterior à inicial.');
 if(value.house_id){const h=await document('houses',value.house_id);if(value.network_id&&h.network_id!==value.network_id)m.fail('A House não pertence à Rede selecionada.');value.network_id=h.network_id;}
 if(value.network_id)await document('networks',value.network_id);
 const ref=d.id?db.collection('communications').doc(m.id(d.id)):db.collection('communications').doc();
 if(d.id)await ref.update(value);else await ref.create({...value,created_at:stamp()});return {id:ref.id};
}
async function beginMaterial(p,d){
 admin(p);let input=d;
 if(d.material_id){const old=await document('materials',d.material_id);input={...old,...d,mime_type:d.mime_type,file_name:d.file_name};}
 const value=m.material(input);
 if(value.house_id){const h=await document('houses',value.house_id);if(value.network_id&&value.network_id!==h.network_id)m.fail('A House não pertence à Rede selecionada.');value.network_id=h.network_id;}
 if(value.network_id)await document('networks',value.network_id);
 const ref=d.material_id?db.collection('materials').doc(m.id(d.material_id)):db.collection('materials').doc();
 const storage_path=`materials/${value.week_start}/${ref.id}/original.${value.extension}`;
 const old=(await ref.get()).data();
 await ref.set({...value,storage_path,previous_path:old?.storage_path||null,active:true,ready:false,uploaded_by:p.id,updated_at:stamp(),created_at:old?.created_at||stamp()});
 return {id:ref.id,storage_path};
}
async function finishMaterial(p,d){admin(p);const item=await document('materials',d.id);const file=await verifyFile(item.storage_path,item.mime_type,20*1024*1024);await db.collection('materials').doc(item.id).update({ready:true,file_size:file.size,generation:file.generation,updated_at:stamp()});if(item.previous_path&&item.previous_path!==item.storage_path)await bucket().file(item.previous_path).delete({ignoreNotFound:true});return {id:item.id,ok:true};}
async function saveUser(p,d){
 admin(p);const role=m.text(d.role,20,true);if(!['leader','pastor','admin'].includes(role))m.fail('Função inválida.');
 const house_ids=(d.house_ids||[]).map(m.id),network_ids=(d.network_ids||[]).map(m.id);
 if(role==='leader'&&!house_ids.length)m.fail('Vincule pelo menos uma House.');if(role==='pastor'&&!network_ids.length)m.fail('Vincule pelo menos uma Rede.');
 const houses=await Promise.all(house_ids.map(i=>document('houses',i)));await Promise.all(network_ids.map(i=>document('networks',i)));
 const email=m.text(d.email,254,true).toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))m.fail('E-mail inválido.');
 let user;try{user=await getAuth().getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;user=await getAuth().createUser({email,displayName:m.text(d.name,150,true)});}
 if(user.uid===p.id&&role!=='admin')m.fail('Você não pode remover seu próprio acesso de administrador.');
 const value={name:m.text(d.name,150,true),email,role,house_ids:role==='leader'?house_ids:[],network_ids:role==='leader'?[...new Set(houses.map(h=>h.network_id))]:role==='pastor'?network_ids:[],active:true,updated_at:stamp()};
 await db.collection('users').doc(user.uid).set(value,{merge:true});
 return {uid:user.uid,ok:true};
}
async function route(p,d){
 switch(d.action){
  case 'profile':return p;
  case 'leader_snapshot':return snapshot(p,d.house_id);
  case 'pastoral_snapshot':return snapshot(p);
  case 'save_report':return saveReport(p,d);
  case 'validate_report':{const h=await houseAccess(p,d.house_id);return m.report(d,h.id);}
  case 'create_house':case 'update_house':return saveHouse(p,d);
  case 'create_network':{admin(p);const name=m.text(d.name,100,true),key='rede-'+name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');await db.collection('networks').doc(key).create({name,leader_name:m.text(d.leader_name,200),coordinator_name:m.text(d.coordinator_name,200),active:true,created_at:stamp()});return {id:key};}
  case 'update_address':{const h=await houseAccess(p,d.house_id),value={};for(const k of ['address_line','neighborhood','city','state','postal_code'])value[k]=m.text(d[k],300);await db.collection('houses').doc(h.id).update({...value,updated_at:stamp()});return {house_profile:value};}
  case 'create_communication':case 'update_communication':return saveCommunication(p,d);
  case 'delete_communication':{admin(p);await db.collection('communications').doc(m.id(d.id)).update({active:false,updated_at:stamp()});return {ok:true};}
  case 'begin_material':return beginMaterial(p,d);
  case 'finish_material':return finishMaterial(p,d);
  case 'delete_material':{admin(p);await db.collection('materials').doc(m.id(d.id)).update({active:false,updated_at:stamp()});return {ok:true};}
  case 'update_care':{pastoral(p);const c=await document('care',d.id);await houseAccess(p,c.house_id);if(!['em_acompanhamento','concluido'].includes(d.status))m.fail('Situação inválida.');await db.collection('care').doc(c.id).update({status:d.status,pastoral_response:m.text(d.pastoral_response,4000),updated_by:p.id,updated_at:stamp()});return {ok:true};}
  case 'save_user':return saveUser(p,d);
  case 'list_users':admin(p);return collection('users');
  case 'disable_user':{admin(p);const uid=m.id(d.id);if(uid===p.id)m.fail('Você não pode desativar seu próprio acesso.');await db.collection('users').doc(uid).update({active:false,updated_at:stamp()});await getAuth().revokeRefreshTokens(uid);return {ok:true};}
  default:m.fail('Operação desconhecida.');
 }
}
exports.housesApi=onCall({region:'southamerica-east1',maxInstances:3,memory:'256MiB',timeoutSeconds:60,cors:true},async request=>{
 try{
  if(!request.auth)m.fail('Entre na sua conta para continuar.','unauthenticated');
  const p=await profile(request.auth.uid);return clean(await route(p,request.data||{}));
 }catch(e){if(e instanceof HttpsError)throw e;const codes=['invalid-argument','permission-denied','not-found','already-exists','failed-precondition','unauthenticated'];if(codes.includes(e.code))throw new HttpsError(e.code,e.message);console.error('Houses API failure',{code:e.code,message:e.message});throw new HttpsError('internal','Não foi possível concluir. Tente novamente.');}
});
