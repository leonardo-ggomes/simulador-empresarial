/**
 * Serviço de Gerenciamento de Bots Concorrentes de IA
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Cria e administra equipes controladas por IA que competem no mesmo ranking dos alunos.
 */

import { CompetitorBots, BOT_PERSONALITIES } from '../engine/bots.js';
import { TeamRepository } from '../repositories/teamRepository.js';
import { RoundRepository } from '../repositories/roundRepository.js';
import { MacroEconomy } from '../engine/macro.js';
import { NewsEngine } from '../engine/news.js';
import { gerarCNPJFicticio } from '../utils/cnpj.js';

export const BOT_COMPANIES = [
  {
    nome: 'Apex Logística Industrial',
    setor: 'Tecnologia & Equipamentos',
    personalidade: BOT_PERSONALITIES.AGRESSIVO,
    slogan: 'Velocidade e escala sem limites em Porto Aurora'
  },
  {
    nome: 'Vanguarda Porto Seguro S.A.',
    setor: 'Varejo & Bens de Consumo',
    personalidade: BOT_PERSONALITIES.CONSERVADOR,
    slogan: 'Solidez e máxima tradição financeira'
  },
  {
    nome: 'Nexus Aurora Soluções',
    setor: 'Alimentos & Bebidas',
    personalidade: BOT_PERSONALITIES.ADAPTATIVO,
    slogan: 'Inteligência dinâmica de ponta a ponta'
  }
];

export class BotService {
  constructor(teamRepo = null, roundRepo = null) {
    this.teamRepo = teamRepo || new TeamRepository();
    this.roundRepo = roundRepo || new RoundRepository();
  }

  /**
   * Garante que as 3 empresas de IA existam na sala.
   * @param {string} salaId
   * @returns {Array<object>} Lista de equipes IA cadastradas
   */
  ensureBotsInRoom(salaId) {
    const existentes = this.teamRepo.findBySala(salaId);
    const bots = [];

    for (const b of BOT_COMPANIES) {
      let equipe = existentes.find(e => e.nome === b.nome);

      if (!equipe) {
        const cnpjData = gerarCNPJFicticio();
        const teamId = `bot_${b.personalidade}_${salaId.substr(-6)}`;

        equipe = this.teamRepo.createTeam({
          id: teamId,
          salaId,
          nome: b.nome,
          slogan: b.slogan,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(b.nome)}`,
          setor: b.setor,
          cnpj: cnpjData.cnpj,
          dataAbertura: '2031-01-01',
          capitalSocial: 80000.0
        });

        // Homologa imediatamente a abertura da empresa IA
        this.teamRepo.confirmTeam(teamId);
      }

      bots.push({
        ...equipe,
        personalidade: b.personalidade
      });
    }

    return bots;
  }

  /**
   * Gera e salva as decisões automáticas dos bots para a rodada atual.
   * @param {string} salaId
   * @param {number} rodada
   * @param {string|number} seed
   */
  processBotDecisions(salaId, rodada, seed) {
    const macroEngine = new MacroEconomy(seed);
    const macroData = macroEngine.getRoundData(rodada);

    const todasNoticias = this.roundRepo.getRoomNews(salaId);
    const newsEngine = new NewsEngine(todasNoticias);
    const noticiasEfeitos = newsEngine.calculateActiveEffects(rodada);

    const bots = this.ensureBotsInRoom(salaId);
    const decisoesGeradas = [];

    for (const bot of bots) {
      // Busca desempenho na rodada anterior se houver
      const historicoAnterior = rodada > 1 ? this.roundRepo.getResult(salaId, bot.id, rodada - 1) : null;

      const decisaoPayload = CompetitorBots.generateDecision({
        personalidade: bot.personalidade,
        rodada,
        seed,
        macroData,
        historicoUltimaRodada: historicoAnterior,
        noticiasEfeitos
      });

      const decisaoId = `dec_${salaId}_${bot.id}_r${rodada}`;
      const record = this.roundRepo.saveDecision({
        id: decisaoId,
        salaId,
        equipeId: bot.id,
        rodada,
        status: 'enviada',
        payload: {
          preco: decisaoPayload.preco,
          marketing: decisaoPayload.marketing,
          compraEstoqueNormal: decisaoPayload.compraEstoqueNormal,
          compraEstoqueUrgente: decisaoPayload.compraEstoqueUrgente,
          solicitarEmprestimo: decisaoPayload.solicitarEmprestimo,
          amortizarEmprestimo: decisaoPayload.amortizarEmprestimo
        },
        justificativa: decisaoPayload.justificativa,
        enviadoPor: 'sistema_ia'
      });

      decisoesGeradas.push(record);
    }

    return decisoesGeradas;
  }
}
