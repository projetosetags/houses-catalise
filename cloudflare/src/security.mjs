import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function sameSecret(a,b) {return timingSafeEqual(Buffer.from(sha256(String(a))),Buffer.from(sha256(String(b))));}
function signingKey(env) {
 if(!env.MIGRATION_TOKEN || env.MIGRATION_TOKEN.length<32) throw Error('Chave de infraestrutura não configurada');
 return createHmac('sha256',env.MIGRATION_TOKEN).update('houses/private-files/v1').digest();
}
export function fileToken(env,id,expires) {
 return expires+'.'+createHmac('sha256',signingKey(env)).update(id+':'+expires).digest('hex');
}
export function validFileToken(env,id,token) {
 const [expires,signature]=String(token||'').split('.');
 if(!/^\d+$/.test(expires||'') || !/^[a-f0-9]{64}$/.test(signature||''))return false;
 const expiry=Number(expires);
 if(expiry<Date.now() || expiry>Date.now()+2*60*60*1000+10000)return false;
 return sameSecret(token,fileToken(env,id,expires));
}
