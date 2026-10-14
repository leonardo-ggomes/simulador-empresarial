/**
 * Gerenciador de Tempo Real - Socket.IO com Compartilhamento de Sessão e Autorização Estrita
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Invariante: O servidor é a fonte única da verdade. Autorização em TODO evento.
 */

import { RoomService } from '../services/roomService.js';
import { TeamService, ROLES } from '../services/teamService.js';
import { RoundRepository } from '../repositories/roundRepository.js';
import { RoundSimulationEngine } from '../engine/simulation.js';
import { BotService } from '../services/botService.js';
import { NewsGeneratorService } from '../services/newsGeneratorService.js';

export class SocketManager {
  /**
   * @param {import('socket.io').Server} io
   * @param {Function} sessionMiddleware
   */
  constructor(io, sessionMiddleware) {
    this.io = io;
    this.sessionMiddleware = sessionMiddleware;
    this.roomService = new RoomService();
    this.teamService = new TeamService();
    this.roundRepo = new RoundRepository();
    this.botService = new BotService(this.teamService.teamRepo, this.roundRepo);
    this.newsGenerator = new NewsGeneratorService();
    this.processedActions = new Set(); // Garantia de idempotência

    this._setupHandshake();
    this._setupEvents();
  }

  /**
   * Compartilha a sessão do Express no Handshake do Socket.IO.
   */
  _setupHandshake() {
    this.io.use((socket, next) => {
      // Executa o middleware de sessão do Express sobre a requisição de handshake
      const req = socket.request;
      const res = {};
      this.sessionMiddleware(req, res, (err) => {
        if (err) return next(err);
        if (!req.session || !req.session.user) {
          return next(new Error('Não autorizado: Sessão de usuário não encontrada.'));
        }
        socket.user = req.session.user;
        next();
      });
    });
  }

  /**
   * Registra os eventos do simulador com autorização em cada chamada.
   */
  _setupEvents() {
    this.io.on('connection', (socket) => {
      const user = socket.user;

      // Evento: sala:entrar
      socket.on('sala:entrar', async (data, ack) => {
        try {
          const { codigo } = data || {};
          const sala = this.roomService.getRoomByCode(codigo);
          const roomChannel = `sala_${sala.id}`;

          socket.join(roomChannel);
          socket.salaId = sala.id;

          // Se for aluno, verifica se ele já tem equipe nesta sala
          let userTeam = null;
          if (user.perfil === 'aluno') {
            userTeam = this.teamService.teamRepo.findUserTeamInRoom(sala.id, user.id);
            if (userTeam) {
              socket.join(`equipe_${userTeam.id}`);
            }
          }

          const response = {
            sucesso: true,
            sala: {
              id: sala.id,
              codigo: sala.codigo,
              nome: sala.nome,
              rodadaAtual: sala.rodada_atual,
              status: sala.status,
              maxRodadas: sala.max_rodadas
            },
            equipe: userTeam
          };

          if (ack) ack(response);
          socket.emit('sala:entrou', response);
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
          socket.emit('erro', { mensagem: err.message });
        }
      });

      // Evento: equipe:atualizar (Onboarding e perfil)
      socket.on('equipe:atualizar', async (data, ack) => {
        try {
          const { equipeId, nome, slogan, avatarUrl, setor } = data || {};
          const equipe = this.teamService.updateProfile({
            equipeId,
            usuarioId: user.id,
            nome,
            slogan,
            avatarUrl,
            setor
          });

          this.io.to(`sala_${equipe.sala_id}`).emit('equipe:atualizada', equipe);
          if (ack) ack({ sucesso: true, equipe });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });

      // Evento: papel:atribuir
      socket.on('papel:atribuir', async (data, ack) => {
        try {
          const { equipeId, alvoUsuarioId, papéis } = data || {};
          const equipe = this.teamService.assignRoles({
            equipeId,
            solicitanteUsuarioId: user.id,
            alvoUsuarioId,
            papéis
          });

          this.io.to(`sala_${equipe.sala_id}`).emit('equipe:papel_atualizado', equipe);
          if (ack) ack({ sucesso: true, equipe });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });

      // Evento: decisao:rascunho (qualquer membro da equipe)
      socket.on('decisao:rascunho', async (data, ack) => {
        try {
          const { equipeId, rodada, payload, justificativa } = data || {};
          const equipe = this.teamService.teamRepo.findById(equipeId);
          if (!equipe) throw new Error('Equipe não encontrada.');

          const ehMembro = equipe.membros.some(m => m.usuario_id === user.id);
          if (!ehMembro) throw new Error('Apenas membros da equipe podem salvar rascunhos.');

          const id = `dec_${equipe.sala_id}_${equipeId}_r${rodada}`;
          const decisao = this.roundRepo.saveDecision({
            id,
            salaId: equipe.sala_id,
            equipeId,
            rodada,
            status: 'rascunho',
            payload,
            justificativa,
            enviadoPor: user.id
          });

          // Notifica os outros membros da mesma equipe
          socket.to(`equipe_${equipeId}`).emit('decisao:rascunho_atualizado', decisao);
          if (ack) ack({ sucesso: true, decisao });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });

      // Evento: decisao:enviar (APENAS CEO com autorização estrita no servidor)
      socket.on('decisao:enviar', async (data, ack) => {
        try {
          const { equipeId, rodada, payload, justificativa, actionId } = data || {};

          // Idempotência
          if (actionId && this.processedActions.has(actionId)) {
            return ack && ack({ sucesso: true, idempotente: true });
          }

          const equipe = this.teamService.teamRepo.findById(equipeId);
          if (!equipe) throw new Error('Equipe não encontrada.');

          const ehCEO = equipe.membros.some(m => m.usuario_id === user.id && m.papel === ROLES.CEO);
          if (!ehCEO && user.perfil !== 'professor') {
            throw new Error('Apenas o CEO possui procuração legal para aprovar e enviar a decisão final da rodada.');
          }

          const id = `dec_${equipe.sala_id}_${equipeId}_r${rodada}`;
          const decisao = this.roundRepo.saveDecision({
            id,
            salaId: equipe.sala_id,
            equipeId,
            rodada,
            status: 'enviada',
            payload,
            justificativa,
            enviadoPor: user.id
          });

          if (actionId) this.processedActions.add(actionId);

          this.io.to(`equipe_${equipeId}`).emit('decisao:enviada_sucesso', decisao);
          this.io.to(`sala_${equipe.sala_id}`).emit('sala:equipe_decidiu', { equipeId, rodada });

          if (ack) ack({ sucesso: true, decisao });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });

      // Evento: rodada:iniciar (Apenas Professor)
      socket.on('rodada:iniciar', async (data, ack) => {
        try {
          const { salaId } = data || {};
          const sala = this.roomService.getRoomById(salaId);
          if (sala.professor_id !== user.id && user.perfil !== 'admin') {
            throw new Error('Apenas o professor pode iniciar a simulação.');
          }

          const atualizada = this.roomService.startSimulation(salaId, user.id);
          this.io.to(`sala_${salaId}`).emit('rodada:iniciada', {
            rodadaAtual: atualizada.rodada_atual,
            status: atualizada.status
          });

          if (ack) ack({ sucesso: true, sala: atualizada });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });

      // Evento: rodada:fechar (Apenas Professor) - Executa a simulação completa da rodada
      socket.on('rodada:fechar', async (data, ack) => {
        try {
          const { salaId, rodada } = data || {};
          const sala = this.roomService.getRoomById(salaId);
          if (sala.professor_id !== user.id && user.perfil !== 'admin') {
            throw new Error('Apenas o professor responsável pode fechar a rodada.');
          }

          const targetRound = rodada || sala.rodada_atual;

          // Se estiver a partir da rodada 2 ou configurado, processa as decisões dos bots concorrentes
          this.botService.processBotDecisions(salaId, targetRound, sala.seed);

          const equipes = this.teamService.teamRepo.findBySala(salaId);
          const decisoes = this.roundRepo.listDecisionsForRound(salaId, targetRound);
          const noticias = this.roundRepo.getRoomNews(salaId);

          // Executa a engine econômica com as garantias de invariantes
          const simResultado = RoundSimulationEngine.runRound({
            rodada: targetRound,
            salaSeed: sala.seed,
            noticias,
            empresas: equipes,
            decisoes: decisoes.map(d => ({
              empresaId: d.equipe_id,
              ...d.payload
            }))
          });

          // Persiste os resultados contábeis e de mercado de cada equipe
          for (const resEmp of simResultado.resultadosEmpresas) {
            const resId = `res_${salaId}_${resEmp.empresaId}_r${targetRound}`;
            this.roundRepo.saveResult({
              id: resId,
              salaId,
              equipeId: resEmp.empresaId,
              rodada: targetRound,
              dre: resEmp.dre,
              balanco: resEmp.balanco,
              dfc: resEmp.dfc,
              mercado: resEmp.mercado,
              estoque: resEmp.estoque,
              credit: resEmp.scoreCredito
            });
          }

          // Revela impactos reais de notícias
          this.roundRepo.revealNews(salaId, targetRound);

          // Avança a rodada da sala
          const salaAtualizada = this.roomService.advanceRound(salaId, user.id);

          this.io.to(`sala_${salaId}`).emit('resultado:publicar', {
            rodada: targetRound,
            proximaRodada: salaAtualizada.rodada_atual,
            statusSala: salaAtualizada.status,
            macro: simResultado.macro,
            noticiasReveladas: simResultado.noticiasReveladas
          });

          if (ack) ack({ sucesso: true, resultado: simResultado });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });

      // Evento: analise:registrar_uso (Pedagógico: rastreia se o aluno usou Descritiva, Diagnóstica, Preditiva ou Prescritiva)
      socket.on('analise:registrar_uso', async (data, ack) => {
        try {
          const { salaId, equipeId, rodada, tipoAnalise, detalhes } = data || {};
          const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

          this.roundRepo.logAnalyticalAction({
            id,
            salaId,
            equipeId,
            usuarioId: user.id,
            rodada: rodada || 1,
            tipoAnalise,
            detalhes
          });

          if (ack) ack({ sucesso: true });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });

      // Evento: noticia:gerar (Apenas Professor)
      socket.on('noticia:gerar', async (data, ack) => {
        try {
          const { salaId, categoria, modo } = data || {};
          const sala = this.roomService.getRoomById(salaId);
          if (sala.professor_id !== user.id && user.perfil !== 'admin') {
            throw new Error('Apenas o professor pode gerar notícias dinâmicas.');
          }

          let noticia;
          if (modo === 'llm') {
            noticia = await this.newsGenerator.generateNewsWithLLM({
              salaId,
              rodada: sala.rodada_atual,
              seed: sala.seed,
              categoria
            });
          } else {
            noticia = this.newsGenerator.generateTemplateNews({
              salaId,
              rodada: sala.rodada_atual,
              seed: sala.seed,
              categoria
            });
          }

          this.roundRepo.saveNews(noticia);
          this.io.to(`sala_${salaId}`).emit('noticia:publicar', noticia);

          if (ack) ack({ sucesso: true, noticia });
        } catch (err) {
          if (ack) ack({ sucesso: false, erro: err.message });
        }
      });
    });
  }
}
