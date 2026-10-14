/**
 * Serviço de Equipes e Onboarding em 6 Etapas
 * Aurora Business Lab - Porto Aurora 2031
 */

import { fakerPT_BR as faker } from '@faker-js/faker';
import { TeamRepository } from '../repositories/teamRepository.js';
import { RoomRepository } from '../repositories/roomRepository.js';
import { gerarCNPJFicticio } from '../utils/cnpj.js';

export const ROLES = {
  CEO: 'CEO', // Aprova e envia a decisão final, reatribui papéis
  CFO: 'CFO', // Crédito, caixa, investimentos, DRE/Balanço
  CMO: 'CMO', // Preço, marketing, campanhas
  COO: 'COO', // Compra, estoque, suprimentos e capacidade
  CDO: 'CDO'  // Dados: acesso completo ao laboratório analítico
};

export class TeamService {
  constructor(teamRepo = null, roomRepo = null) {
    this.teamRepo = teamRepo || new TeamRepository();
    this.roomRepo = roomRepo || new RoomRepository();
  }

  /**
   * Sugere nomes e slogans inspiradores de negócios usando o Faker pt_BR.
   */
  suggestCompanyBrand() {
    const adjetivo = faker.company.buzzAdjective();
    const substantivo = faker.company.buzzNoun();
    const nome = `Aurora ${adjetivo.charAt(0).toUpperCase() + adjetivo.slice(1)} ${substantivo.charAt(0).toUpperCase() + substantivo.slice(1)}`;
    const slogan = `${faker.company.catchPhrase()} em Porto Aurora.`;
    const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(nome)}`;

    return { nome, slogan, avatar };
  }

  /**
   * Etapa 1 e 2: Aluno entra na sala e cria uma equipe inicial (torna-se o CEO fundador inicial).
   */
  createTeam({ salaId, usuarioId, nome, setor = 'Varejo & Bens de Consumo' }) {
    if (!nome || nome.trim().length < 3) {
      throw new Error('O nome da empresa deve conter no mínimo 3 caracteres.');
    }

    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const jaTemEquipe = this.teamRepo.findUserTeamInRoom(salaId, usuarioId);
    if (jaTemEquipe) {
      throw new Error('Você já faz parte de uma equipe nesta sala.');
    }

    // Gera um CNPJ fictício válido garantindo unicidade no banco
    let cnpjData = gerarCNPJFicticio();
    while (this.teamRepo.findByCNPJ(cnpjData.cnpj)) {
      cnpjData = gerarCNPJFicticio();
    }

    const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const team = this.teamRepo.createTeam({
      id: teamId,
      salaId,
      nome: nome.trim(),
      slogan: 'Inovação e eficiência em Porto Aurora',
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(nome)}`,
      setor,
      cnpj: cnpjData.cnpj,
      dataAbertura: new Date().toISOString().split('T')[0],
      capitalSocial: 80000.0
    });

    // Criador inicia como CEO por padrão
    const membroId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.teamRepo.addMember({
      id: membroId,
      equipeId: teamId,
      usuarioId,
      papel: ROLES.CEO
    });

    return this.teamRepo.findById(teamId);
  }

  /**
   * Aluno entra em equipe existente.
   */
  joinTeam({ salaId, equipeId, usuarioId, papelDesejado = ROLES.CDO }) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const jaTemEquipe = this.teamRepo.findUserTeamInRoom(salaId, usuarioId);
    if (jaTemEquipe) {
      throw new Error('Você já faz parte de uma equipe nesta sala.');
    }

    const equipe = this.teamRepo.findById(equipeId);
    if (!equipe) throw new Error('Equipe não encontrada.');
    if (equipe.confirmado) {
      throw new Error('Esta equipe já confirmou a abertura e não aceita novos integrantes.');
    }

    const membroId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.teamRepo.addMember({
      id: membroId,
      equipeId,
      usuarioId,
      papel: papelDesejado
    });

    return this.teamRepo.findById(equipeId);
  }

  /**
   * Etapa 3: Definir e reatribuir papéis.
   * Somente o CEO tem permissão para reatribuir papéis de outros membros.
   */
  assignRoles({ equipeId, solicitanteUsuarioId, alvoUsuarioId, papéis }) {
    const equipe = this.teamRepo.findById(equipeId);
    if (!equipe) throw new Error('Equipe não encontrada.');

    // Verifica permissão do solicitante: ou é o CEO da equipe ou é o próprio membro antes da confirmação
    const membroSolicitante = equipe.membros.find(m => m.usuario_id === solicitanteUsuarioId);
    if (!membroSolicitante) {
      throw new Error('Você não pertence a esta equipe.');
    }

    const solicitanteEhCEO = equipe.membros.some(m => m.usuario_id === solicitanteUsuarioId && m.papel === ROLES.CEO);

    if (!solicitanteEhCEO && solicitanteUsuarioId !== alvoUsuarioId) {
      throw new Error('Apenas o CEO pode reatribuir papéis de outros integrantes da equipe.');
    }

    // Valida papéis
    const papéisValidos = Array.isArray(papéis) ? papéis : [papéis];
    for (const p of papéisValidos) {
      if (!Object.values(ROLES).includes(p)) {
        throw new Error(`Papel inválido: ${p}. Use: CEO, CFO, CMO, COO ou CDO.`);
      }
    }

    this.teamRepo.updateMemberRoles(equipeId, alvoUsuarioId, papéisValidos);
    return this.teamRepo.findById(equipeId);
  }

  /**
   * Etapa 4: Configurar identidade da empresa (nome, slogan, avatar, setor).
   */
  updateProfile({ equipeId, usuarioId, nome, slogan, avatarUrl, setor }) {
    const equipe = this.teamRepo.findById(equipeId);
    if (!equipe) throw new Error('Equipe não encontrada.');
    if (equipe.confirmado) {
      throw new Error('A empresa já está confirmada e sua certidão foi emitida.');
    }

    const ehMembro = equipe.membros.some(m => m.usuario_id === usuarioId);
    if (!ehMembro) throw new Error('Você não tem permissão nesta equipe.');

    return this.teamRepo.updateTeamConfig(equipeId, { nome, slogan, avatarUrl, setor });
  }

  /**
   * Etapa 5: Emite a Certidão de Abertura Oficial com CNPJ válido e dados formatados.
   */
  generateCertificate(equipeId) {
    const equipe = this.teamRepo.findById(equipeId);
    if (!equipe) throw new Error('Equipe não encontrada.');

    const socios = equipe.membros.map(m => ({
      nome: m.nome,
      papel: m.papel,
      email: m.email
    }));

    return {
      certidaoId: `CERT-${equipe.id.toUpperCase()}`,
      cnpj: equipe.cnpj,
      selo: 'FICTÍCIO',
      razaoSocial: `${equipe.nome} S.A.`,
      nomeFantasia: equipe.nome,
      slogan: equipe.slogan,
      setor: equipe.setor,
      dataAbertura: equipe.data_abertura,
      capitalSocial: equipe.capital_social,
      socios,
      incubadora: 'Aurora Hub - Polo Tecnológico de Porto Aurora (2031)',
      bloqueado: Boolean(equipe.confirmado)
    };
  }

  /**
   * Etapa 6: Revisão e Confirmação.
   * Após confirmado, o nome e o CNPJ ficam permanentemente bloqueados.
   */
  confirmOpening({ equipeId, usuarioId }) {
    const equipe = this.teamRepo.findById(equipeId);
    if (!equipe) throw new Error('Equipe não encontrada.');

    // Apenas o CEO pode confirmar formalmente a abertura da empresa
    const ehCEO = equipe.membros.some(m => m.usuario_id === usuarioId && m.papel === ROLES.CEO);
    if (!ehCEO) {
      throw new Error('Apenas o CEO possui procuração para homologar a certidão de abertura da empresa.');
    }

    return this.teamRepo.confirmTeam(equipeId);
  }

  /**
   * Verifica se o usuário possui determinado papel dentro da equipe.
   */
  userHasRole(equipe, usuarioId, papelNecessario) {
    if (!equipe || !equipe.membros) return false;
    return equipe.membros.some(m => m.usuario_id === usuarioId && m.papel === papelNecessario);
  }
}
