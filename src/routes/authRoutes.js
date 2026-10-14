/**
 * Rotas de Autenticação e Perfis
 * Aurora Business Lab - Porto Aurora 2031
 */

import { Router } from 'express';
import { AuthService } from '../services/authService.js';

export function createAuthRoutes() {
  const router = Router();
  const authService = new AuthService();

  // Endpoint de Registro
  router.post('/register', async (req, res) => {
    try {
      const { email, senha, nome, perfil } = req.body;
      const user = await authService.register({ email, senha, nome, perfil });
      req.session.user = user;
      res.status(201).json({ sucesso: true, user });
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Endpoint de Login
  router.post('/login', async (req, res) => {
    try {
      const { email, senha } = req.body;
      const user = await authService.login({ email, senha });
      req.session.user = user;
      res.json({ sucesso: true, user });
    } catch (err) {
      res.status(401).json({ sucesso: false, erro: err.message });
    }
  });

  // Endpoint de Logout
  router.post('/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ sucesso: true, mensagem: 'Sessão encerrada com sucesso.' });
    });
  });

  // Usuário Atual
  router.get('/me', (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ autenticado: false });
    }
    res.json({ autenticado: true, user: req.session.user });
  });

  // Recuperação de Senha Simulada
  router.post('/forgot-password', (req, res) => {
    try {
      const { email } = req.body;
      const resultado = authService.requestPasswordReset(email);
      res.json(resultado);
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  // Redefinição de Senha
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, novaSenha } = req.body;
      const resultado = await authService.resetPassword(token, novaSenha);
      res.json(resultado);
    } catch (err) {
      res.status(400).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
