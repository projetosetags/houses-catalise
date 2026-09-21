const { Client, TablesDB, Storage, Tokens, Query, ID } = require('node-appwrite');
const { InputFile } = require('node-appwrite/file');

const DB='houses_catalise';
const BUCKET='houses_files';
const T={networks:'networks',houses:'houses',reports:'meeting_reports',communications:'communications',materials:'materials',config:'app_config'};

function services(req){
  const endpoint=process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const project=process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const key=req.headers['x-appwrite-key'];
  const client=new Client().setEndpoint(endpoint).setProject(project).setKey(key);
  return {endpoint,project,tables:new TablesDB(client),storage:new Storage(client),tokens:new Tokens(client)};
}
function clean(row){if(!row)return row;const x={...row,id:row.$id};return x}
async function listAll(tables,tableId){
  const r=await tables.listRows({databaseId:DB,tableId,queries:[Query.limit(5000)],total:false});
  return (r.rows||[]).map(clean);
}
function todayISO(){return new Date().toISOString().slice(0,10)}
function isVisible(c,house=null){
  if(c.active===false)return false;const today=todayISO();
  if(c.starts_on&&c.starts_on>today)return false;if(c.ends_on&&c.ends_on<today)return false;
  if(!house)return !c.network_id&&!c.house_id;
  if(c.house_id&&c.house_id!==house.id)return false;if(c.network_id&&c.network_id!==house.network_id)return false;return true;
}
function metrics(reports){
  const sorted=reports.slice().sort((a,b)=>String(b.meeting_date).localeCompare(String(a.meeting_date)));
  const last8=sorted.slice(0,8),done=last8.filter(x=>x.status==='realizado');
  const sum=k=>done.reduce((s,x)=>s+(Number(x[k])||0),0);
  return {
    valid_records:last8.length,
    regularity_pct:Math.round(Math.min(100,last8.length/8*100)),
    avg_attendance:done.length?Math.round(sum('attendance_total')/done.length):0,
    first_time:sum('first_time'),children:sum('children'),decisions:sum('decisions_for_jesus'),
    last_record:sorted[0]?.meeting_date||null
  };
}
async function signedMaterial(m,s){
  if(!m.file_id)return {...m,material_url:null,view_url:null,download_url:null};
  try{
    const expire=new Date(Date.now()+2*60*60*1000).toISOString();
    const tok=await s.tokens.createFileToken({bucketId:BUCKET,fileId:m.file_id,expire});
    const base=`${s.endpoint}/storage/buckets/${BUCKET}/files/${encodeURIComponent(m.file_id)}`;
    const q=`project=${encodeURIComponent(s.project)}&token=${encodeURIComponent(tok.secret)}`;
    return {...m,material_url:`${base}/view?${q}`,view_url:`${base}/view?${q}`,download_url:`${base}/download?${q}`};
  }catch{return {...m,material_url:null,view_url:null,download_url:null}}
}
async function signedPhoto(r,s){
  if(!r?.photo_file_id)return {...r,photo_url:null};
  try{
    const expire=new Date(Date.now()+2*60*60*1000).toISOString();
    const tok=await s.tokens.createFileToken({bucketId:BUCKET,fileId:r.photo_file_id,expire});
    const base=`${s.endpoint}/storage/buckets/${BUCKET}/files/${encodeURIComponent(r.photo_file_id)}`;
    const q=`project=${encodeURIComponent(s.project)}&token=${encodeURIComponent(tok.secret)}`;
    return {...r,photo_url:`${base}/view?${q}`};
  }catch{return {...r,photo_url:null}}
}
function parseDataUrl(v){
  const m=String(v||'').match(/^data:([^;]+);base64,(.+)$/s);if(!m)throw new Error('Foto inválida');
  const mime=m[1].toLowerCase();if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Formato de foto não permitido');
  const buf=Buffer.from(m[2],'base64');if(buf.length>8*1024*1024)throw new Error('Foto acima de 8 MB');
  return {mime,buf};
}
async function savePhoto(storage,house,body){
  if(!body.photo_data_url)return null;
  const {mime,buf}=parseDataUrl(body.photo_data_url);const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  const name=String(body.photo_name||`${house.code}-${body.meeting_date}.${ext}`).replace(/[^A-Za-z0-9._ -]/g,'_');
  const file=await storage.createFile({bucketId:BUCKET,fileId:ID.unique(),file:InputFile.fromBuffer(buf,name),permissions:[],folder:`photos/${house.code}/${String(body.meeting_date||'').slice(0,4)}`});
  return {id:file.$id,name};
}
async function publicPayload(s){
  const [configs,comms]=await Promise.all([listAll(s.tables,T.config),listAll(s.tables,T.communications)]);
  return {config:configs.find(x=>x.active!==false)||null,communications:comms.filter(x=>isVisible(x,null)).sort((a,b)=>(b.priority||0)-(a.priority||0))};
}
async function housePayload(s,code){
  const [houses,networks,reports,comms,mats,configs]=await Promise.all([
    listAll(s.tables,T.houses),listAll(s.tables,T.networks),listAll(s.tables,T.reports),listAll(s.tables,T.communications),listAll(s.tables,T.materials),listAll(s.tables,T.config)
  ]);
  const h=houses.find(x=>x.code===code&&x.active!==false);if(!h)return null;
  const n=networks.find(x=>x.id===h.network_id);const hr=reports.filter(x=>x.house_id===h.id).sort((a,b)=>String(b.meeting_date).localeCompare(String(a.meeting_date)));
  const visibleMats=mats.filter(m=>m.active!==false&&(!m.network_id||m.network_id===h.network_id)&&(!m.house_id||m.house_id===h.id));
  const [materials,recent]=await Promise.all([
    Promise.all(visibleMats.map(m=>signedMaterial(m,s))),
    Promise.all(hr.slice(0,8).map(r=>signedPhoto(r,s)))
  ]);
  return {
    config:configs.find(x=>x.active!==false)||null,
    house:{id:h.id,code:h.code,name:h.name,network:n?.name||'',leaders:h.leader_full_names?.length?h.leader_full_names:(h.leader_names||[]),vision:h.vision||''},
    house_profile:h,
    metrics:metrics(hr),recent,
    communications:comms.filter(c=>isVisible(c,h)).sort((a,b)=>(b.priority||0)-(a.priority||0)),
    materials
  };
}

module.exports=async ({req,res,log,error})=>{
  try{
    const s=services(req);const url=new URL(req.url||'http://local/');const publicMode=url.searchParams.get('public')==='1';const code=(url.searchParams.get('id')||req.headers['x-house-id']||'').replace(/\D/g,'').slice(0,4);
    if(req.method==='GET'&&publicMode)return res.json(await publicPayload(s));
    if(req.method==='GET'){
      if(!/^\d{4}$/.test(code))return res.json({error:'ID da House inválido'},400);
      const payload=await housePayload(s,code);return payload?res.json(payload):res.json({error:'House não encontrada'},404);
    }
    if(req.method==='POST'){
      if(!/^\d{4}$/.test(code))return res.json({error:'ID da House inválido'},400);
      const houses=await listAll(s.tables,T.houses);const house=houses.find(x=>x.code===code&&x.active!==false);if(!house)return res.json({error:'House não encontrada'},404);
      const b=req.bodyJson||{};
      if(b.action==='update_meeting_date'){
        if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(b.meeting_date||'')))return res.json({error:'Data inválida'},400);
        const allReports=await listAll(s.tables,T.reports);
        const report=allReports.find(x=>x.id===String(b.report_id||'')&&x.house_id===house.id);
        if(!report)return res.json({error:'Registro do encontro não encontrado'},404);
        const conflict=allReports.find(x=>x.id!==report.id&&x.house_id===house.id&&x.meeting_date===b.meeting_date);
        if(conflict)return res.json({error:'Já existe um encontro registrado nessa data'},409);
        const updated=await s.tables.updateRow({databaseId:DB,tableId:T.reports,rowId:report.id,data:{meeting_date:b.meeting_date}});
        log(`Data do encontro ${report.id} alterada de ${report.meeting_date} para ${b.meeting_date}`);
        return res.json({ok:true,report:clean(updated)});
      }
      if(b.action==='update_address'){
        const addressData={
          address_line:String(b.address_line||'').trim()||null,
          neighborhood:String(b.neighborhood||'').trim()||null,
          postal_code:String(b.postal_code||'').trim()||null,
          city:String(b.city||'').trim()||null,
          state:String(b.state||'').trim().toUpperCase().slice(0,2)||null
        };
        const updated=await s.tables.updateRow({databaseId:DB,tableId:T.houses,rowId:house.id,data:addressData});
        log(`Endereço atualizado para ${house.code}`);
        return res.json({ok:true,house_profile:clean(updated)});
      }if(!/^\d{4}-\d{2}-\d{2}$/.test(String(b.meeting_date||'')))return res.json({error:'Data inválida'},400);
      const allReports=await listAll(s.tables,T.reports);const existing=allReports.find(x=>x.house_id===house.id&&x.meeting_date===b.meeting_date);
      const photo=await savePhoto(s.storage,house,b);
      const data={
        house_id:house.id,meeting_date:b.meeting_date,status:b.status==='cancelado'?'cancelado':'realizado',
        attendance_total:Math.max(0,Number(b.attendance_total)||0),first_time:Math.max(0,Number(b.first_time)||0),children:Math.max(0,Number(b.children)||0),decisions_for_jesus:Math.max(0,Number(b.decisions_for_jesus)||0),
        cancellation_reason:b.cancellation_reason||null,leader_message:b.leader_message||null,notes:b.notes||null,
        photo_file_id:photo?.id||existing?.photo_file_id||null,photo_name:photo?.name||existing?.photo_name||null,care_status:existing?.care_status||'novo',pastoral_response:existing?.pastoral_response||null
      };
      let row;
      try{
        if(existing) row=await s.tables.updateRow({databaseId:DB,tableId:T.reports,rowId:existing.id,data});
        else row=await s.tables.createRow({databaseId:DB,tableId:T.reports,rowId:ID.unique(),data});
      }catch(saveError){
        if(photo?.id){try{await s.storage.deleteFile({bucketId:BUCKET,fileId:photo.id})}catch{}}
        throw saveError;
      }
      if(photo&&existing?.photo_file_id&&existing.photo_file_id!==photo.id){
        try{await s.storage.deleteFile({bucketId:BUCKET,fileId:existing.photo_file_id})}catch{}
      }
      const saved=await signedPhoto(clean(row),s);
      log(`Registro salvo para ${house.code} em ${b.meeting_date} com dados e foto persistentes`);
      return res.json({ok:true,report:saved});
    }
    return res.json({error:'Método não permitido'},405);
  }catch(e){error(e?.stack||e?.message||String(e));return res.json({error:e?.message||'Erro interno'},500)}
};
