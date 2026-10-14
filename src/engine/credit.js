/**
 * Sistema de Crédito - Banco Aurora
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Avalia a saúde financeira, concede crédito, calcula juros compostos por trimestre,
 * administra limites de endividamento e monitora risco de insolvência.
 */

export class AuroraCreditBank {
  /**
   * Calcula o Credit Score (0 a 1000) de uma empresa baseado em métricas contábeis.
   * @param {object} params
   * @param {number} params.ativoTotal
   * @param {number} params.ativoCirculante
   * @param {number} params.passivoCirculante
   * @param {number} params.passivoTotal
   * @param {number} params.patrimonioLiquido
   * @param {number} params.lucroLiquidoUltimaRodada
   * @param {number} params.historicoPontualidade - 0 a 1 (1 = 100% em dia)
   * @returns {{ score: number, rating: string, descricao: string }}
   */
  static calculateScore({
    ativoTotal = 100000,
    ativoCirculante = 60000,
    passivoCirculante = 10000,
    passivoTotal = 10000,
    patrimonioLiquido = 90000,
    lucroLiquidoUltimaRodada = 5000,
    historicoPontualidade = 1.0
  }) {
    // 1. Índice de Liquidez Corrente (Peso 30%)
    // Ideal: >= 1.8
    const liquidezCorrente = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 3.0;
    let pontosLiquidez = 0;
    if (liquidezCorrente >= 2.0) pontosLiquidez = 300;
    else if (liquidezCorrente >= 1.4) pontosLiquidez = 240;
    else if (liquidezCorrente >= 1.0) pontosLiquidez = 180;
    else if (liquidezCorrente >= 0.7) pontosLiquidez = 100;
    else pontosLiquidez = 30;

    // 2. Grau de Endividamento Geral: Passivo Total / Ativo Total (Peso 30%)
    // Ideal: <= 0.40
    const endividamento = ativoTotal > 0 ? passivoTotal / ativoTotal : 1.0;
    let pontosEndividamento = 0;
    if (endividamento <= 0.25) pontosEndividamento = 300;
    else if (endividamento <= 0.45) pontosEndividamento = 250;
    else if (endividamento <= 0.65) pontosEndividamento = 180;
    else if (endividamento <= 0.85) pontosEndividamento = 90;
    else pontosEndividamento = 20;

    // 3. Rentabilidade sobre Ativo - ROA trimestral (Peso 20%)
    const roa = ativoTotal > 0 ? lucroLiquidoUltimaRodada / ativoTotal : 0;
    let pontosRentabilidade = 0;
    if (roa >= 0.08) pontosRentabilidade = 200;
    else if (roa >= 0.04) pontosRentabilidade = 160;
    else if (roa >= 0.01) pontosRentabilidade = 120;
    else if (roa >= 0) pontosRentabilidade = 70;
    else pontosRentabilidade = 20;

    // 4. Histórico de Pagamentos (Peso 20%)
    const pontosHistorico = Math.max(0, Math.min(200, Math.round(historicoPontualidade * 200)));

    let score = pontosLiquidez + pontosEndividamento + pontosRentabilidade + pontosHistorico;
    score = Math.max(50, Math.min(1000, score));

    let rating = 'C';
    let descricao = 'Risco Alto';
    if (score >= 850) {
      rating = 'AAA';
      descricao = 'Excelente solidez e máxima credibilidade';
    } else if (score >= 700) {
      rating = 'AA';
      descricao = 'Baixo risco de inadimplência';
    } else if (score >= 550) {
      rating = 'A';
      descricao = 'Risco moderado / Perfil padrão de mercado';
    } else if (score >= 400) {
      rating = 'B';
      descricao = 'Atenção: endividamento elevado ou margem estreita';
    } else {
      rating = 'C';
      descricao = 'Crédito restrito pelo Banco Aurora';
    }

    return { score, rating, descricao };
  }

  /**
   * Calcula o limite total de crédito concedido e a taxa de juros trimestral aplicável.
   * @param {object} params
   * @param {number} params.score - 0 a 1000
   * @param {number} params.patrimonioLiquido
   * @param {number} params.receitaMedia
   * @param {number} params.selicTrimestral - Taxa básica em % no trimestre (ex: 2.5)
   */
  static getCreditTerms({ score, patrimonioLiquido, receitaMedia = 30000, selicTrimestral = 2.5 }) {
    if (score < 300 || patrimonioLiquido <= 0) {
      return {
        limiteDisponivel: 0,
        taxaJurosTrimestral: 0,
        bloqueado: true,
        motivoBloqueio: 'Score insuficiente ou patrimônio líquido negativo.'
      };
    }

    // Limite proporcional ao porte (PL e faturamento)
    const baseCapacidade = Math.max(10000, patrimonioLiquido * 0.5 + receitaMedia * 0.8);
    const fatorScore = (score - 250) / 750; // de ~0.06 até 1.0
    const limiteDisponivel = Math.round(baseCapacidade * fatorScore);

    // Spread bancário decresce conforme o score
    // Score 1000 -> Spread de +1.5% no trimestre
    // Score 350  -> Spread de +9.0% no trimestre
    const spreadRisco = Number((1.5 + (1 - fatorScore) * 7.5).toFixed(2));
    const taxaJurosTrimestral = Number((selicTrimestral + spreadRisco).toFixed(2));

    return {
      limiteDisponivel,
      spreadRisco,
      taxaJurosTrimestral,
      taxaJurosDecimal: taxaJurosTrimestral / 100,
      bloqueado: false,
      motivoBloqueio: null
    };
  }

  /**
   * Simula a contratação ou amortização de um empréstimo.
   * @param {object} params
   * @param {number} params.saldoDevedorAtual
   * @param {number} params.novoEmprestimo
   * @param {number} params.amortizacaoPrincipal
   * @param {number} params.taxaJurosDecimal - Taxa do trimestre
   */
  static processLoanCycle({ saldoDevedorAtual, novoEmprestimo = 0, amortizacaoPrincipal = 0, taxaJurosDecimal = 0.04 }) {
    const saldoComNovo = Math.round((saldoDevedorAtual + novoEmprestimo) * 100) / 100;
    const jurosDoTrimestre = Math.round(saldoComNovo * taxaJurosDecimal * 100) / 100;

    // Amortização efetiva não pode ser maior que o saldo devedor
    const amortizacaoEfetiva = Math.min(saldoComNovo, Math.max(0, amortizacaoPrincipal));
    const saldoFinal = Math.round((saldoComNovo - amortizacaoEfetiva) * 100) / 100;

    return {
      saldoInicial: saldoDevedorAtual,
      novoEmprestimo,
      jurosDoTrimestre,
      amortizacaoEfetiva,
      pagamentoTotalBancario: Math.round((jurosDoTrimestre + amortizacaoEfetiva) * 100) / 100,
      saldoDevedorFinal: saldoFinal
    };
  }
}
