/**
 * Rotas de Equipes e Onboarding em 6 Etapas
 * Aurora Business Lab - Porto Aurora 2031
 */

import { Router } from 'express';
import { TeamService } from '../services/teamService.js';
import { requireAuth } from '../auth/middleware.js';

export function createTeamRoutes() {
  const router = Router();
  const teamService = new TeamService();

  // Sugerir Marca com Faker pt_BR (Nome, Slogan e Avatar)
  router.get('/sugerir', requireAuth, (req, res) => {
    try {
      const sugestao = teamService.suggestCompanyBrand();
      res.json({ sucesso: true, sugestao });
    } catch (err) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Criar Equipe (Etapas 1 e 2)
  router.post('/criar', requireAuth, (req, res) => {
    try {
      const { salaId, nome, setor } = req.body;
      const equipe = teamService.createTeam({
        salaId,
        usuarioId: req.session.user.id,
        nome,
        setor
      });
      res.status(201).json({ sucesso: true, equipe });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Entrar em Equipe Existente
  router.post('/entrar', requireAuth, (req, res) => {
    try {
      const { salaId, equipeId, papelDesejado } = req.body;
      const equipe = teamService.joinTeam({
        salaId,
        equipeId,
        usuarioId: req.session.user.id,
        papelDesejado
      });
      res.json({ sucesso: true, equipe });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Atualizar Identidade (Etapa 4)
  router.put('/:id/perfil', requireAuth, (req, res) => {
    try {
      const { nome, slogan, avatarUrl, setor } = req.body;
      const equipe = teamService.updateProfile({
        equipeId: req.params.id,
        usuarioId: req.session.user.id,
        nome,
        slogan,
        avatarUrl,
        setor
      });
      res.json({ sucesso: true, equipe });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Atribuir / Reatribuir Papéis (Etapa 3)
  router.post('/:id/papeis', requireAuth, (req, res) => {
    try {
      const { alvoUsuarioId, papéis } = req.body;
      const equipe = teamService.assignRoles({
        equipeId: req.params.id,
        solicitanteUsuarioId: req.session.user.id,
        alvoUsuarioId,
        papéis
      });
      res.json({ sucesso: true, equipe });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Obter Certidão de Abertura (Etapa 5)
  router.get('/:id/certidao', requireAuth, (req, res) => {
    try {
      const certidao = teamService.generateCertificate(req.params.id);
      res.json({ sucesso: true, certidao });
    } catch (err) {
      res.status(404).json({ sucesso: false, erro: err.message });
    }
  });

  // Confirmar Abertura e Bloquear CNPJ e Nome (Etapa 6)
  router.post('/:id/confirmar', requireAuth, (req, res) => {
    try {
      const equipe = teamService.confirmOpening({
        equipeId: req.params.id,
        usuarioId: req.session.user.id
      });
      res.json({ sucesso: true, equipe, mensagem: 'Empresa homologada com sucesso. Dados bloqueados.' });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
