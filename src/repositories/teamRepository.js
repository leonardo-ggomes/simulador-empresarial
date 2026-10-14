/**
 * Repositório de Equipes e Membros
 * Aurora Business Lab - Porto Aurora 2031
 */

import { getDatabase } from './db.js';

export class TeamRepository {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  createTeam({
    id,
    salaId,
    nome,
    slogan = null,
    avatarUrl = null,
    setor = 'Varejo & Bens de Consumo',
    cnpj,
    dataAbertura = null,
    capitalSocial = 80000.0
  }) {
    const dataAberturaFinal = dataAbertura || new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      INSERT INTO equipes (
        id, sala_id, nome, slogan, avatar_url, setor, cnpj, confirmado,
        capital_social, data_abertura, criado_em
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))
    `);
    stmt.run(id, salaId, nome.trim(), slogan, avatarUrl, setor, cnpj, capitalSocial, dataAberturaFinal);
    return this.findById(id);
  }

  findById(id) {
    if (!id) return null;
    const team = this.db.prepare('SELECT * FROM equipes WHERE id = ?').get(id);
    if (!team) return null;
    team.membros = this.getMembers(id);
    return team;
  }

  findByCNPJ(cnpj) {
    if (!cnpj) return null;
    return this.db.prepare('SELECT * FROM equipes WHERE cnpj = ?').get(cnpj);
  }

  findBySala(salaId) {
    const teams = this.db.prepare('SELECT * FROM equipes WHERE sala_id = ? ORDER BY criado_em ASC').all(salaId);
    return teams.map(t => {
      t.membros = this.getMembers(t.id);
      return t;
    });
  }

  findUserTeamInRoom(salaId, usuarioId) {
    const row = this.db.prepare(`
      SELECT e.* FROM equipes e
      JOIN membros_equipe m ON m.equipe_id = e.id
      WHERE e.sala_id = ? AND m.usuario_id = ?
    `).get(salaId, usuarioId);
    if (!row) return null;
    row.membros = this.getMembers(row.id);
    return row;
  }

  addMember({ id, equipeId, usuarioId, papel }) {
    const stmt = this.db.prepare(`
      INSERT INTO membros_equipe (id, equipe_id, usuario_id, papel, criado_em)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(equipe_id, usuario_id, papel) DO NOTHING
    `);
    stmt.run(id, equipeId, usuarioId, papel);
    return this.getMembers(equipeId);
  }

  removeMember(equipeId, usuarioId) {
    this.db.prepare(`
      DELETE FROM membros_equipe WHERE equipe_id = ? AND usuario_id = ?
    `).run(equipeId, usuarioId);
  }

  getMembers(equipeId) {
    return this.db.prepare(`
      SELECT m.id, m.equipe_id, m.usuario_id, m.papel, u.nome, u.email
      FROM membros_equipe m
      JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.equipe_id = ?
      ORDER BY m.criado_em ASC
    `).all(equipeId);
  }

  updateMemberRoles(equipeId, usuarioId, papéis) {
    // Remove os papéis anteriores desse usuário nesta equipe
    this.db.prepare('DELETE FROM membros_equipe WHERE equipe_id = ? AND usuario_id = ?').run(equipeId, usuarioId);

    // Insere os novos papéis
    const stmt = this.db.prepare(`
      INSERT INTO membros_equipe (id, equipe_id, usuario_id, papel, criado_em)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    for (const papel of papéis) {
      const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      stmt.run(id, equipeId, usuarioId, papel);
    }

    return this.getMembers(equipeId);
  }

  updateTeamConfig(id, { nome, slogan, avatarUrl, setor }) {
    const current = this.findById(id);
    if (!current) throw new Error('Equipe não encontrada.');
    if (current.confirmado) {
      throw new Error('Empresa já confirmada! O nome e o CNPJ estão bloqueados.');
    }

    this.db.prepare(`
      UPDATE equipes
      SET nome = COALESCE(?, nome),
          slogan = COALESCE(?, slogan),
          avatar_url = COALESCE(?, avatar_url),
          setor = COALESCE(?, setor)
      WHERE id = ?
    `).run(nome ? nome.trim() : null, slogan, avatarUrl, setor, id);

    return this.findById(id);
  }

  confirmTeam(id) {
    const current = this.findById(id);
    if (!current) throw new Error('Equipe não encontrada.');

    this.db.prepare(`
      UPDATE equipes SET confirmado = 1 WHERE id = ?
    `).run(id);

    return this.findById(id);
  }

  updateScores(id, { pontuacaoFinanceira, pontuacaoMercado, pontuacaoAnalitica, pontuacaoTotal }) {
    this.db.prepare(`
      UPDATE equipes
      SET pontuacao_financeira = ?,
          pontuacao_mercado = ?,
          pontuacao_analitica = ?,
          pontuacao_total = ?
      WHERE id = ?
    `).run(pontuacaoFinanceira, pontuacaoMercado, pontuacaoAnalitica, pontuacaoTotal, id);
    return this.findById(id);
  }
}
