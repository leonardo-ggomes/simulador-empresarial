import { describe, it, expect } from 'vitest';
import { InventoryManager } from '../src/engine/inventory.js';

describe('Motor de Estoque e Suprimentos', () => {
  it('deve atender demanda total quando há estoque suficiente', () => {
    const res = InventoryManager.processRoundInventory({
      estoqueInicial: 500,
      custoUnitarioMedioInicial: 40,
      pedidosRecebidos: 500,
      custoUnitarioPedidosRecebidos: 40,
      comprasUrgentes: 0,
      demandaRecebida: 800,
      custoArmazenagemUnitario: 2.0,
      taxaObsolescencia: 0.05
    });

    expect(res.estoqueTotalDisponivel).toBe(1000);
    expect(res.unidadesVendidas).toBe(800);
    expect(res.vendasPerdidas).toBe(0);
    expect(res.cmv).toBe(32000); // 800 * 40
    expect(res.taxaAtendimento).toBe(1.0);
    // Sobram 200 un. Perda 5% = 10 un. Estoque final = 190 un.
    expect(res.unidadesPerdidas).toBe(10);
    expect(res.estoqueFinalUnidades).toBe(190);
    expect(res.custoArmazenagemTotal).toBe(380); // 190 * 2.0
  });

  it('deve registrar ruptura (stockout) e vendas perdidas quando estoque é insuficiente', () => {
    const res = InventoryManager.processRoundInventory({
      estoqueInicial: 200,
      custoUnitarioMedioInicial: 35,
      pedidosRecebidos: 300,
      custoUnitarioPedidosRecebidos: 35,
      comprasUrgentes: 0,
      demandaRecebida: 750 // Demanda maior que 500 disponíveis
    });

    expect(res.estoqueTotalDisponivel).toBe(500);
    expect(res.unidadesVendidas).toBe(500);
    expect(res.vendasPerdidas).toBe(250);
    expect(res.taxaAtendimento).toBeCloseTo(500 / 750, 2);
    expect(res.estoqueFinalUnidades).toBe(0);
    expect(res.custoArmazenagemTotal).toBe(0);
  });

  it('deve calcular corretamente o custo médio ponderado com compras emergenciais', () => {
    const res = InventoryManager.processRoundInventory({
      estoqueInicial: 100,
      custoUnitarioMedioInicial: 30, // R$ 3.000
      pedidosRecebidos: 100,
      custoUnitarioPedidosRecebidos: 30, // R$ 3.000
      comprasUrgentes: 100,
      custoUnitarioComprasUrgentes: 60, // R$ 6.000 (mais caro)
      demandaRecebida: 150
    });

    // Total 300 unidades. Custo total = 3000 + 3000 + 6000 = 12.000
    // Custo médio = 12.000 / 300 = R$ 40,00
    expect(res.custoMedioUnitario).toBe(40);
    expect(res.cmv).toBe(6000); // 150 * 40
  });
});
