try {
 await import('./firebase-client.js');
 const scripts=JSON.parse(document.getElementById('firebaseBootstrap').dataset.scripts);
 for(const source of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=source+'?v=firebase-20260917';s.onload=resolve;s.onerror=()=>reject(Error('Não foi possível carregar o aplicativo.'));document.body.appendChild(s);});
}catch(error){
 const host=document.querySelector('#loading')||document.body;
 host.classList.remove('hidden');host.textContent='Não foi possível iniciar o aplicativo. Verifique a conexão e atualize a página.';
 console.error(error);
}
