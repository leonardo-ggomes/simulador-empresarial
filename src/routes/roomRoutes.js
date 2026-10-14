/**
 * Rotas de Salas de Simulação
 * Aurora Business Lab - Porto Aurora 2031
 */

import { Router } from 'express';
import { RoomService } from '../services/roomService.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export function createRoomRoutes() {
  const router = Router();
  const roomService = new RoomService();

  // Listar salas do professor logado
  router.get('/', requireAuth, requireRole(['professor', 'admin']), (req, res) => {
    try {
      const salas = roomService.listRoomsByProfessor(req.session.user.id);
      res.json({ sucesso: true, salas });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Criar sala (Apenas Professor ou Admin)
  router.post('/criar', requireAuth, requireRole(['professor', 'admin']), (req, res) => {
    try {
      const { nome, dificuldade, maxRodadas } = req.body;
      const sala = roomService.createRoom({
        professorId: req.session.user.id,
        nome,
        dificuldade,
        maxRodadas
      });
      res.status(201).json({ sucesso: true, sala });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Entrar em sala por código (Qualquer usuário autenticado)
  router.post('/entrar', requireAuth, (req, res) => {
    try {
      const { codigo } = req.body;
      const sala = roomService.getRoomByCode(codigo);
      res.json({ sucesso: true, sala });
    } catch (err) {
      res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  // Obter detalhes da sala
  router.get('/:id', requireAuth, (req, res) => {
    try {
      const sala = roomService.getRoomById(req.params.id);
      res.json({ sucesso: true, sala });
    } catch (err) {
      res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  // Alternar permissão do Laboratório Analítico interno
  router.post('/:id/toggle-laboratorio', requireAuth, requireRole(['professor', 'admin']), (req, res) => {
    try {
      const { habilitado } = req.body;
      const sala = roomService.toggleAnalyticsLab(req.params.id, req.session.user.id, habilitado);
      res.json({ sucesso: true, sala, habilitado: sala.configuracoes?.habilitarLaboratorioAnalitico });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
