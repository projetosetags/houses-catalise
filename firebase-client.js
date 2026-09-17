import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,connectAuthEmulator} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFunctions,httpsCallable,connectFunctionsEmulator} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import {getStorage,ref,uploadBytesResumable,getBlob,connectStorageEmulator} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

const config=window.HOUSES_FIREBASE_CONFIG;
let auth,functions,storage,account=null;
if(config?.projectId&&config?.apiKey){
 const app=initializeApp(config);auth=getAuth(app);functions=getFunctions(app,window.HOUSES_FIREBASE_REGION||'southamerica-east1');storage=getStorage(app);
 if(['localhost','127.0.0.1'].includes(location.hostname)&&window.HOUSES_FIREBASE_EMULATORS){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFunctionsEmulator(functions,'127.0.0.1',5001);connectStorageEmulator(storage,'127.0.0.1',9199);}
 await new Promise(resolve=>{const unsubscribe=onAuthStateChanged(auth,()=>{unsubscribe();resolve();});});
}
function configured(){if(!auth)throw Error('A implantação do Firebase ainda está em configuração.');}
function message(e){return ({'auth/invalid-credential':'E-mail ou senha incorretos.','auth/too-many-requests':'Muitas tentativas. Aguarde um pouco e tente novamente.','auth/network-request-failed':'Confira a conexão com a internet.','storage/unauthorized':'Seu acesso não permite abrir este arquivo.','functions/unauthenticated':'Entre na sua conta para continuar.','functions/unavailable':'Serviço temporariamente indisponível. Tente novamente.'})[e.code]||e.message||'Não foi possível concluir.';}
async function request(action,body={}){configured();try{return (await httpsCallable(functions,'housesApi')({...body,action})).data;}catch(e){throw Error(message(e));}}
async function login(email,password){configured();try{await signInWithEmailAndPassword(auth,email.trim(),password);account=await request('profile');return account;}catch(e){throw Error(message(e));}}
async function logout(){configured();account=null;await signOut(auth);location.href='./';}
async function profile(){configured();if(!auth.currentUser)return null;account=await request('profile');return account;}
async function resetPassword(email){configured();try{await sendPasswordResetEmail(auth,email.trim());}catch(e){throw Error(message(e));}}
function upload(path,file,progress){return new Promise((resolve,reject)=>{const task=uploadBytesResumable(ref(storage,path),file,{contentType:file.type,cacheControl:'private,max-age=0'});task.on('state_changed',s=>progress?.(Math.round(100*s.bytesTransferred/s.totalBytes)),e=>reject(Error(message(e))),()=>resolve(task.snapshot));});}
async function uploadMaterial(fd,progress){
 const file=fd.get('file');if(!(file instanceof File)||!file.size)throw Error('Selecione o arquivo.');if(file.size>20*1024*1024)throw Error('O limite é 20 MB por material.');
 const body=Object.fromEntries([...fd].filter(([key])=>key!=='file'));body.mime_type=file.type;body.file_name=file.name;
 const draft=await request('begin_material',body);await upload(draft.storage_path,file,progress);return request('finish_material',{id:draft.id});
}
async function imageJpeg(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Selecione uma foto JPG, PNG ou WebP.');
 if(file.size>20*1024*1024)throw Error('A foto original deve ter até 20 MB.');
 const url=URL.createObjectURL(file),img=new Image();
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir a foto. Use JPG ou PNG.'));img.src=url;});
  const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob||blob.size>5*1024*1024)throw Error('Não foi possível reduzir a foto para até 5 MB.');return blob;
 }finally{URL.revokeObjectURL(url);}
}
async function saveReport(houseId,body,file,progress){
 const checked=await request('validate_report',{...body,house_id:houseId});
 if(body.status==='realizado'&&file){const blob=await imageJpeg(file);await upload(checked.value.photo_path,blob,progress);}
 return request('save_report',{...body,house_id:houseId});
}
async function fileBlob(path,max=20*1024*1024){configured();try{return await getBlob(ref(storage,path),max);}catch(e){throw Error(message(e));}}
window.HousesFirebase={request,login,logout,profile,resetPassword,uploadMaterial,saveReport,fileBlob,configured:!!auth};
