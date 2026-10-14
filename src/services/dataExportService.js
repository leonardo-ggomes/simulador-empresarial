/**
 * Serviço de Exportação e Conexão de Dados Multi-Formato para Power BI / Excel
 * Aurora Business Lab - Porto Aurora 2031
 *
 * Fornece dados em 5 formatos:
 * 1. CSV (delimitado por ponto e vírgula, UTF-8 com BOM para Excel/Power BI pt-BR)
 * 2. XLS (XML Spreadsheet formatado compatível nativo com Excel)
 * 3. TXT (Tab-Separated Values TSV delimitado)
 * 4. SQL (Script com DDL CREATE TABLE e DML INSERT para bancos relacionais)
 * 5. API Endpoint (JSON otimizado para o conector Web do Power BI com refresh)
 */

import { RoundRepository } from '../repositories/roundRepository.js';
import { TeamRepository } from '../repositories/teamRepository.js';
import { RoomRepository } from '../repositories/roomRepository.js';
import { MacroEconomy } from '../engine/macro.js';

export class DataExportService {
  constructor(roundRepo = null, teamRepo = null, roomRepo = null) {
    this.roundRepo = roundRepo || new RoundRepository();
    this.teamRepo = teamRepo || new TeamRepository();
    this.roomRepo = roomRepo || new RoomRepository();
  }

  /**
   * Coleta e achata o dataset consolidado da empresa e do mercado para BI.
   * @param {string} salaId
   * @param {string} [equipeId] Se nulo, traz dados de todas as equipes da sala
   */
  getConsolidatedDataset(salaId, equipeId = null) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const todasEquipes = this.teamRepo.findBySala(salaId);
    const equipesAlvo = equipeId
      ? todasEquipes.filter(e => e.id === equipeId)
      : todasEquipes;

    const dataset = [];

    for (const eq of equipesAlvo) {
      const resultados = this.roundRepo.getTeamResults(eq.id);

      for (const res of resultados) {
        dataset.push({
          rodada: res.rodada,
          ano: 2031 + Math.floor((res.rodada - 1) / 4),
          trimestre: ((res.rodada - 1) % 4) + 1,
          equipeId: eq.id,
          empresaNome: eq.nome,
          setor: eq.setor,
          cnpj: eq.cnpj,

          // Decisão e Mercado
          precoPraticado: res.mercado.preco,
          investimentoMarketing: res.mercado.marketing,
          demandaRecebida: res.mercado.demandaRecebida,
          unidadesVendidas: res.mercado.unidadesVendidas,
          vendasPerdidasRuptura: res.mercado.vendasPerdidas,
          marketSharePct: res.mercado.marketShare,

          // Estoque
          estoqueInicial: res.estoque.estoqueInicial,
          entradasEstoque: res.estoque.totalEntradasUnidades,
          estoqueFinal: res.estoque.estoqueFinalUnidades,
          custoMedioUnitario: res.estoque.custoMedioUnitario,
          custoArmazenagem: res.estoque.custoArmazenagemTotal,
          perdasObsolescencia: res.estoque.custoPerdasEstoque,

          // DRE
          receitaBruta: res.dre.receitaBruta,
          impostosSobreVendas: res.dre.impostosSobreVendas,
          receitaLiquida: res.dre.receitaLiquida,
          cmv: res.dre.cmv,
          lucroBruto: res.dre.lucroBruto,
          despesasOperacionaisTotal: res.dre.despesasOperacionais.total,
          ebitda: res.dre.ebitda,
          despesasJurosBancarios: res.dre.despesasFinanceiras,
          lucroLiquido: res.dre.lucroLiquido,
          margemBrutaPct: res.dre.margemBruta,
          margemLiquidaPct: res.dre.margemLiquida,

          // Balanço Patrimonial & Solvência
          caixaFinal: res.balanco.ativo.circulante.caixa,
          ativoTotal: res.balanco.ativo.total,
          passivoTotal: res.balanco.passivo.total,
          patrimonioLiquido: res.balanco.patrimonioLiquido.total,
          creditScore: res.credit.score,
          creditRating: res.credit.rating
        });
      }
    }

    return dataset;
  }

  /**
   * 1. Exportação em Formato CSV (UTF-8 com BOM e delimitador ';')
   */
  exportToCSV(salaId, equipeId = null) {
    const data = this.getConsolidatedDataset(salaId, equipeId);
    if (data.length === 0) return '\uFEFF';

    const headers = Object.keys(data[0]);
    let csv = '\uFEFF' + headers.join(';') + '\r\n';

    for (const row of data) {
      const line = headers.map(h => {
        const val = row[h];
        if (typeof val === 'number') {
          return String(val).replace('.', ','); // Formato decimal brasileiro
        }
        if (typeof val === 'string' && (val.includes(';') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val !== undefined && val !== null ? val : '';
      }).join(';');
      csv += line + '\r\n';
    }

    return csv;
  }

  /**
   * 2. Exportação em Formato XLS (XML Spreadsheet formatado compatível com Microsoft Excel)
   */
  exportToXLS(salaId, equipeId = null) {
    const data = this.getConsolidatedDataset(salaId, equipeId);
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1A365D" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="NumberFormat">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="AuroraDadosPowerBI">
  <Table>
   <Row ss:StyleID="Header">
    ${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('\n    ')}
   </Row>
`;

    for (const row of data) {
      xml += '   <Row>\n';
      for (const h of headers) {
        const val = row[h];
        const isNum = typeof val === 'number';
        const type = isNum ? 'Number' : 'String';
        const style = isNum ? ' ss:StyleID="NumberFormat"' : '';
        xml += `    <Cell${style}><Data ss:Type="${type}">${val !== undefined && val !== null ? val : ''}</Data></Cell>\n`;
      }
      xml += '   </Row>\n';
    }

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
  }

  /**
   * 3. Exportação em Formato TXT (TSV - Tab Separated Values)
   */
  exportToTXT(salaId, equipeId = null) {
    const data = this.getConsolidatedDataset(salaId, equipeId);
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    let txt = headers.join('\t') + '\r\n';

    for (const row of data) {
      const line = headers.map(h => {
        const val = row[h];
        return val !== undefined && val !== null ? String(val).replace(/\t/g, ' ') : '';
      }).join('\t');
      txt += line + '\r\n';
    }

    return txt;
  }

  /**
   * 4. Exportação em Formato SQL (Script com CREATE TABLE e INSERT INTO)
   */
  exportToSQL(salaId, equipeId = null) {
    const data = this.getConsolidatedDataset(salaId, equipeId);
    if (data.length === 0) return '-- Nenhum dado disponível para exportação\n';

    let sql = `-- ==========================================================\n`;
    sql += `-- AURORA BUSINESS LAB 2031 - EXPORTAÇÃO SQL PARA BANCO DE DADOS\n`;
    sql += `-- Arquivo gerado para integração analítica com Power BI / SQL Server / Postgres\n`;
    sql += `-- ==========================================================\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS fato_simulacao_aurora (\n`;
    sql += `  rodada INT,\n`;
    sql += `  ano INT,\n`;
    sql += `  trimestre INT,\n`;
    sql += `  equipe_id VARCHAR(50),\n`;
    sql += `  empresa_nome VARCHAR(100),\n`;
    sql += `  setor VARCHAR(80),\n`;
    sql += `  cnpj VARCHAR(20),\n`;
    sql += `  preco_praticado DECIMAL(10,2),\n`;
    sql += `  investimento_marketing DECIMAL(10,2),\n`;
    sql += `  demanda_recebida INT,\n`;
    sql += `  unidades_vendidas INT,\n`;
    sql += `  vendas_perdidas_ruptura INT,\n`;
    sql += `  market_share_pct DECIMAL(5,2),\n`;
    sql += `  estoque_final INT,\n`;
    sql += `  receita_bruta DECIMAL(12,2),\n`;
    sql += `  cmv DECIMAL(12,2),\n`;
    sql += `  lucro_bruto DECIMAL(12,2),\n`;
    sql += `  despesas_operacionais DECIMAL(12,2),\n`;
    sql += `  ebitda DECIMAL(12,2),\n`;
    sql += `  lucro_liquido DECIMAL(12,2),\n`;
    sql += `  caixa_final DECIMAL(12,2),\n`;
    sql += `  ativo_total DECIMAL(12,2),\n`;
    sql += `  passivo_total DECIMAL(12,2),\n`;
    sql += `  patrimonio_liquido DECIMAL(12,2),\n`;
    sql += `  credit_score INT,\n`;
    sql += `  credit_rating VARCHAR(5)\n`;
    sql += `);\n\n`;

    for (const row of data) {
      sql += `INSERT INTO fato_simulacao_aurora VALUES (\n`;
      sql += `  ${row.rodada}, ${row.ano}, ${row.trimestre}, '${row.equipeId}', '${row.empresaNome.replace(/'/g, "''")}', '${row.setor}', '${row.cnpj}',\n`;
      sql += `  ${row.precoPraticado}, ${row.investimentoMarketing}, ${row.demandaRecebida}, ${row.unidadesVendidas}, ${row.vendasPerdidasRuptura}, ${row.marketSharePct},\n`;
      sql += `  ${row.estoqueFinal}, ${row.receitaBruta}, ${row.cmv}, ${row.lucroBruto}, ${row.despesasOperacionaisTotal}, ${row.ebitda}, ${row.lucroLiquido},\n`;
      sql += `  ${row.caixaFinal}, ${row.ativoTotal}, ${row.passivoTotal}, ${row.patrimonioLiquido}, ${row.creditScore}, '${row.creditRating}'\n`;
      sql += `);\n`;
    }

    return sql;
  }

  /**
   * 5. API Endpoint para Power BI Web Connector
   */
  exportToAPIJSON(salaId, equipeId = null) {
    const data = this.getConsolidatedDataset(salaId, equipeId);
    return {
      sistema: 'Aurora Business Lab',
      versaoApi: '2031.1',
      salaId,
      equipeId: equipeId || 'todas',
      geradoEm: new Date().toISOString(),
      totalRegistros: data.length,
      dados: data
    };
  }

  // =========================================================================
  // ARQUITETURA DE DADOS DISTRIBUÍDA PARA MODELAGEM POWER BI (STAR SCHEMA)
  // =========================================================================

  /**
   * DOMÍNIO 1: Comercial & Vendas (Formato CSV)
   * Tabela Fato: fato_vendas
   * Chaves de Cruzamento: equipe_id, rodada
   */
  getVendasDataset(salaId, equipeId = null) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const todasEquipes = this.teamRepo.findBySala(salaId);
    const equipesAlvo = equipeId ? todasEquipes.filter(e => e.id === equipeId) : todasEquipes;
    const rows = [];

    for (const eq of equipesAlvo) {
      const resultados = this.roundRepo.getTeamResults(eq.id);
      for (const res of resultados) {
        rows.push({
          equipe_id: eq.id,
          rodada: res.rodada,
          preco_praticado: res.mercado.preco,
          investimento_marketing: res.mercado.marketing,
          demanda_recebida: res.mercado.demandaRecebida,
          unidades_vendidas: res.mercado.unidadesVendidas,
          vendas_perdidas_ruptura: res.mercado.vendasPerdidas,
          market_share_pct: res.mercado.marketShare,
          receita_bruta: res.dre.receitaBruta
        });
      }
    }
    return rows;
  }

  exportVendasCSV(salaId, equipeId = null) {
    const data = this.getVendasDataset(salaId, equipeId);
    if (data.length === 0) return '\uFEFF';
    const headers = Object.keys(data[0]);
    let csv = '\uFEFF' + headers.join(';') + '\r\n';
    for (const row of data) {
      const line = headers.map(h => {
        const val = row[h];
        if (typeof val === 'number') return String(val).replace('.', ',');
        return val !== undefined && val !== null ? val : '';
      }).join(';');
      csv += line + '\r\n';
    }
    return csv;
  }

  /**
   * DOMÍNIO 2: Operações, Logística & Estoque (Formato TXT / TSV)
   * Tabela Fato: fato_estoque
   * Chaves de Cruzamento: equipe_id, rodada
   */
  getEstoqueDataset(salaId, equipeId = null) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const todasEquipes = this.teamRepo.findBySala(salaId);
    const equipesAlvo = equipeId ? todasEquipes.filter(e => e.id === equipeId) : todasEquipes;
    const rows = [];

    for (const eq of equipesAlvo) {
      const resultados = this.roundRepo.getTeamResults(eq.id);
      for (const res of resultados) {
        rows.push({
          equipe_id: eq.id,
          rodada: res.rodada,
          estoque_inicial_unidades: res.estoque.estoqueInicial,
          entradas_estoque_unidades: res.estoque.totalEntradasUnidades,
          estoque_final_unidades: res.estoque.estoqueFinalUnidades,
          custo_medio_unitario_cmv: res.estoque.custoMedioUnitario,
          custo_armazenagem_total: res.estoque.custoArmazenagemTotal,
          perdas_obsolescencia_total: res.estoque.custoPerdasEstoque
        });
      }
    }
    return rows;
  }

  exportEstoqueTXT(salaId, equipeId = null) {
    const data = this.getEstoqueDataset(salaId, equipeId);
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    let txt = headers.join('\t') + '\r\n';
    for (const row of data) {
      const line = headers.map(h => {
        const val = row[h];
        return val !== undefined && val !== null ? String(val).replace(/\t/g, ' ') : '';
      }).join('\t');
      txt += line + '\r\n';
    }
    return txt;
  }

  /**
   * DOMÍNIO 3: Contabilidade & Livro-Razão (Formato SQL Script Relacional)
   * Tabelas Fato: fato_dre_contabil e fato_balanco_patrimonial
   * Chaves de Cruzamento: equipe_id, rodada
   */
  getContabilidadeDataset(salaId, equipeId = null) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const todasEquipes = this.teamRepo.findBySala(salaId);
    const equipesAlvo = equipeId ? todasEquipes.filter(e => e.id === equipeId) : todasEquipes;
    const dreRows = [];
    const balancoRows = [];

    for (const eq of equipesAlvo) {
      const resultados = this.roundRepo.getTeamResults(eq.id);
      for (const res of resultados) {
        dreRows.push({
          equipe_id: eq.id,
          rodada: res.rodada,
          receita_bruta: res.dre.receitaBruta,
          impostos_sobre_vendas: res.dre.impostosSobreVendas,
          receita_liquida: res.dre.receitaLiquida,
          cmv: res.dre.cmv,
          lucro_bruto: res.dre.lucroBruto,
          despesas_operacionais: res.dre.despesasOperacionais.total,
          ebitda: res.dre.ebitda,
          despesas_financeiras_juros: res.dre.despesasFinanceiras,
          lucro_liquido: res.dre.lucroLiquido,
          margem_bruta_pct: res.dre.margemBruta,
          margem_liquida_pct: res.dre.margemLiquida
        });

        balancoRows.push({
          equipe_id: eq.id,
          rodada: res.rodada,
          caixa_disponivel: res.balanco.ativo.circulante.caixa,
          estoque_valorizado: res.balanco.ativo.circulante.estoque,
          ativo_total: res.balanco.ativo.total,
          passivo_total: res.balanco.passivo.total,
          patrimonio_liquido: res.balanco.patrimonioLiquido.total,
          credit_score: res.credit.score,
          credit_rating: res.credit.rating
        });
      }
    }

    return { dreRows, balancoRows };
  }

  exportContabilidadeSQL(salaId, equipeId = null) {
    const { dreRows, balancoRows } = this.getContabilidadeDataset(salaId, equipeId);
    if (dreRows.length === 0) return '-- Nenhum dado contabil disponivel para exportacao\n';

    let sql = `-- ==========================================================\n`;
    sql += `-- AURORA BUSINESS LAB 2031 - ERP CONTABILIDADE & LIVRO-RAZAO\n`;
    sql += `-- Schema Relacional Contábil para Modelagem Star Schema no Power BI\n`;
    sql += `-- Chaves de Relacionamento: equipe_id, rodada\n`;
    sql += `-- ==========================================================\n\n`;

    // Tabela 1: DRE
    sql += `CREATE TABLE IF NOT EXISTS fato_dre_contabil (\n`;
    sql += `  equipe_id VARCHAR(50),\n`;
    sql += `  rodada INT,\n`;
    sql += `  receita_bruta DECIMAL(12,2),\n`;
    sql += `  impostos_sobre_vendas DECIMAL(12,2),\n`;
    sql += `  receita_liquida DECIMAL(12,2),\n`;
    sql += `  cmv DECIMAL(12,2),\n`;
    sql += `  lucro_bruto DECIMAL(12,2),\n`;
    sql += `  despesas_operacionais DECIMAL(12,2),\n`;
    sql += `  ebitda DECIMAL(12,2),\n`;
    sql += `  despesas_financeiras_juros DECIMAL(12,2),\n`;
    sql += `  lucro_liquido DECIMAL(12,2),\n`;
    sql += `  margem_bruta_pct DECIMAL(5,2),\n`;
    sql += `  margem_liquida_pct DECIMAL(5,2),\n`;
    sql += `  PRIMARY KEY (equipe_id, rodada)\n`;
    sql += `);\n\n`;

    for (const r of dreRows) {
      sql += `INSERT INTO fato_dre_contabil VALUES ('${r.equipe_id}', ${r.rodada}, ${r.receita_bruta}, ${r.impostos_sobre_vendas}, ${r.receita_liquida}, ${r.cmv}, ${r.lucro_bruto}, ${r.despesas_operacionais}, ${r.ebitda}, ${r.despesas_financeiras_juros}, ${r.lucro_liquido}, ${r.margem_bruta_pct}, ${r.margem_liquida_pct});\n`;
    }

    // Tabela 2: Balanço
    sql += `\nCREATE TABLE IF NOT EXISTS fato_balanco_patrimonial (\n`;
    sql += `  equipe_id VARCHAR(50),\n`;
    sql += `  rodada INT,\n`;
    sql += `  caixa_disponivel DECIMAL(12,2),\n`;
    sql += `  estoque_valorizado DECIMAL(12,2),\n`;
    sql += `  ativo_total DECIMAL(12,2),\n`;
    sql += `  passivo_total DECIMAL(12,2),\n`;
    sql += `  patrimonio_liquido DECIMAL(12,2),\n`;
    sql += `  credit_score INT,\n`;
    sql += `  credit_rating VARCHAR(5),\n`;
    sql += `  PRIMARY KEY (equipe_id, rodada)\n`;
    sql += `);\n\n`;

    for (const r of balancoRows) {
      sql += `INSERT INTO fato_balanco_patrimonial VALUES ('${r.equipe_id}', ${r.rodada}, ${r.caixa_disponivel}, ${r.estoque_valorizado}, ${r.ativo_total}, ${r.passivo_total}, ${r.patrimonio_liquido}, ${r.credit_score}, '${r.credit_rating}');\n`;
    }

    return sql;
  }

  /**
   * DOMÍNIO 4: Dimensão Cadastral de Empresas (Formato XLS / Excel)
   * Tabela Dimensão: dim_empresas
   * Chave Primária: equipe_id (1:N com as tabelas Fato)
   */
  getEmpresasDataset(salaId) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const todasEquipes = this.teamRepo.findBySala(salaId);
    return todasEquipes.map(e => ({
      equipe_id: e.id,
      cnpj: e.cnpj,
      empresa_nome: e.nome,
      slogan: e.slogan || '',
      setor: e.setor || 'Geral',
      rodada_fundacao: 1
    }));
  }

  exportEmpresasXLS(salaId) {
    const data = this.getEmpresasDataset(salaId);
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="dim_empresas">
  <Table>
   <Row ss:StyleID="Header">
    ${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('\n    ')}
   </Row>
`;

    for (const row of data) {
      xml += '   <Row>\n';
      for (const h of headers) {
        const val = row[h];
        xml += `    <Cell><Data ss:Type="String">${val !== undefined && val !== null ? String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</Data></Cell>\n`;
      }
      xml += '   </Row>\n';
    }

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
  }

  /**
   * DOMÍNIO 5: Inteligência Macroeconômica & Mercado Externo (Formato REST JSON API)
   * Tabela Dimensão / Fato Externa: dim_macroeconomia
   * Chave de Cruzamento: rodada (1:N com as tabelas Fato)
   * Conector Power BI: "Obter Dados → Da Web"
   */
  getMacroDataset(salaId) {
    const sala = this.roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    const macro = new MacroEconomy(sala.seed);
    const noticiasTodas = this.roundRepo.getRoomNews(salaId);

    const series = [];
    const maxRodada = sala.rodada_atual;

    for (let r = 1; r <= maxRodada; r++) {
      const macroR = macro.getRoundData(r);
      const noticiasR = noticiasTodas.filter(n => n.rodada_publicacao === r);

      series.push({
        rodada: r,
        ano: macroR.ano,
        trimestre: macroR.trimestre,
        ato_narrativa: macroR.ato.nome,
        selic_anual_pct: macroR.selic,
        selic_trimestral_pct: macroR.selicTrimestral,
        cambio_dolar_ptax: macroR.cambio,
        pib_crescimento_pct: macroR.pibCrescimento,
        inflacao_ipca_anual: macroR.inflacao,
        sazonalidade_fator: macroR.sazonalidade,
        salario_medio_regional: macroR.salarioMedio,
        aliquota_imposto_efetiva: macroR.aliquotaImposto,
        total_noticias_rodada: noticiasR.length
      });
    }

    return {
      sistema: 'Aurora Business Lab',
      modulo: 'Inteligencia Macroeconomica & Mercado Externo',
      salaId: sala.id,
      rodadaAtual: sala.rodada_atual,
      geradoEm: new Date().toISOString(),
      macroeconomia: series,
      noticias: noticiasTodas.filter(n => n.rodada_publicacao <= sala.rodada_atual).map(n => ({
        rodada_publicacao: n.rodada_publicacao,
        categoria: n.categoria,
        titulo: n.titulo,
        tipo_efeito: n.tipo_efeito,
        confiabilidade: n.confiabilidade,
        duracao_rodadas: n.duracao_rodadas
      }))
    };
  }

  exportMacroAPIJSON(salaId) {
    return this.getMacroDataset(salaId);
  }
}

