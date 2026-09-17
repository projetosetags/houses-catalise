const adminRequire=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
// Run only in a trusted environment authenticated to the specific Firebase project.
// Does not copy trial meetings, files, access tokens or legacy credentials.
const {initializeApp,applicationDefault}=adminRequire('firebase-admin/app');
const {getFirestore,FieldValue}=adminRequire('firebase-admin/firestore');
const {getAuth}=adminRequire('firebase-admin/auth');
const fs=require('node:fs');
async function main(){
 const projectId=process.env.HOUSES_PROJECT_ID,email=process.env.HOUSES_ADMIN_EMAIL;
 if(!projectId||!email)throw Error('Set HOUSES_PROJECT_ID and HOUSES_ADMIN_EMAIL.');
 initializeApp({projectId,credential:applicationDefault()});const db=getFirestore();
 const path=process.env.HOUSES_SEED_FILE,seed=path?JSON.parse(fs.readFileSync(path,'utf8')):{networks:[],houses:[]};
 const networks=seed.networks||[];
 for(let n=1;n<=4;n++)if(!networks.some(x=>Number(String(x.name).match(/\d+/)?.[0])===n))networks.push({id:'rede-'+String(n).padStart(2,'0'),name:'Rede '+String(n).padStart(2,'0'),leader_name:'',coordinator_name:''});
 for(const n of networks){const ref=db.collection('networks').doc(n.id);if(!(await ref.get()).exists)await ref.create({name:n.name,leader_name:n.leader_name||'',coordinator_name:n.coordinator_name||'',active:true,created_at:FieldValue.serverTimestamp()});}
 const permitted=['code','name','network_id','leader_names','leader_full_names','address_line','neighborhood','city','state','postal_code','meeting_day','meeting_time'];
 for(const h of seed.houses||[]){const ref=db.collection('houses').doc(h.id);if(!(await ref.get()).exists){const item=Object.fromEntries(permitted.filter(k=>h[k]!==undefined).map(k=>[k,h[k]]));await ref.create({...item,active:true,created_at:FieldValue.serverTimestamp()});}}
 let user;try{user=await getAuth().getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;user=await getAuth().createUser({email,displayName:'Manoel Fernandes Neto'});}
 const ref=db.collection('users').doc(user.uid);if(!(await ref.get()).exists)await ref.create({name:'Manoel Fernandes Neto',email,role:'admin',active:true,house_ids:[],network_ids:[],created_at:FieldValue.serverTimestamp()});
 console.log('Redes e cadastros verificados. Use a recuperação de senha para definir o primeiro acesso.');
}
main().catch(e=>{console.error(e.message);process.exit(1);});
