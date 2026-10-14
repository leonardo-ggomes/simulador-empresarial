import { describe, it, expect, beforeEach } from 'vitest';
import { RoomService } from '../src/services/roomService.js';
import { RoomRepository } from '../src/repositories/roomRepository.js';
import { RoundRepository } from '../src/repositories/roundRepository.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { getDatabase } from '../src/repositories/db.js';

describe('Serviço de Salas de Simulação (Professores)', () => {
  let roomService;
  let userRepo;
  let roundRepo;
  let professor;

  beforeEach(() => {
    const db = getDatabase();
    userRepo = new UserRepository(db);
    const roomRepo = new RoomRepository(db);
    roundRepo = new RoundRepository(db);
    roomService = new RoomService(roomRepo, roundRepo);

    // Cria professor mock
    professor = userRepo.createUser({
      id: `prof_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      email: `prof_${Date.now()}@hub.aurora`,
      senhaHash: 'hash',
      nome: 'Prof. Carlos Alberto',
      perfil: 'professor'
    });
  });

  it('deve criar uma sala com código único de 6 caracteres e popular notícias iniciais', () => {
    const sala = roomService.createRoom({
      professorId: professor.id,
      nome: 'Turma de Análise de Dados 2031.1',
      dificuldade: 'intermediario',
      maxRodadas: 12
    });

    expect(sala.id).toBeDefined();
    expect(sala.codigo).toMatch(/^AUR[A-Z0-9]{3}$/);
    expect(sala.status).toBe('aberta');
    expect(sala.rodada_atual).toBe(1);

    // Verifica se as notícias do cenário foram geradas para a sala
    const noticias = roundRepo.getRoomNews(sala.id);
    expect(noticias.length).toBeGreaterThanOrEqual(12);
  });

  it('deve recuperar a sala por código e por ID', () => {
    const salaCriada = roomService.createRoom({
      professorId: professor.id,
      nome: 'Turma B',
      dificuldade: 'iniciante'
    });

    const encontrada = roomService.getRoomByCode(salaCriada.codigo);
    expect(encontrada.id).toBe(salaCriada.id);

    const porId = roomService.getRoomById(salaCriada.id);
    expect(porId.codigo).toBe(salaCriada.codigo);
  });

  it('deve controlar o início da simulação e avanço de rodadas com autorização', () => {
    const sala = roomService.createRoom({
      professorId: professor.id,
      nome: 'Turma C'
    });

    // Usuário não professor não pode iniciar
    expect(() => {
      roomService.startSimulation(sala.id, 'outro_usuario_qualquer');
    }).toThrow(/Apenas o professor responsável/);

    // Professor inicia
    const iniciada = roomService.startSimulation(sala.id, professor.id);
    expect(iniciada.status).toBe('em_andamento');

    // Avança para rodada 2
    const avanco1 = roomService.advanceRound(sala.id, professor.id);
    expect(avanco1.rodada_atual).toBe(2);
  });
});
