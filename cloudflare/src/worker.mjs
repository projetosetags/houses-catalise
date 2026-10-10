import houses from './houses-api.mjs';
import pastoral from './pastoral-api.mjs';
import {services,ID,checkID} from './services.mjs';
import {SCHEMA} from './schema.mjs';
import {migration} from './migration.mjs';
import {sha256,validFileToken} from './security.mjs';
import {Buffer} from 'node:buffer';
const ORIGIN='https://projetosetags.github.io';
export async function adminAuthorized(request,s,body={}) {
 const u=new URL(request.url),token=request.headers.get('X-Admin-Token')||u.searchParams.get('token')||body._token||'';
 if(!token)return false;
 const r=await s.tables.listRows({tableId:'admin_access',filters:[['token_hash',sha256(String(token))]]});
 return r.rows.some(x=>x.active!==false);
}
async function route(request,env) {
 const url=new URL(request.url);
 if(url.pathname.startsWith('/migration/'))return migration(request,env,url);
 if(url.pathname==='/'||url.pathname==='/health') {
  await env.DB.prepare('SELECT 1 AS ok').first();await env.FILES.get('__connection_test__');
  let ready=false;try{ready=!!(await env.DB.prepare('SELECT ready FROM migration_state WHERE id=1').first())?.ready;}catch{}
  return Response.json({banco:'OK',arquivos:'OK',migracao:ready?'Concluída':'Ainda pendente',backend:'cloudflare'});
 }
 const state=await env.DB.prepare('SELECT ready FROM migration_state WHERE id=1').first();
 if(!state?.ready)return Response.json({error:'Migração ainda não concluída'},{status:503});
 const s=services(env,url.origin);s.env=env;
 const file=url.pathname.match(/^\/storage\/buckets\/houses_files\/files\/([A-Za-z0-9_.-]+)\/(view|download)$/);
 if(file&&['GET','HEAD'].includes(request.method)) {
  const id=checkID(file[1]);
  if(!validFileToken(env,id,url.searchParams.get('token')))return Response.json({error:'Link expirado ou inválido'},{status:403});
  const meta=await env.DB.prepare('SELECT name,mime,size FROM stored_files WHERE id=?').bind(id).first();
  if(!meta)return Response.json({error:'Arquivo não encontrado'},{status:404});
  const value=request.method==='HEAD'?null:await env.FILES.get(id,'arrayBuffer');
  if(request.method!=='HEAD'&&!value)return Response.json({error:'Arquivo ainda não disponível; tente novamente'},{status:503});
  const name=meta.name.replace(/[\r\n"\\]/g,'_');
  return new Response(value,{headers:{'Content-Type':meta.mime,'Content-Length':String(meta.size),'Content-Disposition':`${file[2]==='download'?'attachment':'inline'}; filename="${name.replace(/[^\x20-\x7E]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(url.pathname==='/upload'&&request.method==='POST') {
  let owner,max=20*1024*1024;
  if(await adminAuthorized(request,s))owner='admin';
  else {
   const code=url.searchParams.get('id')||'';if(!/^\d{4}$/.test(code))return Response.json({error:'House inválida'},{status:401});
   const rows=await s.tables.listRows({tableId:'houses',filters:[['code',code]]});
   const house=rows.rows.find(x=>x.active!==false);if(!house)return Response.json({error:'House não encontrada'},{status:404});
   owner='house:'+house.$id;max=8*1024*1024;
  }
  const mime=request.headers.get('Content-Type')||'';
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(mime) || (owner!=='admin'&&mime==='application/pdf'))return Response.json({error:'Formato de arquivo não permitido'},{status:400});
  if(Number(request.headers.get('Content-Length'))>max)return Response.json({error:'Arquivo acima do limite'},{status:413});
  const buffer=await request.arrayBuffer();if(buffer.byteLength>max||!buffer.byteLength)return Response.json({error:'Tamanho de arquivo inválido'},{status:413});
  const id=ID.unique(),name=decodeURIComponent(request.headers.get('X-File-Name')||'arquivo').slice(0,255);
  await s.storage.createFile({fileId:id,file:{buffer:Buffer.from(buffer),name,mime},owner});
  return Response.json({ok:true,id,name,mime});
 }
 if(!['/houses-api','/pastoral-api'].includes(url.pathname))return Response.json({error:'Rota não encontrada'},{status:404});
 if(!['GET','POST'].includes(request.method))return Response.json({error:'Método não permitido'},{status:405});
 let body={};if(request.method==='POST') {
  if(Number(request.headers.get('Content-Length'))>256*1024)return Response.json({error:'Corpo da requisição acima do limite'},{status:413});
  const raw=await request.text();if(raw.length>256*1024)return Response.json({error:'Corpo da requisição acima do limite'},{status:413});
  try{body=JSON.parse(raw);}catch{return Response.json({error:'JSON inválido'},{status:400});}
 }
 const req={url:request.url,method:request.method,headers:Object.fromEntries(request.headers),body,bodyJson:body,services:s};
 const res={json:(data,status=200)=>Response.json(status>=500?{error:'Não foi possível concluir a operação'}:data,{status})};
 return (url.pathname==='/houses-api'?houses:pastoral)({req,res,log:()=>{},error:()=>{}});
}
export default {
 async fetch(request,env) {
  const origin=request.headers.get('Origin');
  if(origin&&origin!==ORIGIN)return Response.json({error:'Origem não permitida'},{status:403});
  let response;
  if(request.method==='OPTIONS')response=new Response(null,{status:204});
  else try{response=await route(request,env);}catch {response=Response.json({error:'Não foi possível concluir a operação; confira a configuração e tente novamente'},{status:500});}
  const headers=new Headers(response.headers);
  if(origin===ORIGIN){headers.set('Access-Control-Allow-Origin',ORIGIN);headers.set('Vary','Origin');}
  headers.set('Access-Control-Allow-Methods','GET,HEAD,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers','Content-Type,X-Admin-Token,X-House-Id,X-File-Name');
  if(!headers.has('Cache-Control'))headers.set('Cache-Control','no-store');
  headers.set('X-Houses-Backend','cloudflare');
  return new Response(response.body,{status:response.status,headers});
 }
};
