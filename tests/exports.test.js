import { describe, it, expect, beforeAll } from 'vitest';
import { DataExportService } from '../src/services/dataExportService.js';
import { RoomService } from '../src/services/roomService.js';
import { TeamService } from '../src/services/teamService.js';
import { RoundRepository } from '../src/repositories/roundRepository.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { getDatabase } from '../src/repositories/db.js';

describe('Central de Exportação e Conexão de Dados para Power BI / Excel', () => {
  let exportService;
  let roomService;
  let teamService;
  let roundRepo;
  let sala;
  let equipe;
  let professor;

  beforeAll(() => {
    const db = getDatabase();
    const userRepo = new UserRepository(db);
    roomService = new RoomService();
    teamService = new TeamService();
    roundRepo = new RoundRepository(db);
    exportService = new DataExportService(roundRepo, teamService.teamRepo, roomService.roomRepo);

    professor = userRepo.createUser({
      id: `prof_exp_${Date.now()}`,
      email: `prof_exp_${Date.now()}@aurora.edu`,
      senhaHash: 'hash',
      nome: 'Prof. Power BI',
      perfil: 'professor'
    });

    sala = roomService.createRoom({
      professorId: professor.id,
      nome: 'Turma Especial Power BI'
    });

    const aluno = userRepo.createUser({
      id: `aluno_exp_${Date.now()}`,
      email: `aluno_exp_${Date.now()}@aurora.edu`,
      senhaHash: 'hash',
      nome: 'Carla Aluna',
      perfil: 'aluno'
    });

    equipe = teamService.createTeam({
      salaId: sala.id,
      usuarioId: aluno.id,
      nome: 'Power BI Analytics S.A.'
    });

    // Salva resultado mock na rodada 1
    roundRepo.saveResult({
      id: `res_${sala.id}_${equipe.id}_r1`,
      salaId: sala.id,
      equipeId: equipe.id,
      rodada: 1,
      dre: {
        receitaBruta: 80000,
        impostosSobreVendas: 9600,
        receitaLiquida: 70400,
        cmv: 32000,
        lucroBruto: 38400,
        despesasOperacionais: { total: 15000 },
        ebitda: 23400,
        despesasFinanceiras: 500,
        lucroLiquido: 22900,
        margemBruta: 54.5,
        margemLiquida: 32.5
      },
      balanco: {
        ativo: { circulante: { caixa: 75000, estoque: 20000 }, total: 95000 },
        passivo: { total: 10000 },
        patrimonioLiquido: { total: 85000 }
      },
      dfc: { fluxoOperacional: { entradas: 80000, saidas: 50000 } },
      mercado: { preco: 80, marketing: 3000, demandaRecebida: 1000, unidadesVendidas: 1000, vendasPerdidas: 0, marketShare: 25 },
      estoque: { estoqueInicial: 1000, totalEntradasUnidades: 0, estoqueFinalUnidades: 0, custoMedioUnitario: 32, custoArmazenagemTotal: 0, custoPerdasEstoque: 0 },
      credit: { score: 850, rating: 'AAA' }
    });
  });

  it('deve exportar em CSV formatado com BOM UTF-8 e delimitador ";" para Power BI pt-BR', () => {
    const csv = exportService.exportToCSV(sala.id, equipe.id);
    expect(csv.startsWith('\uFEFF')).toBe(true); // BOM presente
    expect(csv).toContain('rodada;ano;trimestre;equipeId;empresaNome');
    expect(csv).toContain('Power BI Analytics S.A.');
    expect(csv).toContain('80000');
  });

  it('deve exportar em XLS nativo com XML Spreadsheet 2003', () => {
    const xls = exportService.exportToXLS(sala.id, equipe.id);
    expect(xls).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xls).toContain('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
    expect(xls).toContain('<Worksheet ss:Name="AuroraDadosPowerBI">');
    expect(xls).toContain('Power BI Analytics S.A.');
  });

  it('deve exportar em TXT delimitado por tabulação (TSV)', () => {
    const txt = exportService.exportToTXT(sala.id, equipe.id);
    expect(txt).toContain('rodada\tano\ttrimestre\tequipeId');
    expect(txt).toContain('Power BI Analytics S.A.');
  });

  it('deve exportar em SQL com DDL CREATE TABLE e DML INSERT INTO', () => {
    const sql = exportService.exportToSQL(sala.id, equipe.id);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS fato_simulacao_aurora');
    expect(sql).toContain('INSERT INTO fato_simulacao_aurora VALUES');
    expect(sql).toContain('Power BI Analytics S.A.');
  });

  it('deve exportar via API JSON para o Power BI Web Connector com metadados', () => {
    const apiJson = exportService.exportToAPIJSON(sala.id, equipe.id);
    expect(apiJson.sistema).toBe('Aurora Business Lab');
    expect(apiJson.totalRegistros).toBeGreaterThanOrEqual(1);
    expect(apiJson.dados[0].empresaNome).toBe('Power BI Analytics S.A.');
  });

  it('deve exportar os domínios de negócio particionados para modelagem Star Schema no Power BI', () => {
    // 1. Vendas & Comercial em CSV
    const vendasCsv = exportService.exportVendasCSV(sala.id, equipe.id);
    expect(vendasCsv).toContain('equipe_id;rodada;preco_praticado');
    expect(vendasCsv).toContain('80');

    // 2. Estoque & Logística em TXT
    const estoqueTxt = exportService.exportEstoqueTXT(sala.id, equipe.id);
    expect(estoqueTxt).toContain('equipe_id\trodada\testoque_inicial_unidades');

    // 3. Contabilidade ERP em SQL
    const contabSql = exportService.exportContabilidadeSQL(sala.id, equipe.id);
    expect(contabSql).toContain('CREATE TABLE IF NOT EXISTS fato_dre_contabil');
    expect(contabSql).toContain('CREATE TABLE IF NOT EXISTS fato_balanco_patrimonial');
    expect(contabSql).toContain('PRIMARY KEY (equipe_id, rodada)');

    // 4. Dimensão Empresas em XLS
    const empresasXls = exportService.exportEmpresasXLS(sala.id);
    expect(empresasXls).toContain('<Worksheet ss:Name="dim_empresas">');
    expect(empresasXls).toContain('Power BI Analytics S.A.');

    // 5. Macroeconomia & Mercado em Web API JSON
    const macroJson = exportService.exportMacroAPIJSON(sala.id);
    expect(macroJson.modulo).toContain('Inteligencia Macroeconomica');
    expect(macroJson.macroeconomia.length).toBeGreaterThanOrEqual(1);
    expect(macroJson.macroeconomia[0]).toHaveProperty('selic_anual_pct');
    expect(macroJson.macroeconomia[0]).toHaveProperty('cambio_dolar_ptax');
  });

  it('deve permitir ao professor alternar o bloqueio pedagógico do laboratório analítico web', () => {
    // Por padrão, laboratório analítico web deve estar desativado (foco Power BI)
    const salaAtual = roomService.getRoomById(sala.id);
    expect(salaAtual.configuracoes?.habilitarLaboratorioAnalitico).toBe(false);

    // Professor ativa o laboratório web
    const salaAtivada = roomService.toggleAnalyticsLab(sala.id, professor.id, true);
    expect(salaAtivada.configuracoes?.habilitarLaboratorioAnalitico).toBe(true);

    // Professor desativa de volta
    const salaDesativada = roomService.toggleAnalyticsLab(sala.id, professor.id, false);
    expect(salaDesativada.configuracoes?.habilitarLaboratorioAnalitico).toBe(false);
  });
});
