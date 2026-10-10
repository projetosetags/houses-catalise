import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
execFileSync('./node_modules/.bin/wrangler',['deploy','--dry-run','--outdir','.test-build','--config','wrangler.jsonc'],{stdio:'pipe'});
const rootSecret='local-test-only-migration-root-secret-123456789';
const adminToken='local-test-pastoral';
const digest=v=>createHash('sha256').update(v).digest('hex');
const counts={networks:1,houses:1,meeting_reports:0,communications:1,materials:1,pastoral_contacts:1,admin_access:1,app_config:1};
const rows={
 networks:[{id:'network1',data:{name:'Rede 01',active:true}}],
 houses:[{id:'house1',data:{code:'0001',name:'Teste',network_id:'network1',leader_names:['Líder'],active:true}}],
 meeting_reports:[],
 communications:[{id:'notice1',data:{title:'Agenda Tubarão',message:'Aviso 1\nAviso 2',active:true}}],
 materials:[{id:'material1',data:{title:'Guia',file_id:'file1',active:true}}],
 pastoral_contacts:[{id:'pastor1',data:{name:'Pastor',phone:'123',active:true}}],
 admin_access:[{id:'admin1',data:{token_hash:digest(adminToken),active:true}}],
 app_config:[{id:'config1',data:{active:true,church_name:'Catalyst'}}]
};
test('Worker: importação íntegra, acesso pastoral, fotos, materiais e preservação dos encontros',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'houses-api',modules:true,scriptPath:new URL('../.test-build/worker.js',import.meta.url).pathname,modulesRoot:new URL('../.test-build',import.meta.url).pathname,compatibilityDate:'2026-10-10',compatibilityFlags:['nodejs_compat'],kvNamespaces:['FILES'],d1Databases:['DB'],bindings:{MIGRATION_TOKEN:rootSecret}}]}));
 const request=(path,options={})=>mf.dispatchFetch('https://houses-api.phdbr68.workers.dev'+path,options);
 const migrate=(path,options={})=>request(path,{...options,headers:{Authorization:'Bearer '+rootSecret,...options.headers}});
 const json=(body)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const postAdmin=(body)=>request('/pastoral-api',{...json(body),headers:{'Content-Type':'application/json','X-Admin-Token':adminToken}});
 try{
  assert.equal((await request('/health')).status,200);
  assert.equal((await request('/migration/setup',{method:'POST'})).status,401);
  assert.equal((await migrate('/migration/setup',{method:'POST'})).status,200);
  assert.equal((await request('/houses-api?id=0001')).status,503);
  for(const [collection,data]of Object.entries(rows))assert.equal((await migrate('/migration/rows/'+collection,json({rows:data}))).status,200,collection);
  // A failed full-collection replacement must roll back the deletion.
  assert.equal((await migrate('/migration/rows/houses',json({rows:[rows.houses[0],rows.houses[0]]}))).status,500);
  assert.equal((await (await migrate('/migration/status')).json()).counts.houses,1);
  const original=Buffer.from('%PDF-1.4\noriginal binary');
  assert.equal((await migrate('/migration/files/file1',{method:'PUT',headers:{'X-File-SHA256':digest(original),'X-File-Name':'guia.pdf','Content-Type':'application/pdf'},body:original})).status,200);
  assert.deepEqual(Buffer.from(await (await migrate('/migration/files/file1')).arrayBuffer()),original);
  assert.equal((await migrate('/migration/complete',json({counts:{...counts,houses:2},files:[]}))).status,500);
  assert.equal((await migrate('/migration/complete',json({counts,files:[{id:'file1',size:original.length,checksum:digest(original)}]}))).status,200);
  assert.equal((await migrate('/migration/rows/houses',json({rows:[]}))).status,409);
  assert.equal((await request('/pastoral-api')).status,401);
  assert.equal((await request('/pastoral-api',{headers:{'X-Admin-Token':'wrong'}})).status,401);
  assert.equal((await request('/houses-api?public=1',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const hResponse=await request('/houses-api?id=0001',{headers:{Origin:'https://projetosetags.github.io'}});
  assert.equal(hResponse.headers.get('Access-Control-Allow-Origin'),'https://projetosetags.github.io');
  const house=await hResponse.json();assert.equal(house.house.code,'0001');assert.equal(house.communications[0].message,'Aviso 1\nAviso 2');
  assert.equal((await request(new URL(house.materials[0].view_url).pathname)).status,403);
  const materialUrl=new URL(house.materials[0].view_url);assert.deepEqual(Buffer.from(await (await request(materialUrl.pathname+materialUrl.search)).arrayBuffer()),original);
  assert.equal((await postAdmin({action:'create_communication',title:'Novo',message:'Aviso novo'})).status,200);
  const photo=Buffer.from([255,216,255,224,0,10]);
  const uploaded=await (await request('/upload?id=0001',{method:'POST',headers:{'Content-Type':'image/jpeg','X-File-Name':'foto.jpg'},body:photo})).json();assert.ok(uploaded.id);
  const saved=await (await request('/houses-api?id=0001',json({meeting_date:'2026-10-10',status:'realizado',attendance_total:12,photo_file_id:uploaded.id}))).json();assert.ok(saved.report?.id);
  const response=await postAdmin({action:'update_care',id:saved.report.id,status:'em_acompanhamento',pastoral_response:'Recebido'});assert.equal(response.status,200);
  // Reposting a meeting updates one record and retains the pastoral response.
  await request('/houses-api?id=0001',json({meeting_date:'2026-10-10',status:'realizado',attendance_total:15}));
  const admin=await (await request('/pastoral-api',{headers:{'X-Admin-Token':adminToken}})).json();assert.equal(admin.reports.length,1);assert.equal(admin.reports[0].pastoral_response,'Recebido');assert.equal(admin.reports[0].attendance_total,15);
  assert.equal((await request('/houses-api?id=0001',json({action:'update_meeting_date',report_id:saved.report.id,meeting_date:'2026-10-11'}))).status,200);
  assert.equal((await postAdmin({action:'update_pastor_contact',id:'pastor1',phone:''})).status,200);
  const final=await (await request('/pastoral-api',{headers:{'X-Admin-Token':adminToken}})).json();assert.equal(final.pastors[0].phone,null);
  const photoUrl=new URL(final.reports[0].photo_url);assert.deepEqual(Buffer.from(await (await request(photoUrl.pathname+photoUrl.search)).arrayBuffer()),photo);
 }finally{await mf.dispose();}
});
