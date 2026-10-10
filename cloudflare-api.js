/* Cloudflare staging: ?backend=cloudflare. Production follows backend-config.js. */
(()=>{
 const config=window.HousesBackendConfig||{};
 if(new URLSearchParams(location.search).get('backend')!=='cloudflare'&&config.backend!=='cloudflare')return;
 const base=config.cloudflareUrl.replace(/\/$/,''),previous=window.fetch.bind(window);
 async function upload(file,{token='',code=''}={}){
  const r=await previous(base+'/upload'+(code?'?id='+encodeURIComponent(code):''),{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name||'foto.jpg'),...(token?{'X-Admin-Token':token}:{})},body:file});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Falha no envio do arquivo');return data.id;
 }
 async function executeRaw(fn,{method='GET',path='/',body={}}={}){
  const source=new URL(path,base),url=new URL('/'+fn,base);url.search=source.search;
  if(typeof body==='string')body=JSON.parse(body||'{}');
  const token=url.searchParams.get('token')||body?._token||'';url.searchParams.delete('token');
  body={...body};delete body._token;
  if(body.photo_data_url){const photo=await (await previous(body.photo_data_url)).blob();body.photo_file_id=await upload(photo,{code:url.searchParams.get('id')||''});delete body.photo_data_url;}
  const r=await previous(url.href,{method,headers:{'Content-Type':'application/json',...(token?{'X-Admin-Token':token}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  return {status:r.status,data:await r.json()};
 }
 async function execute(fn,options){const r=await executeRaw(fn,options);if(r.status<200||r.status>=300)throw Error(r.data?.error||'Falha na API');return r.data;}
 window.fetch=async(input,init={})=>{
  const raw=typeof input==='string'?input:input?.url;if(!raw)return previous(input,init);
  const url=new URL(raw,location.href);
  if(!/\.supabase\.co$/i.test(url.hostname)||!url.pathname.includes('/functions/v1/'))return previous(input,init);
  const fn=url.pathname.split('/functions/v1/')[1].split('/')[0];
  try{
   let out;
   if(fn==='material-upload'){
    const fd=init.body;if(!(fd instanceof FormData))throw Error('Upload inválido');
    const file=fd.get('file');if(!(file instanceof Blob))throw Error('Arquivo não informado');
    const token=url.searchParams.get('token')||'',id=await upload(file,{token}),materialId=String(fd.get('material_id')||'');
    const body=Object.fromEntries([...fd].filter(([k])=>k!=='file'));delete body.material_id;
    Object.assign(body,{action:materialId?'link_material':'add_material',upload_file_id:id,id:materialId,allow_download:String(fd.get('allow_download')||'true')==='true',audience:'leaders'});
    out=await executeRaw('pastoral-api',{method:'POST',path:'/?token='+encodeURIComponent(token),body});
   }else if(['houses-api','pastoral-api'].includes(fn))out=await executeRaw(fn,{method:init.method||'GET',path:'/'+url.search,body:init.body||{}});
   else return previous(input,init);
   return Response.json(out.data,{status:out.status});
  }catch(e){return Response.json({error:e.message||'Falha na conexão com Cloudflare'},{status:500});}
 };
 window.HousesAppwrite={execute,executeRaw,houseGet:(query='')=>execute('houses-api',{path:'/'+query}),housePost:(query='',body={})=>execute('houses-api',{method:'POST',path:'/'+query,body}),pastoralGet:(query='')=>execute('pastoral-api',{path:'/'+query}),pastoralPost:(query='',body={})=>execute('pastoral-api',{method:'POST',path:'/'+query,body})};
 window.__HOUSES_BACKEND='cloudflare';
})();
