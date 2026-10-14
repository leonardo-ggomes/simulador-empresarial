/**
 * Repositório de Rodadas, Decisões, Resultados, Notícias e Logs Analíticos
 * Aurora Business Lab - Porto Aurora 2031
 */

import { getDatabase } from './db.js';

export class RoundRepository {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  // --- Decisões ---

  saveDecision({ id, salaId, equipeId, rodada, status, payload, justificativa = null, enviadoPor = null }) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const justificativaStr = justificativa ? (typeof justificativa === 'string' ? justificativa : JSON.stringify(justificativa)) : null;

    const stmt = this.db.prepare(`
      INSERT INTO decisoes_rodada (
        id, sala_id, equipe_id, rodada, status, payload_json, justificativa_analitica_json, enviado_por, enviado_em
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(sala_id, equipe_id, rodada) DO UPDATE SET
        status = excluded.status,
        payload_json = excluded.payload_json,
        justificativa_analitica_json = excluded.justificativa_analitica_json,
        enviado_por = excluded.enviado_por,
        enviado_em = excluded.enviado_em
    `);

    stmt.run(id, salaId, equipeId, rodada, status, payloadStr, justificativaStr, enviadoPor);
    return this.getDecision(salaId, equipeId, rodada);
  }

  getDecision(salaId, equipeId, rodada) {
    const row = this.db.prepare(`
      SELECT * FROM decisoes_rodada WHERE sala_id = ? AND equipe_id = ? AND rodada = ?
    `).get(salaId, equipeId, rodada);
    if (!row) return null;
    try { row.payload = JSON.parse(row.payload_json); } catch (_) { row.payload = {}; }
    if (row.justificativa_analitica_json) {
      try { row.justificativa = JSON.parse(row.justificativa_analitica_json); } catch (_) { row.justificativa = null; }
    }
    return row;
  }

  listDecisionsForRound(salaId, rodada) {
    const rows = this.db.prepare(`
      SELECT * FROM decisoes_rodada WHERE sala_id = ? AND rodada = ?
    `).all(salaId, rodada);
    return rows.map(r => {
      try { r.payload = JSON.parse(r.payload_json); } catch (_) { r.payload = {}; }
      if (r.justificativa_analitica_json) {
        try { r.justificativa = JSON.parse(r.justificativa_analitica_json); } catch (_) { r.justificativa = null; }
      }
      return r;
    });
  }

  // --- Resultados da Rodada ---

  saveResult({ id, salaId, equipeId, rodada, dre, balanco, dfc, mercado, estoque, credit }) {
    const stmt = this.db.prepare(`
      INSERT INTO resultados_rodada (
        id, sala_id, equipe_id, rodada, dre_json, balanco_json, dfc_json, mercado_json, estoque_json, credit_json, criado_em
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(sala_id, equipe_id, rodada) DO UPDATE SET
        dre_json = excluded.dre_json,
        balanco_json = excluded.balanco_json,
        dfc_json = excluded.dfc_json,
        mercado_json = excluded.mercado_json,
        estoque_json = excluded.estoque_json,
        credit_json = excluded.credit_json
    `);

    stmt.run(
      id,
      salaId,
      equipeId,
      rodada,
      JSON.stringify(dre),
      JSON.stringify(balanco),
      JSON.stringify(dfc),
      JSON.stringify(mercado),
      JSON.stringify(estoque),
      JSON.stringify(credit)
    );

    return this.getResult(salaId, equipeId, rodada);
  }

  getResult(salaId, equipeId, rodada) {
    const row = this.db.prepare(`
      SELECT * FROM resultados_rodada WHERE sala_id = ? AND equipe_id = ? AND rodada = ?
    `).get(salaId, equipeId, rodada);
    if (!row) return null;
    return this._parseResultRow(row);
  }

  getResultsForRound(salaId, rodada) {
    const rows = this.db.prepare(`
      SELECT r.*, e.nome as equipe_nome, e.setor, e.avatar_url
      FROM resultados_rodada r
      JOIN equipes e ON e.id = r.equipe_id
      WHERE r.sala_id = ? AND r.rodada = ?
    `).all(salaId, rodada);
    return rows.map(r => this._parseResultRow(r));
  }

  getTeamResults(equipeId) {
    const rows = this.db.prepare(`
      SELECT * FROM resultados_rodada WHERE equipe_id = ? ORDER BY rodada ASC
    `).all(equipeId);
    return rows.map(r => this._parseResultRow(r));
  }

  _parseResultRow(row) {
    return {
      ...row,
      dre: JSON.parse(row.dre_json),
      balanco: JSON.parse(row.balanco_json),
      dfc: JSON.parse(row.dfc_json),
      mercado: JSON.parse(row.mercado_json),
      estoque: JSON.parse(row.estoque_json),
      credit: JSON.parse(row.credit_json)
    };
  }

  // --- Notícias da Sala ---

  saveNews(noticia) {
    const stmt = this.db.prepare(`
      INSERT INTO noticias_sala (
        id, sala_id, rodada_publicacao, rodada_efeito_inicio, duracao_rodadas,
        titulo, texto, categoria, alvo, impacto_real, confiabilidade, tipo_efeito,
        gerada_por, revelada
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        titulo = excluded.titulo,
        texto = excluded.texto,
        revelada = excluded.revelada
    `);

    stmt.run(
      noticia.id,
      noticia.sala_id,
      noticia.rodada_publicacao,
      noticia.rodada_efeito_inicio,
      noticia.duracao_rodadas || 1,
      noticia.titulo,
      noticia.texto,
      noticia.categoria,
      noticia.alvo || 'mercado',
      noticia.impacto_real,
      noticia.confiabilidade,
      noticia.tipo_efeito,
      noticia.gerada_por || 'template',
      noticia.revelada ? 1 : 0
    );
  }

  getRoomNews(salaId) {
    return this.db.prepare(`
      SELECT * FROM noticias_sala WHERE sala_id = ? ORDER BY rodada_publicacao ASC, rodada_efeito_inicio ASC
    `).all(salaId);
  }

  revealNews(salaId, rodada) {
    this.db.prepare(`
      UPDATE noticias_sala SET revelada = 1 WHERE sala_id = ? AND rodada_efeito_inicio <= ?
    `).run(salaId, rodada);
  }

  // --- Logs Analíticos Pedagógicos ---

  logAnalyticalAction({ id, salaId, equipeId, usuarioId, rodada, tipoAnalise, detalhes }) {
    const stmt = this.db.prepare(`
      INSERT INTO logs_analiticos (id, sala_id, equipe_id, usuario_id, rodada, tipo_analise, detalhes_json, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      id,
      salaId,
      equipeId,
      usuarioId,
      rodada,
      tipoAnalise,
      typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)
    );
  }

  getAnalyticalLogs(equipeId) {
    const rows = this.db.prepare(`
      SELECT * FROM logs_analiticos WHERE equipe_id = ? ORDER BY criado_em DESC
    `).all(equipeId);
    return rows.map(r => {
      try { r.detalhes = JSON.parse(r.detalhes_json); } catch (_) { r.detalhes = {}; }
      return r;
    });
  }
}
