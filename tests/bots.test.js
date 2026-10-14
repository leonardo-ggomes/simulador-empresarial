import { describe, it, expect, beforeEach } from 'vitest';
import { CompetitorBots, BOT_PERSONALITIES } from '../src/engine/bots.js';
import { BotService } from '../src/services/botService.js';
import { RoomService } from '../src/services/roomService.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { getDatabase } from '../src/repositories/db.js';

describe('Bots Concorrentes de IA', () => {
  const macroDataMock = {
    rodada: 5,
    selic: 11.0,
    selicTrimestral: 2.75,
    inflacao: 5.2,
    cambio: 5.35,
    fatorCambialCustoMP: 1.05,
    pibCrescimento: 3.2,
    sazonalidade: 1.0
  };

  it('deve gerar decisões válidas com o mesmo formato e API das decisões dos alunos', () => {
    const personalidades = [BOT_PERSONALITIES.AGRESSIVO, BOT_PERSONALITIES.CONSERVADOR, BOT_PERSONALITIES.ADAPTATIVO];

    for (const p of personalidades) {
      const dec = CompetitorBots.generateDecision({
        personalidade: p,
        rodada: 5,
        seed: 'seed_teste_bots',
        macroData: macroDataMock
      });

      expect(dec).toHaveProperty('preco');
      expect(dec).toHaveProperty('marketing');
      expect(dec).toHaveProperty('compraEstoqueNormal');
      expect(dec).toHaveProperty('compraEstoqueUrgente');
      expect(dec).toHaveProperty('solicitarEmprestimo');
      expect(dec).toHaveProperty('amortizarEmprestimo');
      expect(dec).toHaveProperty('justificativa');
      expect(dec.justificativa).toHaveProperty('tipoAnalise');
      expect(dec.justificativa).toHaveProperty('evidencia');
      expect(dec.justificativa).toHaveProperty('hipotese');

      expect(dec.preco).toBeGreaterThan(0);
      expect(dec.marketing).toBeGreaterThanOrEqual(0);
      expect(dec.compraEstoqueNormal).toBeGreaterThan(0);
    }
  });

  it('deve refletir a estratégia agressiva (preço baixo e marketing alto)', () => {
    const agr = CompetitorBots.generateDecision({
      personalidade: BOT_PERSONALITIES.AGRESSIVO,
      rodada: 5,
      seed: 42,
      macroData: macroDataMock
    });

    const cons = CompetitorBots.generateDecision({
      personalidade: BOT_PERSONALITIES.CONSERVADOR,
      rodada: 5,
      seed: 42,
      macroData: macroDataMock
    });

    expect(agr.preco).toBeLessThan(cons.preco);
    expect(agr.marketing).toBeGreaterThan(cons.marketing);
    expect(agr.solicitarEmprestimo).toBeGreaterThan(0);
  });

  it('deve reagir adaptativamente a rupturas de estoque anteriores', () => {
    // Histórico com ruptura (vendas perdidas de 100 unidades)
    const historicoComRuptura = {
      estoque: { vendasPerdidas: 120, demandaRecebida: 1200, unidadesVendidas: 1080, estoqueFinalUnidades: 0 },
      mercado: { preco: 80.0, marketing: 2500 }
    };

    const decReativa = CompetitorBots.generateDecision({
      personalidade: BOT_PERSONALITIES.ADAPTATIVO,
      rodada: 6,
      seed: 99,
      macroData: macroDataMock,
      historicoUltimaRodada: historicoComRuptura
    });

    // Se houve ruptura, aumenta compra e sobe preço ligeiramente
    expect(decReativa.preco).toBeGreaterThan(80.0);
    expect(decReativa.compraEstoqueNormal).toBeGreaterThan(1200);
  });

  it('deve injetar e persistir bots na sala através do BotService', () => {
    const db = getDatabase();
    const userRepo = new UserRepository(db);
    const roomService = new RoomService();
    const botService = new BotService();

    const prof = userRepo.createUser({
      id: `prof_bot_${Date.now()}`,
      email: `prof_bot_${Date.now()}@aurora.edu`,
      senhaHash: 'hash',
      nome: 'Prof. Bots',
      perfil: 'professor'
    });

    const sala = roomService.createRoom({
      professorId: prof.id,
      nome: 'Sala com Bots IA'
    });

    const botsInjetados = botService.ensureBotsInRoom(sala.id);
    expect(botsInjetados).toHaveLength(3);

    // Processa decisões da rodada 1
    const decisoesBots = botService.processBotDecisions(sala.id, 1, sala.seed);
    expect(decisoesBots).toHaveLength(3);
    expect(decisoesBots[0].status).toBe('enviada');
    expect(decisoesBots[0].enviado_por).toBe('sistema_ia');
  });
});
