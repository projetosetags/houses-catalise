const adminRequire=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
const {test}=require('node:test'),assert=require('node:assert/strict');
const {getApp}=adminRequire('firebase-admin/app');
process.env.FIREBASE_CONFIG=JSON.stringify({projectId:'demo-houses',storageBucket:'demo-houses.appspot.com'});
const {housesApi}=require('../functions/index.cjs');
const {getFirestore}=adminRequire('firebase-admin/firestore');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth,connectAuthEmulator,signInAnonymously}=require('firebase/auth');
const {getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions');
const {getStorage,connectStorageEmulator,ref,uploadBytes}=require('firebase/storage');
test('API autenticada completa: isolamento, foto obrigatória, atualização e material',async()=>{
 const projectId='demo-houses',admin=getApp(),db=getFirestore(admin),apps=[];
 async function client(role,house_ids=[],network_ids=[]){const app=initializeApp({projectId,apiKey:'demo-key',storageBucket:projectId+'.appspot.com'},'api-'+role);apps.push(app);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const functions=getFunctions(app,'southamerica-east1');connectFunctionsEmulator(functions,'127.0.0.1',5001);const storage=getStorage(app);connectStorageEmulator(storage,'127.0.0.1',9199);const call=async(action,data={})=>housesApi.run({auth:auth.currentUser?{uid:auth.currentUser.uid}:null,data:{...data,action}});await assert.rejects(()=>call('profile'));const user=(await signInAnonymously(auth)).user;await db.doc('users/'+user.uid).set({name:role,email:role+'@example.invalid',role,active:true,house_ids,network_ids});return {call,storage};}
 try{
  await db.doc('networks/rede-04').set({name:'Rede 04',active:true});for(const id of ['0119','0120'])await db.doc('houses/'+id).set({code:'H-'+id,name:'Teste '+id,network_id:'rede-04',active:true,leader_names:[],leader_full_names:[]});
  const leader=await client('leader',['0119'],['rede-04']),pastor=await client('admin');
  assert.equal((await leader.call('leader_snapshot',{house_id:'0119'})).house.id,'0119');
  await assert.rejects(()=>leader.call('leader_snapshot',{house_id:'0120'}));await assert.rejects(()=>leader.call('pastoral_snapshot'));
  await assert.rejects(()=>leader.call('create_house',{code:'H-0999',name:'Não autorizado',network_id:'rede-04'}));
  const body={house_id:'0119',meeting_date:'2026-09-16',status:'realizado',attendance_total:10,first_time:1,children:2,decisions_for_jesus:0,notes:'',leader_message:''};
  await assert.rejects(()=>leader.call('save_report',body),/arquivo/);
  await uploadBytes(ref(leader.storage,'meetings/0119/2026-09-16/photo.jpg'),Buffer.from([255,216,255,224,1,2,3,4]),{contentType:'image/jpeg'});
  const first=await leader.call('save_report',body),second=await leader.call('save_report',{...body,attendance_total:11});assert.equal(first.id,second.id);assert.equal((await db.collection('reports').get()).size,1);
  const material=await pastor.call('begin_material',{title:'Palavra da semana',week_start:'2026-09-13',mime_type:'application/pdf',file_name:'semana.pdf',allow_download:true});
  await uploadBytes(ref(pastor.storage,material.storage_path),Buffer.from('%PDF-1.7\nfixture'),{contentType:'application/pdf'});await pastor.call('finish_material',{id:material.id});
  const snapshot=await leader.call('leader_snapshot',{house_id:'0119'});assert.equal(snapshot.materials.length,1);assert.equal(snapshot.metrics.attendance,11);assert.equal((await pastor.call('pastoral_snapshot')).houses.length,2);
 }finally{await Promise.all(apps.map(deleteApp));await db.terminate();await admin.delete();}
});
