'use strict';
const {services}=require('./appwrite.cjs');
async function cleanup({store,files}){
 let removed=0;
 for(const t of (await store.list('uploads')).filter(t=>Date.parse(t.expires_at)<Date.now()).slice(0,20)){
  try{await store.lock('upload:'+t.owner_id,async()=>{
   const current=await store.get('uploads',t.id,true);if(!current||current.generation!==t.generation||Date.parse(current.expires_at)>=Date.now())return;
   const target=await store.get(t.purpose==='photo'?'reports':'materials',t.target_id,true);
   if(t.file_id&&target?.file_id!==t.file_id)await files.remove(t.file_id);
   for(let i=0;i<t.parts;i++)await files.remove(t.generation+'p'+i);
   if(t.previous_file_id&&target?.file_id!==t.previous_file_id)await files.remove(t.previous_file_id);
   await store.remove('uploads',t.id);removed++;
  });}catch(e){if(e.code!=='conflict')throw e;}
 }
 return removed;
}
// Deployed separately with execute: [] (no client access), on a six-hour
// schedule. It only cleans expired uploads, never historical meetings/materials.
module.exports=async({req,res,error})=>{try{const removed=await cleanup(services(req.headers['x-appwrite-key']));return res.json({removed});}catch(e){error('Upload cleanup failed: '+String(e.code||'internal'));return res.json({error:'cleanup_failed'},500);}};
module.exports.cleanup=cleanup;
