/**
 * Orquestrador da Simulação da Rodada (Engine Principal)
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Simulação pura, sem dependência de I/O de banco ou rede, 100% determinística e testável.
 */

import { Ledger } from './ledger.js';
import { MacroEconomy } from './macro.js';
import { AuroraCreditBank } from './credit.js';
import { InventoryManager } from './inventory.js';
import { DemandEngine } from './demand.js';
import { NewsEngine } from './news.js';

export class RoundSimulationEngine {
  /**
   * Executa a simulação completa de uma rodada para um conjunto de empresas na sala.
   *
   * @param {object} params
   * @param {number} params.rodada - Número da rodada (1 a 12)
   * @param {string|number} params.salaSeed - Seed da sala
   * @param {Array<object>} params.noticias - Lista de notícias cadastradas no cenário
   * @param {Array<object>} params.empresas - Estado das empresas antes do início da rodada
   * @param {Array<object>} params.decisoes - Decisões enviadas pelas equipes para esta rodada
   * @returns {object} Resultado consolidado da rodada com demonstrativos e novo estado
   */
  static runRound({
    rodada,
    salaSeed,
    noticias = [],
    empresas = [],
    decisoes = []
  }) {
    const round = rodada;

    // 1. Configurações Macroeconômicas
    const macroEngine = new MacroEconomy(salaSeed);
    const macroData = macroEngine.getRoundData(rodada);

    // 2. Sistema de Notícias da Rodada
    const newsEngine = new NewsEngine(noticias);
    const newsEffects = newsEngine.calculateActiveEffects(rodada);
    const newsRevelations = newsEngine.revealImpactsForRound(rodada);

    // 3. Custos de Insumos ajustados pelo Câmbio e Notícias
    const custoMPBase = 32.0; // R$ por unidade
    const custoMPUnitario = Number((custoMPBase * macroData.fatorCambialCustoMP * newsEffects.multiplicadorCusto).toFixed(2));
    const custoMPEmergencial = Number((custoMPUnitario * 1.30).toFixed(2)); // +30% por entrega imediata

    // Custo de Mão de Obra e Galpão fixo por trimestre
    const custoFixoAluguel = 8000.0;
    const custoFixoFolhaBase = Number((macroData.salarioMedio * 4).toFixed(2)); // equipe operacional de 4 funcionários

    // 4. Preparação das decisões das equipes
    const decisoesMap = new Map();
    for (const d of decisoes) {
      decisoesMap.set(d.empresaId, d);
    }

    const payloadDemandaEmpresas = empresas.map(emp => {
      const dec = decisoesMap.get(emp.id) || { preco: 80.0, marketing: 2000.0 };
      return {
        id: emp.id,
        preco: Number(dec.preco) || 80.0,
        marketing: Number(dec.marketing) || 0.0,
        reputacao: emp.reputacao || 1.0
      };
    });

    // 5. Cálculo de Demanda de Mercado
    const demandEngine = new DemandEngine();
    const demandaMercado = demandEngine.calculateMarketDemand({
      rodada,
      seed: salaSeed,
      sazonalidade: macroData.sazonalidade,
      pibCrescimento: macroData.pibCrescimento,
      multiplicadorNoticiaDemanda: newsEffects.multiplicadorDemanda,
      multiplicadorNoticiaElasticidade: newsEffects.multiplicadorElasticidade,
      empresasDecisoes: payloadDemandaEmpresas
    });

    const demandaPorEmpresa = new Map();
    for (const res of demandaMercado.resultados) {
      demandaPorEmpresa.set(res.id, res);
    }

    // 6. Simulação individual por Empresa
    const resultadosEmpresas = [];

    for (const emp of empresas) {
      const dec = decisoesMap.get(emp.id) || {
        preco: 80.0,
        marketing: 2000.0,
        compraEstoqueNormal: 1000,
        compraEstoqueUrgente: 0,
        solicitarEmprestimo: 0,
        amortizarEmprestimo: 0,
        investimentoConsultoria: 0
      };

      const demandaInfo = demandaPorEmpresa.get(emp.id) || { demandaFinal: 800, marketShare: 0 };
      const demandaRecebida = demandaInfo.demandaFinal;

      // Restaura o livro-razão existente da empresa ou inicializa novo
      const ledger = new Ledger();
      if (emp.ledgerEntries && emp.ledgerEntries.length > 0) {
        ledger.entries = [...emp.ledgerEntries];
      } else {
        // Integralização de capital semente na rodada de abertura (R$ 80.000 de capital social)
        ledger.addEntry({
          round: 0,
          description: 'Aporte de Capital Social Semente (Aurora Hub)',
          debits: [{ account: 'ativo.caixa', amount: 80000.0 }],
          credits: [{ account: 'pl.capital_social', amount: 80000.0 }]
        });
      }

      // Ciclo de Estoque:
      // O pedido feito na rodada anterior chega agora com lead-time
      const pedidosRecebidosLeadTime = emp.pedidosEmTransito || 0;
      const custoUnitarioPedidosRecebidos = emp.custoUnitarioEmTransito || custoMPBase;

      const comprasUrgentes = Math.max(0, Number(dec.compraEstoqueUrgente) || 0);

      const estoqueResultado = InventoryManager.processRoundInventory({
        estoqueInicial: emp.estoqueUnidades || 0,
        custoUnitarioMedioInicial: emp.custoUnitarioMedio || custoMPBase,
        pedidosRecebidos: pedidosRecebidosLeadTime,
        custoUnitarioPedidosRecebidos,
        comprasUrgentes,
        custoUnitarioComprasUrgentes: custoMPEmergencial,
        demandaRecebida,
        custoArmazenagemUnitario: 2.50,
        taxaObsolescencia: 0.02
      });

      // Lançamentos Contábeis de Entrada de Estoque (compras urgentes pagas à vista via caixa)
      if (comprasUrgentes > 0) {
        const valorComprasUrgentes = Ledger.roundMoney(comprasUrgentes * custoMPEmergencial);
        ledger.addEntry({
          round,
          description: `Compra emergencial de ${comprasUrgentes} un. a pronta entrega`,
          debits: [{ account: 'ativo.estoque', amount: valorComprasUrgentes }],
          credits: [{ account: 'ativo.caixa', amount: valorComprasUrgentes }]
        });
      }

      // Pedido de compra normal para a próxima rodada (lead time)
      const compraNormalPlanejada = Math.max(0, Number(dec.compraEstoqueNormal) || 0);
      const valorCompraNormal = Ledger.roundMoney(compraNormalPlanejada * custoMPUnitario);
      if (compraNormalPlanejada > 0) {
        // Pago a fornecedores nesta rodada, estoque é reconhecido
        ledger.addEntry({
          round,
          description: `Aquisição de matéria-prima (${compraNormalPlanejada} un.) para fornecimento`,
          debits: [{ account: 'ativo.estoque', amount: valorCompraNormal }],
          credits: [{ account: 'ativo.caixa', amount: valorCompraNormal }]
        });
      }

      // Receita de Vendas
      const receitaBruta = Ledger.roundMoney(estoqueResultado.unidadesVendidas * dec.preco);
      if (receitaBruta > 0) {
        ledger.addEntry({
          round,
          description: `Venda de ${estoqueResultado.unidadesVendidas} unidades a R$ ${dec.preco.toFixed(2)}`,
          debits: [{ account: 'ativo.caixa', amount: receitaBruta }],
          credits: [{ account: 'receita.vendas', amount: receitaBruta }]
        });

        // CMV
        ledger.addEntry({
          round,
          description: `Custo das Mercadorias Vendidas (CMV) - ${estoqueResultado.unidadesVendidas} un.`,
          debits: [{ account: 'despesa.cmv', amount: estoqueResultado.cmv }],
          credits: [{ account: 'ativo.estoque', amount: estoqueResultado.cmv }]
        });

        // Impostos sobre faturamento
        const impostosVendas = Ledger.roundMoney(receitaBruta * macroData.aliquotaImposto);
        if (impostosVendas > 0) {
          ledger.addEntry({
            round,
            description: `Tributos incidentes sobre faturamento (${(macroData.aliquotaImposto * 100).toFixed(0)}%)`,
            debits: [{ account: 'despesa.impostos', amount: impostosVendas }],
            credits: [{ account: 'ativo.caixa', amount: impostosVendas }]
          });
        }
      }

      // Despesa de Marketing
      const gastoMarketing = Math.max(0, Number(dec.marketing) || 0);
      if (gastoMarketing > 0) {
        ledger.addEntry({
          round,
          description: `Campanhas publicitárias e marketing regional`,
          debits: [{ account: 'despesa.marketing', amount: gastoMarketing }],
          credits: [{ account: 'ativo.caixa', amount: gastoMarketing }]
        });
      }

      // Despesas Fixas (Salários e Aluguel)
      ledger.addEntry({
        round,
        description: `Folha de pagamento e encargos da equipe (Porto Aurora)`,
        debits: [{ account: 'despesa.salarios', amount: custoFixoFolhaBase }],
        credits: [{ account: 'ativo.caixa', amount: custoFixoFolhaBase }]
      });

      ledger.addEntry({
        round,
        description: `Aluguel do galpão logístico e sede administrativa`,
        debits: [{ account: 'despesa.aluguel', amount: custoFixoAluguel }],
        credits: [{ account: 'ativo.caixa', amount: custoFixoAluguel }]
      });

      // Custos de Armazenagem e Perdas
      if (estoqueResultado.custoArmazenagemTotal > 0) {
        ledger.addEntry({
          round,
          description: `Custo de armazenagem (${estoqueResultado.estoqueFinalUnidades} un. em estoque)`,
          debits: [{ account: 'despesa.armazenagem', amount: estoqueResultado.custoArmazenagemTotal }],
          credits: [{ account: 'ativo.caixa', amount: estoqueResultado.custoArmazenagemTotal }]
        });
      }

      if (estoqueResultado.custoPerdasEstoque > 0) {
        ledger.addEntry({
          round,
          description: `Quebra e obsolescência de estoque (${estoqueResultado.unidadesPerdidas} un.)`,
          debits: [{ account: 'despesa.perdas_estoque', amount: estoqueResultado.custoPerdasEstoque }],
          credits: [{ account: 'ativo.estoque', amount: estoqueResultado.custoPerdasEstoque }]
        });
      }

      // Consultoria Analítica (Dado)
      const custoConsultoria = Math.max(0, Number(dec.investimentoConsultoria) || 0);
      if (custoConsultoria > 0) {
        ledger.addEntry({
          round,
          description: `Contratação de créditos analíticos do Consultor Dado`,
          debits: [{ account: 'despesa.consultoria', amount: custoConsultoria }],
          credits: [{ account: 'ativo.caixa', amount: custoConsultoria }]
        });
      }

      // Crédito do Banco Aurora: Empréstimos e Juros
      const balancoPrevio = ledger.generateBalanceSheet(round);
      const drePrevia = ledger.generateDRE(round);
      const scoreData = AuroraCreditBank.calculateScore({
        ativoTotal: balancoPrevio.ativo.total,
        ativoCirculante: balancoPrevio.ativo.circulante.total,
        passivoCirculante: balancoPrevio.passivo.circulante.total,
        passivoTotal: balancoPrevio.passivo.total,
        patrimonioLiquido: balancoPrevio.patrimonioLiquido.total,
        lucroLiquidoUltimaRodada: drePrevia.lucroLiquido,
        historicoPontualidade: emp.historicoPontualidade !== undefined ? emp.historicoPontualidade : 1.0
      });

      const condicoesCredito = AuroraCreditBank.getCreditTerms({
        score: scoreData.score,
        patrimonioLiquido: balancoPrevio.patrimonioLiquido.total,
        receitaMedia: Math.max(30000, receitaBruta),
        selicTrimestral: macroData.selicTrimestral * newsEffects.multiplicadorJuros
      });

      const saldoDevedorAtual = ledger.getBalance('passivo.emprestimos', round);
      let novoEmprestimoSolicitado = Math.max(0, Number(dec.solicitarEmprestimo) || 0);
      const limiteRemanescente = Math.max(0, condicoesCredito.limiteDisponivel - saldoDevedorAtual);
      const novoEmprestimoEfetivo = Math.min(novoEmprestimoSolicitado, limiteRemanescente);

      const amortizacaoSolicitada = Math.max(0, Number(dec.amortizarEmprestimo) || 0);

      const cicloCredito = AuroraCreditBank.processLoanCycle({
        saldoDevedorAtual,
        novoEmprestimo: novoEmprestimoEfetivo,
        amortizacaoPrincipal: amortizacaoSolicitada,
        taxaJurosDecimal: condicoesCredito.taxaJurosDecimal
      });

      if (cicloCredito.novoEmprestimo > 0) {
        ledger.addEntry({
          round,
          description: `Liberação de empréstimo de capital de giro - Banco Aurora`,
          debits: [{ account: 'ativo.caixa', amount: cicloCredito.novoEmprestimo }],
          credits: [{ account: 'passivo.emprestimos', amount: cicloCredito.novoEmprestimo }]
        });
      }

      if (cicloCredito.jurosDoTrimestre > 0) {
        ledger.addEntry({
          round,
          description: `Juros financeiros s/ dívida bancária (${condicoesCredito.taxaJurosTrimestral}% no trimestre)`,
          debits: [{ account: 'despesa.juros', amount: cicloCredito.jurosDoTrimestre }],
          credits: [{ account: 'ativo.caixa', amount: cicloCredito.jurosDoTrimestre }]
        });
      }

      if (cicloCredito.amortizacaoEfetiva > 0) {
        ledger.addEntry({
          round,
          description: `Amortização de saldo devedor principal - Banco Aurora`,
          debits: [{ account: 'passivo.emprestimos', amount: cicloCredito.amortizacaoEfetiva }],
          credits: [{ account: 'ativo.caixa', amount: cicloCredito.amortizacaoEfetiva }]
        });
      }

      // Rendimento financeiro de aplicação de caixa ocioso (se caixa positivo)
      const caixaAntesRendimentos = ledger.getBalance('ativo.caixa', round);
      if (caixaAntesRendimentos > 5000) {
        const rendimento = Ledger.roundMoney(caixaAntesRendimentos * (macroData.selicTrimestral / 100) * 0.70); // 70% da Selic trimestral
        if (rendimento > 0) {
          ledger.addEntry({
            round,
            description: `Rendimento de aplicações financeiras de curto prazo (Caixa)`,
            debits: [{ account: 'ativo.caixa', amount: rendimento }],
            credits: [{ account: 'receita.financeira', amount: rendimento }]
          });
        }
      }

      // Geração dos Relatórios Finais Fechados
      const dreFinal = ledger.generateDRE(round);
      const balancoFinal = ledger.generateBalanceSheet(round);
      const dfcFinal = ledger.generateCashFlow(round);

      if (!balancoFinal.estaBalanceado) {
        throw new Error(`Invariante contábil violada para empresa ${emp.id} na rodada ${round}! Dif: ${balancoFinal.diferenca}`);
      }

      // Verificação de Risco de Insolvência
      const estaFalida = balancoFinal.ativo.circulante.caixa < -25000 && balancoFinal.patrimonioLiquido.total < 0;

      resultadosEmpresas.push({
        empresaId: emp.id,
        nome: emp.nome,
        rodada,
        dre: dreFinal,
        balanco: balancoFinal,
        dfc: dfcFinal,
        scoreCredito: scoreData,
        condicoesCredito,
        estoque: estoqueResultado,
        mercado: {
          preco: dec.preco,
          marketing: dec.marketing,
          demandaRecebida,
          unidadesVendidas: estoqueResultado.unidadesVendidas,
          vendasPerdidas: estoqueResultado.vendasPerdidas,
          marketShare: demandaInfo.marketShare,
          fatorPreco: demandaInfo.fatorPreco,
          fatorMarketing: demandaInfo.fatorMarketing
        },
        novoEstado: {
          id: emp.id,
          nome: emp.nome,
          rodadaAtual: rodada + 1,
          estoqueUnidades: estoqueResultado.estoqueFinalUnidades,
          custoUnitarioMedio: estoqueResultado.custoMedioUnitario,
          pedidosEmTransito: compraNormalPlanejada,
          custoUnitarioEmTransito: custoMPUnitario,
          caixa: balancoFinal.ativo.circulante.caixa,
          patrimonioLiquido: balancoFinal.patrimonioLiquido.total,
          lucroAcumulado: balancoFinal.patrimonioLiquido.lucrosAcumulados,
          saldoDevedor: balancoFinal.passivo.circulante.emprestimos,
          estaFalida,
          ledgerEntries: ledger.entries
        }
      });
    }

    return {
      rodada,
      macro: macroData,
      noticiasEfeitos: newsEffects,
      noticiasReveladas: newsRevelations,
      demandaMercado,
      resultadosEmpresas
    };
  }
}
