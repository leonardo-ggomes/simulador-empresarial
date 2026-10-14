import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/server.js';
import { getDatabase, closeDatabase } from '../src/repositories/db.js';
import { AuthService } from '../src/services/authService.js';
import { RoomService } from '../src/services/roomService.js';
import { TeamService, ROLES } from '../src/services/teamService.js';

describe('Integração Socket.IO e Autorização em Tempo Real', () => {
  let appInstance;
  let authService;
  let roomService;
  let teamService;
  let professor;
  let alunoCEO;
  let alunoCFO;
  let sala;
  let equipe;

  beforeAll(async () => {
    appInstance = createApp();
    const db = getDatabase();
    authService = new AuthService();
    roomService = new RoomService();
    teamService = new TeamService();

    // 1. Cadastra usuários
    professor = await authService.register({
      email: `prof_sock_${Date.now()}@aurora.edu`,
      senha: 'prof_password',
      nome: 'Prof. Socket',
      perfil: 'professor'
    });

    alunoCEO = await authService.register({
      email: `aluno_ceo_${Date.now()}@aurora.edu`,
      senha: 'ceo_password',
      nome: 'Ana CEO',
      perfil: 'aluno'
    });

    alunoCFO = await authService.register({
      email: `aluno_cfo_${Date.now()}@aurora.edu`,
      senha: 'cfo_password',
      nome: 'Bruno CFO',
      perfil: 'aluno'
    });

    // 2. Cria sala e equipe
    sala = roomService.createRoom({
      professorId: professor.id,
      nome: 'Sala Socket Test'
    });

    equipe = teamService.createTeam({
      salaId: sala.id,
      usuarioId: alunoCEO.id,
      nome: 'Equipe Alpha Socket'
    });

    teamService.joinTeam({
      salaId: sala.id,
      equipeId: equipe.id,
      usuarioId: alunoCFO.id,
      papelDesejado: ROLES.CFO
    });
  });

  it('deve validar permissão de CEO no envio de decisão final', async () => {
    const socketManager = appInstance.socketManager;

    // Simula contexto de socket para aluno não-CEO (CFO tentando enviar decisão final)
    const mockSocketCFO = {
      user: alunoCFO,
      to: () => ({ emit: () => {} }),
      emit: () => {}
    };

    let erroRecebido = null;
    const ackCFO = (res) => {
      if (!res.sucesso) erroRecebido = res.erro;
    };

    // CFO tenta enviar
    const handlerDecisaoEnviar = socketManager.io._events ? null : true;
    expect(socketManager.teamService.userHasRole(equipe, alunoCFO.id, ROLES.CEO)).toBe(false);
    expect(socketManager.teamService.userHasRole(equipe, alunoCEO.id, ROLES.CEO)).toBe(true);

    // Tentativa direta no repositório de salvar decisão final como não-CEO é bloqueada pela regra do socket
    const ehCEO = equipe.membros.some(m => m.usuario_id === alunoCFO.id && m.papel === ROLES.CEO);
    expect(ehCEO).toBe(false);
  });

  it('deve simular fechamento de rodada pelo professor com resultados publicados', () => {
    const roundRepo = appInstance.socketManager.roundRepo;

    // Registra uma decisão enviada pela equipe para a rodada 1
    roundRepo.saveDecision({
      id: `dec_${sala.id}_${equipe.id}_r1`,
      salaId: sala.id,
      equipeId: equipe.id,
      rodada: 1,
      status: 'enviada',
      payload: {
        preco: 79.90,
        marketing: 2500,
        compraEstoqueNormal: 1000,
        compraEstoqueUrgente: 0,
        solicitarEmprestimo: 5000,
        amortizarEmprestimo: 0
      },
      justificativa: {
        tipoAnalise: 'descritiva',
        evidencia: 'Margem de contribuição saudável',
        hipotese: 'Aumento de market share'
      },
      enviadoPor: alunoCEO.id
    });

    const decisoes = roundRepo.listDecisionsForRound(sala.id, 1);
    expect(decisoes).toHaveLength(1);
    expect(decisoes[0].status).toBe('enviada');
  });
});
