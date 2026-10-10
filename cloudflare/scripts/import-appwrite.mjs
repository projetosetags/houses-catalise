import {createHash} from 'node:crypto';
const base='https://houses-api.phdbr68.workers.dev';
const source='https://fra.cloud.appwrite.io/v1';
const collections=['networks','houses','meeting_reports','communications','materials','pastoral_contacts','admin_access','app_config'];
const key=process.env.APPWRITE_API_KEY,token=process.env.CLOUDFLARE_MIGRATION_TOKEN;
if(!key||!token||token.length<32)throw Error('Configure APPWRITE_API_KEY e CLOUDFLARE_MIGRATION_TOKEN nos secrets do GitHub');
const sha=value=>createHash('sha256').update(value).digest('hex');
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
const signature=x=>sha(JSON.stringify(canonical(x)));
async function appwrite(path,binary=false){
 const r=await fetch(source+path,{headers:{'X-Appwrite-Project':'6aabcd0b000c5d1298ab','X-Appwrite-Key':key,'X-Appwrite-Response-Format':'2.0.0'}});
 if(!r.ok)throw Error(`Leitura da origem falhou (${r.status})`);
 return binary?Buffer.from(await r.arrayBuffer()):r.json();
}
async function cloudflare(path,{method='GET',body,headers={}}={},binary=false){
 for(let attempt=0;attempt<4;attempt++) {
  const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...headers},body});
  if([429,502,503,504].includes(r.status)&&attempt<3){await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));continue;}
  if(!r.ok)throw Error(`Destino recusou ${path} (${r.status}); a origem permanece intacta`);
  return binary?Buffer.from(await r.arrayBuffer()):r.json();
 }
}
async function list(path,field){
 const all=[];let cursor='';
 for(;;){const q=[{method:'limit',values:[100]}];if(cursor)q.push({method:'cursorAfter',values:[cursor]});
  const query=q.map(x=>'queries[]='+encodeURIComponent(JSON.stringify(x))).join('&');
  const page=await appwrite(path+'?'+query);const batch=page[field]||[];all.push(...batch);
  if(batch.length<100)return all;cursor=batch.at(-1).$id;
 }
}
function normalize(row){const data={...(row.data||row)};for(const k of Object.keys(data))if(k.startsWith('$')||k==='id')delete data[k];return{id:row.$id,data,created_at:row.$createdAt,updated_at:row.$updatedAt};}
async function sourceSnapshot(){
 const rows={};for(const c of collections)rows[c]=(await list('/tablesdb/houses_catalise/tables/'+c+'/rows','rows')).map(normalize).sort((a,b)=>a.id.localeCompare(b.id));
 const files=(await list('/storage/buckets/houses_files/files','files')).sort((a,b)=>a.$id.localeCompare(b.$id));return{rows,files};
}
await cloudflare('/migration/setup',{method:'POST'});
const snapshot=await sourceSnapshot(),manifest={counts:{},files:[]};
for(const c of collections){
 if(snapshot.rows[c].length>500)throw Error('Coleção acima de 500 registros: dividir a importação antes de continuar');
 await cloudflare('/migration/rows/'+c,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:snapshot.rows[c]})});manifest.counts[c]=snapshot.rows[c].length;
 console.log(c+': '+snapshot.rows[c].length+' registros importados');
}
for(const file of snapshot.files){
 const bytes=await appwrite('/storage/buckets/houses_files/files/'+encodeURIComponent(file.$id)+'/download',true),checksum=sha(bytes);
 if(bytes.length!==file.sizeOriginal)throw Error('Tamanho do arquivo diverge da origem');
 await cloudflare('/migration/files/'+encodeURIComponent(file.$id),{method:'PUT',body:bytes,headers:{'Content-Type':file.mimeType||'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-File-SHA256':checksum}});
 // KV can take time to propagate across regions. Verify actual bytes, not only metadata.
 let verified=false;
 for(let attempt=0;attempt<8;attempt++){
  try{const copy=await cloudflare('/migration/files/'+encodeURIComponent(file.$id),{},true);verified=sha(copy)===checksum;}catch{}
  if(verified)break;await new Promise(resolve=>setTimeout(resolve,10000));
 }
 if(!verified)throw Error('Arquivo não passou na conferência após propagação do KV');
 manifest.files.push({id:file.$id,size:bytes.length,checksum});console.log('Arquivo conferido: '+manifest.files.length+'/'+snapshot.files.length);
}
for(const c of collections){
 const received=[];for(let offset=0;;offset+=100){const page=await cloudflare('/migration/rows/'+c+'?offset='+offset);received.push(...page.rows);if(page.rows.length<100)break;}
 received.sort((a,b)=>a.id.localeCompare(b.id));
 if(signature(received)!==signature(snapshot.rows[c]))throw Error('Dados divergentes na coleção '+c);
}
const fresh=await sourceSnapshot();
if(signature(fresh)!==signature(snapshot))throw Error('A origem mudou durante a importação. Execute novamente antes de liberar o novo backend.');
await cloudflare('/migration/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(manifest)});
console.log('Importação encerrada: todos os registros e arquivos conferidos. O frontend ainda precisa passar pelos testes antes da troca.');
