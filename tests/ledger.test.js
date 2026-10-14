import { describe, it, expect } from 'vitest';
import { Ledger } from '../src/engine/ledger.js';

describe('Motor de Livro-Razão Contábil (Partidas Dobradas)', () => {
  it('deve registrar lançamentos balanceados com sucesso', () => {
    const ledger = new Ledger();

    // Integralização de capital social: Débito em Caixa R$ 80.000 / Crédito em Capital Social R$ 80.000
    const entry = ledger.addEntry({
      round: 0,
      description: 'Capital Inicial',
      debits: [{ account: 'ativo.caixa', amount: 80000 }],
      credits: [{ account: 'pl.capital_social', amount: 80000 }]
    });

    expect(entry.id).toBeDefined();
    expect(ledger.getBalance('ativo.caixa')).toBe(80000);
    expect(ledger.getBalance('pl.capital_social')).toBe(80000);
  });

  it('deve lançar erro estrito se soma dos débitos != soma dos créditos', () => {
    const ledger = new Ledger();

    expect(() => {
      ledger.addEntry({
        round: 1,
        description: 'Lançamento com erro proposital',
        debits: [{ account: 'ativo.caixa', amount: 5000 }],
        credits: [{ account: 'receita.vendas', amount: 4900 }] // Desbalanceado em R$ 100
      });
    }).toThrow(/Partida dobrada desbalanceada/);
  });

  it('deve gerar DRE, Balanço e DFC perfeitamente equilibrados', () => {
    const ledger = new Ledger();

    // 1. Aporte de capital R$ 100.000
    ledger.addEntry({
      round: 1,
      description: 'Aporte de Capital',
      debits: [{ account: 'ativo.caixa', amount: 100000 }],
      credits: [{ account: 'pl.capital_social', amount: 100000 }]
    });

    // 2. Compra de estoque à vista: R$ 30.000 (1000 un a R$ 30)
    ledger.addEntry({
      round: 1,
      description: 'Compra de Estoque',
      debits: [{ account: 'ativo.estoque', amount: 30000 }],
      credits: [{ account: 'ativo.caixa', amount: 30000 }]
    });

    // 3. Venda de 800 un a R$ 80: Receita de R$ 64.000 à vista
    ledger.addEntry({
      round: 1,
      description: 'Venda de Mercadorias',
      debits: [{ account: 'ativo.caixa', amount: 64000 }],
      credits: [{ account: 'receita.vendas', amount: 64000 }]
    });

    // 4. CMV: 800 un * R$ 30 = R$ 24.000
    ledger.addEntry({
      round: 1,
      description: 'Reconhecimento de CMV',
      debits: [{ account: 'despesa.cmv', amount: 24000 }],
      credits: [{ account: 'ativo.estoque', amount: 24000 }]
    });

    // 5. Imposto sobre vendas 12%: R$ 7.680
    ledger.addEntry({
      round: 1,
      description: 'Impostos',
      debits: [{ account: 'despesa.impostos', amount: 7680 }],
      credits: [{ account: 'ativo.caixa', amount: 7680 }]
    });

    // 6. Despesas operacionais: Salários R$ 12.000 e Marketing R$ 3.000
    ledger.addEntry({
      round: 1,
      description: 'Salários',
      debits: [{ account: 'despesa.salarios', amount: 12000 }],
      credits: [{ account: 'ativo.caixa', amount: 12000 }]
    });

    ledger.addEntry({
      round: 1,
      description: 'Marketing',
      debits: [{ account: 'despesa.marketing', amount: 3000 }],
      credits: [{ account: 'ativo.caixa', amount: 3000 }]
    });

    // Validação DRE
    const dre = ledger.generateDRE(1);
    expect(dre.receitaBruta).toBe(64000);
    expect(dre.impostosSobreVendas).toBe(7680);
    expect(dre.receitaLiquida).toBe(56320);
    expect(dre.cmv).toBe(24000);
    expect(dre.lucroBruto).toBe(32320);
    expect(dre.despesasOperacionais.total).toBe(15000); // 12000 + 3000
    expect(dre.ebitda).toBe(17320);
    expect(dre.lucroLiquido).toBe(17320);

    // Validação Balanço Patrimonial
    const balanco = ledger.generateBalanceSheet(1);
    expect(balanco.estaBalanceado).toBe(true);
    expect(balanco.diferenca).toBe(0);

    // Ativo total: Caixa + Estoque restante
    // Caixa: 100000 - 30000 + 64000 - 7680 - 12000 - 3000 = 111.320
    // Estoque: 30000 - 24000 = 6.000
    // Total Ativo = 117.320
    expect(balanco.ativo.total).toBe(117320);
    // PL = Capital Social (100.000) + Lucro Acumulado (17.320) = 117.320
    expect(balanco.patrimonioLiquido.total).toBe(117320);
    expect(balanco.totalPassivoEPatrimonioLiquido).toBe(117320);

    // Validação DFC
    const dfc = ledger.generateCashFlow(1);
    expect(dfc.saldoInicial).toBe(0);
    expect(dfc.saldoFinal).toBe(111320);
    expect(dfc.variacaoLiquidaCaixa).toBe(111320);
  });
});
