/**
 * Motor Econômico de Demanda e Market Share
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Fórmula:
 * Demanda_i = DemandaMercado × MarketShareRelativo(Preço, Marketing, Reputação, Efeitos) × Ruído determinístico
 * Clamping estrito: multiplicadores limitados entre 0.40x e 1.80x da demanda de referência.
 */

import { SeededRNG } from '../utils/rng.js';

export class DemandEngine {
  /**
   * @param {object} config
   * @param {number} [config.demandaBaseTotal] Demanda média global por empresa (ex: 1.000 un.)
   * @param {number} [config.precoReferencia] Preço médio neutro de referência do mercado (ex: R$ 80,00)
   * @param {number} [config.elasticidadePadrao] Elasticidade-preço natural (ex: 1.35)
   */
  constructor(config = {}) {
    this.demandaBasePorEmpresa = config.demandaBasePorEmpresa || 1000;
    this.precoReferencia = config.precoReferencia || 80.0;
    this.elasticidadePadrao = config.elasticidadePadrao || 1.35;
  }

  /**
   * Calcula o fator de atratividade de marketing com retorno marginal decrescente.
   * Exemplo: R$ 0 -> 1.0x; R$ 1.500 -> 1.24x; R$ 5.000 -> 1.51x; R$ 15.000 -> 1.84x
   * @param {number} marketingInvestimento
   * @returns {number}
   */
  static calculateMarketingFactor(marketingInvestimento) {
    const invest = Math.max(0, Number(marketingInvestimento) || 0);
    return 1.0 + Math.log1p(invest / 1500) * 0.35;
  }

  /**
   * Calcula o fator de atratividade de preço baseado na elasticidade da demanda.
   * Preços menores aumentam atratividade; preços maiores reduzem.
   * @param {number} precoPraticado
   * @param {number} precoReferencia
   * @param {number} elasticidadeEfetiva
   * @returns {number}
   */
  static calculatePriceFactor(precoPraticado, precoReferencia, elasticidadeEfetiva) {
    const p = Math.max(10, Number(precoPraticado) || precoReferencia);
    const razaoPreco = p / precoReferencia;
    // Curva isoelástica: (P / Pref) ^ (-elasticidade)
    const fator = Math.pow(razaoPreco, -elasticidadeEfetiva);
    // Limita o fator de preço individual para evitar distorções extremas
    return Math.max(0.20, Math.min(3.5, fator));
  }

  /**
   * Simula a distribuição de demanda entre todas as empresas competidoras na rodada.
   *
   * @param {object} params
   * @param {number} params.rodada
   * @param {string|number} params.seed
   * @param {number} params.sazonalidade - Multiplicador sazonal da rodada (ex: 1.08)
   * @param {number} params.pibCrescimento - % PIB da rodada (ex: 2.5)
   * @param {number} params.multiplicadorNoticiaDemanda - Efeito cumulativo das notícias
   * @param {number} params.multiplicadorNoticiaElasticidade - Efeito nas preferências do consumidor
   * @param {Array<{ id: string, preco: number, marketing: number, reputacao?: number }>} params.empresasDecisoes
   * @returns {{ demandaTotalMercado: number, resultados: Array<{ id: string, demandaFinal: number, marketShare: number, fatorPreco: number, fatorMarketing: number, atratividade: number, vendasPerdidas?: number }> }}
   */
  calculateMarketDemand({
    rodada,
    seed,
    sazonalidade = 1.0,
    pibCrescimento = 2.5,
    multiplicadorNoticiaDemanda = 1.0,
    multiplicadorNoticiaElasticidade = 1.0,
    empresasDecisoes = []
  }) {
    if (!empresasDecisoes || empresasDecisoes.length === 0) {
      return { demandaTotalMercado: 0, resultados: [] };
    }

    const rng = new SeededRNG(`demand_r${rodada}_${seed}`);
    const numEmpresas = empresasDecisoes.length;

    // 1. Elasticidade Efetiva da Rodada
    const elasticidadeEfetiva = this.elasticidadePadrao * multiplicadorNoticiaElasticidade;

    // 2. Crescimento orgânico do mercado via PIB (ex: PIB +3% -> +1.5% na demanda)
    const fatorPIB = 1.0 + (pibCrescimento / 100) * 0.6;

    // 3. Demanda Base Global do Mercado para o conjunto de empresas
    let demandaTotalEsperada = this.demandaBasePorEmpresa * numEmpresas * sazonalidade * fatorPIB * multiplicadorNoticiaDemanda;

    // Clamping global do mercado entre 0.4x e 1.8x
    const demandaTotalMinima = this.demandaBasePorEmpresa * numEmpresas * 0.40;
    const demandaTotalMaxima = this.demandaBasePorEmpresa * numEmpresas * 1.80;
    demandaTotalEsperada = Math.max(demandaTotalMinima, Math.min(demandaTotalMaxima, demandaTotalEsperada));

    // 4. Cálculo da atratividade individual de cada empresa
    const scores = [];
    let somaAtratividade = 0;

    for (const emp of empresasDecisoes) {
      const fatorPreco = DemandEngine.calculatePriceFactor(emp.preco, this.precoReferencia, elasticidadeEfetiva);
      const fatorMarketing = DemandEngine.calculateMarketingFactor(emp.marketing);
      const fatorReputacao = Math.max(0.8, Math.min(1.2, emp.reputacao || 1.0));

      const atratividade = fatorPreco * fatorMarketing * fatorReputacao;
      somaAtratividade += atratividade;

      scores.push({
        id: emp.id,
        preco: emp.preco,
        marketing: emp.marketing,
        fatorPreco: Number(fatorPreco.toFixed(4)),
        fatorMarketing: Number(fatorMarketing.toFixed(4)),
        atratividade
      });
    }

    // 5. Alocação de Demanda por Market Share com ruído estocástico determinístico
    const resultados = [];
    let somaDemandaReal = 0;

    for (const s of scores) {
      const shareBase = somaAtratividade > 0 ? (s.atratividade / somaAtratividade) : (1 / numEmpresas);

      // Ruído estocástico determinístico calibrado (distribuição normal de média 1.0 e desvio 0.04)
      const ruido = rng.normal(1.0, 0.04);
      const shareComRuido = Math.max(0.01, shareBase * ruido);

      resultados.push({
        ...s,
        shareBruto: shareComRuido
      });
      somaDemandaReal += shareComRuido;
    }

    // Normalização final dos shares e cálculo de unidades físicas de demanda
    const finalResultados = resultados.map(r => {
      const marketShareNormalizado = r.shareBruto / somaDemandaReal;
      let demandaCalculada = Math.round(demandaTotalEsperada * marketShareNormalizado);

      // Clamping por empresa: garantido entre 0.4x e 1.8x da cota média de 1 empresa
      const minEmpresa = Math.round(this.demandaBasePorEmpresa * 0.40);
      const maxEmpresa = Math.round(this.demandaBasePorEmpresa * 1.80);
      const demandaFinal = Math.max(minEmpresa, Math.min(maxEmpresa, demandaCalculada));

      return {
        id: r.id,
        demandaFinal,
        marketShare: Number((marketShareNormalizado * 100).toFixed(2)),
        fatorPreco: r.fatorPreco,
        fatorMarketing: r.fatorMarketing,
        atratividade: Number(r.atratividade.toFixed(4))
      };
    });

    const demandaTotalMercado = finalResultados.reduce((acc, curr) => acc + curr.demandaFinal, 0);

    return {
      demandaTotalMercado,
      resultados: finalResultados
    };
  }
}
