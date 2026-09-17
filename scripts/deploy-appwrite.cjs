'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {admin}=require('./appwrite-admin.cjs');
async function deploy(functionId,entrypoint){
 const {sdk,client}=admin(),functions=new sdk.Functions(client);
 const {InputFile}=require('node:module').createRequire(path.resolve(__dirname,'../functions/package.json'))('node-appwrite/file');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'houses-deploy-')),archive=path.join(dir,'function.tar.gz');
 try{
  const names=['index.cjs','cleanup.cjs','core.cjs','uploads.cjs','model.cjs','appwrite.cjs','package.json','package-lock.json'];
  cp.execFileSync('tar',['-czf',archive,'-C','functions',...names]);
  const deployment=await functions.createDeployment({functionId,code:InputFile.fromPath(archive,'function.tar.gz'),activate:false,entrypoint,commands:'npm ci --omit=dev'});
  console.log('Build iniciado:',deployment.$id);
  for(let i=0;i<180;i++){
   const state=await functions.getDeployment({functionId,deploymentId:deployment.$id});
   if(state.status==='ready'){await functions.updateDeployment({functionId,deploymentId:deployment.$id});console.log(functionId+': publicado.');return;}
   if(['failed','canceled'].includes(state.status))throw Error('O build falhou. Consulte os logs da função no Appwrite.');
   await new Promise(r=>setTimeout(r,5000));
  }throw Error('O build continua no Appwrite. Verifique antes de reenviar.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
async function main(){await deploy('houses-api','index.cjs');await deploy('houses-cleanup','cleanup.cjs');}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
