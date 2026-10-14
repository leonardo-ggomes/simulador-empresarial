/**
 * Serviço do Gêmeo Digital do Galpão (Warehouse Digital Twin)
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Converte os resultados de estoque de cada rodada em um layout físico de porta-paletes
 * (corredores × módulos × níveis), com alocação FIFO determinística e métricas de ocupação.
 *
 * IMPORTANTE: a capacidade física é puramente visual/analítica. Não interfere no motor
 * econômico (InventoryManager) — serve para alertar e ensinar o impacto do estoque parado.
 */

import { RoundRepository } from '../repositories/roundRepository.js';

export const WAREHOUSE_DEFAULTS = Object.freeze({
  corredores: ['A', 'B', 'C', 'D'],
  modulosPorCorredor: 10,
  niveis: 3,
  unidadesPorPalete: 25,
  posicoesDoca: 24,
  limiteAlertaOcupacao: 0.85,
  dimensoes: { comprimento: 48.0, largura: 24.0, altura: 9.0 } // metros
});

export class WarehouseService {
  constructor({ roundRepo = null, config = {} } = {}) {
    this.roundRepo = roundRepo || new RoundRepository();
    this.config = { ...WAREHOUSE_DEFAULTS, ...config };
  }

  get capacidadePosicoes() {
    const c = this.config;
    return c.corredores.length * c.modulosPorCorredor * c.niveis;
  }

  get capacidadeUnidades() {
    return this.capacidadePosicoes * this.config.unidadesPorPalete;
  }

  /**
   * Gera a sequência ordenada de posições do galpão (ordem de alocação FIFO:
   * corredor → módulo → nível, preenchendo de baixo para cima).
   */
  _buildSlotSequence() {
    const { corredores, modulosPorCorredor, niveis } = this.config;
    const slots = [];
    corredores.forEach((corredor, ci) => {
      for (let m = 1; m <= modulosPorCorredor; m++) {
        for (let n = 1; n <= niveis; n++) {
          slots.push({
            codigo: `${corredor}-${String(m).padStart(2, '0')}-N${n}`,
            corredor,
            corredorIndex: ci,
            modulo: m,
            nivel: n,
            status: 'vazio',
            unidades: 0,
            rodadaEntrada: null
          });
        }
      }
    });
    return slots;
  }

  /**
   * Decompõe o estoque final em "lotes" por rodada de entrada (FIFO: os lotes mais
   * antigos são consumidos primeiro, então o saldo remanescente é dos mais recentes).
   */
  _computeLots(historico, idx) {
    let restante = historico[idx].estoque?.estoqueFinalUnidades || 0;
    const lotes = [];
    for (let i = idx; i >= 0 && restante > 0; i--) {
      const est = historico[i].estoque || {};
      const entradas = (est.pedidosRecebidos || 0) + (est.comprasUrgentes || 0);
      const qtd = Math.min(restante, entradas);
      if (qtd > 0) {
        lotes.push({ rodada: historico[i].rodada, unidades: qtd });
        restante -= qtd;
      }
    }
    if (restante > 0) {
      // Estoque herdado sem entrada rastreável (estoque inicial da abertura)
      lotes.push({ rodada: 0, unidades: restante });
    }
    // Ordem cronológica: lote mais antigo ocupa as primeiras posições
    return lotes.reverse();
  }

  /**
   * Monta o snapshot físico e as métricas de uma rodada.
   */
  _buildSnapshot(historico, idx, salaId, equipeId) {
    const { unidadesPorPalete, posicoesDoca, limiteAlertaOcupacao } = this.config;
    const res = historico[idx];
    const est = res.estoque || {};
    const slots = this._buildSlotSequence();
    const capacidadeUnidades = this.capacidadeUnidades;

    // 1. Aloca lotes FIFO em paletes
    const lotes = this._computeLots(historico, idx);
    let cursor = 0;
    for (const lote of lotes) {
      let unidadesLote = lote.unidades;
      while (unidadesLote > 0 && cursor < slots.length) {
        const qtd = Math.min(unidadesPorPalete, unidadesLote);
        slots[cursor].status = 'ocupado';
        slots[cursor].unidades = qtd;
        slots[cursor].rodadaEntrada = lote.rodada;
        unidadesLote -= qtd;
        cursor++;
      }
    }
    const posicoesOcupadas = cursor;
    const estoqueFinal = est.estoqueFinalUnidades || 0;
    const excedenteUnidades = Math.max(0, estoqueFinal - capacidadeUnidades);

    // 2. Perdas/obsolescência: marcadas logo após as posições ocupadas (baixa da rodada)
    const unidadesPerdidas = est.unidadesPerdidas || 0;
    const paletesPerdidos = Math.ceil(unidadesPerdidas / unidadesPorPalete);
    let posicoesPerdas = 0;
    for (let i = 0; i < paletesPerdidos && cursor < slots.length; i++, cursor++) {
      slots[cursor].status = 'perda';
      slots[cursor].unidades = Math.min(unidadesPorPalete, unidadesPerdidas - i * unidadesPorPalete);
      slots[cursor].rodadaEntrada = res.rodada;
      posicoesPerdas++;
    }

    // 3. Em trânsito: pedido normal desta rodada chega na próxima (lead time)
    let emTransito = 0;
    try {
      const dec = this.roundRepo.getDecision(salaId, equipeId, res.rodada);
      emTransito = Math.max(0, Number(dec?.payload?.compraEstoqueNormal) || 0);
    } catch (_) {
      emTransito = 0;
    }
    const paletesTransito = Math.ceil(emTransito / unidadesPorPalete);
    const doca = [];
    for (let i = 0; i < Math.min(paletesTransito, posicoesDoca); i++) {
      doca.push({
        codigo: `DOCA-${String(i + 1).padStart(2, '0')}`,
        unidades: Math.min(unidadesPorPalete, emTransito - i * unidadesPorPalete)
      });
    }

    // 4. Métricas
    const estoqueInicial = est.estoqueInicial || 0;
    const vendidas = est.unidadesVendidas || 0;
    const estoqueMedio = (estoqueInicial + estoqueFinal) / 2;
    const giro = estoqueMedio > 0 ? vendidas / estoqueMedio : 0;
    const vendaDiaria = vendidas / 90; // trimestre
    const coberturaDias = vendaDiaria > 0 ? estoqueFinal / vendaDiaria : (estoqueFinal > 0 ? 999 : 0);
    const ocupacao = this.capacidadePosicoes > 0 ? posicoesOcupadas / this.capacidadePosicoes : 0;
    const ocupacaoProjetada = capacidadeUnidades > 0
      ? (estoqueFinal + emTransito) / capacidadeUnidades
      : 0;

    let alerta = null;
    if (excedenteUnidades > 0) {
      alerta = { nivel: 'critico', mensagem: `Estoque excede a capacidade em ${excedenteUnidades.toLocaleString('pt-BR')} un.` };
    } else if (ocupacaoProjetada >= 1) {
      alerta = { nivel: 'critico', mensagem: `Com o pedido em trânsito, o galpão excederá a capacidade (${(ocupacaoProjetada * 100).toFixed(0)}%).` };
    } else if (ocupacaoProjetada >= limiteAlertaOcupacao) {
      alerta = { nivel: 'atencao', mensagem: `Ocupação projetada de ${(ocupacaoProjetada * 100).toFixed(0)}% na próxima rodada.` };
    } else if (est.vendasPerdidas > 0) {
      alerta = { nivel: 'atencao', mensagem: `Ruptura: ${est.vendasPerdidas.toLocaleString('pt-BR')} un. de demanda não atendida.` };
    }

    return {
      rodada: res.rodada,
      slots,
      doca,
      metricas: {
        capacidadePosicoes: this.capacidadePosicoes,
        capacidadeUnidades,
        posicoesOcupadas,
        posicoesPerdas,
        posicoesLivres: Math.max(0, this.capacidadePosicoes - posicoesOcupadas - posicoesPerdas),
        ocupacao: Number((ocupacao * 100).toFixed(1)),
        ocupacaoProjetada: Number((ocupacaoProjetada * 100).toFixed(1)),
        estoqueUnidades: estoqueFinal,
        excedenteUnidades,
        valorContabil: est.estoqueFinalValor || 0,
        custoMedioUnitario: est.custoMedioUnitario || 0,
        emTransito,
        paletesTransito,
        custoArmazenagem: est.custoArmazenagemTotal || 0,
        unidadesPerdidas,
        custoPerdas: est.custoPerdasEstoque || 0,
        unidadesVendidas: vendidas,
        vendasPerdidas: est.vendasPerdidas || 0,
        taxaAtendimento: Number(((est.taxaAtendimento ?? 1) * 100).toFixed(1)),
        giro: Number(giro.toFixed(2)),
        coberturaDias: Math.round(coberturaDias)
      },
      alerta
    };
  }

  /**
   * Retorna o layout completo do galpão de uma equipe (todas as rodadas apuradas).
   * @param {string} salaId
   * @param {string} equipeId
   * @param {number|null} rodadaSelecionada
   */
  getWarehouse(salaId, equipeId, rodadaSelecionada = null) {
    const historico = this.roundRepo.getTeamResults(equipeId);
    const rodadas = historico.map(r => r.rodada);

    const base = {
      config: {
        corredores: this.config.corredores,
        modulosPorCorredor: this.config.modulosPorCorredor,
        niveis: this.config.niveis,
        unidadesPorPalete: this.config.unidadesPorPalete,
        posicoesDoca: this.config.posicoesDoca,
        dimensoes: this.config.dimensoes,
        capacidadePosicoes: this.capacidadePosicoes,
        capacidadeUnidades: this.capacidadeUnidades
      },
      rodadas
    };

    if (historico.length === 0) {
      const slots = this._buildSlotSequence();
      return {
        ...base,
        rodadaSelecionada: 0,
        snapshots: [{
          rodada: 0,
          slots,
          doca: [],
          metricas: {
            capacidadePosicoes: this.capacidadePosicoes,
            capacidadeUnidades: this.capacidadeUnidades,
            posicoesOcupadas: 0, posicoesPerdas: 0, posicoesLivres: this.capacidadePosicoes,
            ocupacao: 0, ocupacaoProjetada: 0, estoqueUnidades: 0, excedenteUnidades: 0,
            valorContabil: 0, custoMedioUnitario: 0, emTransito: 0, paletesTransito: 0,
            custoArmazenagem: 0, unidadesPerdidas: 0, custoPerdas: 0, unidadesVendidas: 0,
            vendasPerdidas: 0, taxaAtendimento: 100, giro: 0, coberturaDias: 0
          },
          alerta: null
        }]
      };
    }

    const snapshots = historico.map((_, i) => this._buildSnapshot(historico, i, salaId, equipeId));
    const parsed = parseInt(rodadaSelecionada, 10);
    const selecionada = rodadas.includes(parsed) ? parsed : rodadas[rodadas.length - 1];

    return { ...base, rodadaSelecionada: selecionada, snapshots };
  }
}
