try {
 await new Promise((resolve,reject)=>{const sdk=document.createElement('script');sdk.src='assets/vendor/appwrite-27.0.0.js';sdk.onload=resolve;sdk.onerror=reject;document.head.appendChild(sdk);});
 await import('./appwrite-client.js');
 const scripts=JSON.parse(document.getElementById('appwriteBootstrap').dataset.scripts);
 for(const source of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=source+'?v=appwrite-20260917';s.onload=resolve;s.onerror=()=>reject(Error('Não foi possível carregar o aplicativo.'));document.body.appendChild(s);});
}catch(error){
 const host=document.querySelector('#loading')||document.body;
 host.classList.remove('hidden');host.textContent='Não foi possível iniciar o aplicativo. Verifique a conexão e atualize a página.';
 console.error(error);
}
