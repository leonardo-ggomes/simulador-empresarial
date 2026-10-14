import { describe, it, expect, beforeEach } from 'vitest';
import { TeamService, ROLES } from '../src/services/teamService.js';
import { RoomService } from '../src/services/roomService.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { getDatabase } from '../src/repositories/db.js';
import { validarCNPJ } from '../src/utils/cnpj.js';

describe('Onboarding da Equipe (Fluxo em 6 Etapas)', () => {
  let teamService;
  let roomService;
  let userRepo;
  let sala;
  let alunoCEO;
  let alunoCFO;

  beforeEach(() => {
    const db = getDatabase();
    userRepo = new UserRepository(db);
    roomService = new RoomService();
    teamService = new TeamService();

    // Cria usuários
    const prof = userRepo.createUser({
      id: `prof_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      email: `prof_${Date.now()}@aurora.edu.br`,
      senhaHash: 'hash',
      nome: 'Prof. Eduardo',
      perfil: 'professor'
    });

    sala = roomService.createRoom({
      professorId: prof.id,
      nome: 'Sala Onboarding Teste'
    });

    alunoCEO = userRepo.createUser({
      id: `aluno1_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      email: `aluno1_${Date.now()}@aurora.edu.br`,
      senhaHash: 'hash',
      nome: 'Beatriz CEO',
      perfil: 'aluno'
    });

    alunoCFO = userRepo.createUser({
      id: `aluno2_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      email: `aluno2_${Date.now()}@aurora.edu.br`,
      senhaHash: 'hash',
      nome: 'Marcos CFO',
      perfil: 'aluno'
    });
  });

  it('deve executar o fluxo completo das etapas 1 a 6 de forma consistente', () => {
    // Sugestão de Marca via Faker pt_BR
    const sugestao = teamService.suggestCompanyBrand();
    expect(sugestao.nome).toContain('Aurora');
    expect(sugestao.slogan).toBeDefined();

    // Etapa 1 e 2: Aluno entra na sala e funda a empresa
    const equipe = teamService.createTeam({
      salaId: sala.id,
      usuarioId: alunoCEO.id,
      nome: 'Aurora Quantum Tech',
      setor: 'Tecnologia & Equipamentos'
    });

    expect(equipe.id).toBeDefined();
    expect(equipe.nome).toBe('Aurora Quantum Tech');
    expect(equipe.capital_social).toBe(80000.0);
    expect(validarCNPJ(equipe.cnpj)).toBe(true); // CNPJ válido gerado automaticamente
    expect(equipe.confirmado).toBe(0);

    // Criador inicia como CEO
    expect(equipe.membros).toHaveLength(1);
    expect(equipe.membros[0].usuario_id).toBe(alunoCEO.id);
    expect(equipe.membros[0].papel).toBe(ROLES.CEO);

    // Segundo aluno entra na equipe
    teamService.joinTeam({
      salaId: sala.id,
      equipeId: equipe.id,
      usuarioId: alunoCFO.id,
      papelDesejado: ROLES.CFO
    });

    // Etapa 3: Definir e reatribuir papéis reais
    // O CEO atribui papel duplo (CFO + COO) para o Marcos
    const equipeAtualizada = teamService.assignRoles({
      equipeId: equipe.id,
      solicitanteUsuarioId: alunoCEO.id,
      alvoUsuarioId: alunoCFO.id,
      papéis: [ROLES.CFO, ROLES.COO]
    });

    const papeisMarcos = equipeAtualizada.membros.filter(m => m.usuario_id === alunoCFO.id).map(m => m.papel);
    expect(papeisMarcos).toContain(ROLES.CFO);
    expect(papeisMarcos).toContain(ROLES.COO);

    // Não-CEO não tem permissão para reatribuir papel de outro membro
    expect(() => {
      teamService.assignRoles({
        equipeId: equipe.id,
        solicitanteUsuarioId: alunoCFO.id,
        alvoUsuarioId: alunoCEO.id,
        papéis: [ROLES.CDO]
      });
    }).toThrow(/Apenas o CEO pode reatribuir papéis/);

    // Etapa 4: Atualizar perfil da empresa
    const perfilAtualizado = teamService.updateProfile({
      equipeId: equipe.id,
      usuarioId: alunoCEO.id,
      nome: 'Aurora Quantum Soluções',
      slogan: 'Liderando a fronteira analítica',
      avatarUrl: 'https://avatar.svg',
      setor: 'Tecnologia & Equipamentos'
    });
    expect(perfilAtualizado.nome).toBe('Aurora Quantum Soluções');

    // Etapa 5: Emitir Certidão de Abertura
    const certidao = teamService.generateCertificate(equipe.id);
    expect(certidao.certidaoId).toContain('CERT-');
    expect(certidao.cnpj).toBe(equipe.cnpj);
    expect(certidao.selo).toBe('FICTÍCIO');
    expect(certidao.capitalSocial).toBe(80000.0);
    expect(certidao.socios.length).toBeGreaterThanOrEqual(2);

    // Etapa 6: Homologação pelo CEO e Bloqueio permanente de Nome e CNPJ
    const equipeConfirmada = teamService.confirmOpening({
      equipeId: equipe.id,
      usuarioId: alunoCEO.id
    });
    expect(equipeConfirmada.confirmado).toBe(1);

    // Tentativa de alterar nome após confirmação deve ser rejeitada
    expect(() => {
      teamService.updateProfile({
        equipeId: equipe.id,
        usuarioId: alunoCEO.id,
        nome: 'Tentativa de Trocar Nome'
      });
    }).toThrow(/empresa já está confirmada/i);
  });
});
