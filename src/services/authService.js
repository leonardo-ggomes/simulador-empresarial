/**
 * Serviço de Autenticação e Perfis
 * Aurora Business Lab - Porto Aurora 2031
 */

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRepository } from '../repositories/userRepository.js';

export const RegisterSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve conter no mínimo 6 caracteres'),
  nome: z.string().min(2, 'O nome deve conter no mínimo 2 caracteres'),
  perfil: z.enum(['aluno', 'professor', 'admin']).default('aluno')
});

export const LoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha é obrigatória')
});

export class AuthService {
  constructor(userRepo = null) {
    this.userRepo = userRepo || new UserRepository();
    this.resetTokens = new Map(); // Armazenamento em memória de tokens de recuperação temporários
  }

  async register({ email, senha, nome, perfil = 'aluno' }) {
    const validated = RegisterSchema.parse({ email, senha, nome, perfil });

    const existing = this.userRepo.findByEmail(validated.email);
    if (existing) {
      throw new Error('E-mail já cadastrado na plataforma.');
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(validated.senha, salt);
    const id = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;

    const user = this.userRepo.createUser({
      id,
      email: validated.email,
      senhaHash,
      nome: validated.nome,
      perfil: validated.perfil
    });

    const { senha_hash, ...safeUser } = user;
    return safeUser;
  }

  async login({ email, senha }) {
    const validated = LoginSchema.parse({ email, senha });

    const user = this.userRepo.findByEmail(validated.email);
    if (!user) {
      throw new Error('E-mail ou senha incorretos.');
    }

    const match = await bcrypt.compare(validated.senha, user.senha_hash);
    if (!match) {
      throw new Error('E-mail ou senha incorretos.');
    }

    const { senha_hash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Simulação pedagógica de recuperação de senha com token temporário.
   */
  requestPasswordReset(email) {
    const user = this.userRepo.findByEmail(email);
    if (!user) {
      // Resposta genérica segura para evitar enumeração de usuários
      return { enviado: true, message: 'Se o e-mail existir, as instruções foram enviadas.' };
    }

    const token = `reset_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    this.resetTokens.set(token, {
      userId: user.id,
      email: user.email,
      expiresAt: Date.now() + 3600000 // 1 hora
    });

    return {
      enviado: true,
      simulacaoToken: token,
      linkSimulado: `/auth/reset-password?token=${token}`,
      message: 'Instruções de recuperação geradas com sucesso (modo simulado).'
    };
  }

  async resetPassword(token, novaSenha) {
    if (!novaSenha || novaSenha.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }

    const resetData = this.resetTokens.get(token);
    if (!resetData || resetData.expiresAt < Date.now()) {
      throw new Error('Token de recuperação inválido ou expirado.');
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(novaSenha, salt);

    this.userRepo.db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(senhaHash, resetData.userId);
    this.resetTokens.delete(token);

    return { sucesso: true, message: 'Senha redefinida com sucesso!' };
  }
}
