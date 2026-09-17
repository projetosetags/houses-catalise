import { Client, TablesDB, Storage, Query, ID, InputFile } from 'node-appwrite';
import { createHash } from 'node:crypto';

const DB='houses_catalise';
const BUCKET='houses_files';
const T={networks:'networks',houses:'houses',reports:'meeting_reports',communications:'communications',materials:'materials',admins:'admin_access',config:'app_config'};

function services(req){
  const client=new Client().setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(req.headers['x-appwrite-key']);
  return {tables:new TablesDB(client),storage:new Storage(client)};
}
function clean(r){return r?{...r,id:r.$id}:r}
async function listAll(tables,tableId){const r=await tables.listRows({databaseId:DB,tableId,queries:[Query.limit(5000)],total:false});return (r.rows||[]).map(clean)}
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
async function authorized(tables,req,body){
  const u=new URL(req.url||'http://local/');const token=u.searchParams.get('token')||req.headers['x-admin-token']||body?._token||'';
  if(!token)return false;const admins=await listAll(tables,T.admins);const h=hash(token);return admins.some(a=>a.active!==false&&a.token_hash===h);
}
function asList(v){return Array.isArray(v)?v:String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
function reportMetrics(reports){
  const sorted=reports.slice().sort((a,b)=>String(b.meeting_date).localeCompare(String(a.meeting_date))),last8=sorted.slice(0,8),done=last8.filter(x=>x.status==='realizado');
  const sum=k=>done.reduce((s,x)=>s+(Number(x[k])||0),0);return {valid_records:last8.length,regularity_pct:Math.round(Math.min(100,last8.length/8*100)),avg_attendance:done.length?Math.round(sum('attendance_total')/done.length):0,attendance:sum('attendance_total'),first_time:sum('first_time'),children:sum('children'),decisions:sum('decisions_for_jesus'),last_record:sorted[0]?.meeting_date||null};
}
function weekStart(date){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d.toISOString().slice(0,10)}
function weekly(reports){
  const now=new Date();const arr=[];for(let i=7;i>=0;i--){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));d.setUTCDate(d.getUTCDate()-d.getUTCDay()-i*7);const k=d.toISOString().slice(0,10);const rs=reports.filter(r=>weekStart(r.meeting_date)===k&&r.status==='realizado');arr.push({week_start:k,label:`${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`,attendance:rs.reduce((s,r)=>s+(Number(r.attendance_total)||0),0),reports:rs.length})}return arr;
}
function dataUrl(v,max=20*1024*1024){const m=String(v||'').match(/^data:([^;]+);base64,(.+)$/s);if(!m)throw Error('Arquivo inválido');const buf=Buffer.from(m[2],'base64');if(buf.length>max)throw Error('Arquivo acima do limite de 20 MB');return {mime:m[1],buf}}
async function uploadMaterial(storage,b){
  if(!b.material_data_url)return null;const {mime,buf}=dataUrl(b.material_data_url);const name=String(b.file_name||'material.pdf').replace(/[^A-Za-z0-9._ -]/g,'_');
  const file=await storage.createFile({bucketId:BUCKET,fileId:ID.unique(),file:InputFile.fromBuffer(buf,name),permissions:[],folder:`materials/${b.week_start||'geral'}`});return {id:file.$id,name,mime};
}
async function snapshot(s){
  const [networks,houses0,reports0,communications,materials]=await Promise.all([listAll(s.tables,T.networks),listAll(s.tables,T.houses),listAll(s.tables,T.reports),listAll(s.tables,T.communications),listAll(s.tables,T.materials)]);
  const netMap=new Map(networks.map(n=>[n.id,n]));
  const houses=houses0.map(h=>({...h,networks:{id:h.network_id,name:netMap.get(h.network_id)?.name||''}}));const houseMap=new Map(houses.map(h=>[h.id,h]));
  const reports=reports0.slice().sort((a,b)=>String(b.meeting_date).localeCompare(String(a.meeting_date))).map(r=>({...r,houses:houseMap.get(r.house_id)||null}));
  const houseMetrics=houses.filter(h=>h.active!==false).map(h=>({id:h.id,code:h.code,name:h.name,network:h.networks?.name||'',leaders:h.leader_names||[],leader_full_names:h.leader_full_names||[],...reportMetrics(reports0.filter(r=>r.house_id===h.id))}));
  const activeHouses=houses.filter(h=>h.active!==false);const realized=reports0.filter(r=>r.status==='realizado');
  const totals={houses:activeHouses.length,reports:reports0.length,attendance:realized.reduce((s,r)=>s+(Number(r.attendance_total)||0),0),first_time:realized.reduce((s,r)=>s+(Number(r.first_time)||0),0),children:realized.reduce((s,r)=>s+(Number(r.children)||0),0),decisions:realized.reduce((s,r)=>s+(Number(r.decisions_for_jesus)||0),0)};
  const byNetwork=networks.map(n=>{const hs=activeHouses.filter(h=>h.network_id===n.id),ids=new Set(hs.map(h=>h.id)),rs=reports0.filter(r=>ids.has(r.house_id)),done=rs.filter(r=>r.status==='realizado');const possible=hs.length*8;return {id:n.id,name:n.name,houses:hs.length,regularity_pct:possible?Math.round(Math.min(100,rs.length/possible*100)):0,attendance:done.reduce((s,r)=>s+(Number(r.attendance_total)||0),0),first_time:done.reduce((s,r)=>s+(Number(r.first_time)||0),0),children:done.reduce((s,r)=>s+(Number(r.children)||0),0),decisions:done.reduce((s,r)=>s+(Number(r.decisions_for_jesus)||0),0)}});
  const care=reports.filter(r=>r.leader_message&&r.care_status!=='concluido');
  return {networks,houses,reports,communications:communications.filter(x=>x.active!==false),materials:materials.filter(x=>x.active!==false),houseMetrics,totals,weeks:weekly(reports0),byNetwork,care};
}
async function action(s,b){
  switch(b.action){
    case 'create_network': return clean(await s.tables.createRow({databaseId:DB,tableId:T.networks,rowId:ID.unique(),data:{name:String(b.name||'').trim(),leader_name:b.leader_name||null,coordinator_name:b.coordinator_name||null,active:true}}));
    case 'create_house': {
      const code=String(b.code||'').replace(/\D/g,'').slice(0,4);if(!/^\d{4}$/.test(code))throw Error('Código da House deve ter 4 dígitos');
      const all=await listAll(s.tables,T.houses);if(all.some(h=>h.code===code))throw Error('Este código de House já existe');
      return clean(await s.tables.createRow({databaseId:DB,tableId:T.houses,rowId:ID.unique(),data:{code,name:String(b.name||'').trim(),network_id:b.network_id||null,leader_names:asList(b.leader_names),leader_full_names:asList(b.leader_full_names),address_line:b.address_line||null,neighborhood:b.neighborhood||null,city:b.city||null,state:b.state||'SC',postal_code:b.postal_code||null,meeting_day:b.meeting_day===''||b.meeting_day==null?null:Number(b.meeting_day),meeting_time:b.meeting_time||null,vision:b.vision||null,active:true}}));
    }
    case 'update_house': {
      if(!b.id)throw Error('House não informada');return clean(await s.tables.updateRow({databaseId:DB,tableId:T.houses,rowId:b.id,data:{name:String(b.name||'').trim(),network_id:b.network_id||null,leader_names:asList(b.leader_names),leader_full_names:asList(b.leader_full_names),address_line:b.address_line||null,neighborhood:b.neighborhood||null,city:b.city||null,state:b.state||'SC',postal_code:b.postal_code||null,meeting_day:b.meeting_day===''||b.meeting_day==null?null:Number(b.meeting_day),meeting_time:b.meeting_time||null}}));
    }
    case 'create_communication': return clean(await s.tables.createRow({databaseId:DB,tableId:T.communications,rowId:ID.unique(),data:{title:String(b.title||'').trim(),message:String(b.message||'').trim(),starts_on:b.starts_on||null,ends_on:b.ends_on||null,network_id:b.network_id||null,house_id:b.house_id||null,priority:Number(b.priority)||0,active:true}}));
    case 'delete_communication': await s.tables.deleteRow({databaseId:DB,tableId:T.communications,rowId:b.id});return {ok:true};
    case 'add_material': {
      const up=await uploadMaterial(s.storage,b);if(!up)throw Error('Arquivo do material não informado');
      return clean(await s.tables.createRow({databaseId:DB,tableId:T.materials,rowId:ID.unique(),data:{title:String(b.title||'').trim(),description:b.description||null,week_start:b.week_start||null,category:b.category||'principal',file_id:up.id,file_name:up.name,mime_type:b.mime_type||up.mime,allow_download:b.allow_download!==false,personalization_mode:b.personalization_mode||'none',audience:b.audience||'leaders',network_id:b.network_id||null,house_id:b.house_id||null,license_note:b.license_note||null,active:true}}));
    }
    case 'delete_material': {
      const mats=await listAll(s.tables,T.materials),m=mats.find(x=>x.id===b.id);if(m?.file_id){try{await s.storage.deleteFile({bucketId:BUCKET,fileId:m.file_id})}catch{}}
      await s.tables.deleteRow({databaseId:DB,tableId:T.materials,rowId:b.id});return {ok:true};
    }
    case 'update_care': return clean(await s.tables.updateRow({databaseId:DB,tableId:T.reports,rowId:b.id,data:{care_status:b.status||'em_acompanhamento',pastoral_response:b.pastoral_response||null}}));
    default: throw Error('Ação não reconhecida');
  }
}

export default async ({req,res,log,error})=>{
  try{
    const s=services(req),body=req.bodyJson||{};if(!(await authorized(s.tables,req,body)))return res.json({error:'Acesso não autorizado'},401);
    if(req.method==='GET')return res.json(await snapshot(s));
    if(req.method==='POST'){const out=await action(s,body);log(`Ação pastoral: ${body.action}`);return res.json({ok:true,result:out})}
    return res.json({error:'Método não permitido'},405);
  }catch(e){error(e?.stack||e?.message||String(e));return res.json({error:e?.message||'Erro interno'},500)}
};
