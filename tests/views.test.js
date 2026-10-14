import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/server.js';
import http from 'node:http';

describe('Rotas de Visualização EJS e Telas do Simulador', () => {
  let server;
  let port;

  beforeAll(async () => {
    const appData = createApp();
    server = appData.server;
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll((done) => {
    if (server) server.close(done);
    else done();
  });

  it('deve renderizar a tela de login pública com status 200 e layout master', async () => {
    const res = await fetch(`http://localhost:${port}/auth/login`);
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('Aurora Business Lab');
    expect(html).toContain('Porto Aurora 2031');
    expect(html).toContain('form-login');
    expect(html).toContain('form-register');
    expect(html).toContain('csrf-token');
  });

  it('deve redirecionar usuário não autenticado ao tentar acessar o lobby', async () => {
    const res = await fetch(`http://localhost:${port}/lobby`, { redirect: 'manual' });
    expect([302, 303, 307]).toContain(res.status);
    expect(res.headers.get('location')).toBe('/auth/login');
  });

  it('deve responder à rota de healthcheck com JSON válido', async () => {
    const res = await fetch(`http://localhost:${port}/api/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.cidade).toBe('Porto Aurora');
    expect(data.ano).toBe(2031);
  });

  it('deve compilar e renderizar a view game/decisions com o trilho executivo slim e diretorias separadas', async () => {
    const ejs = await import('ejs');
    const path = await import('node:path');
    const templatePath = path.resolve(process.cwd(), 'views/game/decisions.ejs');

    const mockData = {
      currentRoom: { id: 'room-1', nome: 'Sala Alpha', rodada_atual: 1, max_rodadas: 12, codigo: 'ALPH1' },
      currentTeam: { id: 'team-1', nome: 'Equipe Vanguard', membros: [{ usuario_id: 'user-1', papel: 'CEO', nome: 'Ana CEO' }] },
      currentUser: { id: 'user-1', nome: 'Ana CEO', perfil: 'aluno' },
      decisionStatus: 'rascunho',
      currentDecision: {
        payload: { preco: 85.0, marketing: 3000, compraEstoqueNormal: 1200, compraEstoqueUrgente: 100, solicitarEmprestimo: 5000, amortizarEmprestimo: 0 },
        justificativa: { tipoAnalise: 'preditiva', evidencia: 'Demanda MAPE 3%', hipotese: 'Margem > 50%' }
      }
    };

    const rendered = await ejs.renderFile(templatePath, mockData);

    // Valida trilho executivo slim e navegação por diretorias (CMO, COO, CFO e Panorama)
    expect(rendered).toContain('decision-rail');
    expect(rendered).toContain('panel-cmo');
    expect(rendered).toContain('panel-coo');
    expect(rendered).toContain('panel-cfo');
    expect(rendered).toContain('panel-panorama');
    expect(rendered).not.toContain('panel-cdo');

    // Valida campos e seletores essenciais operacionais
    expect(rendered).toContain('id="dec-preco"');
    expect(rendered).toContain('id="dec-marketing"');
    expect(rendered).toContain('id="dec-compra-normal"');
    expect(rendered).toContain('id="dec-compra-urgente"');
    expect(rendered).toContain('id="dec-solicitar-emprestimo"');
    expect(rendered).toContain('id="dec-amortizar-emprestimo"');
    expect(rendered).not.toContain('id="dec-tipo-analise"');

    // Valida micro-interações, sliders e dock de governança
    expect(rendered).toContain('slider-slim');
    expect(rendered).toContain('decision-dock');
    expect(rendered).toContain('abrirPreviaImpacto()');
    expect(rendered).toContain('abrirGuiaDiretorias()');
  });

  it('deve compilar e renderizar a view game/gazeta com ticker financeiro, masthead e terminal de mercado', async () => {
    const ejs = await import('ejs');
    const path = await import('node:path');
    const templatePath = path.resolve(process.cwd(), 'views/game/gazeta.ejs');

    const mockData = {
      currentRoom: { id: 'room-1', nome: 'Sala Alpha', rodada_atual: 2, max_rodadas: 12, codigo: 'ALPH1' },
      currentTeam: { id: 'team-1', nome: 'Equipe Vanguard' },
      macroData: {
        rodada: 2,
        trimestre: 2,
        ano: 2031,
        ato: { nome: 'Ato 1: Nascimento', descricao: 'Estabilidade econômica no porto.' },
        selic: 9.25,
        selicTrimestral: 2.31,
        cambio: 5.12,
        pibCrescimento: 2.5,
        inflacao: 3.9,
        sazonalidade: 1.0,
        salarioMedio: 3250,
        aliquotaImposto: 0.12
      },
      todasNoticias: [
        { id: 'n1', titulo: 'Porto modernizado', texto: 'Novos guindastes aceleram carga.', categoria: 'logistica_porto', confiabilidade: 0.95, tipo_efeito: 'demanda', duracao_rodadas: 2, rodada_publicacao: 1 },
        { id: 'n2', titulo: 'Juros estáveis em Porto Aurora', texto: 'Banco Aurora mantém linha.', categoria: 'credito', confiabilidade: 0.85, tipo_efeito: 'credito_juros', duracao_rodadas: 1, rodada_publicacao: 2 }
      ],
      noticiasRodada: [
        { id: 'n2', titulo: 'Juros estáveis em Porto Aurora', texto: 'Banco Aurora mantém linha.', categoria: 'credito', confiabilidade: 0.85, tipo_efeito: 'credito_juros', duracao_rodadas: 1, rodada_publicacao: 2 }
      ],
      noticiasPassadas: [
        { id: 'n1', titulo: 'Porto modernizado', texto: 'Novos guindastes aceleram carga.', categoria: 'logistica_porto', confiabilidade: 0.95, tipo_efeito: 'demanda', duracao_rodadas: 2, rodada_publicacao: 1 }
      ]
    };

    const rendered = await ejs.renderFile(templatePath, mockData);

    // Valida elementos do jornal digital financeiro
    expect(rendered).toContain('GAZETA AURORA');
    expect(rendered).toContain('gazeta-ticker-bar');
    expect(rendered).toContain('Terminal Financeiro Aurora');
    expect(rendered).toContain('Barômetro de Inteligência');
    expect(rendered).toContain('Juros estáveis em Porto Aurora');
    expect(rendered).toContain('Porto modernizado');
    expect(rendered).toContain('abrirArtigoCompleto');
  });

  it('deve compilar e renderizar a view game/ranking com pódio top 3 e tabela editorial de empresas', async () => {
    const ejs = await import('ejs');
    const path = await import('node:path');
    const templatePath = path.resolve(process.cwd(), 'views/game/ranking.ejs');

    const mockData = {
      currentRoom: { id: 'room-1', nome: 'Sala Alpha', rodada_atual: 2, max_rodadas: 12, codigo: 'ALPH1' },
      currentTeam: { id: 'team-1', nome: 'Aurora Logistics', cnpj: '11.222.333/0001-44' },
      rankingData: {
        sala: { id: 'room-1', nome: 'Sala Alpha', codigo: 'ALPH1', rodadaAtual: 2, maxRodadas: 12 },
        rodadaApurada: 1,
        isCumulative: true,
        completedRounds: [1],
        pesos: { financeiro: 0.50, mercado: 0.20, analitico: 0.30 },
        empresas: [
          {
            posicao: 1,
            variacao: 0,
            equipe: { id: 'team-1', nome: 'Aurora Logistics', setor: 'Logística', cnpj: '11.222.333/0001-44', slogan: 'Pontualidade', membros: [] },
            scores: { financeiro: 90.0, mercado: 85.0, analitico: 88.0, geral: 88.4 },
            metricas: { lucroAcumulado: 22000, caixaAtual: 102000, marketShareMedio: 38.0, ratingCredito: 'AAA', statusSolvencia: 'Saudável' }
          }
        ],
        top3: [
          {
            posicao: 1,
            variacao: 0,
            equipe: { id: 'team-1', nome: 'Aurora Logistics', setor: 'Logística', cnpj: '11.222.333/0001-44', slogan: 'Pontualidade', membros: [] },
            scores: { financeiro: 90.0, mercado: 85.0, analitico: 88.0, geral: 88.4 },
            metricas: { lucroAcumulado: 22000, caixaAtual: 102000, marketShareMedio: 38.0, ratingCredito: 'AAA', statusSolvencia: 'Saudável' }
          }
        ],
        estatisticas: {
          totalEmpresas: 1,
          lucroMedio: 22000,
          marketShareLider: 38.0,
          empresaLider: 'Aurora Logistics'
        }
      }
    };

    const rendered = await ejs.renderFile(templatePath, mockData);

    expect(rendered).toContain('Classificação das Empresas');
    expect(rendered).toContain('Aurora Logistics');
    expect(rendered).toContain('Score Global');
    expect(rendered).toContain('88.4');
    expect(rendered).toContain('1º Lugar');
    expect(rendered).toContain('ranking-table');
    expect(rendered).toContain('abrirRaioXEquipe');
  });
});

