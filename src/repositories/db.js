/**
 * Camada de Acesso a Dados e Inicialização SQLite
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Usa o DatabaseSync nativo do Node.js (ou fallback de drivers compatíveis).
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

/**
 * Retorna a instância ativa do banco de dados SQLite ou cria uma nova.
 * @param {string} [dbPath]
 * @returns {DatabaseSync}
 */
export function getDatabase(dbPath = null) {
  if (dbInstance) return dbInstance;

  const targetPath = dbPath || process.env.AURORA_DB_PATH || path.resolve(__dirname, '../../aurora.sqlite');
  dbInstance = new DatabaseSync(targetPath);

  // Executa PRAGMAs para integridade referencial e performance
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');

  // Aplica o schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.exec(schemaSql);
  }

  return dbInstance;
}

/**
 * Fecha a conexão com o banco de dados.
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
