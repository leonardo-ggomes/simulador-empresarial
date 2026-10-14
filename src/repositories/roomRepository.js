/**
 * Repositório de Salas de Simulação
 * Aurora Business Lab - Porto Aurora 2031
 */

import { getDatabase } from './db.js';

export class RoomRepository {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  createRoom({ id, codigo, professorId, nome, seed, maxRodadas = 12, configuracoes = {} }) {
    const configStr = typeof configuracoes === 'string' ? configuracoes : JSON.stringify(configuracoes);
    const stmt = this.db.prepare(`
      INSERT INTO salas (id, codigo, professor_id, nome, seed, rodada_atual, max_rodadas, status, configuracoes_json, criado_em)
      VALUES (?, ?, ?, ?, ?, 1, ?, 'aberta', ?, datetime('now'))
    `);
    stmt.run(id, codigo.toUpperCase().trim(), professorId, nome.trim(), seed, maxRodadas, configStr);
    return this.findById(id);
  }

  findByCode(codigo) {
    if (!codigo) return null;
    const row = this.db.prepare(`
      SELECT * FROM salas WHERE UPPER(codigo) = UPPER(?)
    `).get(codigo.trim());
    if (row && row.configuracoes_json) {
      try { row.configuracoes = JSON.parse(row.configuracoes_json); } catch (_) { row.configuracoes = {}; }
    }
    return row;
  }

  findById(id) {
    if (!id) return null;
    const row = this.db.prepare(`
      SELECT * FROM salas WHERE id = ?
    `).get(id);
    if (row && row.configuracoes_json) {
      try { row.configuracoes = JSON.parse(row.configuracoes_json); } catch (_) { row.configuracoes = {}; }
    }
    return row;
  }

  listByProfessor(professorId) {
    const rows = this.db.prepare(`
      SELECT * FROM salas WHERE professor_id = ? ORDER BY criado_em DESC
    `).all(professorId);
    return rows.map(r => {
      try { r.configuracoes = JSON.parse(r.configuracoes_json); } catch (_) { r.configuracoes = {}; }
      return r;
    });
  }

  updateStatus(id, status, rodadaAtual = null) {
    if (rodadaAtual !== null) {
      this.db.prepare(`
        UPDATE salas SET status = ?, rodada_atual = ? WHERE id = ?
      `).run(status, rodadaAtual, id);
    } else {
      this.db.prepare(`
        UPDATE salas SET status = ? WHERE id = ?
      `).run(status, id);
    }
    return this.findById(id);
  }

  advanceRound(id, novaRodada) {
    this.db.prepare(`
      UPDATE salas SET rodada_atual = ? WHERE id = ?
    `).run(novaRodada, id);
    return this.findById(id);
  }
}
