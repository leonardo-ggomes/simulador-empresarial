/**
 * Servidor Principal - Aurora Business Lab
 * Porto Aurora 2031
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';

import { SQLiteSessionStore } from './auth/sessionStore.js';
import { csrfProtection } from './auth/middleware.js';
import { SocketManager } from './sockets/socketManager.js';
import { setupViewRenderer } from './utils/viewRenderer.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createRoomRoutes } from './routes/roomRoutes.js';
import { createTeamRoutes } from './routes/teamRoutes.js';
import { createExportRoutes } from './routes/exportRoutes.js';
import { createViewRoutes } from './routes/viewRoutes.js';
import { getDatabase } from './repositories/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  // Garante inicialização do banco SQLite
  getDatabase();

  // Segurança básica e compressão
  app.use(helmet({
    contentSecurityPolicy: false // Permite CDNs de scripts/estilos como Chart.js e OpenUI5
  }));
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser('aurora_secret_cookie_key_2031'));

  // Rate Limiter
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
  });
  app.use('/api/', limiter);

  // Sessões no SQLite
  const sessionMiddleware = session({
    store: new SQLiteSessionStore(),
    secret: process.env.SESSION_SECRET || 'aurora_hub_business_lab_secret_seed_2031',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Pode ser ativado em produção com HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    }
  });

  app.use(sessionMiddleware);
  app.use(csrfProtection);

  // Configuração de Visualização (EJS) e Arquivos Estáticos
  app.set('view engine', 'ejs');
  app.set('views', path.resolve(__dirname, '../views'));
  app.use(express.static(path.resolve(__dirname, '../public')));
  setupViewRenderer(app);

  // Socket.IO com Handshake de Sessão e Autorização em cada evento
  const socketManager = new SocketManager(io, sessionMiddleware);

  // Rotas da API
  app.use('/api/auth', createAuthRoutes());
  app.use('/api/salas', createRoomRoutes());
  app.use('/api/equipes', createTeamRoutes());
  app.use('/api/export', createExportRoutes());

  // Rotas de Visualização (Telas do Jogo)
  app.use('/', createViewRoutes());

  // Rota de Healthcheck / Status
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      produto: 'Aurora Business Lab',
      ano: 2031,
      cidade: 'Porto Aurora',
      tempo: new Date().toISOString()
    });
  });

  return { app, server, io, socketManager };
}

// Inicialização automática se executado diretamente via linha de comando
const isDirectRun = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isDirectRun && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const PORT = process.env.PORT || 3000;
  const { server } = createApp();
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🌌 AURORA BUSINESS LAB - SERVIDOR ONLINE NA PORTA ${PORT}`);
    console.log(`📍 Porto Aurora 2031 | Incubadora Aurora Hub`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}
