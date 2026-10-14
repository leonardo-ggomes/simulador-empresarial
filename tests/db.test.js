import { describe, it, expect, afterAll } from 'vitest';
import { getDatabase, closeDatabase } from '../src/repositories/db.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.resolve(__dirname, 'test_aurora.sqlite');

describe('Camada de Persistência SQLite', () => {
  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (_) {}
    }
  });

  it('deve inicializar o banco de dados e aplicar o schema relacional com sucesso', () => {
    const db = getDatabase(testDbPath);
    expect(db).toBeDefined();

    // Verifica se as tabelas principais foram criadas
    const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tablesQuery.map(t => t.name);

    expect(tableNames).toContain('usuarios');
    expect(tableNames).toContain('salas');
    expect(tableNames).toContain('equipes');
    expect(tableNames).toContain('membros_equipe');
    expect(tableNames).toContain('noticias_sala');
    expect(tableNames).toContain('decisoes_rodada');
    expect(tableNames).toContain('resultados_rodada');
    expect(tableNames).toContain('ledger_entries');
    expect(tableNames).toContain('logs_analiticos');
    expect(tableNames).toContain('conquistas_equipe');
  });
});
