/**
 * Serviço de Apuração de Ranking Executivo das Empresas
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Avalia o desempenho corporativo multidisciplinar (Financeiro 50%, Mercado 20%, Risco/Governança 30%)
 * com suporte a apuração acumulada ou rodada a rodada, cálculo de variações de posição e raio-x detalhado.
 */

import { getDatabase } from '../repositories/db.js';
import { RoomRepository } from '../repositories/roomRepository.js';
import { TeamRepository } from '../repositories/teamRepository.js';
import { RoundRepository } from '../repositories/roundRepository.js';

export class RankingService {
  constructor({ db = null, roomRepo = null, teamRepo = null, roundRepo = null } = {}) {
    this.db = db || getDatabase();
    this.roomRepo = roomRepo || new RoomRepository(this.db);
    this.teamRepo = teamRepo || new TeamRepository(this.db);
    this.roundRepo = roundRepo || new RoundRepository(this.db);
  }

  /**
   * Obtém a lista de rodadas que já foram simuladas para a sala.
   * @param {string} salaId
   * @returns {number[]}
   */
  getCompletedRounds(salaId) {
    const rows = this.db.prepare(`
      SELECT DISTINCT rodada FROM resultados_rodada
      WHERE sala_id = ?
      ORDER BY rodada ASC
    `).all(salaId);
    return rows.map(r => r.rodada);
  }

  /**
   * Calcula o ranking completo das empresas de uma sala.
   *
   * @param {string} salaId - ID da sala
   * @param {number|'acumulado'|null} targetRound - Rodada específica ou 'acumulado'
   * @returns {object} Dados formatados do ranking com top 3, tabela, estatísticas e histórico
   */
  calculateRanking(salaId, targetRound = null) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) {
      throw new Error(`Sala ${salaId} não encontrada.`);
    }

    const equipes = this.teamRepo.findBySala(salaId);
    const completedRounds = this.getCompletedRounds(salaId);
    const latestCompletedRound = completedRounds.length > 0 ? Math.max(...completedRounds) : 0;

    // Determina a rodada apurada
    let effectiveRound = latestCompletedRound;
    let isCumulative = true;

    if (targetRound && targetRound !== 'acumulado') {
      const parsedRound = parseInt(targetRound, 10);
      if (!isNaN(parsedRound) && parsedRound >= 1) {
        effectiveRound = Math.min(parsedRound, latestCompletedRound || parsedRound);
        isCumulative = false;
      }
    }

    // Pesos da sala
    const pesos = sala.configuracoes?.pesosRanking || {
      financeiro: 0.50,
      mercado: 0.20,
      analitico: 0.30
    };

    // Se nenhuma rodada foi processada ainda
    if (completedRounds.length === 0 || effectiveRound === 0) {
      const baselineEmpresas = equipes.map((eq, idx) => ({
        posicao: idx + 1,
        variacao: 0,
        equipe: {
          id: eq.id,
          nome: eq.nome,
          slogan: eq.slogan || 'Inovação e Crescimento em Porto Aurora',
          avatarUrl: eq.avatar_url || '/images/avatars/default.png',
          setor: eq.setor || 'Varejo & Bens de Consumo',
          cnpj: eq.cnpj,
          capitalSocial: eq.capital_social || 80000,
          dataAbertura: eq.data_abertura,
          membros: eq.membros || []
        },
        scores: {
          financeiro: 70.0,
          mercado: 70.0,
          analitico: 75.0,
          geral: 71.5
        },
        metricas: {
          lucroAcumulado: 0.0,
          receitaAcumulada: 0.0,
          caixaAtual: eq.capital_social || 80000.0,
          patrimonioLiquido: eq.capital_social || 80000.0,
          marketShareMedio: equipes.length > 0 ? Number((100 / equipes.length).toFixed(1)) : 0,
          unidadesVendidasTotal: 0,
          vendasPerdidasTotal: 0,
          taxaAtendimento: 100.0,
          scoreCredito: 750,
          ratingCredito: 'A',
          statusSolvencia: 'Saudável'
        },
        historicoRodadas: []
      }));

      return {
        sala: {
          id: sala.id,
          nome: sala.nome,
          codigo: sala.codigo,
          rodadaAtual: sala.rodada_atual,
          maxRodadas: sala.max_rodadas,
          status: sala.status
        },
        rodadaApurada: 0,
        isCumulative: true,
        completedRounds: [],
        pesos,
        empresas: baselineEmpresas,
        top3: baselineEmpresas.slice(0, 3),
        estatisticas: {
          totalEmpresas: baselineEmpresas.length,
          lucroMedio: 0,
          marketShareLider: baselineEmpresas[0]?.metricas?.marketShareMedio || 0,
          empresaLider: baselineEmpresas[0]?.equipe?.nome || 'N/A'
        }
      };
    }

    // Calcula as métricas brutas das empresas para a rodada efetiva
    const rawEmpresas = equipes.map(eq => {
      const allResults = this.roundRepo.getTeamResults(eq.id);
      const resultsUpToRound = allResults.filter(r => r.rodada <= effectiveRound);
      const resultsForSingleRound = allResults.filter(r => r.rodada === effectiveRound);
      const activeResults = isCumulative ? resultsUpToRound : resultsForSingleRound;
      const latestResult = resultsUpToRound.length > 0 ? resultsUpToRound[resultsUpToRound.length - 1] : null;

      let lucroAcumulado = 0;
      let receitaAcumulada = 0;
      let marketShareSoma = 0;
      let unidadesVendidas = 0;
      let vendasPerdidas = 0;

      for (const res of activeResults) {
        lucroAcumulado += (res.dre?.lucroLiquido || 0);
        receitaAcumulada += (res.dre?.receitaBruta || 0);
        marketShareSoma += (res.mercado?.marketShare || 0);
        unidadesVendidas += (res.mercado?.unidadesVendidas || 0);
        vendasPerdidas += (res.mercado?.vendasPerdidas || 0);
      }

      const totalDemanda = unidadesVendidas + vendasPerdidas;
      const taxaAtendimento = totalDemanda > 0 ? (unidadesVendidas / totalDemanda) * 100 : 100;
      const marketShareMedio = activeResults.length > 0 ? (marketShareSoma / activeResults.length) : 0;

      const caixaAtual = latestResult?.balanco?.ativo?.circulante?.caixa ?? (eq.capital_social || 80000);
      const patrimonioLiquido = latestResult?.balanco?.patrimonioLiquido?.total ?? (eq.capital_social || 80000);
      const scoreCredito = latestResult?.credit?.score ?? 750;
      const ratingCredito = latestResult?.credit?.rating ?? 'A';
      const estaFalida = caixaAtual < -25000 && patrimonioLiquido < 0;

      let statusSolvencia = 'Saudável';
      if (estaFalida) {
        statusSolvencia = 'Insolvente';
      } else if (caixaAtual < 5000 || scoreCredito < 500) {
        statusSolvencia = 'Alerta';
      }

      return {
        equipe: {
          id: eq.id,
          nome: eq.nome,
          slogan: eq.slogan || 'Inovação e Eficiência em Porto Aurora',
          avatarUrl: eq.avatar_url || '/images/avatars/default.png',
          setor: eq.setor || 'Varejo & Bens de Consumo',
          cnpj: eq.cnpj,
          capitalSocial: eq.capital_social || 80000,
          dataAbertura: eq.data_abertura,
          membros: eq.membros || []
        },
        metricas: {
          lucroAcumulado: Number(lucroAcumulado.toFixed(2)),
          receitaAcumulada: Number(receitaAcumulada.toFixed(2)),
          caixaAtual: Number(caixaAtual.toFixed(2)),
          patrimonioLiquido: Number(patrimonioLiquido.toFixed(2)),
          marketShareMedio: Number(marketShareMedio.toFixed(1)),
          unidadesVendidasTotal: unidadesVendidas,
          vendasPerdidasTotal: vendasPerdidas,
          taxaAtendimento: Number(taxaAtendimento.toFixed(1)),
          scoreCredito,
          ratingCredito,
          statusSolvencia,
          estaFalida
        },
        historicoRodadas: allResults.map(r => ({
          rodada: r.rodada,
          lucroLiquido: r.dre?.lucroLiquido || 0,
          receita: r.dre?.receitaBruta || 0,
          caixa: r.balanco?.ativo?.circulante?.caixa || 0,
          marketShare: r.mercado?.marketShare || 0,
          rating: r.credit?.rating || 'A'
        }))
      };
    });

    // Normalização comparativa dos scores (0 a 100)
    const lucros = rawEmpresas.map(e => e.metricas.lucroAcumulado);
    const caixas = rawEmpresas.map(e => e.metricas.caixaAtual);
    const patrimonios = rawEmpresas.map(e => e.metricas.patrimonioLiquido);
    const marketShares = rawEmpresas.map(e => e.metricas.marketShareMedio);

    const minLucro = Math.min(...lucros);
    const maxLucro = Math.max(...lucros);
    const minCaixa = Math.min(...caixas);
    const maxCaixa = Math.max(...caixas);
    const minPL = Math.min(...patrimonios);
    const maxPL = Math.max(...patrimonios);
    const maxMS = Math.max(...marketShares, 1);

    const normalize = (val, min, max) => {
      if (max === min) return 70.0;
      return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    };

    const scoredEmpresas = rawEmpresas.map(item => {
      const { metricas } = item;

      // 1. Pilar Financeiro (50%): Lucro (50%), Caixa (25%), Patrimônio Líquido (25%)
      const normLucro = normalize(metricas.lucroAcumulado, minLucro, maxLucro);
      const normCaixa = normalize(metricas.caixaAtual, minCaixa, maxCaixa);
      const normPL = normalize(metricas.patrimonioLiquido, minPL, maxPL);
      let scoreFin = (normLucro * 0.50) + (normCaixa * 0.25) + (normPL * 0.25);
      if (metricas.estaFalida) scoreFin = Math.min(scoreFin, 10.0);

      // 2. Pilar Mercado (20%): Market Share (65%) + Taxa de Atendimento (35%)
      const normMS = Math.min(100, (metricas.marketShareMedio / maxMS) * 100);
      const normAtend = Math.max(0, Math.min(100, metricas.taxaAtendimento));
      const scoreMerc = (normMS * 0.65) + (normAtend * 0.35);

      // 3. Pilar Governança / Risco (30%): Score de Crédito Banco Aurora (0-1000 -> 0-100)
      let scoreGov = (metricas.scoreCredito / 1000) * 100;
      if (metricas.estaFalida) scoreGov = 0.0;
      else if (metricas.statusSolvencia === 'Alerta') scoreGov = Math.min(scoreGov, 45.0);

      // Score Geral Ponderado
      const scoreGeral = (scoreFin * pesos.financeiro) +
                         (scoreMerc * pesos.mercado) +
                         (scoreGov * pesos.analitico);

      return {
        ...item,
        scores: {
          financeiro: Number(scoreFin.toFixed(1)),
          mercado: Number(scoreMerc.toFixed(1)),
          analitico: Number(scoreGov.toFixed(1)),
          geral: Number(scoreGeral.toFixed(1))
        }
      };
    });

    // Ordenação decrescente de Score Geral (desempate por Lucro Acumulado e Caixa)
    scoredEmpresas.sort((a, b) => {
      if (b.scores.geral !== a.scores.geral) {
        return b.scores.geral - a.scores.geral;
      }
      if (b.metricas.lucroAcumulado !== a.metricas.lucroAcumulado) {
        return b.metricas.lucroAcumulado - a.metricas.lucroAcumulado;
      }
      return b.metricas.caixaAtual - a.metricas.caixaAtual;
    });

    // Atribuição de Posição
    scoredEmpresas.forEach((emp, index) => {
      emp.posicao = index + 1;
    });

    // Se houver rodada anterior (effectiveRound > 1), calcula a variação de posição
    if (effectiveRound > 1) {
      try {
        const prevRanking = this._calculateQuickRankingForRound(salaId, effectiveRound - 1, pesos);
        scoredEmpresas.forEach(emp => {
          const prevPos = prevRanking.get(emp.equipe.id);
          if (prevPos) {
            // Variação: se estava em 3º e foi pra 1º -> variacao = 3 - 1 = +2 (subiu)
            emp.variacao = prevPos - emp.posicao;
          } else {
            emp.variacao = 0;
          }
        });
      } catch (_) {
        scoredEmpresas.forEach(emp => { emp.variacao = 0; });
      }
    } else {
      scoredEmpresas.forEach(emp => { emp.variacao = 0; });
    }

    // Estatísticas Consolidadas
    const totalLucro = scoredEmpresas.reduce((acc, e) => acc + e.metricas.lucroAcumulado, 0);
    const lucroMedio = scoredEmpresas.length > 0 ? totalLucro / scoredEmpresas.length : 0;
    const empresaLider = scoredEmpresas[0]?.equipe?.nome || 'N/A';
    const marketShareLider = scoredEmpresas[0]?.metricas?.marketShareMedio || 0;

    return {
      sala: {
        id: sala.id,
        nome: sala.nome,
        codigo: sala.codigo,
        rodadaAtual: sala.rodada_atual,
        maxRodadas: sala.max_rodadas,
        status: sala.status
      },
      rodadaApurada: effectiveRound,
      isCumulative,
      completedRounds,
      pesos,
      empresas: scoredEmpresas,
      top3: scoredEmpresas.slice(0, 3),
      estatisticas: {
        totalEmpresas: scoredEmpresas.length,
        lucroMedio: Number(lucroMedio.toFixed(2)),
        marketShareLider,
        empresaLider
      }
    };
  }

  /**
   * Método auxiliar para apuração ultrarrápida da rodada anterior para cálculo do delta de posição.
   * @private
   */
  _calculateQuickRankingForRound(salaId, rodada, pesos) {
    const equipes = this.teamRepo.findBySala(salaId);
    const posMap = new Map();

    const items = equipes.map(eq => {
      const results = this.roundRepo.getTeamResults(eq.id).filter(r => r.rodada <= rodada);
      let lucro = 0;
      let msSoma = 0;
      let caixa = eq.capital_social || 80000;
      let pl = eq.capital_social || 80000;
      let scoreCred = 750;

      for (const res of results) {
        lucro += (res.dre?.lucroLiquido || 0);
        msSoma += (res.mercado?.marketShare || 0);
      }
      if (results.length > 0) {
        const last = results[results.length - 1];
        caixa = last.balanco?.ativo?.circulante?.caixa ?? caixa;
        pl = last.balanco?.patrimonioLiquido?.total ?? pl;
        scoreCred = last.credit?.score ?? scoreCred;
      }
      const msMedio = results.length > 0 ? msSoma / results.length : 0;

      // Estimativa linear rápida de pontuação
      const score = (lucro * 0.001 * pesos.financeiro) +
                    (msMedio * pesos.mercado) +
                    ((scoreCred / 10) * pesos.analitico);

      return { id: eq.id, score, lucro, caixa };
    });

    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lucro !== a.lucro) return b.lucro - a.lucro;
      return b.caixa - a.caixa;
    });

    items.forEach((item, idx) => {
      posMap.set(item.id, idx + 1);
    });

    return posMap;
  }
}
