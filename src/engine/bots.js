/**
 * Bots de Inteligência Artificial para Simulação Empresarial
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Implementa 3 perfis estratégicos baseados em regras econômicas:
 * 1. Agressivo: Guerra de preços, alto marketing, compras volumosas, uso de dívida.
 * 2. Conservador: Foco em margem, preço mais alto, marketing moderado, caixa blindado.
 * 3. Adaptativo: Ajusta preço e compras baseado no histórico, ruptura e notícias.
 *
 * Todos os bots utilizam a mesma interface/API de decisão dos alunos humanos.
 */

import { SeededRNG } from '../utils/rng.js';

export const BOT_PERSONALITIES = {
  AGRESSIVO: 'agressivo',
  CONSERVADOR: 'conservador',
  ADAPTATIVO: 'adaptativo'
};

export class CompetitorBots {
  /**
   * Gera uma decisão completa para um bot concorrente com base na sua personalidade.
   *
   * @param {object} params
   * @param {string} params.personalidade - 'agressivo' | 'conservador' | 'adaptativo'
   * @param {number} params.rodada - Rodada atual
   * @param {string|number} params.seed - Seed determinística
   * @param {object} params.macroData - Indicadores macroeconômicos da rodada
   * @param {object} [params.historicoUltimaRodada] - Desempenho do bot no trimestre anterior
   * @param {object} [params.noticiasEfeitos] - Multiplicadores de notícias da rodada
   * @returns {object} Decisão padronizada idêntica à dos alunos
   */
  static generateDecision({
    personalidade,
    rodada,
    seed,
    macroData,
    historicoUltimaRodada = null,
    noticiasEfeitos = { multiplicadorDemanda: 1.0, multiplicadorCusto: 1.0 }
  }) {
    const rng = new SeededRNG(`bot_${personalidade}_r${rodada}_${seed}`);

    switch (personalidade) {
      case BOT_PERSONALITIES.AGRESSIVO:
        return CompetitorBots._generateAggressiveDecision(rodada, rng, macroData, noticiasEfeitos);

      case BOT_PERSONALITIES.CONSERVADOR:
        return CompetitorBots._generateConservativeDecision(rodada, rng, macroData, noticiasEfeitos);

      case BOT_PERSONALITIES.ADAPTATIVO:
      default:
        return CompetitorBots._generateAdaptiveDecision(rodada, rng, macroData, historicoUltimaRodada, noticiasEfeitos);
    }
  }

  /**
   * Perfil Agressivo:
   * Busca liderança de market share através de preço competitivo e alto investimento em publicidade.
   */
  static _generateAggressiveDecision(rodada, rng, macroData, noticiasEfeitos) {
    // Preço abaixo da referência (R$ 72 a R$ 76)
    const preco = Number(rng.range(71.0, 75.5).toFixed(2));

    // Marketing massivo: R$ 4.500 a R$ 7.500
    const marketing = Math.round(rng.range(4500, 7500) / 100) * 100;

    // Compra agressiva de estoque (1.300 a 1.700 un.) antecipando expansão
    const demandaEsperada = 1400 * noticiasEfeitos.multiplicadorDemanda * macroData.sazonalidade;
    const compraEstoqueNormal = Math.round(demandaEsperada / 50) * 50;

    // Alavancagem: toma empréstimo se juros não estiverem proibitivos
    const solicitarEmprestimo = macroData.selicTrimestral < 3.5 ? 15000 : 5000;
    const amortizarEmprestimo = 0;

    return {
      preco,
      marketing,
      compraEstoqueNormal,
      compraEstoqueUrgente: 0,
      solicitarEmprestimo,
      amortizarEmprestimo,
      justificativa: {
        tipoAnalise: 'descritiva',
        evidencia: `Preço R$ ${preco} focado em ganho de market share com investimento de marketing de R$ ${marketing}`,
        hipotese: 'Penetração agressiva de mercado para sufocar concorrentes com margem mais estreita'
      }
    };
  }

  /**
   * Perfil Conservador:
   * Prioriza rentabilidade unitária (margem), segurança de liquidez e repasse de custos.
   */
  static _generateConservativeDecision(rodada, rng, macroData, noticiasEfeitos) {
    // Preço premium (R$ 84 a R$ 90) cobrindo aumentos de câmbio
    const basePreco = 84.0 * macroData.fatorCambialCustoMP;
    const preco = Number(rng.range(basePreco, basePreco + 5.0).toFixed(2));

    // Marketing moderado e focado: R$ 1.200 a R$ 2.200
    const marketing = Math.round(rng.range(1200, 2200) / 100) * 100;

    // Compra enxuta de estoque (800 a 1.050 un.) para evitar custos de armazenagem
    const compraEstoqueNormal = Math.round((900 * macroData.sazonalidade) / 50) * 50;

    // Zero dívidas: não toma empréstimo e amortiza se houver passivo
    const solicitarEmprestimo = 0;
    const amortizarEmprestimo = 5000;

    return {
      preco,
      marketing,
      compraEstoqueNormal,
      compraEstoqueUrgente: 0,
      solicitarEmprestimo,
      amortizarEmprestimo,
      justificativa: {
        tipoAnalise: 'diagnostica',
        evidencia: `Margem preservada em R$ ${preco} para mitigar riscos cambiais de R$ ${macroData.cambio}`,
        hipotese: 'Blindagem de caixa e foco em lucratividade unitária contra endividamento bancário'
      }
    };
  }

  /**
   * Perfil Adaptativo:
   * Analisa a rodada anterior: se houve ruptura (vendas perdidas), aumenta compras e reajusta preço;
   * se sobrou estoque, baixa ligeiramente o preço e corta compras; ajusta-se a notícias.
   */
  static _generateAdaptiveDecision(rodada, rng, macroData, historicoUltimaRodada, noticiasEfeitos) {
    let preco = 80.0;
    let marketing = 2800;
    let compraEstoqueNormal = 1000;

    if (historicoUltimaRodada) {
      const { estoque, mercado } = historicoUltimaRodada;

      // Se teve vendas perdidas (ruptura) na rodada anterior
      if (estoque && estoque.vendasPerdidas > 50) {
        // Demanda superou estoque: pode aumentar preço ligeiramente e deve comprar mais
        preco = Number((mercado.preco * 1.04).toFixed(2));
        marketing = Math.round((mercado.marketing * 1.05) / 100) * 100;
        compraEstoqueNormal = Math.round((estoque.demandaRecebida * 1.15) / 50) * 50;
      }
      // Se sobrou estoque excessivo (> 300 unidades)
      else if (estoque && estoque.estoqueFinalUnidades > 300) {
        // Reduz preço para girar estoque e reduz novos pedidos
        preco = Number((mercado.preco * 0.96).toFixed(2));
        marketing = Math.round((mercado.marketing * 1.10) / 100) * 100;
        compraEstoqueNormal = Math.max(400, Math.round((estoque.unidadesVendidas * 0.8) / 50) * 50);
      }
      // Caso equilibrado: acompanha inflação e sazonalidade
      else {
        preco = Number((mercado.preco * (1 + (macroData.inflacao / 100) * 0.25)).toFixed(2));
        marketing = mercado.marketing;
        compraEstoqueNormal = Math.round((1050 * macroData.sazonalidade) / 50) * 50;
      }
    } else {
      // Primeira rodada neutra calibrada
      preco = Number(rng.range(79.0, 81.5).toFixed(2));
      marketing = 2800;
      compraEstoqueNormal = Math.round((1000 * macroData.sazonalidade) / 50) * 50;
    }

    // Ajuste ao efeito de notícias
    if (noticiasEfeitos.multiplicadorDemanda > 1.1) {
      compraEstoqueNormal = Math.round((compraEstoqueNormal * 1.12) / 50) * 50;
    } else if (noticiasEfeitos.multiplicadorDemanda < 0.9) {
      compraEstoqueNormal = Math.round((compraEstoqueNormal * 0.90) / 50) * 50;
    }

    return {
      preco,
      marketing,
      compraEstoqueNormal,
      compraEstoqueUrgente: 0,
      solicitarEmprestimo: 0,
      amortizarEmprestimo: 0,
      justificativa: {
        tipoAnalise: 'preditiva',
        evidencia: `Ajuste dinâmico baseado no histórico prévio e sazonalidade de ${macroData.sazonalidade}x`,
        hipotese: 'Maximização de resultado equilibrando volume e estoque sem incorrer em rupturas graves'
      }
    };
  }
}
