import express from 'express';
import ExcelJS from 'exceljs';
import cors from 'cors';
import {
  calculateCoatingCostTable,
  calculateBomSummary,
  redactRevisionForRole,
  RevisionStatus,
  UserRole
} from '@cscc/shared';
import { dataStore } from './store/data-store';
import {
  extractRoleMiddleware,
  requireCostAccessMiddleware
} from './middleware/auth-rbac.middleware';
import { signJwtToken } from './services/auth.service';
import { cloneRevision, updateRevisionStatus } from './services/revision.service';
import { generateRevisionWorkbook } from './services/excel-exporter.service';
import {
  importMasterDataFromExcel,
  resolveDefaultExcelPath
} from './services/excel-importer.service';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));
  app.use(extractRoleMiddleware);

  // Healthcheck
  app.get('/api/health', async (_req, res) => {
    try {
      const counts = await dataStore.getCounts();
      res.json({
        status: 'ok',
        database: 'postgresql',
        counts
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // =========================================================================
  // AUTHENTICATION & USER ACCOUNTS (PostgreSQL `User` Table + JWT)
  // =========================================================================

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) {
        res.status(400).json({ error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' });
        return;
      }

      const user = await dataStore.verifyUserCredentials(email, password);
      if (!user) {
        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không chính xác.'
        });
        return;
      }

      const token = signJwtToken(user);
      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Chưa đăng nhập hoặc phiên đã hết hạn.' });
        return;
      }
      const user = await dataStore.getUserById(req.authUser.sub);
      if (!user) {
        res.status(401).json({ error: 'USER_NOT_FOUND', message: 'Tài khoản không tồn tại.' });
        return;
      }
      res.json({ user });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/auth/users', async (_req, res) => {
    try {
      const users = await dataStore.getUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/auth/users', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const fullName = String(req.body?.fullName || '').trim();
      const password = req.body?.password ? String(req.body.password) : undefined;
      const role = String(req.body?.role || 'TECHNICAL').toUpperCase() as UserRole;

      if (!email || !fullName) {
        res.status(400).json({ error: 'Email và Họ tên là bắt buộc.' });
        return;
      }

      const { user, created } = await dataStore.upsertUser({
        email,
        fullName,
        passwordPlain: password,
        role
      });
      res.status(created ? 201 : 200).json(user);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/auth/users/:id', async (req, res) => {
    try {
      const result = await dataStore.deleteUser(req.params.id);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // =========================================================================
  // MASTER DATA CRUD & EXCEL IMPORT (PostgreSQL)
  // =========================================================================

  // 1. Customers
  app.get('/api/master/customers', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const list = await dataStore.getCustomers(q);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/master/customers/paged', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(Math.max(10, Number(req.query.pageSize) || 50), 500);
      const result = await dataStore.getCustomersPaginated({ q, page, pageSize });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/master/customers', async (req, res) => {
    try {
      const { customerId, shortName, customerName } = req.body;
      if (!customerId || !customerName) {
        res.status(400).json({ error: 'customerId and customerName are required' });
        return;
      }
      const { customer, created } = await dataStore.upsertCustomer({
        customerId: String(customerId),
        shortName: shortName ? String(shortName) : undefined,
        customerName: String(customerName)
      });
      res.status(created ? 201 : 200).json(customer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Upload templates (column layout matches excel-importer.service.ts)
  app.get('/api/master/templates/:type', async (req, res) => {
    try {
      const type = String(req.params.type);
      const workbook = new ExcelJS.Workbook();
      if (type === 'customers') {
        const sheet = workbook.addWorksheet('Customer');
        sheet.addRow(['Short Name', 'Customer ID', 'Customer Name']);
        sheet.addRow(['NITORI-HO CHI MINH', '1200001169', 'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM']);
        sheet.columns = [{ width: 28 }, { width: 16 }, { width: 50 }];
        sheet.getColumn(2).numFmt = '@';
      } else if (type === 'quotations') {
        const sheet = workbook.addWorksheet('quotation');
        sheet.addRow([
          'Sold-to code',
          'Customer Name',
          'SAP Material Code',
          'Material Description',
          'Cust & product key (tự tính, bỏ qua)',
          'Material Short Name (without pack)',
          'Packing',
          'Nett',
          'Pack Price',
          'Price/nett (VND)',
          'Valid From',
          'Valid To'
        ]);
        sheet.addRow([
          '1200001169',
          'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM',
          'PSV-76000',
          'PSV-76000 SB HC MY VN 20 Kg',
          '',
          'PSV-76000 SB HC MY VN',
          '20 Kg',
          20,
          10860000,
          543000,
          '',
          ''
        ]);
        sheet.columns = [
          { width: 16 }, { width: 40 }, { width: 20 }, { width: 32 }, { width: 22 },
          { width: 32 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 16 },
          { width: 12 }, { width: 12 }
        ];
        sheet.getColumn(1).numFmt = '@';
      } else {
        res.status(404).json({ error: 'Unknown template type' });
        return;
      }
      workbook.getWorksheet(1)!.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="template-${type}.xlsx"`);
      res.send(Buffer.from(buffer as ArrayBuffer));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/master/customers/import', async (req, res) => {
    try {
      const { fileBase64 } = req.body || {};
      if (!fileBase64) {
        res.status(400).json({ error: 'fileBase64 is required' });
        return;
      }
      const imported = await importMasterDataFromExcel(Buffer.from(fileBase64, 'base64'));
      const result = await dataStore.bulkUpsertCustomers(imported.customers);
      res.json({ ...result, total: imported.customers.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/master/customers/:id', async (req, res) => {
    try {
      const updated = await dataStore.updateCustomer(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/master/customers/:id', async (req, res) => {
    try {
      await dataStore.deleteCustomer(req.params.id);
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // 2. Quotations (Price redacted if role === TECHNICAL)
  app.get('/api/master/quotations', async (req, res) => {
    try {
      const customerCode = String(req.query.customerCode || '').trim();
      const q = String(req.query.q || '').trim();
      const limit = Math.min(Number(req.query.limit) || 500, 3000);

      const list = await dataStore.getQuotations({ customerCode, q, limit });
      const redacted = list.map((item) =>
        req.userRole === 'TECHNICAL' ? { ...item, priceUnitVnd: null } : item
      );
      res.json(redacted);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/master/quotations/paged', async (req, res) => {
    try {
      const customerCode = String(req.query.customerCode || '').trim();
      const q = String(req.query.q || '').trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(Math.max(10, Number(req.query.pageSize) || 50), 500);

      const result = await dataStore.getQuotationsPaginated({
        customerCode,
        q,
        page,
        pageSize
      });

      res.json({
        ...result,
        items: result.items.map((item) =>
          req.userRole === 'TECHNICAL' ? { ...item, priceUnitVnd: null } : item
        )
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/master/quotations', requireCostAccessMiddleware, async (req, res) => {
    try {
      const {
        sapCustomerCode,
        customerName,
        sapProductCode,
        materialCode,
        materialName,
        packingDesc,
        nett,
        priceUnitVnd
      } = req.body;
      if (!sapCustomerCode || !materialCode) {
        res.status(400).json({ error: 'sapCustomerCode and materialCode are required' });
        return;
      }
      const { quotation, created } = await dataStore.upsertQuotation({
        sapCustomerCode,
        customerName,
        sapProductCode,
        materialCode,
        materialName,
        packingDesc,
        nett,
        priceUnitVnd
      });
      res.status(created ? 201 : 200).json(quotation);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/master/quotations/import', requireCostAccessMiddleware, async (req, res) => {
    try {
      const { fileBase64 } = req.body || {};
      if (!fileBase64) {
        res.status(400).json({ error: 'fileBase64 is required' });
        return;
      }
      const imported = await importMasterDataFromExcel(Buffer.from(fileBase64, 'base64'));
      const result = await dataStore.bulkUpsertQuotations(imported.quotations);
      res.json({ ...result, total: imported.quotations.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/master/quotations/:id', requireCostAccessMiddleware, async (req, res) => {
    try {
      const updated = await dataStore.updateQuotation(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Quotation not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/master/quotations/:id', requireCostAccessMiddleware, async (req, res) => {
    try {
      await dataStore.deleteQuotation(String(req.params.id));
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // 3. Application Steps
  app.get('/api/master/steps', async (_req, res) => {
    try {
      const steps = await dataStore.getApplicationSteps();
      res.json(steps);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/master/steps', async (req, res) => {
    try {
      const stepName = String(req.body.stepName || '').trim().toUpperCase();
      if (!stepName) {
        res.status(400).json({ error: 'stepName is required' });
        return;
      }
      const { step, created } = await dataStore.upsertApplicationStep({
        stepName,
        sortOrder: req.body.sortOrder
      });
      res.status(created ? 201 : 200).json(step);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/master/steps/:id', async (req, res) => {
    try {
      const updated = await dataStore.updateApplicationStep(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Step not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/master/steps/:id', async (req, res) => {
    try {
      await dataStore.deleteApplicationStep(req.params.id);
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // 4. Application Methods (Efficiency %)
  app.get('/api/master/methods', async (_req, res) => {
    try {
      const methods = await dataStore.getApplicationMethods();
      res.json(methods);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/master/methods', async (req, res) => {
    try {
      const methodName = String(req.body.methodName || '').trim().toUpperCase();
      const efficiency = Number(req.body.efficiency);
      if (!methodName || !(efficiency > 0 && efficiency <= 1)) {
        res.status(400).json({ error: 'methodName and efficiency (0 < eff <= 1) are required' });
        return;
      }
      const { method, created } = await dataStore.upsertApplicationMethod({
        methodName,
        efficiency
      });
      res.status(created ? 201 : 200).json(method);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/master/methods/:id', async (req, res) => {
    try {
      const updated = await dataStore.updateApplicationMethod(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Method not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/master/methods/:id', async (req, res) => {
    try {
      await dataStore.deleteApplicationMethod(req.params.id);
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // 5. Packing Mappings
  app.get('/api/master/packings', async (_req, res) => {
    try {
      const packings = await dataStore.getPackingMappings();
      res.json(packings);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  const isValidPacking = (b: Record<string, unknown>) =>
    String(b.code || '').trim() !== '' &&
    ['KG', 'LTR', 'SET'].includes(String(b.unitType)) &&
    Number(b.nettWeight) > 0;

  app.post('/api/master/packings', async (req, res) => {
    try {
      if (!isValidPacking(req.body || {})) {
        res.status(400).json({
          error: 'code, unitType (KG|LTR|SET) và nettWeight (> 0) là bắt buộc'
        });
        return;
      }
      res.status(201).json(await dataStore.createPackingMapping(req.body));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/master/packings/:id', async (req, res) => {
    try {
      const b = req.body || {};
      if (
        (b.code !== undefined && !String(b.code).trim()) ||
        (b.unitType !== undefined && !['KG', 'LTR', 'SET'].includes(String(b.unitType))) ||
        (b.nettWeight !== undefined && !(Number(b.nettWeight) > 0))
      ) {
        res.status(400).json({ error: 'Dữ liệu packing không hợp lệ' });
        return;
      }
      const updated = await dataStore.updatePackingMapping(String(req.params.id), b);
      if (!updated) {
        res.status(404).json({ error: 'Packing not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/master/packings/:id', async (req, res) => {
    try {
      await dataStore.deletePackingMapping(String(req.params.id));
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // 6. Import Master Data from Excel (`docs/Form CS Industry.xlsx` or uploaded base64)
  app.post('/api/master/import-excel', async (req, res) => {
    try {
      const { fileBase64, resetGoldenProject } = req.body || {};
      if (resetGoldenProject) {
        const counts = await dataStore.init(true);
        res.json({
          imported: true,
          counts: {
            customers: counts.customers,
            quotations: counts.quotations,
            packingMappings: counts.packingMappings,
            applicationSteps: counts.applicationSteps,
            applicationMethods: counts.applicationMethods
          }
        });
        return;
      }

      const source = fileBase64
        ? Buffer.from(fileBase64, 'base64')
        : resolveDefaultExcelPath();
      const imported = await importMasterDataFromExcel(source);
      const counts = await dataStore.replaceMasterData(imported);

      res.json({
        imported: true,
        counts: {
          customers: counts.customers,
          quotations: counts.quotations,
          packingMappings: counts.packingMappings,
          applicationSteps: counts.applicationSteps,
          applicationMethods: counts.applicationMethods
        }
      });
    } catch (err) {
      res.status(500).json({
        error: 'EXCEL_IMPORT_FAILED',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // =========================================================================
  // PROJECTS & REVISIONS (CS, CC, BOM, VERSIONING, EXPORT)
  // =========================================================================

  app.get('/api/projects', async (req, res) => {
    try {
      const isTech = req.userRole === 'TECHNICAL';
      const projects = await dataStore.getProjects();
      const list = projects.map((p) => ({
        ...p,
        revisions: p.revisions.map((r) => ({
          ...r,
          totalCoatingCostDisplay: isTech ? null : r.totalCoatingCostDisplay
        }))
      }));
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const result = await dataStore.deleteProject(req.params.id);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/revisions/:id', async (req, res) => {
    try {
      const result = await dataStore.deleteRevision(req.params.id);
      if (!result.ok) {
        res.status(result.status || 400).json({ error: result.error });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const { project, revision } = await dataStore.createProject(req.body || {});
      res.status(201).json({
        project,
        revision: redactRevisionForRole(revision, req.userRole)
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Get Revision Detail (Redacts priceSnapshotVnd for TECHNICAL role)
  app.get('/api/revisions/:id', async (req, res) => {
    try {
      const rev = await dataStore.getRevisionById(req.params.id);
      if (!rev) {
        res.status(404).json({ error: 'Revision not found' });
        return;
      }
      res.json(redactRevisionForRole(rev, req.userRole));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update Revision Schedule (Header + Dynamic Steps)
  app.put('/api/revisions/:id', async (req, res) => {
    try {
      const result = await dataStore.updateRevision(req.params.id, req.body || {});
      if (!result.ok || !result.revision) {
        res.status(result.status || 400).json({
          error: result.error,
          ...(result.message ? { message: result.message } : {})
        });
        return;
      }

      const rev = result.revision;
      const redactedRevision = redactRevisionForRole(rev, req.userRole);
      const bomSummary = calculateBomSummary(
        rev.id,
        rev.defaultAreaM2,
        rev.steps,
        req.userRole
      );
      const costSummary =
        req.userRole === 'TECHNICAL'
          ? null
          : calculateCoatingCostTable(rev.id, rev.steps);

      res.json({
        revision: redactedRevision,
        costSummary,
        bomSummary
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get Coating Cost Summary (Protected by RBAC -> 403 for TECHNICAL)
  app.get('/api/revisions/:id/cost', requireCostAccessMiddleware, async (req, res) => {
    try {
      const rev = await dataStore.getRevisionById(String(req.params.id));
      if (!rev) {
        res.status(404).json({ error: 'Revision not found' });
        return;
      }
      const costSummary = calculateCoatingCostTable(rev.id, rev.steps);
      res.json(costSummary);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get BOM Summary
  app.get('/api/revisions/:id/bom', async (req, res) => {
    try {
      const rev = await dataStore.getRevisionById(req.params.id);
      if (!rev) {
        res.status(404).json({ error: 'Revision not found' });
        return;
      }
      const areaM2 = Number(req.query.areaM2) || 1;
      const bomSummary = calculateBomSummary(rev.id, areaM2, rev.steps, req.userRole);
      res.json(bomSummary);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Clone Revision (`Rev 00` -> `Rev 01`)
  app.post('/api/revisions/:id/clone', async (req, res) => {
    try {
      const refreshPrices = req.body?.refreshPrices !== false;
      const cloned = await cloneRevision(req.params.id, refreshPrices);
      res.status(201).json(redactRevisionForRole(cloned, req.userRole));
    } catch (err) {
      res.status(404).json({
        error: 'CLONE_FAILED',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Update Revision Status (`DRAFT` | `APPROVED` | `LOCKED`)
  app.patch('/api/revisions/:id/status', async (req, res) => {
    try {
      const status = String(req.body.status || 'LOCKED').toUpperCase() as RevisionStatus;
      const updated = await updateRevisionStatus(req.params.id, status);
      res.json(redactRevisionForRole(updated, req.userRole));
    } catch (err) {
      res.status(404).json({
        error: 'STATUS_UPDATE_FAILED',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Refresh Prices from Master Data
  app.post('/api/revisions/:id/refresh-prices', async (req, res) => {
    try {
      const result = await dataStore.refreshRevisionPrices(req.params.id);
      if (!result.ok || !result.revision) {
        res.status(result.status || 400).json({ error: result.error });
        return;
      }
      res.json(redactRevisionForRole(result.revision, req.userRole));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Export Excel (.xlsx) with Dynamic mergeCells & Live Formulas
  app.get('/api/revisions/:id/export-excel', async (req, res) => {
    try {
      const rev = await dataStore.getRevisionById(req.params.id);
      if (!rev) {
        res.status(404).json({ error: 'Revision not found' });
        return;
      }
      const areaM2 = Number(req.query.areaM2) || 1;
      const buffer = await generateRevisionWorkbook(rev, req.userRole, areaM2);
      const revCode = String(rev.revisionNo).padStart(2, '0');
      const safeCode = rev.projectCode.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeCode}_Rev${revCode}_${req.userRole}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
}
