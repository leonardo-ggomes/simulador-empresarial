import { describe, it, expect } from 'vitest';
import { AuroraCreditBank } from '../src/engine/credit.js';

describe('Banco Aurora - Análise de Crédito e Financiamento', () => {
  it('deve atribuir score alto e rating AAA para empresas líquidas e pouco endividadas', () => {
    const scoreInfo = AuroraCreditBank.calculateScore({
      ativoTotal: 150000,
      ativoCirculante: 100000,
      passivoCirculante: 15000, // Liquidez > 6
      passivoTotal: 15000,     // Endividamento 10%
      patrimonioLiquido: 135000,
      lucroLiquidoUltimaRodada: 12000,
      historicoPontualidade: 1.0
    });

    expect(scoreInfo.score).toBeGreaterThanOrEqual(850);
    expect(scoreInfo.rating).toBe('AAA');
  });

  it('deve punir empresas com passivo excessivo e histórico ruim', () => {
    const scoreInfo = AuroraCreditBank.calculateScore({
      ativoTotal: 80000,
      ativoCirculante: 20000,
      passivoCirculante: 40000, // Liquidez 0.5 (ruim)
      passivoTotal: 75000,     // Endividamento > 90%
      patrimonioLiquido: 5000,
      lucroLiquidoUltimaRodada: -8000,
      historicoPontualidade: 0.4
    });

    expect(scoreInfo.score).toBeLessThan(350);
    expect(scoreInfo.rating).toBe('C');
  });

  it('deve calcular taxa de juros inversamente proporcional ao score', () => {
    const condicoesTop = AuroraCreditBank.getCreditTerms({
      score: 900,
      patrimonioLiquido: 100000,
      receitaMedia: 50000,
      selicTrimestral: 2.5
    });

    const condicoesMedias = AuroraCreditBank.getCreditTerms({
      score: 450,
      patrimonioLiquido: 100000,
      receitaMedia: 50000,
      selicTrimestral: 2.5
    });

    expect(condicoesTop.taxaJurosTrimestral).toBeLessThan(condicoesMedias.taxaJurosTrimestral);
    expect(condicoesTop.limiteDisponivel).toBeGreaterThan(condicoesMedias.limiteDisponivel);
  });

  it('deve amortizar e calcular juros corretamente no ciclo bancário', () => {
    const resultado = AuroraCreditBank.processLoanCycle({
      saldoDevedorAtual: 20000,
      novoEmprestimo: 10000,
      amortizacaoPrincipal: 5000,
      taxaJurosDecimal: 0.05 // 5% no trimestre
    });

    // Saldo com novo = 30.000
    // Juros = 30.000 * 0.05 = 1.500
    // Amortização efetiva = 5.000
    // Saldo devedor final = 30.000 - 5.000 = 25.000
    expect(resultado.jurosDoTrimestre).toBe(1500);
    expect(resultado.amortizacaoEfetiva).toBe(5000);
    expect(resultado.saldoDevedorFinal).toBe(25000);
    expect(resultado.pagamentoTotalBancario).toBe(6500); // 1500 juros + 5000 amortizacao
  });
});
