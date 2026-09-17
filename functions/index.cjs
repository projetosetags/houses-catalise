'use strict';
const {services,authenticated}=require('./appwrite.cjs');
const {createAPI}=require('./core.cjs');
module.exports=async function({req,res,error}){
 try{
  // A supplied user-id header alone never grants access to the privileged SDK.
  const id=await authenticated(req);
  const data=await createAPI(services(req.headers['x-appwrite-key'])).dispatch(id,req.bodyJson);
  return res.json({data},200,{'cache-control':'no-store'});
 }catch(e){
  const codes={'invalid-argument':400,'permission-denied':403,'not-found':404,'already-exists':409,conflict:409,'failed-precondition':412,unauthenticated:401};
  const status=codes[e.code];if(!status)error('Houses API error: '+String(e.type||e.code||'internal'));
  return res.json({error:{code:status?e.code:'internal',message:status?e.message:'Não foi possível concluir. Tente novamente.'}},status||500,{'cache-control':'no-store'});
 }
};
