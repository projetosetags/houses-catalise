const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const house={id:'0119',code:'H-0119',name:'House de teste',active:true,network_id:'rede-04',networks:{name:'Rede 04'},leader_names:['Líder de teste'],leader_full_names:[],meeting_day:3,meeting_time:'19:30'};
const metrics={id:house.id,code:house.code,name:house.name,network:'Rede 04',valid_records:0,regularity_pct:0,avg_attendance:0,attendance:0,first_time:0,children:0,decisions:0,last_record:null};
const adminData={profile:{id:'test-admin',role:'admin',name:'Administrador de teste'},networks:[{id:'rede-04',name:'Rede 04'}],houses:[house],houseMetrics:[metrics],totals:{houses:1},byNetwork:[],weeks:[],reports:[],care:[],communications:[],materials:[]};
async function page(file,response){
 const html=fs.readFileSync(file,'utf8'),dom=new JSDOM(html,{runScripts:'outside-only',url:'https://test.invalid/'+file});const {window}=dom;
 const observers=[];const OriginalObserver=window.MutationObserver;window.MutationObserver=class extends OriginalObserver{constructor(callback){super(callback);observers.push(this);}};window.scrollTo=()=>{};window.alert=()=>{};window.confirm=()=>false;const errors=[];window.addEventListener('error',e=>errors.push(e.message));
 window.HousesAppwrite={configured:true,request:async(action)=>action==='list_users'?[]:response,profile:async()=>file==='index.html'?{role:'leader',house_ids:['0119']}:response.profile,logout:async()=>{},fileBlob:async()=>new Blob(),resetPassword:async()=>{}};
 const scripts=JSON.parse(html.match(/data-scripts='([^']+)'/)[1]);
 for(const s of scripts)vm.runInContext(fs.readFileSync(s,'utf8'),dom.getInternalVMContext(),{filename:s});
 await new Promise(resolve=>setTimeout(resolve,120));return {dom,window,errors,cleanup:()=>{observers.forEach(x=>x.disconnect());dom.window.close();}};
}
test('painel pastoral carrega controladores e novas opções de acesso sem erros',async()=>{
 const {dom,window,errors,cleanup}=await page('admin.html',adminData);try{assert.deepEqual(errors,[]);assert.equal(window.document.querySelector('#app').classList.contains('hidden'),false);assert.equal(window.document.querySelector('#kHouses').textContent,'1');assert.match(window.document.querySelector('#houseList').textContent,/House de teste/);assert.equal(window.document.querySelector('#userHouses').options.length,1);}finally{cleanup();}
});
test('painel do líder restaura House, exibe foto única e alterna encontro adiado',async()=>{
 const data={config:{},house:{...house,network:'Rede 04',leaders:['Líder de teste']},house_profile:house,metrics,materials:[{id:'study',title:'Apenas visualização',mime_type:'application/pdf',week_start:'2026-09-01',view_url:'storage:private.pdf',allow_download:false,personalization_mode:'cover'}],communications:[],recent:[]};
 const {dom,window,errors,cleanup}=await page('index.html',data);try{assert.deepEqual(errors,[]);assert.equal(window.document.querySelector('#app').classList.contains('hidden'),false);assert.ok(window.document.querySelector('#meetingPhoto'));assert.match(window.document.querySelector('#materials').textContent,/Apenas visualização/);assert.equal(window.document.querySelector('#materials .js-personalize'),null);window.document.querySelector('.no-house').click();assert.equal(window.document.querySelector('#meetingPhotoBox').classList.contains('hidden'),true);window.document.querySelector('.yes-house').click();assert.equal(window.document.querySelector('#meetingPhotoBox').classList.contains('hidden'),false);}finally{cleanup();}
});
