/**
 * Motor de Gestão de Estoque e Suprimentos
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Controla estoque disponível, pedidos em trânsito (lead time),
 * compras emergenciais, custos de armazenagem, perdas/obsolescência e rupturas.
 */

export class InventoryManager {
  /**
   * Processa o ciclo de suprimentos e atendimento de demanda da rodada.
   * @param {object} params
   * @param {number} params.estoqueInicial - Unidades físicas no início da rodada
   * @param {number} params.custoUnitarioMedioInicial - Custo médio contábil por unidade
   * @param {number} params.pedidosRecebidos - Unidades que chegaram da rodada anterior (lead time)
   * @param {number} params.custoUnitarioPedidosRecebidos - Custo médio dos pedidos recebidos
   * @param {number} params.comprasUrgentes - Unidades compradas a pronta entrega nesta rodada
   * @param {number} params.custoUnitarioComprasUrgentes - Custo unitário com sobrepreço logístico
   * @param {number} params.demandaRecebida - Total de pedidos de compra feitos pelos clientes
   * @param {number} params.custoArmazenagemUnitario - R$ por unidade não vendida no fim do trimestre
   * @param {number} params.taxaObsolescencia - Taxa de quebra/perda (ex: 0.02 = 2%)
   */
  static processRoundInventory({
    estoqueInicial = 0,
    custoUnitarioMedioInicial = 40,
    pedidosRecebidos = 0,
    custoUnitarioPedidosRecebidos = 40,
    comprasUrgentes = 0,
    custoUnitarioComprasUrgentes = 52, // +30% sobrepreço por urgência
    demandaRecebida = 0,
    custoArmazenagemUnitario = 2.50,
    taxaObsolescencia = 0.02
  }) {
    // 1. Estoque Total Disponível antes das vendas
    const totalEntradasUnidades = pedidosRecebidos + comprasUrgentes;
    const estoqueTotalDisponivel = estoqueInicial + totalEntradasUnidades;

    // 2. Novo Custo Médio Ponderado Unitário
    const valorEstoqueInicial = estoqueInicial * custoUnitarioMedioInicial;
    const valorPedidosRecebidos = pedidosRecebidos * custoUnitarioPedidosRecebidos;
    const valorComprasUrgentes = comprasUrgentes * custoUnitarioComprasUrgentes;
    const valorTotalEntradas = valorPedidosRecebidos + valorComprasUrgentes;

    const valorTotalDisponivel = valorEstoqueInicial + valorTotalEntradas;
    const custoMedioUnitario = estoqueTotalDisponivel > 0
      ? Math.round((valorTotalDisponivel / estoqueTotalDisponivel) * 100) / 100
      : custoUnitarioMedioInicial;

    // 3. Atendimento de Demanda & Ruptura (Stockout)
    const unidadesVendidas = Math.min(estoqueTotalDisponivel, demandaRecebida);
    const vendasPerdidas = Math.max(0, demandaRecebida - estoqueTotalDisponivel);
    const taxaAtendimento = demandaRecebida > 0 ? (unidadesVendidas / demandaRecebida) : 1;

    // 4. CMV (Custo das Mercadorias Vendidas)
    const cmv = Math.round(unidadesVendidas * custoMedioUnitario * 100) / 100;

    // 5. Sobra antes de perdas
    const estoqueAntesPerdas = estoqueTotalDisponivel - unidadesVendidas;

    // 6. Perdas / Obsolescência
    const unidadesPerdidas = Math.floor(estoqueAntesPerdas * taxaObsolescencia);
    const custoPerdasEstoque = Math.round(unidadesPerdidas * custoMedioUnitario * 100) / 100;

    // 7. Estoque Final Físico e Contábil
    const estoqueFinalUnidades = Math.max(0, estoqueAntesPerdas - unidadesPerdidas);
    const estoqueFinalValor = Math.round(estoqueFinalUnidades * custoMedioUnitario * 100) / 100;

    // 8. Custo de Armazenagem sobre o estoque remanescente
    const custoArmazenagemTotal = Math.round(estoqueFinalUnidades * custoArmazenagemUnitario * 100) / 100;

    return {
      estoqueInicial,
      pedidosRecebidos,
      comprasUrgentes,
      totalEntradasUnidades,
      estoqueTotalDisponivel,
      custoMedioUnitario,
      demandaRecebida,
      unidadesVendidas,
      vendasPerdidas,
      taxaAtendimento: Number(taxaAtendimento.toFixed(4)),
      cmv,
      unidadesPerdidas,
      custoPerdasEstoque,
      estoqueFinalUnidades,
      estoqueFinalValor,
      custoArmazenagemTotal,
      valorTotalEntradas
    };
  }
}
