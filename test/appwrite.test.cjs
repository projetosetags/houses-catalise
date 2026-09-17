'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createAPI}=require('../functions/core.cjs');
const {Store}=require('../functions/appwrite.cjs');
const {CHUNK}=require('../functions/uploads.cjs');
const m=require('../functions/model.cjs');
class MemoryStore{
 constructor(data={}){this.data=structuredClone(data);this.held=new Set();}
 async get(t,id,optional=false){const v=this.data[t]?.[id];if(!v&&!optional)m.fail('Cadastro não encontrado.','not-found');return v?structuredClone({...v,id}):null;}
 async list(t,filters=[]){return Object.entries(this.data[t]||{}).map(([id,v])=>structuredClone({...v,id})).filter(v=>filters.every(([op,k,x])=>op==='gte'?v[k]>=x:v[k]===x));}
 async create(t,id,v){if(this.data[t]?.[id])m.fail('Já existe.','already-exists');return this.put(t,id,v);}
 async put(t,id,v){this.data[t]??={};this.data[t][id]=structuredClone(v);return this.get(t,id);}
 async patch(t,id,v){return this.put(t,id,{...await this.get(t,id),...v});}
 async remove(t,id){delete this.data[t]?.[id];}
 async atomic(fn){const tx=new MemoryStore(this.data);const result=await fn(tx);this.data=tx.data;return result;}
 async lock(key,fn){if(this.held.has(key))m.fail('Envio em andamento.','conflict');this.held.add(key);try{return await fn();}finally{this.held.delete(key);}}
}
function fixture(){
 const store=new MemoryStore({networks:{'rede-04':{name:'Rede 04'},'rede-03':{name:'Rede 03'}},houses:{'0119':{code:'H-0119',name:'Teste A',network_id:'rede-04',active:true},'0001':{code:'H-0001',name:'Teste B',network_id:'rede-04',active:true},'0002':{code:'H-0002',name:'Teste C',network_id:'rede-03',active:true}},users:{admin:{name:'Admin',email:'admin@example.invalid',role:'admin',active:true},leader:{name:'Líder',role:'leader',active:true,house_ids:['0119'],network_ids:['rede-04']},other:{name:'Outro',role:'leader',active:true,house_ids:['0001'],network_ids:['rede-04']},pastor:{name:'Pastor',role:'pastor',active:true,network_ids:['rede-04']},disabled:{role:'admin',active:false}}});
 const objects=new Map(),files={async write(id,bytes,name,folder){if(objects.has(id))throw Object.assign(Error('exists'),{code:409});objects.set(id,{bytes:Buffer.from(bytes),name,folder});return {$id:id};},async bytes(id){if(!objects.has(id))throw Object.assign(Error('missing'),{code:404});return objects.get(id).bytes;},async remove(id){objects.delete(id);},async link(id){assert.ok(objects.has(id));return 'https://files.example.invalid/'+id+'?token=temporary';}};
 const accounts={async ensure(email){return {$id:email.startsWith('admin')?'admin':'new-user'};},async activate(){},async disable(){}};
 const api=createAPI({store,files,accounts});return {store,files,objects,call:(user,action,body={})=>api.dispatch(user,{...body,action})};
}
const report={house_id:'0119',meeting_date:'2026-09-01',status:'realizado',attendance_total:12,first_time:2,children:3,decisions_for_jesus:1};
async function upload(f,user,bytes,body){
 const draft=await f.call(user,'begin_upload',{...body,size:bytes.length});
 for(let offset=0,index=0;offset<bytes.length;offset+=draft.chunk_size,index++)await f.call(user,'upload_chunk',{...draft,index,bytes:bytes.subarray(offset,offset+draft.chunk_size).toString('base64')});
 await f.call(user,'finish_upload',{...draft,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});return draft.id;
}
test('API exige perfil ativo e mantém isolamento entre líderes e Redes',async()=>{
 const f=fixture();await assert.rejects(f.call(null,'profile'),{code:'unauthenticated'});await assert.rejects(f.call('disabled','profile'),{code:'permission-denied'});
 await assert.rejects(f.call('leader','leader_snapshot',{house_id:'0001'}),{code:'permission-denied'});await assert.rejects(f.call('leader','pastoral_snapshot'),{code:'permission-denied'});
 const pastoral=await f.call('pastor','pastoral_snapshot');assert.deepEqual(pastoral.houses.map(h=>h.id).sort(),['0001','0119']);
 await assert.rejects(f.call('leader','save_user',{role:'admin'}),{code:'permission-denied'});
 await assert.rejects(f.call('admin','disable_user',{id:'admin'}));
});
test('foto é obrigatória; correção mantém uma reunião e troca a foto só depois de salvar',async()=>{
 const f=fixture();await assert.rejects(f.call('leader','save_report',report),{code:'failed-precondition'});
 const photo=Buffer.from([255,216,255,224,1,2,3,4]);
 let upload_id=await upload(f,'leader',photo,{...report,purpose:'photo'});await f.call('leader','save_report',{...report,upload_id,leader_message:'Acompanhamento'});
 const first=await f.store.get('reports','0119_2026-09-01');assert.equal(f.objects.size,1);assert.equal((await f.store.get('care',first.id)).status,'pendente');
 upload_id=await upload(f,'leader',Buffer.concat([photo,Buffer.from([5])]),{...report,purpose:'photo'});
 assert.ok(f.objects.has(first.file_id),'a foto anterior permanece durante o envio');
 await f.call('leader','save_report',{...report,upload_id,attendance_total:15});
 const updated=await f.store.get('reports',first.id);assert.notEqual(updated.file_id,first.file_id);assert.equal(updated.attendance_total,15);assert.equal(f.objects.size,1);assert.equal((await f.store.list('reports')).length,1);
 await assert.rejects(f.call('other','file_link',{path:updated.photo_path}),{code:'permission-denied'});
 assert.ok((await f.call('pastor','file_link',{path:updated.photo_path})).url);
 await f.call('leader','save_report',{...report,status:'cancelado',cancellation_reason:'Viagem'});assert.equal(f.objects.size,0);assert.equal((await f.store.get('reports',first.id)).file_id,null);
});
test('valida tamanho, formato, sequência, autor e integridade dos arquivos',async()=>{
 const f=fixture(),draft=await f.call('leader','begin_upload',{...report,purpose:'photo',size:CHUNK+5});
 await assert.rejects(f.call('other','upload_chunk',{...draft,index:0,bytes:''}),{code:'permission-denied'});
 await assert.rejects(f.call('leader','upload_chunk',{...draft,index:1,bytes:Buffer.alloc(5).toString('base64')}));
 await assert.rejects(f.call('leader','upload_chunk',{...draft,index:0,bytes:Buffer.alloc(CHUNK).toString('base64')}));
 const part=Buffer.alloc(CHUNK);part.set([255,216,255]);await f.call('leader','upload_chunk',{...draft,index:0,bytes:part.toString('base64')});
 await f.call('leader','upload_chunk',{...draft,index:0,bytes:part.toString('base64')});assert.equal(f.objects.size,1,'repetir uma parte não duplica o arquivo');
 await assert.rejects(f.call('leader','finish_upload',{...draft,sha256:'bad'}),{code:'failed-precondition'});
 await f.call('leader','upload_chunk',{...draft,index:1,bytes:Buffer.alloc(5).toString('base64')});
 await assert.rejects(f.call('leader','finish_upload',{...draft,sha256:'bad'}));
 await assert.rejects(f.call('leader','begin_upload',{...report,purpose:'photo',size:5*1024*1024+1}));
 await assert.rejects(f.call('leader','begin_upload',{purpose:'material',size:100}),{code:'permission-denied'});
});
test('PDF por público: material em preparação não aparece e substituição é atômica para leitores',async()=>{
 const f=fixture(),input={purpose:'material',title:'Material semanal',mime_type:'application/pdf',file_name:'estudo.pdf',week_start:'2026-09-01',house_id:'0119',allow_download:true};
 const upload_id=await upload(f,'admin',Buffer.from('%PDF-1.4\nPDF de teste'),input);
 assert.equal((await f.call('leader','leader_snapshot',{house_id:'0119'})).materials.length,0);
 const saved=await f.call('admin','finish_material',{upload_id});let material=await f.store.get('materials',saved.id);
 assert.equal((await f.call('leader','leader_snapshot',{house_id:'0119'})).materials.length,1);
 assert.equal((await f.call('other','leader_snapshot',{house_id:'0001'})).materials.length,0);
 await assert.rejects(f.call('other','file_link',{path:material.storage_path}),{code:'permission-denied'});
 assert.ok((await f.call('leader','file_link',{path:material.storage_path,download:true})).url);
 const replacement=await upload(f,'admin',Buffer.from('%PDF-1.5\nnovo'),{...input,material_id:saved.id});assert.ok(f.objects.has(material.file_id));
 await f.call('admin','finish_material',{upload_id:replacement});assert.equal(f.objects.size,1);
 material=await f.store.patch('materials',saved.id,{allow_download:false});await assert.rejects(f.call('leader','file_link',{path:material.storage_path,download:true}),{code:'permission-denied'});
 await f.call('admin','delete_material',{id:saved.id});await assert.rejects(f.call('leader','file_link',{path:material.storage_path}),{code:'permission-denied'});assert.equal(f.objects.size,1,'arquivamento mantém original');
});
test('envio antigo não pode finalizar um envio novo e uma House não usa foto de outra data',async()=>{
 const f=fixture(),photo=Buffer.from([255,216,255,0]);
 const old=await f.call('leader','begin_upload',{...report,purpose:'photo',size:4});
 const newer=await f.call('leader','begin_upload',{...report,purpose:'photo',size:4});
 await assert.rejects(f.call('leader','upload_chunk',{...old,index:0,bytes:photo.toString('base64')}));
 const id=await upload(f,'leader',photo,{...report,purpose:'photo'});
 await assert.rejects(f.call('leader','save_report',{...report,meeting_date:'2026-09-02',upload_id:id}));
 assert.notEqual(old.generation,newer.generation);
});
test('handler ignora user-id forjado sem um JWT válido',async()=>{
 const handler=require('../functions/index.cjs');let response;
 await handler({req:{headers:{'x-appwrite-user-id':'admin'},bodyJson:{action:'list_users'}},res:{json:(body,status)=>{response={body,status};}},error:()=>{}});
 assert.equal(response.status,401);
});
test('limpeza automática remove envios vencidos sem tocar na foto já registrada',async()=>{
 const f=fixture(),id=await upload(f,'leader',Buffer.from([255,216,255,0]),{...report,purpose:'photo'});
 const ticket=await f.store.get('uploads',id);
 await f.store.put('reports','0119_2026-09-01',{...report,file_id:ticket.file_id});
 await f.store.patch('uploads',id,{expires_at:'2020-01-01T00:00:00.000Z'});
 const {cleanup}=require('../functions/cleanup.cjs');assert.equal(await cleanup(f),1);assert.ok(f.objects.has(ticket.file_id));assert.equal(f.objects.size,1);assert.equal((await f.store.list('uploads')).length,0);
});
test('adapter pagina todos os registros e mantém permissões vazias nas gravações',async()=>{
 const calls=[],rows=Array.from({length:105},(_,i)=>({$id:String(i).padStart(4,'0'),payload:JSON.stringify({name:'Registro '+i})}));
 const api={async listRows(p){calls.push(p);return {rows:calls.length===1?rows.slice(0,100):rows.slice(100)};},async createRow(p){assert.deepEqual(p.permissions,[]);return {$id:p.rowId,...p.data};}};
 const store=new Store(api,'houses');assert.equal((await store.list('houses')).length,105);assert.equal(calls.length,2);assert.ok(calls[1].queries.some(q=>q.includes('cursorAfter')));await store.create('reports','0119_2026-09-01',report);
});
