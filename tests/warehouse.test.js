import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import ejs from 'ejs';
import { getDatabase } from '../src/repositories/db.js';
import { RoomRepository } from '../src/repositories/roomRepository.js';
import { TeamRepository } from '../src/repositories/teamRepository.js';
import { RoundRepository } from '../src/repositories/roundRepository.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { WarehouseService, WAREHOUSE_DEFAULTS } from '../src/services/warehouseService.js';

describe('WarehouseService — Gêmeo Digital do Galpão', () => {
  let roundRepo;
  let service;
  let sala;
  let equipe;

  const saveRound = (rodada, estoque) => roundRepo.saveResult({
    id: `res_${sala.id}_${equipe.id}_r${rodada}`,
    salaId: sala.id,
    equipeId: equipe.id,
    rodada,
    dre: { lucroLiquido: 0 },
    balanco: { ativo: { circulante: { caixa: 80000 } }, patrimonioLiquido: { total: 80000 } },
    dfc: {},
    mercado: { marketShare: 25 },
    estoque,
    credit: { score: 750, rating: 'A' }
  });

  beforeEach(() => {
    const db = getDatabase();
    const roomRepo = new RoomRepository(db);
    const teamRepo = new TeamRepository(db);
    const userRepo = new UserRepository(db);
    roundRepo = new RoundRepository(db);
    service = new WarehouseService({ roundRepo });

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const prof = userRepo.createUser({
      id: `prof_wh_${suffix}`, email: `prof_wh_${suffix}@aurora.edu`, senhaHash: 'hash', nome: 'Prof. Galpão', perfil: 'professor'
    });
    sala = roomRepo.createRoom({
      id: `sala_wh_${suffix}`, codigo: `WH${Math.floor(1000 + Math.random() * 9000)}`,
      professorId: prof.id, nome: 'Sala Galpão', seed: 'seed_wh'
    });
    equipe = teamRepo.createTeam({
      id: `eq_wh_${suffix}`, salaId: sala.id, nome: 'Logística Delta',
      cnpj: `77.${Math.floor(100 + Math.random() * 900)}.${Math.floor(100 + Math.random() * 900)}/0001-${Math.floor(10 + Math.random() * 89)}`
    });
  });

  it('deve retornar galpão vazio com capacidade padrão quando não há rodadas', () => {
    const wh = service.getWarehouse(sala.id, equipe.id);
    const capacidade = WAREHOUSE_DEFAULTS.corredores.length * WAREHOUSE_DEFAULTS.modulosPorCorredor * WAREHOUSE_DEFAULTS.niveis;

    expect(wh.rodadas).toEqual([]);
    expect(wh.rodadaSelecionada).toBe(0);
    expect(wh.config.capacidadePosicoes).toBe(capacidade);
    expect(wh.snapshots[0].slots).toHaveLength(capacidade);
    expect(wh.snapshots[0].slots.every(s => s.status === 'vazio')).toBe(true);
    expect(wh.snapshots[0].metricas.ocupacao).toBe(0);
  });

  it('deve alocar paletes FIFO, marcar perdas, doca em trânsito e calcular métricas', () => {
    saveRound(1, {
      estoqueInicial: 0, pedidosRecebidos: 0, comprasUrgentes: 600, estoqueTotalDisponivel: 600,
      unidadesVendidas: 300, vendasPerdidas: 0, taxaAtendimento: 1, unidadesPerdidas: 6,
      estoqueFinalUnidades: 294, estoqueFinalValor: 12348, custoMedioUnitario: 42,
      custoArmazenagemTotal: 735, custoPerdasEstoque: 252
    });
    roundRepo.saveDecision({
      id: `dec_${sala.id}_r1`, salaId: sala.id, equipeId: equipe.id, rodada: 1, status: 'enviada',
      payload: { compraEstoqueNormal: 1000 }
    });

    const wh = service.getWarehouse(sala.id, equipe.id);
    const snap = wh.snapshots[0];
    const upp = WAREHOUSE_DEFAULTS.unidadesPorPalete;

    expect(wh.rodadaSelecionada).toBe(1);
    expect(snap.metricas.posicoesOcupadas).toBe(Math.ceil(294 / upp));
    expect(snap.slots[0].codigo).toBe('A-01-N1');
    expect(snap.slots[0].status).toBe('ocupado');
    expect(snap.slots[0].rodadaEntrada).toBe(1);
    expect(snap.slots.reduce((a, s) => a + (s.status === 'ocupado' ? s.unidades : 0), 0)).toBe(294);
    expect(snap.metricas.posicoesPerdas).toBe(1);
    expect(snap.metricas.emTransito).toBe(1000);
    expect(snap.doca).toHaveLength(Math.min(Math.ceil(1000 / upp), WAREHOUSE_DEFAULTS.posicoesDoca));
    expect(snap.metricas.giro).toBeCloseTo(300 / 147, 2);
    expect(snap.metricas.ocupacaoProjetada).toBeGreaterThan(snap.metricas.ocupacao);
  });

  it('deve sinalizar alerta crítico quando o estoque excede a capacidade física', () => {
    const capUn = service.capacidadeUnidades;
    saveRound(1, {
      estoqueInicial: 0, pedidosRecebidos: capUn + 500, comprasUrgentes: 0,
      unidadesVendidas: 0, vendasPerdidas: 0, taxaAtendimento: 1, unidadesPerdidas: 0,
      estoqueFinalUnidades: capUn + 500, estoqueFinalValor: 0, custoMedioUnitario: 40
    });

    const snap = service.getWarehouse(sala.id, equipe.id).snapshots[0];
    expect(snap.metricas.excedenteUnidades).toBe(500);
    expect(snap.metricas.posicoesLivres).toBe(0);
    expect(snap.alerta.nivel).toBe('critico');
  });

  it('deve compilar a view game/warehouse com viewport CAD, HUD e dados embutidos', async () => {
    const wh = service.getWarehouse(sala.id, equipe.id);
    const rendered = await ejs.renderFile(path.resolve(process.cwd(), 'views/game/warehouse.ejs'), {
      currentRoom: { id: sala.id, nome: 'Sala Galpão', rodada_atual: 1, max_rodadas: 12 },
      currentTeam: { id: equipe.id, nome: 'Logística Delta' },
      warehouse: wh
    });

    expect(rendered).toContain('Gêmeo Digital do Galpão');
    expect(rendered).toContain('id="warehouse-viewport"');
    expect(rendered).toContain('id="warehouse-hud"');
    expect(rendered).toContain('id="warehouse-data"');
    expect(rendered).toContain('wh-mode-heat');
    expect(rendered).toContain('id="wh-btn-fullscreen"');
    expect(rendered).toContain('/js/warehouse3d.js');
    expect(rendered).toContain('importmap');
  });
});
