import './appwrite-client.js';
const query=new URLSearchParams(location.search),userId=query.get('userId'),secret=query.get('secret');
// Remove the one-use recovery secret from browser history before any navigation.
history.replaceState(null,'',location.pathname);
const form=document.getElementById('recoveryForm'),message=document.getElementById('recoveryMessage');
if(!userId||!secret){message.textContent='Link incompleto. Solicite outro na tela de entrada.';form.querySelector('button').disabled=true;}
form.onsubmit=async event=>{event.preventDefault();const password=document.getElementById('newPassword'),confirmation=document.getElementById('confirmPassword'),button=event.submitter;if(password.value!==confirmation.value){message.textContent='As senhas precisam ser iguais.';return;}button.disabled=true;try{await HousesAppwrite.finishRecovery(userId,secret,password.value);form.reset();message.textContent='Senha definida. Você já pode entrar no aplicativo.';}catch(error){message.textContent=error.message;button.disabled=false;}};
