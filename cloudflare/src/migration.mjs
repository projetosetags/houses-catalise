import {SCHEMA,COLLECTIONS} from './schema.mjs';
import {Buffer} from 'node:buffer';
import {sameSecret,sha256} from './security.mjs';
import {checkID,cleanData,checkCollection,services} from './services.mjs';
export function migrationAuthorized(request,env) {
 const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 return env.MIGRATION_TOKEN?.length>=32 && sameSecret(token,env.MIGRATION_TOKEN);
}
export async function inventory(env) {
 const records=await env.DB.prepare('SELECT collection,COUNT(*) AS total FROM records GROUP BY collection').all();
 const files=await env.DB.prepare('SELECT id,name,mime,size,checksum FROM stored_files ORDER BY id').all();
 return {counts:Object.fromEntries(COLLECTIONS.map(c=>[c,records.results.find(x=>x.collection===c)?.total||0])),files:files.results};
}
export async function migration(request,env,url) {
 if(!migrationAuthorized(request,env))return Response.json({error:'Acesso não autorizado'},{status:401});
 if(url.pathname==='/migration/setup'&&request.method==='POST') {
  await env.DB.batch(SCHEMA.split(';').map(x=>x.trim()).filter(Boolean).map(x=>env.DB.prepare(x)));return Response.json({ok:true});
 }
 const state=await env.DB.prepare('SELECT ready FROM migration_state WHERE id=1').first();
 if(state?.ready)return Response.json({error:'Importação encerrada'},{status:409});
 if(url.pathname==='/migration/status'&&request.method==='GET')return Response.json(await inventory(env));
 const rows=url.pathname.match(/^\/migration\/rows\/([a-z_]+)$/);
 if(rows) {
  const collection=rows[1];checkCollection(collection);
  if(request.method==='GET') {
   const offset=Math.max(0,Number(url.searchParams.get('offset'))||0);
   const r=await env.DB.prepare('SELECT id,data,created_at,updated_at FROM records WHERE collection=? ORDER BY id LIMIT 100 OFFSET ?').bind(collection,offset).all();
   return Response.json({rows:r.results.map(x=>({id:x.id,data:JSON.parse(x.data),created_at:x.created_at,updated_at:x.updated_at}))});
  }
  if(request.method==='POST') {
   const body=await request.json();
   if(!Array.isArray(body.rows)||body.rows.length>500)throw Error('Lote de importação inválido');
   const now=new Date().toISOString();
   const statements=[env.DB.prepare('DELETE FROM records WHERE collection=?').bind(collection)];
   for(const row of body.rows)statements.push(env.DB.prepare('INSERT INTO records(collection,id,data,created_at,updated_at) VALUES(?,?,?,?,?)').bind(collection,checkID(row.id),JSON.stringify(cleanData(row.data)),row.created_at||now,row.updated_at||now));
   await env.DB.batch(statements);return Response.json({ok:true,total:body.rows.length});
  }
 }
 const files=url.pathname.match(/^\/migration\/files\/([A-Za-z0-9_.-]+)$/);
 if(files) {
  const id=checkID(files[1]);
  if(request.method==='GET') {
   const value=await env.FILES.get(id,'arrayBuffer');
   return value?new Response(value):Response.json({error:'Arquivo não encontrado'},{status:404});
  }
  if(request.method==='PUT') {
   const buffer=await request.arrayBuffer();
   if(buffer.byteLength>20*1024*1024)throw Error('Arquivo acima de 20 MB');
   const checksum=sha256(Buffer.from(buffer));
   if(checksum!==request.headers.get('X-File-SHA256'))throw Error('Checksum divergente');
   const name=decodeURIComponent(request.headers.get('X-File-Name')||'arquivo').slice(0,255),mime=request.headers.get('Content-Type')||'application/octet-stream';
   const old=await env.DB.prepare('SELECT checksum FROM stored_files WHERE id=?').bind(id).first();
   if(old&&old.checksum!==checksum)throw Error('Arquivo mudou na origem; reinicie a conferência');
   await env.FILES.put(id,buffer,{metadata:{name,mime,size:buffer.byteLength,checksum}});
   await env.DB.prepare('INSERT OR REPLACE INTO stored_files(id,name,mime,size,checksum,owner,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,name,mime,buffer.byteLength,checksum,'import',new Date().toISOString()).run();
   return Response.json({ok:true,checksum,size:buffer.byteLength});
  }
 }
 if(url.pathname==='/migration/complete'&&request.method==='POST') {
  const expected=await request.json(),actual=await inventory(env);
  if(COLLECTIONS.some(c=>actual.counts[c]!==expected.counts?.[c]))throw Error('Contagem de registros divergente');
  if(actual.files.length!==expected.files?.length || actual.files.some(f=>!expected.files.some(e=>e.id===f.id&&e.size===f.size&&e.checksum===f.checksum)))throw Error('Conferência de arquivos divergente');
  await env.DB.prepare('UPDATE migration_state SET ready=1 WHERE id=1').run();return Response.json({ok:true,ready:true});
 }
 return Response.json({error:'Rota não encontrada'},{status:404});
}
