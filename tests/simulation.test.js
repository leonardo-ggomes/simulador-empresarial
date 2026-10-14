import { describe, it, expect } from 'vitest';
import { RoundSimulationEngine } from '../src/engine/simulation.js';
import { NEWS_TEMPLATES } from '../src/engine/news.js';

describe('Orquestrador de Simulação de Rodada (RoundSimulationEngine)', () => {
  it('deve simular a rodada 1 e manter estritamente a invariante contábil (Ativo = Passivo + PL)', () => {
    const empresasIniciais = [
      {
        id: 'empresa_alfa',
        nome: 'Alfa Logística & Comércio',
        estoqueUnidades: 1200,
        custoUnitarioMedio: 32.0,
        reputacao: 1.0,
        pedidosEmTransito: 0
      },
      {
        id: 'empresa_beta',
        nome: 'Beta Inovações Aurora',
        estoqueUnidades: 1500,
        custoUnitarioMedio: 32.0,
        reputacao: 1.0,
        pedidosEmTransito: 0
      }
    ];

    const decisoes = [
      {
        empresaId: 'empresa_alfa',
        preco: 78.0,
        marketing: 3500.0,
        compraEstoqueNormal: 800,
        compraEstoqueUrgente: 0,
        solicitarEmprestimo: 10000,
        amortizarEmprestimo: 0,
        investimentoConsultoria: 500
      },
      {
        empresaId: 'empresa_beta',
        preco: 85.0,
        marketing: 1500.0,
        compraEstoqueNormal: 1000,
        compraEstoqueUrgente: 100,
        solicitarEmprestimo: 0,
        amortizarEmprestimo: 0,
        investimentoConsultoria: 0
      }
    ];

    const noticiasMock = [
      {
        ...NEWS_TEMPLATES[0],
        rodada_publicacao: 1,
        rodada_efeito_inicio: 1,
        impacto_real: 0.15,
        confiabilidade: 0.95
      }
    ];

    const resultado = RoundSimulationEngine.runRound({
      rodada: 1,
      salaSeed: 'seed_porto_aurora_rodada_1',
      noticias: noticiasMock,
      empresas: empresasIniciais,
      decisoes
    });

    expect(resultado.rodada).toBe(1);
    expect(resultado.macro).toBeDefined();
    expect(resultado.demandaMercado.demandaTotalMercado).toBeGreaterThan(0);
    expect(resultado.resultadosEmpresas).toHaveLength(2);

    for (const resEmp of resultado.resultadosEmpresas) {
      // Invariante contábil de partida dobrada absoluta:
      expect(resEmp.balanco.estaBalanceado).toBe(true);
      expect(resEmp.balanco.diferenca).toBeCloseTo(0, 2);
      expect(resEmp.dre.receitaBruta).toBeGreaterThan(0);
      expect(resEmp.scoreCredito.score).toBeGreaterThan(0);
      expect(resEmp.novoEstado.rodadaAtual).toBe(2);
    }

    // A empresa Alfa praticou preço menor e investiu mais em marketing, logo deve ter maior atratividade
    const alfaRes = resultado.resultadosEmpresas.find(e => e.empresaId === 'empresa_alfa');
    const betaRes = resultado.resultadosEmpresas.find(e => e.empresaId === 'empresa_beta');

    expect(alfaRes.mercado.demandaRecebida).toBeGreaterThan(betaRes.mercado.demandaRecebida);
  });

  it('deve ser 100% determinístico e reproduzir resultados idênticos para a mesma seed', () => {
    const empresasIniciais = [
      {
        id: 'empresa_gama',
        nome: 'Gama Varejo 2031',
        estoqueUnidades: 1000,
        custoUnitarioMedio: 32.0
      }
    ];

    const decisoes = [
      {
        empresaId: 'empresa_gama',
        preco: 80.0,
        marketing: 2000.0,
        compraEstoqueNormal: 500
      }
    ];

    const exec1 = RoundSimulationEngine.runRound({
      rodada: 2,
      salaSeed: 'seed_reprodutivel_999',
      noticias: [],
      empresas: empresasIniciais,
      decisoes
    });

    const exec2 = RoundSimulationEngine.runRound({
      rodada: 2,
      salaSeed: 'seed_reprodutivel_999',
      noticias: [],
      empresas: empresasIniciais,
      decisoes
    });

    expect(exec1.demandaMercado).toEqual(exec2.demandaMercado);
    expect(exec1.resultadosEmpresas[0].dre).toEqual(exec2.resultadosEmpresas[0].dre);
    expect(exec1.resultadosEmpresas[0].balanco).toEqual(exec2.resultadosEmpresas[0].balanco);
  });
});
