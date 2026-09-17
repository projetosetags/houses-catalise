'use strict';
const path=require('node:path');
const sdk=require('node:module').createRequire(path.resolve(__dirname,'../functions/package.json'))('node-appwrite');
const {clientFor,config}=require('../functions/appwrite.cjs');
function admin(){if(!process.env.APPWRITE_API_KEY)throw Error('Configure APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID e APPWRITE_API_KEY no ambiente seguro.');return {sdk,client:clientFor(process.env.APPWRITE_API_KEY),config:config()};}
async function ensure(get,create){try{return await get();}catch(e){if(e.code!==404)throw e;return create();}}
async function available(get,label){for(let i=0;i<60;i++){const r=await get();if(r.status==='available')return r;if(['failed','stuck'].includes(r.status))throw Error(label+': '+r.status);await new Promise(r=>setTimeout(r,1000));}throw Error('Tempo excedido ao configurar '+label);}
module.exports={admin,ensure,available};
