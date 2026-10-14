/**
 * Serviço de Gerenciamento de Salas de Simulação
 * Aurora Business Lab - Porto Aurora 2031
 */

import { RoomRepository } from '../repositories/roomRepository.js';
import { RoundRepository } from '../repositories/roundRepository.js';
import { NEWS_TEMPLATES } from '../engine/news.js';

export class RoomService {
  constructor(roomRepo = null, roundRepo = null) {
    this.roomRepo = roomRepo || new RoomRepository();
    this.roundRepo = roundRepo || new RoundRepository();
  }

  /**
   * Gera código amigável de 6 caracteres alfanuméricos únicos (ex: AUR402).
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'AUR';
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Cria uma nova sala de simulação vinculada a um professor.
   */
  createRoom({ professorId, nome, dificuldade = 'intermediario', maxRodadas = 12 }) {
    if (!nome || nome.trim().length < 3) {
      throw new Error('O nome da sala/turma deve conter ao menos 3 caracteres.');
    }

    let codigo = this.generateRoomCode();
    while (this.roomRepo.findByCode(codigo)) {
      codigo = this.generateRoomCode();
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const seed = `aurora_seed_${roomId}_${Date.now()}`;

    const room = this.roomRepo.createRoom({
      id: roomId,
      codigo,
      professorId,
      nome,
      seed,
      maxRodadas,
      configuracoes: {
        dificuldade,
        habilitarLaboratorioAnalitico: false, // Por padrão, os alunos devem construir no Power BI
        pesosRanking: {
          financeiro: 0.50,
          mercado: 0.20,
          analitico: 0.30
        }
      }
    });

    // Popula as notícias do cenário da sala com base nos templates
    this._populateInitialNews(roomId, dificuldade);

    return room;
  }

  toggleAnalyticsLab(roomId, professorId, habilitado) {
    const room = this.getRoomById(roomId);
    if (room.professor_id !== professorId) {
      throw new Error('Apenas o professor responsável pode alterar as configurações da sala.');
    }

    const configs = room.configuracoes || {};
    configs.habilitarLaboratorioAnalitico = Boolean(habilitado);

    this.roomRepo.db.prepare(`
      UPDATE salas SET configuracoes_json = ? WHERE id = ?
    `).run(JSON.stringify(configs), roomId);

    return this.getRoomById(roomId);
  }

  _populateInitialNews(salaId, dificuldade) {
    // Distribui os 20 templates ao longo das 12 rodadas
    let index = 0;
    for (let r = 1; r <= 12; r++) {
      // 1 ou 2 notícias por rodada
      const qtdNoticias = r % 2 === 0 ? 2 : 1;
      for (let k = 0; k < qtdNoticias; k++) {
        const tmpl = NEWS_TEMPLATES[index % NEWS_TEMPLATES.length];
        index++;

        let confiabilidade = tmpl.confiabilidade_padrao;
        if (dificuldade === 'iniciante') {
          confiabilidade = 1.0;
        } else if (dificuldade === 'avancado' && tmpl.confiabilidade_padrao < 0.9) {
          confiabilidade = Math.max(0.50, tmpl.confiabilidade_padrao - 0.15);
        }

        this.roundRepo.saveNews({
          id: `news_${salaId}_r${r}_${k + 1}`,
          sala_id: salaId,
          rodada_publicacao: r,
          rodada_efeito_inicio: r,
          duracao_rodadas: tmpl.duracao_padrao,
          titulo: tmpl.titulo,
          texto: tmpl.texto,
          categoria: tmpl.categoria,
          alvo: 'mercado',
          impacto_real: tmpl.impacto_padrao,
          confiabilidade,
          tipo_efeito: tmpl.tipo_efeito,
          gerada_por: 'template',
          revelada: false
        });
      }
    }
  }

  getRoomByCode(codigo) {
    const room = this.roomRepo.findByCode(codigo);
    if (!room) throw new Error(`Sala com código "${codigo}" não foi encontrada.`);
    return room;
  }

  getRoomById(id) {
    const room = this.roomRepo.findById(id);
    if (!room) throw new Error(`Sala não encontrada.`);
    return room;
  }

  listRoomsByProfessor(professorId) {
    return this.roomRepo.listByProfessor(professorId);
  }

  startSimulation(roomId, professorId) {
    const room = this.getRoomById(roomId);
    if (room.professor_id !== professorId) {
      throw new Error('Apenas o professor responsável pode iniciar a simulação.');
    }
    return this.roomRepo.updateStatus(roomId, 'em_andamento', 1);
  }

  advanceRound(roomId, professorId) {
    const room = this.getRoomById(roomId);
    if (room.professor_id !== professorId) {
      throw new Error('Apenas o professor responsável pode avançar rodadas.');
    }
    if (room.rodada_atual >= room.max_rodadas) {
      return this.roomRepo.updateStatus(roomId, 'encerrada', room.max_rodadas);
    }
    return this.roomRepo.advanceRound(roomId, room.rodada_atual + 1);
  }
}
