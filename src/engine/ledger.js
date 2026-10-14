/**
 * Motor Contábil de Partidas Dobradas (Double-entry Bookkeeping)
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Regra de Ouro: Para todo débito deve haver um crédito de igual valor.
 * Invariante: Soma(Débitos) === Soma(Créditos)
 * Balanço: Ativo === Passivo + Patrimônio Líquido
 */

export const ACCOUNT_TYPES = {
  ATIVO: 'ATIVO',       // Natureza Devedora (+) Débito, (-) Crédito
  PASSIVO: 'PASSIVO',   // Natureza Credora  (+) Crédito, (-) Débito
  PL: 'PL',             // Natureza Credora  (+) Crédito, (-) Débito
  RECEITA: 'RECEITA',   // Natureza Credora  (+) Crédito, (-) Débito
  DESPESA: 'DESPESA'    // Natureza Devedora (+) Débito, (-) Crédito
};

export const CHART_OF_ACCOUNTS = {
  // Ativos (1)
  'ativo.caixa': { codigo: '1.1.1', nome: 'Caixa e Equivalentes', tipo: ACCOUNT_TYPES.ATIVO },
  'ativo.clientes': { codigo: '1.1.2', nome: 'Contas a Receber (Clientes)', tipo: ACCOUNT_TYPES.ATIVO },
  'ativo.estoque': { codigo: '1.1.3', nome: 'Estoque de Mercadorias', tipo: ACCOUNT_TYPES.ATIVO },
  'ativo.imobilizado': { codigo: '1.2.1', nome: 'Ativo Imobilizado', tipo: ACCOUNT_TYPES.ATIVO },

  // Passivos (2)
  'passivo.fornecedores': { codigo: '2.1.1', nome: 'Fornecedores a Pagar', tipo: ACCOUNT_TYPES.PASSIVO },
  'passivo.emprestimos': { codigo: '2.1.2', nome: 'Empréstimos Bancários (Banco Aurora)', tipo: ACCOUNT_TYPES.PASSIVO },
  'passivo.impostos': { codigo: '2.1.3', nome: 'Impostos a Recolher', tipo: ACCOUNT_TYPES.PASSIVO },

  // Patrimônio Líquido (3)
  'pl.capital_social': { codigo: '3.1.1', nome: 'Capital Social Integralizado', tipo: ACCOUNT_TYPES.PL },
  'pl.lucros_acumulados': { codigo: '3.1.2', nome: 'Lucros ou Prejuízos Acumulados', tipo: ACCOUNT_TYPES.PL },

  // Receitas (4)
  'receita.vendas': { codigo: '4.1.1', nome: 'Receita Bruta de Vendas', tipo: ACCOUNT_TYPES.RECEITA },
  'receita.financeira': { codigo: '4.2.1', nome: 'Receitas Financeiras (Rendimentos)', tipo: ACCOUNT_TYPES.RECEITA },

  // Despesas e Custos (5)
  'despesa.cmv': { codigo: '5.1.1', nome: 'Custo das Mercadorias Vendidas (CMV)', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.salarios': { codigo: '5.2.1', nome: 'Salários e Encargos', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.aluguel': { codigo: '5.2.2', nome: 'Aluguel do Galpão e Escritório', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.armazenagem': { codigo: '5.2.3', nome: 'Custo de Armazenagem de Estoque', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.marketing': { codigo: '5.2.4', nome: 'Despesas com Publicidade e Marketing', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.juros': { codigo: '5.2.5', nome: 'Juros e Encargos Financeiros', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.impostos': { codigo: '5.2.6', nome: 'Tributos e Impostos sobre Vendas', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.perdas_estoque': { codigo: '5.2.7', nome: 'Perdas e Obsolescência de Estoque', tipo: ACCOUNT_TYPES.DESPESA },
  'despesa.consultoria': { codigo: '5.2.8', nome: 'Serviços de Consultoria Analítica', tipo: ACCOUNT_TYPES.DESPESA }
};

export class Ledger {
  constructor() {
    /** @type {Array<{ id: string, round: number, date: string, description: string, debits: Array<{ account: string, amount: number }>, credits: Array<{ account: string, amount: number }> }>} */
    this.entries = [];
  }

  /**
   * Arredonda valores monetários para duas casas decimais com segurança.
   * @param {number} num
   * @returns {number}
   */
  static roundMoney(num) {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Registra um lançamento contábil de partida dobrada.
   * @param {object} params
   * @param {number} params.round Rodada da transação
   * @param {string} params.description Descrição / Histórico
   * @param {Array<{ account: string, amount: number }>} params.debits Lançamentos a débito
   * @param {Array<{ account: string, amount: number }>} params.credits Lançamentos a crédito
   * @returns {object} Registro adicionado
   */
  addEntry({ round, description, debits, credits }) {
    if (!debits || debits.length === 0) {
      throw new Error(`Lançamento sem débito: "${description}"`);
    }
    if (!credits || credits.length === 0) {
      throw new Error(`Lançamento sem crédito: "${description}"`);
    }

    let totalDebit = 0;
    for (const d of debits) {
      if (!CHART_OF_ACCOUNTS[d.account]) {
        throw new Error(`Conta desconhecida para débito: ${d.account}`);
      }
      if (d.amount <= 0) {
        throw new Error(`Valor de débito inválido na conta ${d.account}: ${d.amount}`);
      }
      totalDebit = Ledger.roundMoney(totalDebit + d.amount);
    }

    let totalCredit = 0;
    for (const c of credits) {
      if (!CHART_OF_ACCOUNTS[c.account]) {
        throw new Error(`Conta desconhecida para crédito: ${c.account}`);
      }
      if (c.amount <= 0) {
        throw new Error(`Valor de crédito inválido na conta ${c.account}: ${c.amount}`);
      }
      totalCredit = Ledger.roundMoney(totalCredit + c.amount);
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.009) {
      throw new Error(
        `Partida dobrada desbalanceada em "${description}". Débitos: R$ ${totalDebit.toFixed(2)}, Créditos: R$ ${totalCredit.toFixed(2)} (Dif: ${diff})`
      );
    }

    const entry = {
      id: `entry_${this.entries.length + 1}_r${round}`,
      round,
      timestamp: new Date().toISOString(),
      description,
      debits: debits.map(d => ({ account: d.account, amount: Ledger.roundMoney(d.amount) })),
      credits: credits.map(c => ({ account: c.account, amount: Ledger.roundMoney(c.amount) }))
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Calcula o saldo acumulado de uma conta até determinada rodada.
   * Contas devedoras (Ativo, Despesa): Saldo = Débitos - Créditos
   * Contas credoras (Passivo, PL, Receita): Saldo = Créditos - Débitos
   * @param {string} accountKey
   * @param {number} [upToRound]
   * @returns {number}
   */
  getBalance(accountKey, upToRound = Infinity) {
    const meta = CHART_OF_ACCOUNTS[accountKey];
    if (!meta) throw new Error(`Conta não encontrada: ${accountKey}`);

    let debits = 0;
    let credits = 0;

    for (const entry of this.entries) {
      if (entry.round > upToRound) continue;

      for (const d of entry.debits) {
        if (d.account === accountKey) debits += d.amount;
      }
      for (const c of entry.credits) {
        if (c.account === accountKey) credits += c.amount;
      }
    }

    debits = Ledger.roundMoney(debits);
    credits = Ledger.roundMoney(credits);

    if (meta.tipo === ACCOUNT_TYPES.ATIVO || meta.tipo === ACCOUNT_TYPES.DESPESA) {
      return Ledger.roundMoney(debits - credits);
    } else {
      return Ledger.roundMoney(credits - debits);
    }
  }

  /**
   * Calcula o movimento ocorrido estritamente dentro da rodada especificada.
   * @param {string} accountKey
   * @param {number} round
   */
  getRoundMovement(accountKey, round) {
    const meta = CHART_OF_ACCOUNTS[accountKey];
    if (!meta) throw new Error(`Conta não encontrada: ${accountKey}`);

    let debits = 0;
    let credits = 0;

    for (const entry of this.entries) {
      if (entry.round !== round) continue;

      for (const d of entry.debits) {
        if (d.account === accountKey) debits += d.amount;
      }
      for (const c of entry.credits) {
        if (c.account === accountKey) credits += c.amount;
      }
    }

    if (meta.tipo === ACCOUNT_TYPES.ATIVO || meta.tipo === ACCOUNT_TYPES.DESPESA) {
      return Ledger.roundMoney(debits - credits);
    } else {
      return Ledger.roundMoney(credits - debits);
    }
  }

  /**
   * Gera a DRE (Demonstração do Resultado do Exercício) da rodada.
   * @param {number} round
   */
  generateDRE(round) {
    const receitaVendas = this.getRoundMovement('receita.vendas', round);
    const receitaFinanceira = this.getRoundMovement('receita.financeira', round);
    const impostosSobreVendas = this.getRoundMovement('despesa.impostos', round);

    const receitaLiquida = Ledger.roundMoney(receitaVendas - impostosSobreVendas);

    const cmv = this.getRoundMovement('despesa.cmv', round);
    const lucroBruto = Ledger.roundMoney(receitaLiquida - cmv);

    const salarios = this.getRoundMovement('despesa.salarios', round);
    const aluguel = this.getRoundMovement('despesa.aluguel', round);
    const armazenagem = this.getRoundMovement('despesa.armazenagem', round);
    const marketing = this.getRoundMovement('despesa.marketing', round);
    const perdasEstoque = this.getRoundMovement('despesa.perdas_estoque', round);
    const consultoria = this.getRoundMovement('despesa.consultoria', round);

    const totalDespesasOperacionais = Ledger.roundMoney(
      salarios + aluguel + armazenagem + marketing + perdasEstoque + consultoria
    );

    const ebitda = Ledger.roundMoney(lucroBruto - totalDespesasOperacionais);

    const juros = this.getRoundMovement('despesa.juros', round);
    const resultadoFinanceiro = Ledger.roundMoney(receitaFinanceira - juros);

    const lucroLiquido = Ledger.roundMoney(ebitda + resultadoFinanceiro);

    return {
      round,
      receitaBruta: receitaVendas,
      impostosSobreVendas,
      receitaLiquida,
      cmv,
      lucroBruto,
      despesasOperacionais: {
        salarios,
        aluguel,
        armazenagem,
        marketing,
        perdasEstoque,
        consultoria,
        total: totalDespesasOperacionais
      },
      ebitda,
      receitaFinanceira,
      despesasFinanceiras: juros,
      resultadoFinanceiro,
      lucroLiquido,
      margemBruta: receitaLiquida > 0 ? Ledger.roundMoney((lucroBruto / receitaLiquida) * 100) : 0,
      margemOperacional: receitaLiquida > 0 ? Ledger.roundMoney((ebitda / receitaLiquida) * 100) : 0,
      margemLiquida: receitaLiquida > 0 ? Ledger.roundMoney((lucroLiquido / receitaLiquida) * 100) : 0
    };
  }

  /**
   * Transfere o resultado do exercício da rodada para Lucros Acumulados no Patrimônio Líquido.
   * Isso fecha as contas de resultado e equilibra perfeitamente o Balanço Patrimonial.
   * @param {number} round
   * @param {number} netIncome
   */
  closeIncomeToEquity(round, netIncome) {
    if (netIncome === 0) return null;

    // Se lucro positivo: Crédito em PL (aumenta PL)
    // Se prejuízo (netIncome < 0): Débito em PL (reduz PL)
    // O contra-lançamento é virtual nas contas de encerramento do período
    return {
      round,
      transferredAmount: netIncome
    };
  }

  /**
   * Gera o Balanço Patrimonial da rodada.
   * @param {number} round
   */
  generateBalanceSheet(round) {
    const caixa = this.getBalance('ativo.caixa', round);
    const clientes = this.getBalance('ativo.clientes', round);
    const estoque = this.getBalance('ativo.estoque', round);
    const ativoCirculante = Ledger.roundMoney(caixa + clientes + estoque);

    const imobilizado = this.getBalance('ativo.imobilizado', round);
    const totalAtivo = Ledger.roundMoney(ativoCirculante + imobilizado);

    const fornecedores = this.getBalance('passivo.fornecedores', round);
    const emprestimos = this.getBalance('passivo.emprestimos', round);
    const impostos = this.getBalance('passivo.impostos', round);
    const totalPassivo = Ledger.roundMoney(fornecedores + emprestimos + impostos);

    const capitalSocial = this.getBalance('pl.capital_social', round);

    // Lucros acumulados até a rodada atual = soma dos lucros líquidos de todas as rodadas <= round
    let lucroAcumuladoHistorico = 0;
    for (let r = 1; r <= round; r++) {
      const dre = this.generateDRE(r);
      lucroAcumuladoHistorico = Ledger.roundMoney(lucroAcumuladoHistorico + dre.lucroLiquido);
    }

    const totalPL = Ledger.roundMoney(capitalSocial + lucroAcumuladoHistorico);
    const totalPassivoPL = Ledger.roundMoney(totalPassivo + totalPL);

    const diferenca = Ledger.roundMoney(totalAtivo - totalPassivoPL);

    return {
      round,
      ativo: {
        circulante: {
          caixa,
          clientes,
          estoque,
          total: ativoCirculante
        },
        naoCirculante: {
          imobilizado,
          total: imobilizado
        },
        total: totalAtivo
      },
      passivo: {
        circulante: {
          fornecedores,
          emprestimos,
          impostos,
          total: totalPassivo
        },
        total: totalPassivo
      },
      patrimonioLiquido: {
        capitalSocial,
        lucrosAcumulados: lucroAcumuladoHistorico,
        total: totalPL
      },
      totalPassivoEPatrimonioLiquido: totalPassivoPL,
      estaBalanceado: Math.abs(diferenca) <= 0.01,
      diferenca
    };
  }

  /**
   * Gera a Demonstração do Fluxo de Caixa (DFC) da rodada.
   * @param {number} round
   */
  generateCashFlow(round) {
    let entradasOperacionais = 0;
    let saidasOperacionais = 0;
    let entradasFinanciamento = 0;
    let saidasFinanciamento = 0;
    let entradasInvestimento = 0;
    let saidasInvestimento = 0;

    for (const entry of this.entries) {
      if (entry.round !== round) continue;

      // Entradas no caixa (Débitos na conta caixa)
      for (const d of entry.debits) {
        if (d.account === 'ativo.caixa') {
          // Analisa contrapartida do crédito
          for (const c of entry.credits) {
            if (c.account.startsWith('receita.') || c.account === 'ativo.clientes') {
              entradasOperacionais = Ledger.roundMoney(entradasOperacionais + d.amount);
            } else if (c.account === 'passivo.emprestimos' || c.account === 'pl.capital_social') {
              entradasFinanciamento = Ledger.roundMoney(entradasFinanciamento + d.amount);
            }
          }
        }
      }

      // Saídas do caixa (Créditos na conta caixa)
      for (const c of entry.credits) {
        if (c.account === 'ativo.caixa') {
          // Analisa contrapartida do débito
          for (const d of entry.debits) {
            if (d.account.startsWith('despesa.') || d.account === 'ativo.estoque' || d.account === 'passivo.fornecedores') {
              saidasOperacionais = Ledger.roundMoney(saidasOperacionais + c.amount);
            } else if (d.account === 'passivo.emprestimos') {
              saidasFinanciamento = Ledger.roundMoney(saidasFinanciamento + c.amount);
            } else if (d.account === 'ativo.imobilizado') {
              saidasInvestimento = Ledger.roundMoney(saidasInvestimento + c.amount);
            }
          }
        }
      }
    }

    const fluxoOperacional = Ledger.roundMoney(entradasOperacionais - saidasOperacionais);
    const fluxoFinanciamento = Ledger.roundMoney(entradasFinanciamento - saidasFinanciamento);
    const fluxoInvestimento = Ledger.roundMoney(entradasInvestimento - saidasInvestimento);
    const variacaoCaixa = Ledger.roundMoney(fluxoOperacional + fluxoFinanciamento + fluxoInvestimento);

    const saldoFinal = this.getBalance('ativo.caixa', round);
    const saldoInicial = Ledger.roundMoney(saldoFinal - variacaoCaixa);

    return {
      round,
      saldoInicial,
      fluxoOperacional: {
        entradas: entradasOperacionais,
        saidas: saidasOperacionais,
        liquido: fluxoOperacional
      },
      fluxoFinanciamento: {
        entradas: entradasFinanciamento,
        saidas: saidasFinanciamento,
        liquido: fluxoFinanciamento
      },
      fluxoInvestimento: {
        entradas: entradasInvestimento,
        saidas: saidasInvestimento,
        liquido: fluxoInvestimento
      },
      variacaoLiquidaCaixa: variacaoCaixa,
      saldoFinal
    };
  }
}
