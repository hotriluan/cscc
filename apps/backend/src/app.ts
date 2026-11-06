import express from 'express';
import ExcelJS from 'exceljs';
import cors from 'cors';
import {
  calculateCoatingCostTable,
  calculateBomSummary,
  redactRevisionForRole,
  ReportFilterQuery,
  ReportSubTab,
  RevisionScopeFilter,
  RevisionStatus,
  UserRole
} from '@cscc/shared';
import { dataStore } from './store/data-store';
import {
  extractRoleMiddleware,
  requireCostAccessMiddleware,
  requireAdminMiddleware,
  requireStatusChangeAccessMiddleware
} from './middleware/auth-rbac.middleware';
import { signJwtToken } from './services/auth.service';
import {
  cloneRevision,
  updateRevisionStatus,
  getRevisionStatusHistory,
  RevisionStatusDomainError
} from './services/revision.service';
import { generateRevisionWorkbook } from './services/excel-exporter.service';
import { generateReportsOverview } from './services/report.service';
import { generateAnalyticsReportWorkbook } from './services/report-excel.service';
import { importMasterDataFromExcel } from './services/excel-importer.service';

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

  app.post('/api/auth/change-password', async (req, res) => {
    try {
      if (!req.authUser) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.'
        });
        return;
      }

      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '').trim();

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.'
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.'
        });
        return;
      }

      const result = await dataStore.changeUserPassword(
        req.authUser.sub,
        currentPassword,
        newPassword
      );

      if (!result.ok) {
        const status = result.error === 'USER_NOT_FOUND' ? 404 : 400;
        res.status(status).json({
          error: result.error,
          message: result.message
        });
        return;
      }

      res.json({
        updated: true,
        message: result.message || 'Đổi mật khẩu thành công!'
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Helper: Extract salesmanFilter for SALES and TECHNICAL roles
  const getSalesmanFilter = (req: express.Request): string | null => {
    if (req.userRole === 'ADMIN' || req.userRole === 'PROJECT_LEADER') {
      return null;
    }
    return req.salesmanName ?? null;
  };

  // Distinct salesmen list from Customers
  app.get('/api/auth/salesmen', async (_req, res) => {
    try {
      const salesmen = await dataStore.getDistinctSalesmen();
      res.json(salesmen);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/auth/users', requireAdminMiddleware, async (_req, res) => {
    try {
      const users = await dataStore.getUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/auth/users', requireAdminMiddleware, async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const fullName = String(req.body?.fullName || '').trim();
      const password = req.body?.password ? String(req.body.password) : undefined;
      const role = String(req.body?.role || 'TECHNICAL').toUpperCase() as UserRole;
      const salesmanName = req.body?.salesmanName !== undefined ? req.body.salesmanName : null;

      if (!email || !fullName) {
        res.status(400).json({ error: 'Email và Họ tên là bắt buộc.' });
        return;
      }

      if ((role === 'SALES' || role === 'TECHNICAL') && (!salesmanName || !String(salesmanName).trim())) {
        res.status(400).json({
          error: 'SALESMAN_REQUIRED',
          message: 'Vui lòng chọn Sales man phụ trách cho tài khoản Sales hoặc Technical.'
        });
        return;
      }

      const { user, created } = await dataStore.upsertUser({
        email,
        fullName,
        passwordPlain: password,
        role,
        salesmanName
      });
      res.status(created ? 201 : 200).json(user);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/auth/users/:id', requireAdminMiddleware, async (req, res) => {
    try {
      const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : undefined;
      const fullName = req.body?.fullName ? String(req.body.fullName).trim() : undefined;
      const password = req.body?.password ? String(req.body.password) : undefined;
      const role = req.body?.role ? (String(req.body.role).toUpperCase() as UserRole) : undefined;
      const salesmanName = req.body?.salesmanName !== undefined ? req.body.salesmanName : undefined;

      if (role && (role === 'SALES' || role === 'TECHNICAL')) {
        if (salesmanName !== undefined && (!salesmanName || !String(salesmanName).trim())) {
          res.status(400).json({
            error: 'SALESMAN_REQUIRED',
            message: 'Vui lòng chọn Sales man phụ trách cho tài khoản Sales hoặc Technical.'
          });
          return;
        }
      }

      const userId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const updated = await dataStore.updateUser(userId, {
        email,
        fullName,
        passwordPlain: password,
        role,
        salesmanName
      });
      if (!updated) {
        res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Tài khoản không tồn tại.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/auth/users/:id', requireAdminMiddleware, async (req, res) => {
    try {
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const result = await dataStore.deleteUser(userId);
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
      const salesmanFilter = getSalesmanFilter(req);
      const list = await dataStore.getCustomers(q, salesmanFilter);
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
      const salesmanFilter = getSalesmanFilter(req);
      const result = await dataStore.getCustomersPaginated({ q, page, pageSize, salesmanFilter });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/master/customers', async (req, res) => {
    try {
      const { customerId, shortName, customerName, salesmanName } = req.body;
      if (!customerId || !customerName) {
        res.status(400).json({ error: 'customerId and customerName are required' });
        return;
      }
      const { customer, created } = await dataStore.upsertCustomer({
        customerId: String(customerId),
        shortName: shortName ? String(shortName) : undefined,
        customerName: String(customerName),
        salesmanName:
          salesmanName !== undefined
            ? salesmanName
              ? String(salesmanName)
              : null
            : undefined
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
        sheet.addRow(['Short Name', 'Customer ID', 'Customer Name', 'Salesman Name']);
        sheet.addRow([
          'NITORI-HO CHI MINH',
          '1200001169',
          'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM',
          'Nguyễn Văn A'
        ]);
        sheet.columns = [
          { width: 28 },
          { width: 16 },
          { width: 50 },
          { width: 24 }
        ];
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

  app.delete('/api/master/customers', requireAdminMiddleware, async (_req, res) => {
    try {
      const count = await dataStore.clearAllCustomers();
      res.json({ deleted: true, count });
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
      const salesmanFilter = getSalesmanFilter(req);

      const list = await dataStore.getQuotations({ customerCode, q, limit, salesmanFilter });
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
      const salesmanFilter = getSalesmanFilter(req);

      const result = await dataStore.getQuotationsPaginated({
        customerCode,
        q,
        page,
        pageSize,
        salesmanFilter
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

      if (req.userRole === 'SALES') {
        const salesmanName = (req.salesmanName || '').trim();
        if (!salesmanName) {
          res.status(403).json({
            error: 'FORBIDDEN_SALESMAN_QUOTATION',
            message:
              'Tài khoản SALES chưa được gán Sales man phụ trách nên không được phép thêm hoặc cập nhật báo giá.'
          });
          return;
        }
        const invalidCustomerCodes = await dataStore.findUnauthorizedCustomerCodesForSalesman(
          [String(sapCustomerCode)],
          salesmanName
        );
        if (invalidCustomerCodes.length > 0) {
          res.status(403).json({
            error: 'FORBIDDEN_SALESMAN_QUOTATION',
            invalidCustomerCodes,
            message: `Tài khoản SALES (${salesmanName}) chỉ được phép thêm/cập nhật quotation của khách hàng có Sales man tương ứng. Mã khách hàng vi phạm: ${invalidCustomerCodes.join(', ')}.`
          });
          return;
        }
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

      if (req.userRole === 'SALES') {
        const salesmanName = (req.salesmanName || '').trim();
        if (!salesmanName) {
          res.status(403).json({
            error: 'FORBIDDEN_SALESMAN_QUOTATION',
            message:
              'Tài khoản SALES chưa được gán Sales man phụ trách nên không được phép upload quotation.'
          });
          return;
        }
        const customerCodes = imported.quotations.map((q) => q.sapCustomerCode);
        const invalidCustomerCodes = await dataStore.findUnauthorizedCustomerCodesForSalesman(
          customerCodes,
          salesmanName
        );
        if (invalidCustomerCodes.length > 0) {
          res.status(403).json({
            error: 'FORBIDDEN_SALESMAN_QUOTATION',
            invalidCustomerCodes,
            message: `Tài khoản SALES (${salesmanName}) chỉ được phép upload quotation của khách hàng có Sales man tương ứng. Phát hiện mã khách hàng không thuộc quyền phụ trách hoặc chưa tồn tại: ${invalidCustomerCodes.join(', ')}.`
          });
          return;
        }
      }

      const result = await dataStore.bulkUpsertQuotations(imported.quotations);
      res.json({ ...result, total: imported.quotations.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/master/quotations/:id', requireCostAccessMiddleware, async (req, res) => {
    try {
      const quotationId = String(req.params.id);
      if (req.userRole === 'SALES') {
        const salesmanName = (req.salesmanName || '').trim();
        if (!salesmanName) {
          res.status(403).json({
            error: 'FORBIDDEN_SALESMAN_QUOTATION',
            message:
              'Tài khoản SALES chưa được gán Sales man phụ trách nên không được phép cập nhật quotation.'
          });
          return;
        }
        const existing = await dataStore.getQuotationById(quotationId);
        if (!existing) {
          res.status(404).json({ error: 'Quotation not found' });
          return;
        }
        const codesToVerify = [
          existing.sapCustomerCode,
          ...(req.body?.sapCustomerCode !== undefined ? [String(req.body.sapCustomerCode)] : [])
        ];
        const invalidCustomerCodes = await dataStore.findUnauthorizedCustomerCodesForSalesman(
          codesToVerify,
          salesmanName
        );
        if (invalidCustomerCodes.length > 0) {
          res.status(403).json({
            error: 'FORBIDDEN_SALESMAN_QUOTATION',
            invalidCustomerCodes,
            message: `Tài khoản SALES (${salesmanName}) chỉ được phép cập nhật quotation của khách hàng có Sales man tương ứng. Mã khách hàng vi phạm: ${invalidCustomerCodes.join(', ')}.`
          });
          return;
        }
      }

      const updated = await dataStore.updateQuotation(quotationId, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Quotation not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/master/quotations', requireAdminMiddleware, async (_req, res) => {
    try {
      const count = await dataStore.clearAllQuotations();
      res.json({ deleted: true, count });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/master/quotations/:id', requireCostAccessMiddleware, async (req, res) => {
    try {
      const quotationId = String(req.params.id);
      if (req.userRole === 'SALES') {
        const salesmanName = (req.salesmanName || '').trim();
        if (!salesmanName) {
          res.status(403).json({
            error: 'FORBIDDEN_SALESMAN_QUOTATION',
            message:
              'Tài khoản SALES chưa được gán Sales man phụ trách nên không được phép xóa quotation.'
          });
          return;
        }
        const existing = await dataStore.getQuotationById(quotationId);
        if (existing) {
          const invalidCustomerCodes = await dataStore.findUnauthorizedCustomerCodesForSalesman(
            [existing.sapCustomerCode],
            salesmanName
          );
          if (invalidCustomerCodes.length > 0) {
            res.status(403).json({
              error: 'FORBIDDEN_SALESMAN_QUOTATION',
              invalidCustomerCodes,
              message: `Tài khoản SALES (${salesmanName}) chỉ được phép xóa quotation của khách hàng có Sales man tương ứng. Mã khách hàng vi phạm: ${invalidCustomerCodes.join(', ')}.`
            });
            return;
          }
        }
      }

      await dataStore.deleteQuotation(quotationId);
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

  // 6. Import Master Data from uploaded Excel (base64)
  app.post('/api/master/import-excel', async (req, res) => {
    try {
      const { fileBase64 } = req.body || {};
      if (!fileBase64) {
        res.status(400).json({
          error: 'MISSING_EXCEL_FILE',
          message: 'fileBase64 is required to import Excel master data'
        });
        return;
      }

      const source = Buffer.from(fileBase64, 'base64');
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
      const salesmanFilter = getSalesmanFilter(req);
      const projects = await dataStore.getProjects(salesmanFilter);
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

  // Update Revision Status (`DRAFT` | `APPROVED` | `INACTIVE`) — Restricted to PROJECT_LEADER & ADMIN
  app.patch(
    '/api/revisions/:id/status',
    requireStatusChangeAccessMiddleware,
    async (req, res) => {
      try {
        const revisionId = Array.isArray(req.params.id)
          ? req.params.id[0]
          : String(req.params.id);
        const status = String(req.body?.status || 'APPROVED').toUpperCase() as RevisionStatus;
        const note = typeof req.body?.note === 'string' ? req.body.note : '';

        const defaultNameByRole: Record<UserRole, string> = {
          PROJECT_LEADER: 'Nguyễn Văn Quản Lý (Project Leader)',
          ADMIN: 'Quản Trị Hệ Thống (System Admin)',
          SALES: 'Trần Thị Kinh Doanh (Sales)',
          TECHNICAL: 'Lê Văn Kỹ Thuật (Technical TA)'
        };

        const actor = {
          userId: req.authUser?.sub ?? null,
          fullName:
            req.authUser && req.authUser.role === req.userRole
              ? req.authUser.fullName
              : defaultNameByRole[req.userRole] || req.userRole,
          role: req.userRole
        };

        const updated = await updateRevisionStatus({
          revisionId,
          targetStatus: status,
          note,
          actor
        });
        res.json(redactRevisionForRole(updated, req.userRole));
      } catch (err) {
        if (err instanceof RevisionStatusDomainError) {
          res.status(err.httpStatus).json({
            error: err.code,
            message: err.message
          });
          return;
        }
        res.status(404).json({
          error: 'STATUS_UPDATE_FAILED',
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }
  );

  // Get Revision Status History Timeline
  app.get('/api/revisions/:id/status-history', async (req, res) => {
    try {
      const revisionId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : String(req.params.id);
      const rev = await dataStore.getRevisionById(revisionId);
      if (!rev) {
        res.status(404).json({ error: 'Revision not found' });
        return;
      }
      const history = await getRevisionStatusHistory(revisionId);
      res.json(history);
    } catch (err) {
      res.status(500).json({
        error: 'STATUS_HISTORY_FAILED',
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

  // =========================================================================
  // REPORTS & ANALYTICS SYSTEM (7 REPORTS + RBAC + REVISION SCOPE + EXCEL)
  // =========================================================================

  const parseReportQuery = (q: Record<string, unknown>): ReportFilterQuery => {
    const revScopeRaw = String(q.revisionScope || 'ALL')
      .trim()
      .toUpperCase();
    const revisionScope: RevisionScopeFilter =
      revScopeRaw === 'LATEST' || revScopeRaw === 'APPROVED' ? revScopeRaw : 'ALL';

    return {
      revisionScope,
      salesmanName: q.salesmanName ? String(q.salesmanName).trim() : undefined,
      customerId: q.customerId ? String(q.customerId).trim() : undefined,
      materialCode: q.materialCode ? String(q.materialCode).trim() : undefined,
      productName: q.productName ? String(q.productName).trim() : undefined,
      finishingSystem: q.finishingSystem ? String(q.finishingSystem).trim() : undefined,
      substrate: q.substrate ? String(q.substrate).trim() : undefined,
      q: q.q ? String(q.q).trim() : undefined,
      compareProjectId: q.compareProjectId ? String(q.compareProjectId).trim() : undefined,
      baseRevId: q.baseRevId ? String(q.baseRevId).trim() : undefined,
      targetRevId: q.targetRevId ? String(q.targetRevId).trim() : undefined
    };
  };

  const resolveEnforcedReportSalesman = (req: express.Request): string | null => {
    if (req.userRole === 'ADMIN' || req.userRole === 'PROJECT_LEADER') {
      return null;
    }
    if (
      req.authUser &&
      (req.authUser.role === 'SALES' || req.authUser.role === 'TECHNICAL')
    ) {
      const fromToken = (req.authUser.salesmanName || '').trim();
      return fromToken ? fromToken : '__NO_SALESMAN_ASSIGNED__';
    }
    const fromReq = (req.salesmanName || '').trim();
    if (fromReq && fromReq !== 'ALL') {
      return fromReq;
    }
    return null;
  };

  app.get('/api/reports/overview', async (req, res) => {
    try {
      const query = parseReportQuery(req.query as Record<string, unknown>);
      const enforcedSalesmanScope = resolveEnforcedReportSalesman(req);
      const overview = await generateReportsOverview({
        userRole: req.userRole,
        enforcedSalesmanScope,
        query
      });
      res.json(overview);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/reports/bom-forecast', async (req, res) => {
    try {
      const query = parseReportQuery((req.body?.query || {}) as Record<string, unknown>);
      const allocations = Array.isArray(req.body?.allocations)
        ? req.body.allocations
        : undefined;
      const enforcedSalesmanScope = resolveEnforcedReportSalesman(req);
      const overview = await generateReportsOverview({
        userRole: req.userRole,
        enforcedSalesmanScope,
        query,
        bomAllocations: allocations
      });
      res.json(overview.bomForecast);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/reports/export-excel', async (req, res) => {
    try {
      const query = parseReportQuery(req.query as Record<string, unknown>);
      const reportTabRaw = String(req.query.reportTab || 'ALL')
        .trim()
        .toUpperCase();
      const validTabs: ReportSubTab[] = [
        'PRODUCT_USAGE',
        'CUSTOMER_PORTFOLIO',
        'REVISION_VARIANCE',
        'PRICE_DRIFT',
        'STEP_BENCHMARK',
        'BOM_FORECAST',
        'ACTIVITY_FUNNEL'
      ];
      const reportTab: ReportSubTab | 'ALL' = validTabs.includes(
        reportTabRaw as ReportSubTab
      )
        ? (reportTabRaw as ReportSubTab)
        : 'ALL';

      const enforcedSalesmanScope = resolveEnforcedReportSalesman(req);
      const overview = await generateReportsOverview({
        userRole: req.userRole,
        enforcedSalesmanScope,
        query
      });
      const buffer = await generateAnalyticsReportWorkbook(
        overview,
        req.userRole,
        reportTab
      );

      const scopeTag = query.revisionScope || 'ALL';
      const filename = `CSCC_Analytics_${reportTab}_${scopeTag}_${req.userRole}.xlsx`;

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
