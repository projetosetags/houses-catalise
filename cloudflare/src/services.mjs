import {randomUUID} from 'node:crypto';
import {COLLECTIONS} from './schema.mjs';
import {sha256,fileToken} from './security.mjs';
export const ID={unique:()=>randomUUID()};
export const InputFile={fromBuffer:(buffer,name)=>({buffer,name})};
export function cleanData(input) {
 const data={...(input.data && typeof input.data==='object'?input.data:input)};
 for(const key of Object.keys(data))if(key.startsWith('$')||key==='id')delete data[key];
 return data;
}
export function checkCollection(collection) {if(!COLLECTIONS.includes(collection))throw Error('Coleção inválida');}
export function checkID(id) {if(!/^[A-Za-z0-9_.-]{1,100}$/.test(String(id)))throw Error('ID inválido');return String(id);}
function decode(row) {return row?{...JSON.parse(row.data),$id:row.id,$createdAt:row.created_at,$updatedAt:row.updated_at}:null;}
export function services(env,origin) {
 const tables={
  async listRows({tableId,filters=[]}) {
   checkCollection(tableId);
   let sql='SELECT * FROM records WHERE collection=?',args=[tableId];
   for(const [key,value] of filters){if(!/^[a-z_]+$/.test(key))throw Error('Filtro inválido');sql+=` AND json_extract(data,'$.${key}')=?`;args.push(value);}
   const r=await env.DB.prepare(sql+' ORDER BY id LIMIT 5001').bind(...args).all();
   if(r.results.length>5000)throw Error('Coleção acima do limite de leitura; pagine a API');
   return {rows:r.results.map(decode)};
  },
  async getRow({tableId,rowId}) {checkCollection(tableId);return decode(await env.DB.prepare('SELECT * FROM records WHERE collection=? AND id=?').bind(tableId,checkID(rowId)).first());},
  async createRow({tableId,rowId,data}) {
   checkCollection(tableId);checkID(rowId);const now=new Date().toISOString();
   await env.DB.prepare('INSERT INTO records(collection,id,data,created_at,updated_at) VALUES(?,?,?,?,?)').bind(tableId,rowId,JSON.stringify(cleanData(data)),now,now).run();
   return tables.getRow({tableId,rowId});
  },
  async updateRow({tableId,rowId,data}) {
   checkCollection(tableId);checkID(rowId);const patch=cleanData(data),keys=Object.keys(patch);
   if(keys.some(key=>! /^[a-z_]+$/.test(key)))throw Error('Campo inválido');
   const expressions=keys.map(key=>`'$.${key}',json(?)`).join(',');
   const json=keys.length?`json_set(data,${expressions})`:'data';
   const result=await env.DB.prepare(`UPDATE records SET data=${json},updated_at=? WHERE collection=? AND id=?`).bind(...keys.map(key=>JSON.stringify(patch[key])),new Date().toISOString(),tableId,rowId).run();
   if(!result.meta.changes)throw Error('Registro não encontrado');
   return tables.getRow({tableId,rowId});
  },
  async deleteRow({tableId,rowId}) {checkCollection(tableId);await env.DB.prepare('DELETE FROM records WHERE collection=? AND id=?').bind(tableId,checkID(rowId)).run();}
 };
 const storage={
  async createFile({fileId,file,owner='legacy'}) {
   checkID(fileId);const buffer=file.buffer;
   if(buffer.byteLength>20*1024*1024)throw Error('Arquivo acima de 20 MB');
   const checksum=sha256(buffer),now=new Date().toISOString(),name=String(file.name||'arquivo').slice(0,255),mime=file.mime||'application/octet-stream';
   await env.FILES.put(fileId,buffer,{metadata:{name,mime,size:buffer.byteLength,checksum}});
   try{await env.DB.prepare('INSERT INTO stored_files(id,name,mime,size,checksum,owner,created_at) VALUES(?,?,?,?,?,?,?)').bind(fileId,name,mime,buffer.byteLength,checksum,owner,now).run();}
   catch(error){await env.FILES.delete(fileId);throw error;}
   return {$id:fileId,name};
  },
  async deleteFile({fileId}) {checkID(fileId);await env.FILES.delete(fileId);await env.DB.prepare('DELETE FROM stored_files WHERE id=?').bind(fileId).run();}
 };
 const tokens={async createFileToken({fileId,expire}) {return {secret:fileToken(env,checkID(fileId),new Date(expire).getTime())};}};
 return {tables,storage,tokens,endpoint:origin,project:'houses-catalise'};
}
export async function uploadedFile(s,id,owner) {
 const row=await s.env.DB.prepare('SELECT * FROM stored_files WHERE id=? AND owner=?').bind(checkID(id),owner).first();
 if(!row)throw Error('Arquivo enviado não encontrado ou sem permissão');
 return {id:row.id,name:row.name,mime:row.mime};
}
