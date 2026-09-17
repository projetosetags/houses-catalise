/* Houses Catalise — ponte pública para as Functions do Appwrite.
   Não contém API key. A chave de infraestrutura permanece somente no GitHub Actions. */
(()=>{
  const endpoint='https://fra.cloud.appwrite.io/v1';
  const projectId='6aabcd0b000c5d1298ab';
  const nativeFetch=window.fetch.bind(window);

  function jsonResponse(data,status=200){
    return new Response(JSON.stringify(data??null),{
      status,
      headers:{'Content-Type':'application/json; charset=utf-8','X-Houses-Backend':'appwrite'}
    });
  }

  async function executeRaw(functionId,{method='GET',path='/',body=''}={}){
    const payload={
      body:typeof body==='string'?body:JSON.stringify(body||{}),
      async:false,
      path:path||'/',
      method
    };
    const response=await nativeFetch(`${endpoint}/functions/${encodeURIComponent(functionId)}/executions`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Appwrite-Project':projectId,
        'X-Appwrite-Response-Format':'2.0.0'
      },
      body:JSON.stringify(payload),
      cache:'no-store'
    });
    const execution=await response.json().catch(()=>({}));
    if(!response.ok){
      return {status:response.status||500,data:{error:execution.message||`Erro Appwrite ${response.status}`},execution};
    }
    const status=Number(execution.responseStatusCode)||500;
    let data=null;
    try{data=JSON.parse(execution.responseBody||'null')}
    catch{data={error:execution.responseBody||execution.errors||'Resposta inválida'}}
    return {status,data,execution};
  }

  async function execute(functionId,options={}){
    const out=await executeRaw(functionId,options);
    if(out.status<200||out.status>=300)throw new Error(out.data?.error||`Erro da API (${out.status})`);
    return out.data;
  }

  async function fileToDataURL(file){
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(reader.error||new Error('Não foi possível ler o arquivo'));
      reader.readAsDataURL(file);
    });
  }

  function requestBody(init){
    const value=init?.body;
    if(!value)return {};
    if(typeof value==='string'){
      try{return JSON.parse(value)}catch{return {}}
    }
    return value;
  }

  async function bridgeLegacyFetch(input,init={}){
    const rawUrl=typeof input==='string'?input:input?.url;
    if(!rawUrl)return nativeFetch(input,init);
    let url;
    try{url=new URL(rawUrl,location.href)}catch{return nativeFetch(input,init)}
    const isOldSupabase=/\.supabase\.co$/i.test(url.hostname)&&url.pathname.includes('/functions/v1/');
    if(!isOldSupabase)return nativeFetch(input,init);

    const fn=url.pathname.split('/functions/v1/')[1]?.split('/')[0]||'';
    const method=String(init.method||'GET').toUpperCase();
    const path=`/${url.search||''}`;

    try{
      if(fn==='houses-api'||fn==='pastoral-api'){
        const out=await executeRaw(fn,{method,path,body:requestBody(init)});
        return jsonResponse(out.data,out.status);
      }

      if(fn==='material-upload'){
        const fd=init.body;
        if(!(fd instanceof FormData))return jsonResponse({error:'Upload inválido'},400);
        const materialId=String(fd.get('material_id')||'');
        if(materialId){
          return jsonResponse({error:'Este material já deve ser republicado pelo Appwrite com o arquivo original.'},409);
        }
        const file=fd.get('file');
        if(!(file instanceof File))return jsonResponse({error:'Arquivo não informado'},400);
        if(file.size>20*1024*1024)return jsonResponse({error:'Arquivo acima do limite de 20 MB'},400);
        const token=url.searchParams.get('token')||'';
        const body={
          action:'add_material',
          title:String(fd.get('title')||''),
          description:String(fd.get('description')||'')||null,
          week_start:String(fd.get('week_start')||'')||null,
          category:String(fd.get('category')||'principal'),
          personalization_mode:String(fd.get('personalization_mode')||'none'),
          network_id:String(fd.get('network_id')||'')||null,
          house_id:String(fd.get('house_id')||'')||null,
          license_note:String(fd.get('license_note')||'')||null,
          allow_download:String(fd.get('allow_download')||'true')==='true',
          audience:'leaders',
          file_name:file.name,
          mime_type:file.type||'application/octet-stream',
          material_data_url:await fileToDataURL(file)
        };
        const out=await executeRaw('pastoral-api',{method:'POST',path:`/?token=${encodeURIComponent(token)}`,body});
        return jsonResponse(out.data,out.status);
      }
    }catch(error){
      return jsonResponse({error:error?.message||'Erro na integração com Appwrite'},500);
    }

    return nativeFetch(input,init);
  }

  window.fetch=bridgeLegacyFetch;
  window.HousesAppwrite={
    endpoint,projectId,execute,executeRaw,
    houseGet:(query='')=>execute('houses-api',{method:'GET',path:`/${query}`}),
    housePost:(query='',body={})=>execute('houses-api',{method:'POST',path:`/${query}`,body}),
    pastoralGet:(query='')=>execute('pastoral-api',{method:'GET',path:`/${query}`}),
    pastoralPost:(query='',body={})=>execute('pastoral-api',{method:'POST',path:`/${query}`,body})
  };
  window.__HOUSES_BACKEND='appwrite';
})();
