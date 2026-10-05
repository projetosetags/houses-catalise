/* Ajustes finais do painel pastoral após migração para Appwrite. */
(()=>{
  function hideLegacyLinkers(){
    document.querySelectorAll('.js-link-file').forEach(input=>{
      const wrap=input.closest('.admin-actions');
      if(wrap)wrap.style.display='none';
    });
  }
  hideLegacyLinkers();
  const root=document.getElementById('materialsAdmin');
  if(root)new MutationObserver(hideLegacyLinkers).observe(root,{childList:true,subtree:true});

  const header=document.querySelector('header span');
  if(header&&window.__HOUSES_BACKEND==='appwrite')header.title='Dados e arquivos: Appwrite Cloud';

  /* Fluxo 2026-10: ao publicar material principal P&B, oferece e gera a versão colorida padronizada. */
  const auto=document.createElement('script');
  auto.src='auto-color-upload.js?v=20261005-1';
  auto.async=false;
  document.head.appendChild(auto);
})();
