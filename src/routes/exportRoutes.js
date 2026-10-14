/**
 * Rotas de Exportação e Conexão de Dados para Power BI e Excel
 * Aurora Business Lab - Porto Aurora 2031
 */

import { Router } from 'express';
import { DataExportService } from '../services/dataExportService.js';
import { RoomRepository } from '../repositories/roomRepository.js';

export function createExportRoutes() {
  const router = Router();
  const exportService = new DataExportService();
  const roomRepo = new RoomRepository();

  // Validador de acesso à sala
  function validarAcesso(req, salaId) {
    const sala = roomRepo.findById(salaId);
    if (!sala) throw new Error('Sala não encontrada.');

    // Permite via sessão OU via token de integração na query string (?token=...)
    const token = req.query.token;
    const isSessionAuth = req.session && req.session.user;

    if (!isSessionAuth && (!token || token !== sala.seed)) {
      throw new Error('Não autorizado. Forneça o token de integração da sala ou faça login.');
    }

    return sala;
  }

  // 1. Download CSV
  router.get('/:salaId/csv', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const csv = exportService.exportToCSV(salaId, equipeId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aurora_dados_r${Date.now()}.csv"`);
      res.send(csv);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // 2. Download XLS (Excel Nativo)
  router.get('/:salaId/xls', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const xls = exportService.exportToXLS(salaId, equipeId);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aurora_dados_r${Date.now()}.xls"`);
      res.send(xls);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // 3. Download TXT (TSV Delimitado)
  router.get('/:salaId/txt', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const txt = exportService.exportToTXT(salaId, equipeId);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aurora_dados_r${Date.now()}.txt"`);
      res.send(txt);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // 4. Download SQL Script
  router.get('/:salaId/sql', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const sql = exportService.exportToSQL(salaId, equipeId);
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aurora_dados_dump_r${Date.now()}.sql"`);
      res.send(sql);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // 5. Endpoint de API para o Power BI Web Connector (com suporte a Refresh)
  router.get('/:salaId/powerbi', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const json = exportService.exportToAPIJSON(salaId, equipeId);
      res.json(json);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // =========================================================================
  // ROTAS DE DADOS PARTICIONADOS POR DOMÍNIO PARA MODELAGEM POWER BI
  // =========================================================================

  // Domínio 1: Comercial & Vendas em CSV
  router.get('/:salaId/vendas/csv', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const csv = exportService.exportVendasCSV(salaId, equipeId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="fato_vendas_comercial_r${Date.now()}.csv"`);
      res.send(csv);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // Domínio 2: Operações & Estoque em TXT (TSV)
  router.get('/:salaId/estoque/txt', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const txt = exportService.exportEstoqueTXT(salaId, equipeId);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="fato_estoque_operacoes_r${Date.now()}.txt"`);
      res.send(txt);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // Domínio 3: Contabilidade & DRE/Balanço em SQL Script
  router.get('/:salaId/contabilidade/sql', (req, res) => {
    try {
      const { salaId } = req.params;
      const { equipeId } = req.query;
      validarAcesso(req, salaId);

      const sql = exportService.exportContabilidadeSQL(salaId, equipeId);
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="fato_contabilidade_erp_r${Date.now()}.sql"`);
      res.send(sql);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // Domínio 4: Dimensão Empresas em XLS
  router.get('/:salaId/empresas/xls', (req, res) => {
    try {
      const { salaId } = req.params;
      validarAcesso(req, salaId);

      const xls = exportService.exportEmpresasXLS(salaId);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dim_empresas_mercado_r${Date.now()}.xls"`);
      res.send(xls);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  // Domínio 5: Dimensão Macroeconomia & Notícias via Web API (JSON REST com suporte a Refresh)
  router.get('/:salaId/macro/api', (req, res) => {
    try {
      const { salaId } = req.params;
      validarAcesso(req, salaId);

      const json = exportService.exportMacroAPIJSON(salaId);
      res.json(json);
    } catch (err) {
      res.status(403).json({ sucesso: false, erro: err.message });
    }
  });

  return router;
}
