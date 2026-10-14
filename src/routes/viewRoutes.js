/**
 * Rotas de Visualização (Renderização Server-Side com EJS e Layout Master)
 * Aurora Business Lab - Porto Aurora 2031
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { RoomService } from '../services/roomService.js';
import { TeamService } from '../services/teamService.js';
import { RoundRepository } from '../repositories/roundRepository.js';
import { MacroEconomy } from '../engine/macro.js';
import { DataExportService } from '../services/dataExportService.js';
import { RankingService } from '../services/rankingService.js';
import { WarehouseService } from '../services/warehouseService.js';

export function createViewRoutes() {
  const router = Router();
  const roomService = new RoomService();
  const teamService = new TeamService();
  const roundRepo = new RoundRepository();
  const rankingService = new RankingService();
  const warehouseService = new WarehouseService({ roundRepo });

  // Raiz: Redireciona baseado no estado de login
  router.get('/', (req, res) => {
    if (req.session && req.session.user) {
      return res.redirect('/lobby');
    }
    res.redirect('/auth/login');
  });

  // Tela de Login / Cadastro
  router.get('/auth/login', (req, res) => {
    if (req.session && req.session.user) {
      return res.redirect('/lobby');
    }
    res.renderApp('auth/login', {
      title: 'Acesso à Plataforma'
    });
  });

  // Tela do Lobby
  router.get('/lobby', requireAuth, (req, res) => {
    const user = req.session.user;
    let salas = [];
    if (user.perfil === 'professor' || user.perfil === 'admin') {
      salas = roomService.listRoomsByProfessor(user.id);
    }

    res.renderApp('rooms/lobby', {
      title: 'Lobby de Simulação',
      salas
    });
  });

  // Tela de Onboarding (6 Etapas)
  router.get('/sala/:id/onboarding', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    const existingTeams = teamService.teamRepo.findBySala(salaId);
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);

    res.renderApp('rooms/onboarding', {
      title: 'Onboarding Empresarial',
      currentRoom: sala,
      currentTeam,
      existingTeams
    });
  });

  // Tela de Briefing da Rodada
  router.get('/sala/:id/briefing', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);

    const macro = new MacroEconomy(sala.seed);
    const macroData = macro.getRoundData(sala.rodada_atual);
    const todasNoticias = roundRepo.getRoomNews(salaId);
    const noticiasRodada = todasNoticias.filter(n => n.rodada_publicacao === sala.rodada_atual);

    res.renderApp('game/briefing', {
      title: `Briefing - Rodada ${sala.rodada_atual}`,
      currentRoom: sala,
      currentTeam,
      macroData,
      noticias: noticiasRodada
    });
  });

  // Tela Dedicada do Jornal "Gazeta Aurora" (Estilo Digital Financeiro / Investing)
  router.get('/sala/:id/gazeta', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    if (!sala) return res.redirect('/lobby');
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);

    const macro = new MacroEconomy(sala.seed);
    const macroData = macro.getRoundData(sala.rodada_atual);
    const todasNoticias = roundRepo.getRoomNews(salaId);
    const noticiasRodada = todasNoticias.filter(n => n.rodada_publicacao === sala.rodada_atual);
    const noticiasPassadas = todasNoticias.filter(n => n.rodada_publicacao < sala.rodada_atual);

    res.renderApp('game/gazeta', {
      title: `Gazeta Aurora • Rodada ${sala.rodada_atual}`,
      currentRoom: sala,
      currentTeam,
      macroData,
      todasNoticias,
      noticiasRodada,
      noticiasPassadas
    });
  });

  // Tela de Painel de Decisões
  router.get('/sala/:id/decisoes', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);

    if (!currentTeam) {
      return res.redirect(`/sala/${salaId}/onboarding`);
    }

    const decisionRecord = roundRepo.getDecision(salaId, currentTeam.id, sala.rodada_atual) || {
      status: 'rascunho',
      payload: {},
      justificativa: {}
    };

    res.renderApp('game/decisions', {
      title: `Decisões - Rodada ${sala.rodada_atual}`,
      currentRoom: sala,
      currentTeam,
      decisionStatus: decisionRecord.status,
      currentDecision: decisionRecord
    });
  });

  // Tela do Laboratório de Análise (4 Abas)
  router.get('/sala/:id/analise', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);

    if (!currentTeam) {
      return res.redirect(`/sala/${salaId}/onboarding`);
    }

    const historicoResultados = roundRepo.getTeamResults(currentTeam.id);
    const habilitado = Boolean(sala.configuracoes?.habilitarLaboratorioAnalitico);

    res.renderApp('game/analytics', {
      title: 'Laboratório de Análise de Dados',
      currentRoom: sala,
      currentTeam,
      historicoResultados,
      bloqueadoPeloProfessor: !habilitado
    });
  });

  // Tela da Central de Integração com Power BI (XLS, CSV, TXT, SQL, API)
  router.get('/sala/:id/powerbi', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);

    if (!currentTeam) {
      return res.redirect(`/sala/${salaId}/onboarding`);
    }

    const exportService = new DataExportService();
    const previewDataset = exportService.getConsolidatedDataset(salaId, currentTeam.id);
    const vendasPreview = exportService.getVendasDataset(salaId, currentTeam.id);
    const estoquePreview = exportService.getEstoqueDataset(salaId, currentTeam.id);
    const contabPreview = exportService.getContabilidadeDataset(salaId, currentTeam.id);
    const empresasPreview = exportService.getEmpresasDataset(salaId);
    const macroPreview = exportService.getMacroDataset(salaId);
    const hostUrl = `${req.protocol}://${req.get('host')}`;

    res.renderApp('game/data_export', {
      title: 'Central de Modelagem Power BI • Star Schema',
      currentRoom: sala,
      currentTeam,
      previewDataset,
      vendasPreview,
      estoquePreview,
      contabPreview,
      empresasPreview,
      macroPreview,
      hostUrl
    });
  });

  // Tela de Demonstrativos Contábeis (Resultados da Rodada Anterior)
  router.get('/sala/:id/resultados', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);

    if (!currentTeam) {
      return res.redirect(`/sala/${salaId}/onboarding`);
    }

    const targetRound = Math.max(1, sala.rodada_atual - 1);
    const resultado = roundRepo.getResult(salaId, currentTeam.id, targetRound);

    res.renderApp('game/results', {
      title: 'Demonstrativos Financeiros',
      currentRoom: sala,
      currentTeam,
      resultado
    });
  });

  // Tela de Ranking Executivo das Empresas (Top 3, Tabela Slim e Raio-X)
  router.get('/sala/:id/ranking', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    if (!sala) return res.redirect('/lobby');

    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);
    const targetRound = req.query.rodada || null;
    const rankingData = rankingService.calculateRanking(salaId, targetRound);

    res.renderApp('game/ranking', {
      title: `Ranking das Empresas • ${rankingData.isCumulative ? 'Geral Acumulado' : 'Rodada ' + rankingData.rodadaApurada}`,
      currentRoom: sala,
      currentTeam,
      rankingData
    });
  });

  // Tela do Gêmeo Digital do Galpão (Visualização 3D CAD / Wireframe)
  router.get('/sala/:id/galpao', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    if (!sala) return res.redirect('/lobby');

    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);
    if (!currentTeam) {
      return res.redirect(`/sala/${salaId}/onboarding`);
    }

    const warehouse = warehouseService.getWarehouse(salaId, currentTeam.id, req.query.rodada || null);

    res.renderApp('game/warehouse', {
      title: 'Gêmeo Digital do Galpão',
      currentRoom: sala,
      currentTeam,
      warehouse
    });
  });

  // API JSON do galpão
  router.get('/api/sala/:id/galpao', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const currentTeam = teamService.teamRepo.findUserTeamInRoom(salaId, req.session.user.id);
    if (!currentTeam) {
      return res.status(403).json({ sucesso: false, erro: 'Usuário não pertence a uma equipe desta sala.' });
    }
    const warehouse = warehouseService.getWarehouse(salaId, currentTeam.id, req.query.rodada || null);
    res.json({ sucesso: true, galpao: warehouse });
  });

  // API JSON para consulta e atualização assíncrona do ranking
  router.get('/api/sala/:id/ranking', requireAuth, (req, res) => {
    const salaId = req.params.id;
    const targetRound = req.query.rodada || null;
    try {
      const rankingData = rankingService.calculateRanking(salaId, targetRound);
      res.json({ sucesso: true, ranking: rankingData });
    } catch (err) {
      res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  // Tela do Painel do Professor
  router.get('/sala/:id/professor', requireAuth, requireRole(['professor', 'admin']), (req, res) => {
    const salaId = req.params.id;
    const sala = roomService.getRoomById(salaId);
    const equipes = teamService.teamRepo.findBySala(salaId);
    const decisoes = roundRepo.listDecisionsForRound(salaId, sala.rodada_atual);

    res.renderApp('teacher/dashboard', {
      title: 'Painel do Facilitador',
      currentRoom: sala,
      equipes,
      decisoes
    });
  });

  return router;
}
