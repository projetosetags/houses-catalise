const {Client,Account,Functions}=window.Appwrite;
const config=window.HOUSES_APPWRITE_CONFIG;
let account,functions;
if(config?.projectId&&config?.endpoint){const client=new Client().setEndpoint(config.endpoint).setProject(config.projectId);account=new Account(client);functions=new Functions(client);}
function configured(){if(!account)throw Error('O novo sistema ainda está em configuração.');}
function message(e){return ({user_invalid_credentials:'E-mail ou senha incorretos.',user_blocked:'Acesso desativado. Fale com a administração.',general_rate_limit_exceeded:'Muitas tentativas. Aguarde um pouco e tente novamente.',user_password_mismatch:'A senha informada não atende aos requisitos.',user_password_recently_used:'Escolha uma senha diferente das anteriores.',user_invalid_token:'O link expirou. Solicite outro pela tela de entrada.'})[e.type]||e.message||'Não foi possível concluir.';}
async function request(action,body={}){
 configured();try{
  const result=await functions.createExecution({functionId:config.functionId,body:JSON.stringify({...body,action}),async:false,headers:{'content-type':'application/json'}});
  let payload;try{payload=JSON.parse(result.responseBody);}catch{throw Error('O servidor não respondeu. Tente novamente.');}
  if(payload.error)throw Error(payload.error.message);if(result.responseStatusCode!==200)throw Error('Serviço temporariamente indisponível. Tente novamente.');return payload.data;
 }catch(e){throw Error(message(e));}
}
async function login(email,password){configured();try{await account.deleteSession({sessionId:'current'}).catch(e=>{if(e.code!==401)throw e;});await account.createEmailPasswordSession({email:email.trim(),password});try{return await request('profile');}catch(e){await account.deleteSession({sessionId:'current'}).catch(()=>{});throw e;}}catch(e){throw Error(message(e));}}
async function logout(){configured();await account.deleteSession({sessionId:'current'}).catch(e=>{if(e.code!==401)throw e;});location.href='./';}
async function profile(){configured();try{await account.get();}catch(e){if(e.code===401)return null;throw Error(message(e));}return request('profile');}
async function resetPassword(email){configured();try{await account.createRecovery({email:email.trim(),url:new URL('./recuperar.html',location.href).href});}catch(e){if(e.type!=='user_not_found')throw Error(message(e));}}
async function finishRecovery(userId,secret,password){configured();try{await account.updateRecovery({userId,secret,password});}catch(e){throw Error(message(e));}}
function base64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
async function upload(file,body,progress){
 const bytes=new Uint8Array(await file.arrayBuffer()),draft=await request('begin_upload',{...body,size:bytes.length});
 for(let offset=0,index=0;offset<bytes.length;offset+=draft.chunk_size,index++){
  const chunk=bytes.subarray(offset,Math.min(bytes.length,offset+draft.chunk_size));
  await request('upload_chunk',{id:draft.id,generation:draft.generation,index,bytes:base64(chunk)});progress?.(Math.min(95,Math.round((offset+chunk.length)*95/bytes.length)));
 }
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 // Large PDFs finish in the background: synchronous Appwrite calls have a
 // 30-second ceiling. Check execution status without exposing logs or bodies.
 const execution=await functions.createExecution({functionId:config.functionId,async:true,body:JSON.stringify({action:'finish_upload',id:draft.id,generation:draft.generation,sha256:hash}),headers:{'content-type':'application/json'}});
 const deadline=Date.now()+150000;let done=false;
 while(Date.now()<deadline){const state=await functions.getExecution({functionId:config.functionId,executionId:execution.$id});if(state.status==='completed'){const status=await request('upload_status',{id:draft.id,generation:draft.generation});if(!status.ready)throw Error('Não foi possível concluir o arquivo. Envie novamente.');done=true;break;}if(state.status==='failed')throw Error('Não foi possível concluir o arquivo. Envie novamente.');await new Promise(resolve=>setTimeout(resolve,1500));}
 if(!done)throw Error('O envio demorou além do esperado. Aguarde um pouco e tente novamente.');progress?.(100);return draft.id;
}
async function uploadMaterial(fd,progress){
 const file=fd.get('file');if(!(file instanceof File)||!file.size)throw Error('Selecione o arquivo.');if(file.size>20*1024*1024)throw Error('O limite é 20 MB por material.');
 const body=Object.fromEntries([...fd].filter(([key])=>key!=='file'));body.mime_type=file.type;body.file_name=file.name;
 const upload_id=await upload(file,{...body,purpose:'material'},progress);return request('finish_material',{upload_id});
}
async function imageJpeg(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Selecione uma foto JPG, PNG ou WebP.');
 if(file.size>20*1024*1024)throw Error('A foto original deve ter até 20 MB.');const url=URL.createObjectURL(file),img=new Image();
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir a foto. Use JPG ou PNG.'));img.src=url;});
  const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob||blob.size>5*1024*1024)throw Error('Não foi possível reduzir a foto para até 5 MB.');return blob;
 }finally{URL.revokeObjectURL(url);}
}
async function saveReport(houseId,body,file,progress){
 await request('validate_report',{...body,house_id:houseId});let upload_id;
 if(body.status==='realizado'&&file)upload_id=await upload(await imageJpeg(file),{...body,house_id:houseId,purpose:'photo'},progress);
 return request('save_report',{...body,house_id:houseId,upload_id});
}
async function fileBlob(path,max=20*1024*1024,download=false){
 const file=await request('file_link',{path,download});if(file.size>max)throw Error('Arquivo acima do limite.');
 const response=await fetch(file.url,{cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Não foi possível abrir o arquivo. Tente novamente.');
 const blob=await response.blob();if(blob.size>max||blob.size!==file.size)throw Error('O arquivo chegou incompleto. Tente novamente.');return blob.slice(0,blob.size,file.mime_type);
}
window.HousesAppwrite={request,login,logout,profile,resetPassword,finishRecovery,uploadMaterial,saveReport,fileBlob,configured:!!account};
