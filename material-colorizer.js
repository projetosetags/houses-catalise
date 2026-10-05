/* Gera uma segunda versao colorida e padronizada a partir do PDF P&B. */
(()=>{
const palette=[['#fff5f5','#e53e3e','#742a2a'],['#ebf8ff','#3182ce','#2b6cb0'],['#fffaf0','#dd6b20','#7b341e'],['#f0fff4','#38a169','#22543d']];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function linesToModel(lines,meta={}){let title=clean(meta.title),scripture='',intro=[],topics=[],conclusion=[],questions=[],mode='intro',cur=null;
 for(const raw of lines){const s=clean(raw);if(!s)continue;if(!title&&s.length<80)title=s;
  if(/^\d+\.?\s*[-.]?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ].{5,}$/u.test(s)&&!/^(1\s*Reis|\d+\s*Reis)/i.test(s)){cur={heading:s,body:[]};topics.push(cur);mode='topic';continue}
  if(/^CONCLUS[ÃA]O/i.test(s)){mode='conclusion';cur=null;continue} if(/^PERGUNTAS/i.test(s)){mode='questions';cur=null;continue}
  if(!scripture&&/\b(?:Reis|Jo[aã]o|Mateus|Marcos|Lucas|Salmos|G[eê]nesis|[EÊ]xodo|Romanos|Cor[ií]ntios|Ef[eé]sios|Filipenses|Apocalipse)\b.*\d+[:.]\d+/i.test(s)&&s.length<90){scripture=s;continue}
  if(mode==='topic'&&cur)cur.body.push(s);else if(mode==='conclusion')conclusion.push(s);else if(mode==='questions')questions.push(s);else intro.push(s);
 }
 return {title:title||'Guia de Mensagens - HOUSE',scripture,intro,topics:topics.slice(0,6),conclusion,questions,meta};}
async function extract(file){if(!window.pdfjsLib)throw Error('Leitor de PDF não carregado');const ab=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument({data:ab}).promise,lines=[];for(let p=1;p<=pdf.numPages;p++){const tc=await (await pdf.getPage(p)).getTextContent();let lastY=null,row=[];for(const it of tc.items){const y=Math.round(it.transform[5]);if(lastY!==null&&Math.abs(y-lastY)>3){lines.push(row.join(' '));row=[]}row.push(it.str);lastY=y}if(row.length)lines.push(row.join(' '))}return lines}
function make(model){if(!window.jspdf?.jsPDF)throw Error('Gerador de PDF não carregado');const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),W=210,H=297,M=14,CW=W-2*M;let y=16;
 const addPage=()=>{doc.addPage();y=16};const ensure=h=>{if(y+h>282)addPage()};const text=(t,x,w,size=10,color='#2c3e50',bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);const ls=doc.splitTextToSize(clean(t),w);ensure(ls.length*size*.38+4);doc.text(ls,x,y);y+=ls.length*size*.38+2};
 doc.setFillColor('#2980b9');doc.roundedRect(M,y,28,8,2,2,'F');doc.setTextColor('#ffffff');doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('HOUSE',M+14,y+5.5,{align:'center'});y+=14;text(model.title,M,CW,19,'#1a365d',true);if(model.scripture)text(model.scripture,M,CW,11,'#4a5568',true);doc.setDrawColor('#2980b9');doc.setLineWidth(1);doc.line(M,y,M+CW,y);y+=7;
 const card=(heading,body,bg,border,fg)=>{const all=[heading,...body].filter(Boolean);const wrapped=[];for(const [i,t] of all.entries()){doc.setFontSize(i===0?11:9.4);doc.setFont('helvetica',i===0?'bold':'normal');wrapped.push({ls:doc.splitTextToSize(clean(t),CW-10),head:i===0})}const h=wrapped.reduce((s,a)=>s+a.ls.length*(a.head?4.5:4.0)+2,0)+6;ensure(h);doc.setFillColor(bg);doc.setDrawColor(border);doc.roundedRect(M,y,CW,h,2,2,'FD');doc.setFillColor(border);doc.rect(M,y,2,h,'F');let yy=y+6;doc.setTextColor(fg);for(const a of wrapped){doc.setFont('helvetica',a.head?'bold':'normal');doc.setFontSize(a.head?11:9.4);doc.text(a.ls,M+6,yy);yy+=a.ls.length*(a.head?4.5:4.0)+2}y+=h+5};
 if(model.intro.length)card('CONTEXTO',model.intro,'#f7fafc','#4a5568','#2d3748');model.topics.forEach((t,i)=>{const p=palette[i%palette.length];card(t.heading,t.body,...p)});if(model.conclusion.length)card('CONCLUSÃO',model.conclusion,'#faf5ff','#805ad5','#44337a');if(model.questions.length)card('PERGUNTAS PARA REFLEXÃO E COMPARTILHAMENTO',model.questions.map((q,i)=>`${i+1}. ${q}`),'#f0fdf4','#22c55e','#14532d');
 for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor('#667085');doc.text(`Guia de Mensagens - HOUSE • ${model.meta.weekLabel||''}`,M,290);doc.text(`Página ${i}/${doc.getNumberOfPages()}`,W-M,290,{align:'right'})}
 return doc.output('blob')}
window.generateColoredMaterialPDF=async(file,meta={})=>make(linesToModel(await extract(file),meta));
})();