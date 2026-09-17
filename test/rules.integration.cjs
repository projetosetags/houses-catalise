const {test,before,after}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
let env;
const jpeg=Buffer.from([255,216,255,224,1,2,3,4]);
const pdf=Buffer.from('%PDF-1.7\nfixture');
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-houses',firestore:{rules:fs.readFileSync('firebase/firestore.rules','utf8')},storage:{rules:fs.readFileSync('firebase/storage.rules','utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  const users={admin:{role:'admin',active:true,house_ids:[],network_ids:[]},leader:{role:'leader',active:true,house_ids:['0119'],network_ids:['rede-04']},other:{role:'leader',active:true,house_ids:['0120'],network_ids:['rede-04']},pastor:{role:'pastor',active:true,house_ids:[],network_ids:['rede-04']},disabled:{role:'admin',active:false,house_ids:[],network_ids:[]}};
  for(const [uid,p] of Object.entries(users))await db.doc('users/'+uid).set(p);
  for(const [id,network] of [['0119','rede-04'],['0120','rede-04'],['0121','rede-03']])await db.doc('houses/'+id).set({active:true,network_id:network});
  for(const [id,house,network] of [['general',null,null],['network',null,'rede-04'],['specific','0119','rede-04']])await db.doc('materials/'+id).set({active:true,ready:true,house_id:house,network_id:network,storage_path:`materials/2026-09-13/${id}/original.pdf`,mime_type:'application/pdf'});
  for(const id of ['general','network','specific'])await ctx.storage().ref(`materials/2026-09-13/${id}/original.pdf`).put(pdf,{contentType:'application/pdf'});
  for(const id of ['0119','0120','0121'])await ctx.storage().ref(`meetings/${id}/2026-09-16/photo.jpg`).put(jpeg,{contentType:'image/jpeg'});
 });
});
after(async()=>{await env?.cleanup();});
test('Firestore bloqueia leitura anônima e promoção do próprio usuário',async()=>{
 await assertFails(env.unauthenticatedContext().firestore().doc('houses/0119').get());
 const db=env.authenticatedContext('leader').firestore();await assertSucceeds(db.doc('users/leader').get());
 await assertFails(db.doc('users/leader').update({role:'admin'}));await assertFails(db.doc('users/other').get());
 await assertFails(db.doc('reports/0119_2026-09-16').set({attendance_total:12}));
});
test('foto somente da própria House, caminho único e MIME correto',async()=>{
 const s=env.authenticatedContext('leader').storage();
 await assertSucceeds(s.ref('meetings/0119/2026-09-16/photo.jpg').put(jpeg,{contentType:'image/jpeg'}));
 await assertSucceeds(s.ref('meetings/0119/2026-09-16/photo.jpg').put(jpeg,{contentType:'image/jpeg'}));
 await assertFails(s.ref('meetings/0119/2026-09-16/segunda.jpg').put(jpeg,{contentType:'image/jpeg'}));
 await assertFails(s.ref('meetings/0120/2026-09-16/photo.jpg').put(jpeg,{contentType:'image/jpeg'}));
 await assertFails(s.ref('meetings/0119/2026-09-16/photo.jpg').put(pdf,{contentType:'application/pdf'}));
 await assertFails(s.ref('meetings/0120/2026-09-16/photo.jpg').getMetadata());
});
test('materiais respeitam destino geral, Rede e House específica',async()=>{
 const s=env.authenticatedContext('leader').storage(),other=env.authenticatedContext('other').storage();
 for(const id of ['general','network','specific'])await assertSucceeds(s.ref(`materials/2026-09-13/${id}/original.pdf`).getMetadata());
 await assertFails(other.ref('materials/2026-09-13/specific/original.pdf').getMetadata());
 await assertFails(s.ref('materials/2026-09-13/general/original.pdf').put(pdf,{contentType:'application/pdf'}));
 await assertFails(env.unauthenticatedContext().storage().ref('materials/2026-09-13/general/original.pdf').getMetadata());
});
test('pastor consulta fotos da sua Rede; desativado perde acesso imediatamente',async()=>{
 const s=env.authenticatedContext('pastor').storage();
 await assertSucceeds(s.ref('meetings/0119/2026-09-16/photo.jpg').getMetadata());
 await assertFails(s.ref('meetings/0121/2026-09-16/photo.jpg').getMetadata());
 await assertFails(env.authenticatedContext('disabled').storage().ref('meetings/0119/2026-09-16/photo.jpg').getMetadata());
});
test('administrador não pode enviar arquivo fora da estrutura ou acima do limite',async()=>{
 const s=env.authenticatedContext('admin').storage();
 await assertSucceeds(s.ref('materials/2026-09-13/general/original.pdf').put(pdf,{contentType:'application/pdf'}));
 await assertFails(s.ref('materials/2026-09-13/general/extra.pdf').put(pdf,{contentType:'application/pdf'}));
 await assertFails(s.ref('meetings/0119/2026-09-16/photo.jpg').put(Buffer.alloc(5*1024*1024+1),{contentType:'image/jpeg'}));
});
