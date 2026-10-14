import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/services/authService.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { getDatabase } from '../src/repositories/db.js';

describe('Serviço de Autenticação e Perfis', () => {
  let authService;
  let userRepo;

  beforeEach(() => {
    const db = getDatabase();
    userRepo = new UserRepository(db);
    authService = new AuthService(userRepo);
  });

  it('deve registrar um novo aluno com senha criptografada e retornar dados seguros', async () => {
    const email = `aluno_${Date.now()}@aurora.edu.br`;
    const user = await authService.register({
      email,
      senha: 'senhaSecreta123',
      nome: 'Lucas Porto',
      perfil: 'aluno'
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(email);
    expect(user.nome).toBe('Lucas Porto');
    expect(user.perfil).toBe('aluno');
    expect(user.senha_hash).toBeUndefined(); // não vaza hash

    // Verifica no banco se a senha está realmente com hash bcrypt
    const dbUser = userRepo.findById(user.id);
    expect(dbUser.senha_hash).not.toBe('senhaSecreta123');
    expect(dbUser.senha_hash).toMatch(/^\$2[aby]\$/);
  });

  it('deve rejeitar cadastro com e-mail duplicado', async () => {
    const email = `duplicado_${Date.now()}@aurora.edu.br`;
    await authService.register({ email, senha: '123456', nome: 'Primeiro', perfil: 'aluno' });

    await expect(
      authService.register({ email, senha: 'outrasenha', nome: 'Segundo', perfil: 'aluno' })
    ).rejects.toThrow(/E-mail já cadastrado/);
  });

  it('deve autenticar login válido e rejeitar credenciais incorretas', async () => {
    const email = `prof_${Date.now()}@aurora.edu.br`;
    await authService.register({ email, senha: 'passwordValida', nome: 'Prof. Sofia', perfil: 'professor' });

    const logado = await authService.login({ email, senha: 'passwordValida' });
    expect(logado.perfil).toBe('professor');

    await expect(authService.login({ email, senha: 'senhaErrada' })).rejects.toThrow(/E-mail ou senha incorretos/);
  });

  it('deve realizar fluxo pedagógico de recuperação simulada de senha', async () => {
    const email = `recup_${Date.now()}@aurora.edu.br`;
    await authService.register({ email, senha: 'antigaSenha123', nome: 'Renata', perfil: 'aluno' });

    const solicitacao = authService.requestPasswordReset(email);
    expect(solicitacao.enviado).toBe(true);
    expect(solicitacao.simulacaoToken).toBeDefined();

    // Redefinição com o token gerado
    const redefinicao = await authService.resetPassword(solicitacao.simulacaoToken, 'novaSenha456');
    expect(redefinicao.sucesso).toBe(true);

    // O login agora deve funcionar apenas com a nova senha
    const logado = await authService.login({ email, senha: 'novaSenha456' });
    expect(logado.id).toBeDefined();
  });
});
