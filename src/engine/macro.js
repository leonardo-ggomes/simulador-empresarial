/**
 * Motor Macroeconômico Determinístico
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Gera as variáveis do ambiente econômico para as 12 rodadas (trimestres),
 * obedecendo fielmente ao Storyline dos 3 Atos.
 */

import { SeededRNG } from '../utils/rng.js';

export const ACTS = {
  ATO_1: {
    nome: 'Ato 1: Nascimento',
    rodadas: [1, 2, 3, 4],
    descricao: 'Mercado estável, aprendizado básico, crédito fácil do Banco Aurora.'
  },
  ATO_2: {
    nome: 'Ato 2: Expansão',
    rodadas: [5, 6, 7, 8],
    descricao: 'Concorrentes IA entram, demanda cresce, juros sobem, notícias ambíguas.'
  },
  ATO_3: {
    nome: 'Ato 3: Turbulência',
    rodadas: [9, 10, 11, 12],
    descricao: 'Choque de câmbio e crédito, boatos, risco de insolvência e aperto monetário.'
  }
};

export class MacroEconomy {
  /**
   * @param {string|number} roomSeed
   */
  constructor(roomSeed) {
    this.seed = roomSeed;
    this.rng = new SeededRNG(`macro_${roomSeed}`);
    this.roundsData = this._generateAllRounds();
  }

  /**
   * Identifica o Ato da narrativa a partir do número da rodada.
   * @param {number} round
   */
  static getActByRound(round) {
    if (round <= 4) return ACTS.ATO_1;
    if (round <= 8) return ACTS.ATO_2;
    return ACTS.ATO_3;
  }

  /**
   * Gera a série macroeconômica completa das 12 rodadas de forma 100% determinística.
   */
  _generateAllRounds() {
    const rounds = {};

    let selicAtual = 9.5;      // Taxa básica % a.a.
    let cambioAtual = 5.10;    // BRL / USD
    let inflacaoAtual = 4.0;   // % a.a.
    let salarioMedio = 3200;   // R$

    for (let r = 1; r <= 12; r++) {
      let pibCrescimento;
      let aliquotaImposto = 0.12; // 12% sobre faturamento padrão simples

      if (r <= 4) {
        // Ato 1: Estabilidade
        selicAtual = 8.5 + this.rng.range(-0.5, 0.5);
        inflacaoAtual = 3.8 + this.rng.range(-0.4, 0.4);
        cambioAtual = 5.05 + this.rng.range(-0.10, 0.10);
        pibCrescimento = 2.8 + this.rng.range(-0.3, 0.5);
        salarioMedio += 40 + this.rng.range(-10, 15);
      } else if (r <= 8) {
        // Ato 2: Expansão & Pressão
        selicAtual = 10.5 + (r - 4) * 0.6 + this.rng.range(-0.3, 0.4);
        inflacaoAtual = 5.0 + (r - 4) * 0.35 + this.rng.range(-0.3, 0.5);
        cambioAtual = 5.25 + (r - 4) * 0.12 + this.rng.range(-0.15, 0.15);
        pibCrescimento = 3.5 - (r - 4) * 0.2 + this.rng.range(-0.4, 0.4);
        salarioMedio += 65 + this.rng.range(-10, 20);
        aliquotaImposto = 0.13;
      } else {
        // Ato 3: Turbulência & Choque Cambial
        selicAtual = 13.5 + (r - 8) * 0.8 + this.rng.range(-0.4, 0.6);
        inflacaoAtual = 6.8 + (r - 8) * 0.4 + this.rng.range(-0.5, 0.8);
        cambioAtual = 5.80 + (r - 8) * 0.28 + this.rng.range(-0.25, 0.35);
        pibCrescimento = 1.0 - (r - 8) * 0.35 + this.rng.range(-0.6, 0.4);
        salarioMedio += 50 + this.rng.range(-20, 20);
        aliquotaImposto = 0.14;
      }

      // Variação de custo de matéria prima atrelada ao câmbio (base R$ 1.00 = 100%)
      const fatorCambialCustoMP = Number((cambioAtual / 5.10).toFixed(4));

      // Sazonalidade trimestral de Porto Aurora:
      // Q1 (R1, R5, R9): Retomada (0.95x)
      // Q2 (R2, R6, R10): Regular (1.00x)
      // Q3 (R3, R7, R11): Aquecimento (1.08x)
      // Q4 (R4, R8, R12): Alta temporada/Natal no porto (1.20x)
      const trimestre = ((r - 1) % 4) + 1;
      const fatoresSazonalidade = { 1: 0.95, 2: 1.00, 3: 1.08, 4: 1.20 };
      const sazonalidade = fatoresSazonalidade[trimestre];

      rounds[r] = {
        rodada: r,
        trimestre,
        ano: 2031 + Math.floor((r - 1) / 4),
        ato: MacroEconomy.getActByRound(r),
        selic: Number(selicAtual.toFixed(2)),               // % ao ano
        selicTrimestral: Number((selicAtual / 4).toFixed(3)), // % no trimestre
        inflacao: Number(inflacaoAtual.toFixed(2)),         // % ao ano
        cambio: Number(cambioAtual.toFixed(2)),             // BRL por USD
        fatorCambialCustoMP,
        pibCrescimento: Number(pibCrescimento.toFixed(2)),  // % ao ano
        salarioMedio: Number(salarioMedio.toFixed(2)),      // R$ por funcionário/mês
        aliquotaImposto: Number(aliquotaImposto.toFixed(2)),// 0.12 a 0.14
        sazonalidade
      };
    }

    return rounds;
  }

  /**
   * Obtém os indicadores da rodada informada.
   * @param {number} round
   */
  getRoundData(round) {
    if (round < 1 || round > 12) {
      throw new Error(`Rodada inválida: ${round}. O simulador possui 12 rodadas.`);
    }
    return this.roundsData[round];
  }
}
