import fs from 'node:fs';
import { Client, TablesDB, Query } from 'node-appwrite';

const config = JSON.parse(fs.readFileSync(new URL('../appwrite.config.json', import.meta.url), 'utf8'));
const endpoint = process.env.APPWRITE_ENDPOINT || config.endpoint;
const projectId = process.env.APPWRITE_PROJECT_ID || config.projectId;
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) throw new Error('APPWRITE_API_KEY não informado');

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const tablesDB = new TablesDB(client);

function is404(error) {
  return Number(error?.code) === 404 || Number(error?.response?.code) === 404;
}

async function maybe(fn) {
  try {
    return await fn();
  } catch (error) {
    if (is404(error)) return null;
    throw error;
  }
}

async function waitUntilDeleted(databaseId, tableId) {
  for (let i = 0; i < 20; i++) {
    const current = await maybe(() => tablesDB.getTable({ databaseId, tableId }));
    if (!current) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`A tabela ${tableId} não terminou de ser removida a tempo.`);
}

for (const database of config.tablesDB || []) {
  const databaseId = database.$id;
  let current = await maybe(() => tablesDB.get({ databaseId }));
  if (!current) {
    console.log(`Criando database ${database.name} (${databaseId})...`);
    await tablesDB.create({
      databaseId,
      name: database.name,
      enabled: database.enabled !== false
    });
  } else {
    console.log(`Database ${databaseId} já existe.`);
  }
}

for (const table of config.tables || []) {
  const databaseId = table.databaseId;
  const tableId = table.$id;
  let current = await maybe(() => tablesDB.getTable({ databaseId, tableId }));

  if (current) {
    const wanted = new Set((table.columns || []).map(column => column.key));
    const present = new Set((current.columns || []).map(column => column.key));
    const complete = [...wanted].every(key => present.has(key));

    if (complete) {
      console.log(`Tabela ${tableId} já está completa; mantendo.`);
      continue;
    }

    const rows = await tablesDB.listRows({
      databaseId,
      tableId,
      queries: [Query.limit(1)],
      total: false
    });

    if ((rows.rows || []).length > 0) {
      throw new Error(`A tabela ${tableId} está incompleta, mas já contém dados. Interrompido para evitar perda.`);
    }

    console.log(`Tabela ${tableId} está vazia e incompleta; recriando pelo TablesDB atual...`);
    await tablesDB.deleteTable({ databaseId, tableId });
    await waitUntilDeleted(databaseId, tableId);
    current = null;
  }

  if (!current) {
    const columns = (table.columns || []).map(column => ({ ...column }));
    const indexes = (table.indexes || []).map(index => ({ ...index }));

    console.log(`Criando tabela ${table.name} (${tableId}) com ${columns.length} colunas...`);
    await tablesDB.createTable({
      databaseId,
      tableId,
      name: table.name,
      permissions: table.$permissions || [],
      rowSecurity: table.rowSecurity === true,
      enabled: table.enabled !== false,
      columns,
      indexes
    });
  }
}

console.log('Schema TablesDB provisionado com sucesso.');
