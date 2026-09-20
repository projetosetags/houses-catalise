(()=>{const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),br=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const PASTORS=[
  {id:'pastor_luciana',name:'Luciana Ferreira Costa',phone:'9 9149-2104',role:'Pastora',sort_order:1},
  {id:'pastor_mariza',name:'Mariza Ferreira',phone:'',role:'Pastora',sort_order:2},
  {id:'pastor_marcelo',name:'Marcelo Cruz',phone:'9 9148-9910',role:'Pastor',sort_order:3},
  {id:'pastor_andrea',name:'Andréa Cruz',phone:'',role:'Pastora',sort_order:4},
  {id:'pastor_francine',name:'Francine Zaboti',phone:'',role:'Pastora',sort_order:5},
  {id:'pastor_joao_marcos',name:'João Marcos da Silva',phone:'',role:'Pastor',sort_order:6},
  {id:'pastor_luiz',name:'Luiz Sartor',phone:'',role:'Pastor',sort_order:7},
  {id:'pastor_roselane',name:'Roselane Mota de Bem',phone:'',role:'Pastora',sort_order:8},
  {id:'pastor_thiago',name:'Thiago Zaboti',phone:'9 9847-0596',role:'Pastor',sort_order:9}
];
function pastors(){
  const live=window.data?.pastors;
  const source=Array.isArray(live)&&live.length?live:PASTORS;
  return source.map(p=>{const fallback=PASTORS.find(x=>x.id===p.id||x.name===p.name);return {...p,role:(p.role&&p.role!=='Pastor(a)')?p.role:(fallback?.role||'Pastor')}})
    .sort((a,b)=>(Number(a.sort_order)||100)-(Number(b.sort_order)||100)||String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
}
function selectedPastor(){const name=$('#repName')?.value||'';return pastors().find(p=>p.name===name)||PASTORS.find(p=>p.name===name)||null}
const STORE='housesPastoresReportProfileV1';
function readSaved(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return{}}}
function saveSaved(){
  const name=$('#repName')?.value||'',phone=$('#repPhone')?.value||'',notes=$('#repNotes')?.value||'';
  const saved=readSaved(),phones={...(saved.phones||{})};
  if(name)phones[name]=phone;
  localStorage.setItem(STORE,JSON.stringify({name,phone,notes,phones}));
}
function pastorPhone(name){
  const live=pastors().find(p=>p.name===name);
  if(live&&live.phone!=null&&String(live.phone).trim()!=='')return String(live.phone);
  const saved=readSaved(),custom=saved.phones?.[name];
  if(custom!==undefined)return custom;
  return PASTORS.find(p=>p.name===name)?.phone||'';
}
async function savePastorPhone(){
  const name=$('#repName')?.value||'',phone=$('#repPhone')?.value||'';
  saveSaved();
  if(!name)return;
  const pastor=pastors().find(p=>p.name===name)||PASTORS.find(p=>p.name===name);
  if(!pastor?.id||!window.HousesAppwrite?.pastoralPost)return;
  const status=$('#repStatus');if(status)status.textContent='Salvando telefone…';
  try{
    const token=new URLSearchParams(location.search).get('token')||'';
    await window.HousesAppwrite.pastoralPost('?token='+encodeURIComponent(token),{action:'update_pastor_contact',id:pastor.id,phone});
    if(window.data?.pastors){const live=window.data.pastors.find(p=>p.id===pastor.id);if(live)live.phone=phone}
    if(status)status.textContent='Telefone do Pastor(a) salvo no Appwrite.';
  }catch(e){if(status)status.textContent='Não foi possível salvar o telefone no Appwrite agora.'}
}
function profile(){const pastor=selectedPastor();return{name:$('#repName')?.value||'',role:pastor?.role||$('#repRole')?.value||'Pastor',phone:$('#repPhone')?.value||'',notes:$('#repNotes')?.value||''}}
function inject(){
  const ov=$('#overview');if(!ov||$('#pastoralReports'))return;
  const b=document.createElement('section');b.id='pastoralReports';b.className='pastoral-export';
  b.innerHTML='<h3>Relatórios e Backup Pastoral</h3><p class="export-hint">Uso exclusivo dos pastores. Selecione o Pastor ou Pastora. Telefones preenchidos ou atualizados ficam gravados no Appwrite.</p><div class="pastoral-export-grid"><label>Pastor ou Pastora<select id="repName"><option value="">Selecione o Pastor ou Pastora</option>'+pastors().map(p=>'<option value="'+esc(p.name)+'">'+esc(p.role+' '+p.name)+'</option>').join('')+'</select></label><label>Cargo<input id="repRole" value="" readonly></label><label>Telefone<input id="repPhone" inputmode="tel" placeholder="Digite o telefone"></label><label class="pastoral-export-full">Observações<textarea id="repNotes"></textarea></label></div><div class="pastoral-export-actions"><button class="pastoral-pdf" id="repPdf" type="button">🖨 Imprimir / Salvar PDF</button><button class="pastoral-xlsx" id="repXlsx" type="button">⬇ Backup completo XLSX</button></div><p id="repStatus" class="pastoral-export-status"></p>';
  ov.insertBefore(b,ov.firstChild);
  const saved=readSaved();
  if(saved.name&&pastors().some(p=>p.name===saved.name))$('#repName').value=saved.name;
  $('#repRole').value=selectedPastor()?.role||'';
  $('#repPhone').value=pastorPhone($('#repName').value);
  $('#repNotes').value=saved.notes||'';
  $('#repName').addEventListener('change',()=>{$('#repRole').value=selectedPastor()?.role||'';$('#repPhone').value=pastorPhone($('#repName').value);saveSaved()});
  $('#repPhone').addEventListener('input',saveSaved);$('#repPhone').addEventListener('change',savePastorPhone);
  $('#repNotes').addEventListener('input',saveSaved);
  $('#repPdf').onclick=()=>{saveSaved();printReport()};
  $('#repXlsx').onclick=()=>{saveSaved();backup()};
}function table(title,heads,rows){return `<section><h2>${esc(title)}</h2><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`}function printReport(){
  const d=window.data||{},t=d.totals||{},p=profile(),hm=d.houseMetrics||[];
  if(!p.name){$('#repStatus').textContent='Selecione o Pastor ou Pastora antes de gerar o relatório.';return}
  const logo=new URL('assets/houses-s.svg',location.href).href;
  const responsible=`${p.role} ${p.name}`;
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Houses Pastores</title><style>
  @page{size:A4 landscape;margin:14mm 10mm 18mm}
  body{font:11px Arial;color:#172033}h1{font-size:20px;margin:0}h2{font-size:13px;color:#1e40af;margin:16px 0 5px}p{margin:3px 0}
  .top{border-bottom:2px solid #d4a72c;padding-bottom:8px;display:flex;align-items:center;gap:12px}.church-logo{width:42px;height:42px;object-fit:contain}.top-copy{flex:1}
  table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:auto}tr{page-break-inside:avoid}th{background:#1e40af;color:white}th,td{border:1px solid #ccd3dd;padding:4px;text-align:left;vertical-align:top}
  .responsible{margin-top:22px;padding-top:12px;border-top:2px solid #d4a72c;page-break-inside:avoid}.responsible h2{margin:0 0 8px;color:#172033}.signature{font-size:14px;font-weight:700}.meta{font-size:10px;color:#555}
  </style></head><body>
  <div class="top"><img class="church-logo" src="${esc(logo)}" alt="Catalise Church"><div class="top-copy"><h1>Houses Pastores • Relatório Geral</h1><p>Catalise Church • ${new Date().toLocaleString('pt-BR')}</p></div></div>
  ${table('Visão Geral',['Indicador','Valor'],[['Houses ativas',t.houses||0],['Registros 8 semanas',t.reports||0],['Participações',t.attendance||0],['Primeira vez',t.first_time||0],['Crianças',t.children||0],['Decisões',t.decisions||0]])}
  ${table('Evolução semanal',['Semana','Registros','Participações'],(d.weeks||[]).map(w=>[w.label,w.records||0,w.attendance||0]))}
  ${table('Semáforo / Ranking',['House','Rede','Regularidade','Participações','Média','Último registro'],hm.map(m=>[`${m.code} • ${m.name}`,m.network||'',`${m.regularity_pct||0}%`,m.attendance||0,m.avg_attendance||0,br(m.last_record)]))}
  ${table('Redes',['Rede','Houses','Regularidade','Participações','Primeira vez','Crianças','Decisões'],(d.byNetwork||[]).map(n=>[n.name,n.houses,`${n.regularity_pct}%`,n.attendance,n.first_time,n.children,n.decisions]))}
  ${table('Houses',['Código','Nome','Rede','Líderes','Endereço'],(d.houses||[]).map(h=>[h.code,h.name,h.networks?.name||'',(h.leader_full_names||h.leader_names||[]).join(' e '),[h.address_line,h.neighborhood,h.city,h.state,h.postal_code].filter(Boolean).join(' • ')]))}
  ${table('Registros',['House','Data','Status','Participantes','Primeira vez','Crianças','Decisões'],(d.reports||[]).map(r=>[`${r.houses?.code||''} • ${r.houses?.name||''}`,br(r.meeting_date),r.status,r.attendance_total||0,r.first_time||0,r.children||0,r.decisions_for_jesus||0]))}
  ${table('Cuidado Pastoral',['House','Status','Mensagem do líder','Retorno pastoral'],(d.care||[]).map(x=>[`${x.houses?.code||''} • ${x.houses?.name||''}`,x.status||'',x.leader_message||'',x.pastoral_response||'']))}
  ${table('Comunicações',['Título','Comunicado','Início','Fim'],(d.communications||[]).map(x=>[x.title,x.message,br(x.starts_on),br(x.ends_on)]))}
  ${table('Materiais',['Título','Categoria','Semana','Arquivo'],(d.materials||[]).map(m=>[m.title,m.category||'',br(m.week_start),m.file_name||'']))}
  <section class="responsible"><h2>Responsável pelo relatório</h2><p class="signature">${esc(responsible)}</p><p><b>Telefone:</b> ${esc(p.phone||'—')}</p>${p.notes?`<p><b>Observações:</b> ${esc(p.notes)}</p>`:''}<p class="meta">Relatório emitido em ${new Date().toLocaleString('pt-BR')}</p></section>
  <script>window.onload=()=>window.print()<\/script></body></html>`;
  const w=window.open('','_blank');if(w){w.document.write(html);w.document.close()}
}function loadXLSX(cb){if(window.XLSX)return cb();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';s.onload=cb;s.onerror=()=>$('#repStatus').textContent='Não foi possível carregar o gerador XLSX.';document.head.appendChild(s)}function ws(rows,widths){const s=XLSX.utils.json_to_sheet(rows);s['!cols']=widths.map(w=>({wch:w}));s['!freeze']={xSplit:0,ySplit:1};const rg=XLSX.utils.decode_range(s['!ref']||'A1:A1');for(let c=rg.s.c;c<=rg.e.c;c++){const x=s[XLSX.utils.encode_cell({r:0,c})];if(x)x.s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1E40AF'}},alignment:{horizontal:'center'}}}return s}function backup(){loadXLSX(()=>{
  const d=window.data||{},t=d.totals||{},p=profile(),wb=XLSX.utils.book_new(),hm=d.houseMetrics||[];
  if(!p.name){$('#repStatus').textContent='Selecione o Pastor ou Pastora antes de gerar o backup.';return}
  const responsible=`${p.role} ${p.name}`;
  XLSX.utils.book_append_sheet(wb,ws([{Campo:'Houses ativas',Valor:t.houses||0},{Campo:'Registros 8 semanas',Valor:t.reports||0},{Campo:'Participações',Valor:t.attendance||0},{Campo:'Primeira vez',Valor:t.first_time||0},{Campo:'Crianças',Valor:t.children||0},{Campo:'Decisões',Valor:t.decisions||0}],[24,60]),'Resumo');
  XLSX.utils.book_append_sheet(wb,ws((d.weeks||[]).map(w=>({Semana:w.label,Registros:w.records||0,Participacoes:w.attendance||0})),[16,12,16]),'Evolucao_Semanal');
  XLSX.utils.book_append_sheet(wb,ws(hm.map((m,i)=>({Posicao:i+1,Codigo:m.code,House:m.name,Rede:m.network||'',Regularidade:(m.regularity_pct||0)+'%',Participacoes:m.attendance||0,Media:m.avg_attendance||0,PrimeiraVez:m.first_time||0,Criancas:m.children||0,Decisoes:m.decisions||0,UltimoRegistro:br(m.last_record)})),[9,12,28,20,14,16,10,14,12,12,16]),'Ranking_Semaforo');
  XLSX.utils.book_append_sheet(wb,ws((d.houses||[]).map(h=>({Codigo:h.code,House:h.name,Rede:h.networks?.name||'',Lideres:(h.leader_full_names||h.leader_names||[]).join(' e '),Endereco:[h.address_line,h.neighborhood,h.city,h.state,h.postal_code].filter(Boolean).join(' • '),Horario:h.meeting_time||''})),[12,28,20,38,55,12]),'Houses');
  XLSX.utils.book_append_sheet(wb,ws((d.reports||[]).map(r=>({House:`${r.houses?.code||''} • ${r.houses?.name||''}`,Data:br(r.meeting_date),Status:r.status,Participantes:r.attendance_total||0,PrimeiraVez:r.first_time||0,Criancas:r.children||0,Decisoes:r.decisions_for_jesus||0,Mensagem:r.leader_message||''})),[32,14,14,14,14,12,12,45]),'Registros');
  XLSX.utils.book_append_sheet(wb,ws((d.communications||[]).map(x=>({Titulo:x.title,Comunicado:x.message,Inicio:br(x.starts_on),Fim:br(x.ends_on),Prioridade:x.priority||0})),[28,55,14,14,12]),'Comunicacoes');
  XLSX.utils.book_append_sheet(wb,ws((d.materials||[]).map(m=>({Titulo:m.title,Categoria:m.category||'',Semana:br(m.week_start),Arquivo:m.file_name||'',Descricao:m.description||''})),[38,16,14,40,55]),'Materiais');
  XLSX.utils.book_append_sheet(wb,ws((d.byNetwork||[]).map(n=>({Rede:n.name,Houses:n.houses,Regularidade:n.regularity_pct+'%',Participacoes:n.attendance,PrimeiraVez:n.first_time,Criancas:n.children,Decisoes:n.decisions})),[24,10,14,16,14,12,12]),'Redes');
  XLSX.utils.book_append_sheet(wb,ws((d.care||[]).map(x=>({House:`${x.houses?.code||''} • ${x.houses?.name||''}`,Status:x.status||'',MensagemLider:x.leader_message||'',RetornoPastoral:x.pastoral_response||''})),[32,18,48,48]),'Cuidado');
  // A última aba identifica claramente quem emitiu o backup.
  XLSX.utils.book_append_sheet(wb,ws([
    {Campo:'Responsável',Valor:responsible},
    {Campo:'Nome',Valor:p.name},
    {Campo:'Cargo',Valor:p.role},
    {Campo:'Telefone',Valor:p.phone||'—'},
    {Campo:'Observações',Valor:p.notes||'—'},
    {Campo:'Emitido em',Valor:new Date().toLocaleString('pt-BR')}
  ],[24,60]),'Responsavel');
  XLSX.writeFile(wb,`Houses_Pastores_Backup_${new Date().toISOString().slice(0,10)}.xlsx`);
  $('#repStatus').textContent='Backup XLSX gerado. O responsável consta na última aba.';
})}const o=new MutationObserver(inject);o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(inject,500)})();