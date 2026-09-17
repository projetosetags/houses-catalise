'use strict';
const m=require('./model.cjs');
const {uid,stamp,keyFor}=require('./appwrite.cjs');
const {createUploads}=require('./uploads.cjs');
function createAPI({store,files,accounts}){
const collection=(name,filters)=>store.list(name,filters);
const document=(name,key)=>store.get(name,key);
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
  const recent=sortDate(await collection('reports',[['eq','house_id',h.id]]),'meeting_date');
  const c=await catalog(p,[h]);
  return {config:m.CONFIG,profile:p,house:{...h,network:h.networks?.name||'',leaders:h.leader_names||[]},house_profile:h,metrics:m.metrics(recent),recent,...c};
 }
 pastoral(p);
 const cutoff=new Date(m.today()+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-55);
 const allowedIds=new Set(houses.map(h=>h.id));
 const reports=sortDate((await collection('reports',[['gte','meeting_date',cutoff.toISOString().slice(0,10)]])).filter(r=>allowedIds.has(r.house_id)).map(r=>({...r,houses:houses.find(h=>h.id===r.house_id)})),'meeting_date');
 const houseMetrics=houses.map(h=>({id:h.id,code:h.code,name:h.name,network:h.networks?.name||'',leader_full_names:h.leader_full_names||[],leaders:h.leader_names||[],...m.metrics(reports.filter(r=>r.house_id===h.id))}));
 const byNetwork=networks.map(n=>{const ids=houses.filter(h=>h.network_id===n.id).map(h=>h.id),list=houseMetrics.filter(h=>ids.includes(h.id));return {...n,houses:ids.length,regularity_pct:list.length?Math.round(list.reduce((s,h)=>s+h.regularity_pct,0)/list.length):0,attendance:list.reduce((s,h)=>s+h.attendance,0),first_time:list.reduce((s,h)=>s+h.first_time,0),children:list.reduce((s,h)=>s+h.children,0),decisions:list.reduce((s,h)=>s+h.decisions,0)};});
 const totals={houses:houses.length,reports:reports.filter(r=>r.status==='realizado').length,attendance:houseMetrics.reduce((s,h)=>s+h.attendance,0),first_time:houseMetrics.reduce((s,h)=>s+h.first_time,0),children:houseMetrics.reduce((s,h)=>s+h.children,0)};
 const weeks=Array.from({length:8},(_,i)=>{const start=new Date(m.today()+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-start.getUTCDay()-(7-i)*7);const end=new Date(start);end.setUTCDate(start.getUTCDate()+7);const a=start.toISOString().slice(0,10),b=end.toISOString().slice(0,10);return {label:a.slice(8)+'/'+a.slice(5,7),attendance:reports.filter(r=>r.status==='realizado'&&r.meeting_date>=a&&r.meeting_date<b).reduce((s,r)=>s+r.attendance_total,0)};});
 const care=(await collection('care')).filter(c=>allowedIds.has(c.house_id)&&c.status!=='concluido').map(c=>({...c,houses:houses.find(h=>h.id===c.house_id)}));
 return {config:m.CONFIG,profile:p,houses,networks,houseMetrics,byNetwork,reports,totals,weeks,care,...await catalog(p,houses)};
}
const uploadRoutes=createUploads({store,files,admin,houseAccess});
function names(v){if(!Array.isArray(v)||v.length>20)m.fail('Informe uma lista de líderes.');return [...new Set(v.map(x=>m.text(x,150,true)))];}
async function saveHouse(p,d){
 admin(p);const editing=d.action==='update_house',key=editing?m.id(d.id):m.text(d.code,6,true).replace(/^H-/i,'');
 if(!editing&&!/^\d{4}$/.test(key))m.fail('Use um código de quatro dígitos, como H-0119.');
 const old=editing?await document('houses',key):{},network=m.id(d.network_id);await document('networks',network);
 const value={...old,name:m.text(d.name,200,true),network_id:network,leader_names:names(d.leader_names||[]),leader_full_names:names(d.leader_full_names||[]),active:true,updated_at:stamp()};
 for(const k of ['address_line','neighborhood','city','state','postal_code','meeting_time'])value[k]=m.text(d[k]||'',300);
 if(value.meeting_time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.meeting_time))m.fail('Horário inválido.');
 value.meeting_day=d.meeting_day===''||d.meeting_day==null?null:Number(d.meeting_day);if(value.meeting_day!==null&&(!Number.isInteger(value.meeting_day)||value.meeting_day<0||value.meeting_day>6))m.fail('Dia da semana inválido.');
 await store.atomic(async tx=>{
  if(editing)await tx.put('houses',key,value);else await tx.create('houses',key,{...value,code:`H-${key}`,created_at:stamp()});
  if(editing&&old.network_id!==network){
   const members=(await collection('users')).filter(x=>x.role==='leader'&&x.house_ids?.includes(key));
   for(const member of members){const linked=await Promise.all(member.house_ids.map(i=>i===key?{network_id:network}:document('houses',i)));await tx.patch('users',member.id,{network_ids:[...new Set(linked.map(x=>x.network_id))]});}
  }
 });return {id:key};
}
async function saveCommunication(p,d){
 admin(p);const value={title:m.text(d.title,200,true),message:m.text(d.message,5000,true),starts_on:m.date(d.starts_on,false),ends_on:m.date(d.ends_on,false),network_id:d.network_id?m.id(d.network_id):null,house_id:d.house_id?m.id(d.house_id):null,priority:Number(d.priority||0),active:true,updated_at:stamp()};
 if(!Number.isFinite(value.priority)||value.priority<0||value.priority>100)m.fail('Prioridade inválida.');
 if(value.starts_on&&value.ends_on&&value.ends_on<value.starts_on)m.fail('A data final precisa ser igual ou posterior à inicial.');
 if(value.house_id){const h=await document('houses',value.house_id);if(value.network_id&&h.network_id!==value.network_id)m.fail('A House não pertence à Rede selecionada.');value.network_id=h.network_id;}
 if(value.network_id)await document('networks',value.network_id);const id=d.id?m.id(d.id):uid();
 if(d.id)await store.patch('communications',id,value);else await store.create('communications',id,{...value,created_at:stamp()});return {id};
}
async function saveUser(p,d){
 admin(p);const role=m.text(d.role,20,true);if(!['leader','pastor','admin'].includes(role))m.fail('Função inválida.');
 if(!Array.isArray(d.house_ids)||!Array.isArray(d.network_ids)||d.house_ids.length>100||d.network_ids.length>100)m.fail('Vínculos inválidos.');
 const house_ids=[...new Set(d.house_ids.map(m.id))],network_ids=[...new Set(d.network_ids.map(m.id))];
 if(role==='leader'&&!house_ids.length)m.fail('Vincule pelo menos uma House.');if(role==='pastor'&&!network_ids.length)m.fail('Vincule pelo menos uma Rede.');
 const houses=await Promise.all(house_ids.map(i=>document('houses',i)));await Promise.all(network_ids.map(i=>document('networks',i)));
 const email=m.text(d.email,254,true).toLowerCase(),name=m.text(d.name,128,true);if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))m.fail('E-mail inválido.');
 const user=await accounts.ensure(email,name);if(user.$id===p.id&&role!=='admin')m.fail('Você não pode remover seu próprio acesso de administrador.');
 await store.put('users',user.$id,{name,email,role,house_ids:role==='leader'?house_ids:[],network_ids:role==='leader'?[...new Set(houses.map(h=>h.network_id))]:role==='pastor'?network_ids:[],active:true,updated_at:stamp()});
 await accounts.activate(user.$id);return {uid:user.$id,ok:true};
}
async function route(p,d){
 if(Object.hasOwn(uploadRoutes,d.action))return uploadRoutes[d.action](p,d);
 switch(d.action){
 case 'profile':return p;
 case 'leader_snapshot':return snapshot(p,d.house_id);
 case 'pastoral_snapshot':return snapshot(p);
 case 'validate_report':{const h=await houseAccess(p,d.house_id);return m.report(d,h.id);}
 case 'create_house':case 'update_house':return saveHouse(p,d);
 case 'create_network':{admin(p);const name=m.text(d.name,100,true),key=keyFor('network:'+name.toLowerCase());await store.create('networks',key,{name,leader_name:m.text(d.leader_name,200),coordinator_name:m.text(d.coordinator_name,200),active:true,created_at:stamp()});return {id:key};}
 case 'update_address':{const h=await houseAccess(p,d.house_id),value={};for(const k of ['address_line','neighborhood','city','state','postal_code'])value[k]=m.text(d[k],300);await store.patch('houses',h.id,{...value,updated_at:stamp()});return {house_profile:value};}
 case 'create_communication':case 'update_communication':return saveCommunication(p,d);
 case 'delete_communication':{admin(p);await store.patch('communications',m.id(d.id),{active:false,updated_at:stamp()});return {ok:true};}
 case 'delete_material':{admin(p);await store.patch('materials',m.id(d.id),{active:false,updated_at:stamp()});return {ok:true};}
 case 'update_care':{pastoral(p);const c=await document('care',d.id);await houseAccess(p,c.house_id);if(!['em_acompanhamento','concluido'].includes(d.status))m.fail('Situação inválida.');await store.patch('care',c.id,{status:d.status,pastoral_response:m.text(d.pastoral_response,4000),updated_by:p.id,updated_at:stamp()});return {ok:true};}
 case 'save_user':return saveUser(p,d);
 case 'list_users':admin(p);return collection('users');
 case 'disable_user':{admin(p);const id=m.id(d.id);if(id===p.id)m.fail('Você não pode desativar seu próprio acesso.');await store.patch('users',id,{active:false,updated_at:stamp()});await accounts.disable(id);return {ok:true};}
 default:m.fail('Operação desconhecida.');
 }}
return {async dispatch(id,body){if(!id)m.fail('Entre na sua conta para continuar.','unauthenticated');return clean(await route(await profile(id),body||{}));}};
}
module.exports={createAPI};
