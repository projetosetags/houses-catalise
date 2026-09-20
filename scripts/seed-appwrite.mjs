import { Client, TablesDB } from 'node-appwrite';
import { createHash } from 'node:crypto';

const endpoint=process.env.APPWRITE_ENDPOINT||'https://fra.cloud.appwrite.io/v1';
const project=process.env.APPWRITE_PROJECT_ID||'6aabcd0b000c5d1298ab';
const key=process.env.APPWRITE_API_KEY;
const adminToken=process.env.HOUSES_ADMIN_TOKEN;
if(!key)throw new Error('APPWRITE_API_KEY não configurada.');
if(!adminToken)throw new Error('HOUSES_ADMIN_TOKEN não configurado.');

const client=new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const tables=new TablesDB(client);const DB='houses_catalise';

async function put(tableId,rowId,data){
  try{return await tables.updateRow({databaseId:DB,tableId,rowId,data})}
  catch(e){if(e?.code!==404)throw e;return tables.createRow({databaseId:DB,tableId,rowId,data})}
}

// Dados históricos que devem ser restaurados apenas se ainda não existirem.
// Assim, os próximos deploys não sobrescrevem alterações feitas pelo painel pastoral.
async function ensure(tableId,rowId,data){
  try{return await tables.createRow({databaseId:DB,tableId,rowId,data})}
  catch(e){if(e?.code===409)return null;throw e}
}

for(let n=1;n<=4;n++){
  await put('networks',`network_${String(n).padStart(2,'0')}`,{name:`Rede ${String(n).padStart(2,'0')}`,leader_name:null,coordinator_name:null,active:true});
}

const rede04Houses=[
  {code:'0001',name:'Ademir e Sibele',leader_names:['Ademir','Sibele'],leader_full_names:['Ademir Athanazio','Sibele Nunes Do Nascimento']},
  {code:'0011',name:'Nivan e Andresa',leader_names:['Nivan','Andresa'],leader_full_names:['Nivan Mendes','Andresa Viel Mendes']},
  {code:'0030',name:'Edgar e Cleimar',leader_names:['Edgar','Cleimar'],leader_full_names:['Edgar Silva','Cleimar De Souza Silva']},
  {code:'0032',name:'Custódia Felipe',leader_names:['Custódia Felipe'],leader_full_names:['Custódia Goulart Felipe']},
  {code:'0035',name:'Fernando e Danielle',leader_names:['Fernando','Danielle'],leader_full_names:['Fernando De Freitas Passarela','Danielle Da Silva Felácio']},
  {code:'0043',name:'Ederson e Morgana',leader_names:['Ederson','Morgana'],leader_full_names:['Ederson Marcelino Mateus','Morgana Monteiro Gomes Mateus']},
  {code:'0052',name:'Felipe e Rayssa',leader_names:['Felipe','Rayssa'],leader_full_names:['Felipe J. Marcolino De Souza','Rayssa M. Scarpato']},
  {code:'0054',name:'Fernanda Castro',leader_names:['Fernanda Castro'],leader_full_names:['Fernanda Castro']},
  {code:'0070',name:'Harisson e Maiara',leader_names:['Harisson','Maiara'],leader_full_names:['Harisson Mendes Pacheco','Maiara Martins Do Amaral']},
  {code:'0072',name:'Caulino e Hellen',leader_names:['Caulino','Hellen'],leader_full_names:['Caulino Junior','Hellen Villa']},
  {code:'0078',name:'Jeniffer Meirelles',leader_names:['Jeniffer Meirelles'],leader_full_names:['Jeniffer De Lara Meirelles']},
  {code:'0085',name:'Joricelia Maciel',leader_names:['Joricelia Maciel'],leader_full_names:['Joricelia Maciel']},
  {code:'0093',name:'Maycon e Karine',leader_names:['Maycon','Karine'],leader_full_names:['Maycon André Marcos','Karine Vieira De Bitencourt']},
  {code:'0097',name:'Jonathan e Kátia',leader_names:['Jonathan','Kátia'],leader_full_names:['Jonathan Da Silva Manoel','Kátia Bloemer Da Silva Manoel']},
  {code:'0119',name:'Manoel e Patricia',leader_names:['Manoel','Patricia'],leader_full_names:['Manoel Fernandes Neto','Patricia Lisboa Fernandes']},
  {code:'0126',name:'Maycon e Andrea',leader_names:['Maycon','Andrea'],leader_full_names:['Maycon Paquelin','Andrea Paquelin']},
  {code:'0127',name:'Mateus e Michele',leader_names:['Mateus','Michele'],leader_full_names:['Mateus Cardoso Mendes','Michele Valgas Mendes']},
  {code:'0134',name:'Piter e Suelen',leader_names:['Piter','Suelen'],leader_full_names:['Piter Flores Alves','Suelen Rodrigues Flores']},
  {code:'0135',name:'Rafael e Patrícia',leader_names:['Rafael','Patrícia'],leader_full_names:['Rafael De Moraes Dos Santos','Patrícia Da Silva Damiani Dos Santos']},
  {code:'0138',name:'Sabrina Krobel',leader_names:['Sabrina Krobel'],leader_full_names:['Sabrina Ize Krobel']},
  {code:'0140',name:'Samantha Pacifico',leader_names:['Samantha Pacifico'],leader_full_names:['Samantha Pacifico']},
  {code:'0141',name:'Santilina Souza',leader_names:['Santilina Souza'],leader_full_names:['Santilina Cecilio De Souza']},
  {code:'0143',name:'Stefani Souza',leader_names:['Stefani Souza'],leader_full_names:['Stefani Marcelino Souza']},
  {code:'0146',name:'Tadeu e Michele',leader_names:['Tadeu','Michele'],leader_full_names:['Tadeu Mariot','Michele Mariot']},
  {code:'0147',name:'Tatiana e Ariel',leader_names:['Tatiana','Ariel'],leader_full_names:['Tatiana Marcelino Puhl','Ariel Elias Puhl']}
];

let housesCreated=0;
for(const h of rede04Houses){
  const row=await ensure('houses',`house_${h.code}`,{
    code:h.code,
    name:h.name,
    network_id:'network_04',
    leader_names:h.leader_names,
    leader_full_names:h.leader_full_names,
    active:true
  });
  if(row)housesCreated++;
}

const notices=[
  {
    id:'notice_tubarao_202609',
    title:'Agenda Tubarão',
    message:'22.09 ESCOLA DO DISCÍPULO; 24.09 CULTO DE MULHERES; 01.10 CULTO DE HOMENS',
    starts_on:'2026-09-17',ends_on:'2026-10-01',network_id:null,house_id:null,priority:20,active:true
  },
  {
    id:'notice_braco_norte_202609',
    title:'Agenda Braço do Norte',
    message:'24.09 CULTO DE MULHERES – CATALISE TUBARÃO; 01.10 CULTO DE HOMENS – CATALISE TUBARÃO',
    starts_on:'2026-09-17',ends_on:'2026-10-01',network_id:null,house_id:null,priority:10,active:true
  }
];
let noticesCreated=0;
for(const n of notices){
  const {id,...data}=n;
  const row=await ensure('communications',id,data);
  if(row)noticesCreated++;
}

const pastors=[
  {id:'pastor_luciana',name:'Luciana Ferreira Costa',phone:'9 9149-2104',role:'Pastora',sort_order:1},
  {id:'pastor_mariza',name:'Mariza Ferreira',phone:null,role:'Pastora',sort_order:2},
  {id:'pastor_marcelo',name:'Marcelo Cruz',phone:'9 9148-9910',role:'Pastor',sort_order:3},
  {id:'pastor_andrea',name:'Andréa Cruz',phone:null,role:'Pastora',sort_order:4},
  {id:'pastor_francine',name:'Francine Zaboti',phone:null,role:'Pastora',sort_order:5},
  {id:'pastor_joao_marcos',name:'João Marcos da Silva',phone:null,role:'Pastor',sort_order:6},
  {id:'pastor_luiz',name:'Luiz Sartor',phone:null,role:'Pastor',sort_order:7},
  {id:'pastor_roselane',name:'Roselane Mota de Bem',phone:null,role:'Pastora',sort_order:8},
  {id:'pastor_thiago',name:'Thiago Zaboti',phone:'9 9847-0596',role:'Pastor',sort_order:9}
];
let pastorsCreated=0;
for(const p of pastors){
  const {id,...data}=p;
  try{
    await tables.createRow({databaseId:DB,tableId:'pastoral_contacts',rowId:id,data:{...data,active:true}});
    pastorsCreated++;
  }catch(e){
    if(e?.code!==409)throw e;
    // Atualiza nome/cargo/ordem sem apagar telefone que possa ter sido preenchido pelo painel.
    await tables.updateRow({databaseId:DB,tableId:'pastoral_contacts',rowId:id,data:{name:p.name,role:p.role,sort_order:p.sort_order,active:true}});
  }
}

await put('app_config','main',{
  church_name:'Catalise Church',
  slogan:'Houses que transformam vidas',
  purpose_text:'Pessoas • Houses • Propósito',
  verse_text:'Pois onde estiverem dois ou três reunidos em meu nome, ali estou no meio deles.',
  verse_ref:'Mateus 18:20',
  active:true
});
await put('admin_access','primary',{
  label:'Admin Pastoral',
  token_hash:createHash('sha256').update(adminToken).digest('hex'),
  active:true
});

// Registra a origem do GitHub Pages para o navegador conversar com a API Appwrite.
try{
  const r=await fetch(`${endpoint}/project/platforms/web`,{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Appwrite-Project':project,'X-Appwrite-Key':key,'X-Appwrite-Response-Format':'2.0.0'},
    body:JSON.stringify({platformId:'github_pages',name:'Houses Catalise - GitHub Pages',hostname:'projetosetags.github.io'})
  });
  if(!r.ok&&r.status!==409)console.warn('Plataforma web não criada automaticamente:',r.status,await r.text());
}catch(e){console.warn('Plataforma web pendente:',e.message)}

console.log(`Seed Appwrite concluído: Redes 01–04, Rede 04 com 25 Houses (${housesCreated} novas), 2 avisos (${noticesCreated} novos), ${pastorsCreated} novos contatos pastorais, configuração e acesso pastoral.`);
