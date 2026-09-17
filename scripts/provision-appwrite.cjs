'use strict';
async function main(){
 await require('./setup-appwrite.cjs').main();
 await require('./seed.cjs').main();
 await require('./deploy-appwrite.cjs').main();
 console.log('Provisionamento concluído. Falta validar o acesso e os arquivos no projeto real antes de integrar o frontend à main.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
