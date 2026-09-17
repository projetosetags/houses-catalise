'use strict';
const CONFIG = {church_name:'Catalise Church',slogan:'Houses que transformam vidas',verse_text:'Pois onde estiverem dois ou três reunidos em meu nome, ali estou no meio deles.',verse_ref:'Mateus 18:20'};
function fail(message,code='invalid-argument'){const e=new Error(message);e.code=code;throw e;}
function text(v,max=200,required=false){if(typeof v!=='string'&&v!=null)fail('Texto inválido.');const s=String(v??'').trim();if(s.length>max||(required&&!s))fail('Confira os campos obrigatórios e o tamanho do texto.');return s;}
function id(v){const s=text(v,36,true);if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s))fail('Identificador inválido.');return s;}
function date(v,required=true){if(!v&&!required)return null;const s=text(v,10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)fail('Data inválida.');return s;}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());}
function allowed(p,h){return !!(p?.active===true&&h?.active!==false&&(p.role==='admin'||(p.role==='pastor'&&p.network_ids?.includes(h.network_id))||(p.role==='leader'&&p.house_ids?.includes(h.id))));}
function staff(p){return p?.active===true&&['admin','pastor'].includes(p.role);}
function audience(p,m,houses){return p?.active===true&&(p.role==='admin'||(!m.house_id&&!m.network_id)||houses.some(h=>allowed(p,h)&&(!m.house_id||m.house_id===h.id)&&(!m.network_id||m.network_id===h.network_id)));}
function report(input,houseId,now=today()){
 const d=date(input.meeting_date);if(d>now)fail('Registre a reunião na data em que ela ocorreu.');
 if(!['realizado','cancelado'].includes(input.status))fail('Situação do encontro inválida.');
 const result={house_id:id(houseId),meeting_date:d,status:input.status};
 for(const k of ['attendance_total','first_time','children','decisions_for_jesus']){const n=input.status==='cancelado'?0:Number(input[k]??0);if(!Number.isInteger(n)||n<0||n>10000)fail('Informe quantidades inteiras entre 0 e 10.000.');result[k]=n;}
 if(result.first_time>result.attendance_total||result.children>result.attendance_total||result.decisions_for_jesus>result.attendance_total)fail('As quantidades não podem superar o total de participantes.');
 result.cancellation_reason=input.status==='cancelado'?text(input.cancellation_reason,300,true):null;
 result.leader_message=text(input.leader_message,4000);result.notes=text(input.notes,4000);
 result.photo_path=input.status==='realizado'?`meetings/${result.house_id}/${d}/photo.jpg`:null;
 return {key:`${result.house_id}_${d}`,value:result};
}
function metrics(reports,now=today()){
 const start=new Date(now+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-55);const cutoff=start.toISOString().slice(0,10);
 const recent=reports.filter(r=>r.meeting_date>=cutoff&&r.meeting_date<=now).sort((a,b)=>b.meeting_date.localeCompare(a.meeting_date));
 const done=recent.filter(r=>r.status==='realizado');const attendance=done.reduce((n,r)=>n+r.attendance_total,0);
 const weeks=new Set(done.map(r=>{const d=new Date(r.meeting_date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d.toISOString().slice(0,10);}));
 return {valid_records:done.length,regularity_pct:Math.min(100,Math.round(weeks.size/8*100)),avg_attendance:done.length?Math.round(attendance/done.length*10)/10:0,attendance,first_time:done.reduce((n,r)=>n+r.first_time,0),children:done.reduce((n,r)=>n+r.children,0),decisions:done.reduce((n,r)=>n+r.decisions_for_jesus,0),last_record:recent[0]?.meeting_date||null};
}
function material(input){
 const mime=text(input.mime_type,80,true),ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[mime];if(!ext)fail('Envie PDF, JPG ou PNG.');
 const week=date(input.week_start||today()),category=text(input.category||'principal',20);
 if(!['principal','kids','outro'].includes(category))fail('Categoria inválida.');
 const mode=text(input.personalization_mode||'none',20);if(!['none','cover','stamp'].includes(mode))fail('Personalização inválida.');
 return {title:text(input.title,200,true),description:text(input.description,4000),week_start:week,category,personalization_mode:mode,network_id:input.network_id?id(input.network_id):null,house_id:input.house_id?id(input.house_id):null,license_note:text(input.license_note,2000),allow_download:input.allow_download===true||input.allow_download==='true',mime_type:mime,file_name:text(input.file_name,200,true),extension:ext};
}
module.exports={CONFIG,fail,text,id,date,today,allowed,staff,audience,report,metrics,material};
