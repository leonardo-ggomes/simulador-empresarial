import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../src/repositories/db.js';
import { RoomRepository } from '../src/repositories/roomRepository.js';
import { TeamRepository } from '../src/repositories/teamRepository.js';
import { RoundRepository } from '../src/repositories/roundRepository.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { RankingService } from '../src/services/rankingService.js';
import path from 'node:path';
import ejs from 'ejs';

describe('RankingService e Visualização do Ranking Corporativo', () => {
  let db;
  let roomRepo;
  let teamRepo;
  let roundRepo;
  let userRepo;
  let rankingService;
  let sala;
  let equipeA;
  let equipeB;

  beforeEach(() => {
    db = getDatabase();
    roomRepo = new RoomRepository(db);
    teamRepo = new TeamRepository(db);
    roundRepo = new RoundRepository(db);
    userRepo = new UserRepository(db);
    rankingService = new RankingService({ db, roomRepo, teamRepo, roundRepo });

    const prof = userRepo.createUser({
      id: `prof_rank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      email: `prof_rank_${Date.now()}@aurora.edu`,
      senhaHash: 'hash',
      nome: 'Prof. Carlos Ranking',
      perfil: 'professor'
    });

    const uniqueSuffix = `${Date.now().toString(36).substr(-3)}${Math.floor(100 + Math.random() * 899)}`.toUpperCase();
    sala = roomRepo.createRoom({
      id: `sala_rank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      codigo: `R${uniqueSuffix}`,
      professorId: prof.id,
      nome: 'Sala Executiva 2031',
      seed: 'seed_rank_test',
      maxRodadas: 12,
      configuracoes: {
        pesosRanking: { financeiro: 0.50, mercado: 0.20, analitico: 0.30 }
      }
    });

    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    equipeA = teamRepo.createTeam({
      id: `eq_a_${Date.now()}_${randSuffix}`,
      salaId: sala.id,
      nome: 'Alpha Corp',
      cnpj: `12.${randSuffix}.678/0001-90`,
      capitalSocial: 80000.0
    });

    equipeB = teamRepo.createTeam({
      id: `eq_b_${Date.now()}_${randSuffix}`,
      salaId: sala.id,
      nome: 'Beta Logistics',
      cnpj: `98.${randSuffix}.432/0001-10`,
      capitalSocial: 80000.0
    });
  });

  it('deve calcular ranking baseline quando nenhuma rodada foi simulada ainda', () => {
    const ranking = rankingService.calculateRanking(sala.id);

    expect(ranking.sala.id).toBe(sala.id);
    expect(ranking.rodadaApurada).toBe(0);
    expect(ranking.empresas.length).toBe(2);
    expect(ranking.top3.length).toBe(2);
    expect(ranking.empresas[0].metricas.caixaAtual).toBe(80000);
    expect(ranking.empresas[0].metricas.ratingCredito).toBe('A');
    expect(ranking.empresas[0].scores.geral).toBe(71.5);
    expect(ranking.empresas[0].posicao).toBe(1);
    expect(ranking.empresas[0].variacao).toBe(0);
  });

  it('deve classificar empresas corretamente com base nos resultados simulados e calcular delta de posições', () => {
    // Simula Resultados Rodada 1: Equipe B teve desempenho financeiro superior
    roundRepo.saveResult({
      id: `res_${sala.id}_a_1`,
      salaId: sala.id,
      equipeId: equipeA.id,
      rodada: 1,
      dre: { receitaBruta: 60000, receitaLiquida: 52800, lucroBruto: 24000, lucroOperacional: 10000, lucroLiquido: 8000 },
      balanco: { ativo: { circulante: { caixa: 88000 } }, patrimonioLiquido: { total: 88000 } },
      dfc: { fluxoOperacional: 8000 },
      mercado: { marketShare: 45.0, unidadesVendidas: 750, vendasPerdidas: 50 },
      estoque: { estoqueFinalUnidades: 200 },
      credit: { score: 780, rating: 'AA', limite: 45000 }
    });

    roundRepo.saveResult({
      id: `res_${sala.id}_b_1`,
      salaId: sala.id,
      equipeId: equipeB.id,
      rodada: 1,
      dre: { receitaBruta: 90000, receitaLiquida: 79200, lucroBruto: 40000, lucroOperacional: 22000, lucroLiquido: 18000 },
      balanco: { ativo: { circulante: { caixa: 98000 } }, patrimonioLiquido: { total: 98000 } },
      dfc: { fluxoOperacional: 18000 },
      mercado: { marketShare: 55.0, unidadesVendidas: 1100, vendasPerdidas: 0 },
      estoque: { estoqueFinalUnidades: 400 },
      credit: { score: 850, rating: 'AAA', limite: 60000 }
    });

    // Avança a rodada no roomRepo
    roomRepo.updateStatus(sala.id, 'em_andamento', 2);

    const rankingR1 = rankingService.calculateRanking(sala.id, 1);
    expect(rankingR1.rodadaApurada).toBe(1);
    expect(rankingR1.empresas.length).toBe(2);

    // Equipe B deve estar em 1º lugar com score superior
    expect(rankingR1.empresas[0].equipe.id).toBe(equipeB.id);
    expect(rankingR1.empresas[0].posicao).toBe(1);
    expect(rankingR1.empresas[0].metricas.lucroAcumulado).toBe(18000);
    expect(rankingR1.empresas[0].metricas.ratingCredito).toBe('AAA');

    // Equipe A deve estar em 2º lugar
    expect(rankingR1.empresas[1].equipe.id).toBe(equipeA.id);
    expect(rankingR1.empresas[1].posicao).toBe(2);
    expect(rankingR1.empresas[1].metricas.lucroAcumulado).toBe(8000);

    // Simula Resultados Rodada 2: Equipe A tem grande virada
    roundRepo.saveResult({
      id: `res_${sala.id}_a_2`,
      salaId: sala.id,
      equipeId: equipeA.id,
      rodada: 2,
      dre: { receitaBruta: 150000, receitaLiquida: 132000, lucroBruto: 70000, lucroOperacional: 45000, lucroLiquido: 38000 },
      balanco: { ativo: { circulante: { caixa: 126000 } }, patrimonioLiquido: { total: 126000 } },
      dfc: { fluxoOperacional: 38000 },
      mercado: { marketShare: 70.0, unidadesVendidas: 1800, vendasPerdidas: 0 },
      estoque: { estoqueFinalUnidades: 300 },
      credit: { score: 920, rating: 'AAA', limite: 80000 }
    });

    roundRepo.saveResult({
      id: `res_${sala.id}_b_2`,
      salaId: sala.id,
      equipeId: equipeB.id,
      rodada: 2,
      dre: { receitaBruta: 40000, receitaLiquida: 35200, lucroBruto: 10000, lucroOperacional: -2000, lucroLiquido: -3000 },
      balanco: { ativo: { circulante: { caixa: 95000 } }, patrimonioLiquido: { total: 95000 } },
      dfc: { fluxoOperacional: -3000 },
      mercado: { marketShare: 30.0, unidadesVendidas: 500, vendasPerdidas: 200 },
      estoque: { estoqueFinalUnidades: 50 },
      credit: { score: 710, rating: 'A', limite: 40000 }
    });

    roomRepo.updateStatus(sala.id, 'em_andamento', 3);

    const rankingR2 = rankingService.calculateRanking(sala.id, 2);
    expect(rankingR2.rodadaApurada).toBe(2);

    // Equipe A deve assumir a 1ª posição com variação positiva (+1)
    expect(rankingR2.empresas[0].equipe.id).toBe(equipeA.id);
    expect(rankingR2.empresas[0].posicao).toBe(1);
    expect(rankingR2.empresas[0].variacao).toBeGreaterThanOrEqual(1);

    // Equipe B caiu para a 2ª posição com variação negativa (-1)
    expect(rankingR2.empresas[1].equipe.id).toBe(equipeB.id);
    expect(rankingR2.empresas[1].posicao).toBe(2);
    expect(rankingR2.empresas[1].variacao).toBeLessThanOrEqual(-1);
  });

  it('deve compilar e renderizar a view game/ranking com pódio top 3, tabela slim e scripts de raio-x', async () => {
    const templatePath = path.resolve(process.cwd(), 'views/game/ranking.ejs');

    const mockRankingData = {
      sala: { id: 'room-1', nome: 'Sala Alpha', codigo: 'ALPH1', rodadaAtual: 2, maxRodadas: 12, status: 'em_andamento' },
      rodadaApurada: 1,
      isCumulative: true,
      completedRounds: [1],
      pesos: { financeiro: 0.50, mercado: 0.20, analitico: 0.30 },
      empresas: [
        {
          posicao: 1,
          variacao: 1,
          equipe: { id: 'eq-1', nome: 'Vanguard Corp', setor: 'Varejo', cnpj: '11.222.333/0001-44', slogan: 'Liderança', membros: [] },
          scores: { financeiro: 95.0, mercado: 88.0, analitico: 90.0, geral: 92.1 },
          metricas: { lucroAcumulado: 25000, caixaAtual: 105000, marketShareMedio: 35.5, ratingCredito: 'AAA', statusSolvencia: 'Saudável' }
        },
        {
          posicao: 2,
          variacao: -1,
          equipe: { id: 'eq-2', nome: 'Nexus Tech', setor: 'Tecnologia', cnpj: '55.666.777/0001-88', slogan: 'Futuro', membros: [] },
          scores: { financeiro: 80.0, mercado: 75.0, analitico: 82.0, geral: 79.6 },
          metricas: { lucroAcumulado: 12000, caixaAtual: 92000, marketShareMedio: 28.0, ratingCredito: 'AA', statusSolvencia: 'Saudável' }
        }
      ],
      top3: [
        {
          posicao: 1,
          variacao: 1,
          equipe: { id: 'eq-1', nome: 'Vanguard Corp', setor: 'Varejo', cnpj: '11.222.333/0001-44', slogan: 'Liderança', membros: [] },
          scores: { financeiro: 95.0, mercado: 88.0, analitico: 90.0, geral: 92.1 },
          metricas: { lucroAcumulado: 25000, caixaAtual: 105000, marketShareMedio: 35.5, ratingCredito: 'AAA', statusSolvencia: 'Saudável' }
        }
      ],
      estatisticas: {
        totalEmpresas: 2,
        lucroMedio: 18500,
        marketShareLider: 35.5,
        empresaLider: 'Vanguard Corp'
      }
    };

    const rendered = await ejs.renderFile(templatePath, {
      currentRoom: mockRankingData.sala,
      currentTeam: { id: 'eq-1', nome: 'Vanguard Corp' },
      rankingData: mockRankingData
    });

    // Valida elementos do design minimalista e slim
    expect(rendered).toContain('Classificação das Empresas');
    expect(rendered).toContain('Padrão visual: Minimalista, slim, limpo e editorial');
    expect(rendered).toContain('Vanguard Corp');
    expect(rendered).toContain('1º Lugar');
    expect(rendered).toContain('Score Global');
    expect(rendered).toContain('92.1');
    expect(rendered).toContain('Sua Empresa');
    expect(rendered).toContain('ranking-table');
    expect(rendered).toContain('abrirRaioXEquipe');
    expect(rendered).toContain('filtrarTabelaRanking');
  });
});
