'use strict';
const crypto=require('node:crypto');
const m=require('./model.cjs');
const {uid,stamp,keyFor}=require('./appwrite.cjs');
const CHUNK=512*1024,MAX_MATERIAL=20*1024*1024,MAX_PHOTO=5*1024*1024;
function signature(bytes,mime){return mime==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));}
function createUploads({store,files,admin,houseAccess}){
 const document=(name,id)=>store.get(name,id);
 async function ticket(p,id){const t=await document('uploads',m.id(id));if(t.owner_id!==p.id||Date.parse(t.expires_at)<Date.now())m.fail('O envio expirou. Selecione o arquivo novamente.','permission-denied');return t;}
 async function discard(t){
  // Never delete a committed file if the response was interrupted after saving.
  const target=await store.get(t.purpose==='photo'?'reports':'materials',t.target_id,true);
  if(t.file_id&&target?.file_id!==t.file_id)await files.remove(t.file_id);
  for(let i=0;i<t.parts;i++)await files.remove(t.generation+'p'+i);
  if(t.previous_file_id&&target?.file_id!==t.previous_file_id)await files.remove(t.previous_file_id);
  await store.remove('uploads',t.id);
 }
 async function begin(p,d){
  let value,target,path,mime,purpose=m.text(d.purpose,20,true);
  if(purpose==='photo'){
   const h=await houseAccess(p,d.house_id),report=m.report(d,h.id);
   if(report.value.status!=='realizado')m.fail('O encontro adiado não precisa de foto.');
   target=report.key;path=report.value.photo_path;mime='image/jpeg';
  }else if(purpose==='material'){
   admin(p);const old=d.material_id?await document('materials',d.material_id):null;
   value=m.material({...old,...d});target=old?.id||uid();mime=value.mime_type;
   if(value.house_id){const h=await document('houses',value.house_id);if(value.network_id&&value.network_id!==h.network_id)m.fail('A House não pertence à Rede selecionada.');value.network_id=h.network_id;}
   if(value.network_id)await document('networks',value.network_id);
   path=`materials/${value.week_start}/${target}/original.${value.extension}`;
  }else m.fail('Tipo de envio inválido.');
  const size=Number(d.size),max=purpose==='photo'?MAX_PHOTO:MAX_MATERIAL;
  if(!Number.isSafeInteger(size)||size<=0||size>max)m.fail('Arquivo vazio ou acima do limite permitido.');
  return store.lock('upload:'+p.id,async()=>{
   const id=keyFor('upload:'+p.id),old=await store.get('uploads',id,true);if(old)await discard(old);
   const t={owner_id:p.id,purpose,target_id:target,storage_path:path,mime_type:mime,size,parts:Math.ceil(size/CHUNK),received:0,generation:uid().slice(0,24),file_id:uid(),ready:false,value:value||null,expires_at:new Date(Date.now()+3600000).toISOString(),created_at:stamp()};
   await store.create('uploads',id,t);return {id,generation:t.generation,chunk_size:CHUNK,size};
  });
 }
 async function chunk(p,d){return store.lock('upload:'+p.id,async()=>{
  const t=await ticket(p,d.id);if(t.generation!==d.generation||t.ready)m.fail('Envio desatualizado. Selecione o arquivo novamente.');
  const index=Number(d.index);if(!Number.isSafeInteger(index)||index<0||index>=t.parts||index>t.received)m.fail('Parte do arquivo fora de ordem.');
  const encoded=m.text(d.bytes,Math.ceil(CHUNK/3)*4+4,true);if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))m.fail('Parte do arquivo inválida.');
  const bytes=Buffer.from(encoded,'base64'),expected=Math.min(CHUNK,t.size-index*CHUNK);
  if(bytes.length!==expected||bytes.toString('base64')!==encoded)m.fail('O tamanho da parte recebida está incorreto.');
  if(index===0&&!signature(bytes,t.mime_type))m.fail('O conteúdo do arquivo não corresponde ao formato informado.');
  const fileId=t.generation+'p'+index;
  try{await files.write(fileId,bytes,'part.bin','uploads/'+t.id+'/'+t.generation);}catch(e){if(e.code!==409)throw e;const previous=await files.bytes(fileId);if(!previous.equals(bytes))m.fail('A parte recebida difere do envio anterior.');}
  await store.patch('uploads',t.id,{received:Math.max(t.received,index+1)});return {received:Math.max(t.received,index+1),parts:t.parts};
 });}
 async function finish(p,d){return store.lock('upload:'+p.id,async()=>{
  const t=await ticket(p,d.id);if(t.generation!==d.generation)m.fail('Envio desatualizado.');if(t.ready)return {id:t.id,ready:true};
  if(t.received!==t.parts)m.fail('Aguarde o envio de todas as partes.','failed-precondition');
  const chunks=new Array(t.parts);let next=0;
  await Promise.all(Array.from({length:Math.min(4,t.parts)},async()=>{while(next<t.parts){const i=next++;chunks[i]=await files.bytes(t.generation+'p'+i);}}));
  const bytes=Buffer.concat(chunks);if(bytes.length!==t.size||!signature(bytes,t.mime_type))m.fail('Arquivo incompleto ou inválido.');
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');if(d.sha256!==digest)m.fail('O arquivo chegou incompleto. Envie novamente.');
  const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[t.mime_type];
  try{await files.write(t.file_id,bytes,'original.'+ext,t.storage_path.slice(0,t.storage_path.lastIndexOf('/')));}catch(e){if(e.code!==409)throw e;const existing=await files.bytes(t.file_id);if(crypto.createHash('sha256').update(existing).digest('hex')!==digest)m.fail('O arquivo não corresponde ao envio.');}
  await store.patch('uploads',t.id,{ready:true,sha256:digest});return {id:t.id,ready:true};
 });}
 async function saveReport(p,d){
  const h=await houseAccess(p,d.house_id),r=m.report(d,h.id);
  return store.lock('report:'+r.key,()=>store.lock('upload:'+p.id,async()=>{
   const old=await store.get('reports',r.key,true),t=d.upload_id?await ticket(p,d.upload_id):null;
   if(t&&(!t.ready||t.purpose!=='photo'||t.target_id!==r.key))m.fail('Envio de foto inválido.');
   if(r.value.status==='realizado'&&!t&&!old?.file_id)m.fail('Envie uma foto desta reunião.','failed-precondition');
   const fileId=r.value.status==='realizado'?(t?.file_id||old.file_id):null;
   if(t)await store.patch('uploads',t.id,{previous_file_id:old?.file_id||null});
   await store.atomic(async tx=>{
    await tx.put('reports',r.key,{...r.value,file_id:fileId,photo_size:fileId?(t?.size||old.photo_size):0,updated_by:p.id,updated_at:stamp(),created_at:old?.created_at||stamp()});
    if(r.value.leader_message){const care=await tx.get('care',r.key,true);await tx.put('care',r.key,{...care,house_id:h.id,report_id:r.key,leader_message:r.value.leader_message,status:'pendente',updated_at:stamp()});}
   });
   // Cleanup can retry on the next upload; the report is already durable.
   if(t)await discard({...t,previous_file_id:old?.file_id}).catch(()=>{});
   else if(old?.file_id&&old.file_id!==fileId)await files.remove(old.file_id).catch(()=>{});
   return {id:r.key,ok:true};
  }));
 }
 async function saveMaterial(p,d){admin(p);return store.lock('upload:'+p.id,async()=>{
  const t=await ticket(p,d.upload_id);if(!t.ready||t.purpose!=='material')m.fail('Envie o arquivo antes de publicar.','failed-precondition');
  const old=await store.get('materials',t.target_id,true);await store.patch('uploads',t.id,{previous_file_id:old?.file_id||null});
  await store.put('materials',t.target_id,{...t.value,storage_path:t.storage_path,file_id:t.file_id,file_size:t.size,sha256:t.sha256,active:true,ready:true,uploaded_by:p.id,updated_at:stamp(),created_at:old?.created_at||stamp()});
  await discard({...t,previous_file_id:old?.file_id}).catch(()=>{});return {id:t.target_id,ok:true};
 });}
 async function link(p,d){
  const path=m.text(d.path,400,true);let item;
  const photo=path.match(/^meetings\/([A-Za-z0-9_-]+)\/(\d{4}-\d{2}-\d{2})\/photo\.jpg$/);
  if(photo){await houseAccess(p,photo[1]);item=await document('reports',`${photo[1]}_${m.date(photo[2])}`);if(item.status!=='realizado'||item.photo_path!==path)m.fail('Foto não encontrada.','not-found');}
  else{
   const match=path.match(/^materials\/\d{4}-\d{2}-\d{2}\/([A-Za-z0-9_-]+)\/original\.(pdf|jpg|png)$/);if(!match)m.fail('Arquivo inválido.');
   item=await document('materials',match[1]);const houses=(await store.list('houses')).filter(h=>m.allowed(p,h));
   if(!item.active||!item.ready||item.storage_path!==path||!m.audience(p,item,houses)||(!m.staff(p)&&item.week_start>m.today()))m.fail('Seu acesso não permite abrir este arquivo.','permission-denied');
   if(d.download&&!item.allow_download&&p.role!=='admin')m.fail('O download deste material está desativado.','permission-denied');
  }
  if(!item.file_id)m.fail('Arquivo não encontrado.','not-found');return {url:await files.link(item.file_id),size:item.file_size||item.photo_size,mime_type:item.mime_type||'image/jpeg'};
 }
 async function status(p,d){const t=await ticket(p,d.id);if(t.generation!==d.generation)m.fail('Envio desatualizado.');return {ready:t.ready};}
 return {begin_upload:begin,upload_chunk:chunk,finish_upload:finish,upload_status:status,save_report:saveReport,finish_material:saveMaterial,file_link:link};
}
module.exports={createUploads,signature,CHUNK,MAX_MATERIAL,MAX_PHOTO};
