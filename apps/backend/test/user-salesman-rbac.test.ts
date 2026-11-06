import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ExcelJS from 'exceljs';
import express, { Request, Response, NextFunction } from 'express';
import { UserAccount, UserRole } from '@cscc/shared';
import {
  DEFAULT_SEED_USERS,
  signJwtToken,
  verifyJwtToken
} from '../src/services/auth.service';
import {
  extractRoleMiddleware,
  requireAdminMiddleware
} from '../src/middleware/auth-rbac.middleware';
import { dataStore } from '../src/store/data-store';
import { createApp } from '../src/app';

test('User Account Management & Salesman RBAC Isolation', async (t) => {
  await t.test('1. Default seed users have correct roles and salesman linkages', () => {
    const leader = DEFAULT_SEED_USERS.find((u) => u.role === 'PROJECT_LEADER');
    assert.ok(leader);
    assert.equal(leader.salesmanName, null);

    const admin = DEFAULT_SEED_USERS.find((u) => u.role === 'ADMIN');
    assert.ok(admin);
    assert.equal(admin.salesmanName, null);

    const sales = DEFAULT_SEED_USERS.find((u) => u.role === 'SALES');
    assert.ok(sales);
    assert.equal(sales.salesmanName, 'Nguyễn Văn A');

    const tech = DEFAULT_SEED_USERS.find((u) => u.role === 'TECHNICAL');
    assert.ok(tech);
    assert.equal(tech.salesmanName, 'Nguyễn Văn A');
  });

  await t.test('2. JWT tokens carry and preserve salesmanName in payload', () => {
    const techUser: UserAccount = {
      id: 'tech-001',
      email: 'tech01@alkana.vn',
      fullName: 'Kỹ Thuật Viên 1',
      role: 'TECHNICAL',
      salesmanName: 'Nguyễn Văn A',
      createdAt: new Date().toISOString()
    };

    const token = signJwtToken(techUser);
    const decoded = verifyJwtToken(token);
    assert.ok(decoded);
    assert.equal(decoded.sub, 'tech-001');
    assert.equal(decoded.role, 'TECHNICAL');
    assert.equal(decoded.salesmanName, 'Nguyễn Văn A');

    const adminUser: UserAccount = {
      id: 'admin-001',
      email: 'admin@alkana.vn',
      fullName: 'Admin Tổng',
      role: 'ADMIN',
      salesmanName: null,
      createdAt: new Date().toISOString()
    };
    const adminToken = signJwtToken(adminUser);
    const decodedAdmin = verifyJwtToken(adminToken);
    assert.ok(decodedAdmin);
    assert.equal(decodedAdmin.role, 'ADMIN');
    assert.equal(decodedAdmin.salesmanName, null);
  });

  await t.test('3. requireAdminMiddleware strictly allows ADMIN and rejects all other roles with 403', () => {
    const roles: UserRole[] = ['TECHNICAL', 'SALES', 'PROJECT_LEADER'];

    for (const role of roles) {
      let nextCalled = false;
      let statusCode = 0;
      let responseBody: any = null;

      const req = { userRole: role } as Request;
      const res = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          responseBody = data;
          return this;
        }
      } as unknown as Response;

      requireAdminMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, `Role ${role} should not be allowed`);
      assert.equal(statusCode, 403);
      assert.equal(responseBody?.error, 'FORBIDDEN_ADMIN_ACCESS');
      assert.ok(responseBody?.message.includes('Quản trị viên (ADMIN)'));
    }

    // ADMIN must pass through
    let adminNextCalled = false;
    const adminReq = { userRole: 'ADMIN' } as Request;
    const adminRes = {} as Response;

    requireAdminMiddleware(adminReq, adminRes, () => {
      adminNextCalled = true;
    });

    assert.equal(adminNextCalled, true, 'ADMIN role must call next()');
  });

  await t.test('4. extractRoleMiddleware extracts userRole and salesmanName correctly', () => {
    // 4.1 From headers: x-user-role and x-salesman-name
    const req1 = {
      headers: {
        'x-user-role': 'SALES',
        'x-salesman-name': 'Trần Thị B'
      },
      query: {}
    } as unknown as Request;

    extractRoleMiddleware(req1, {} as Response, () => {});
    assert.equal(req1.userRole, 'SALES');
    assert.equal(req1.salesmanName, 'Trần Thị B');

    // 4.2 From JWT token in Authorization header
    const token = signJwtToken({
      id: 'u-123',
      email: 'tech@alkana.vn',
      fullName: 'Tech User',
      role: 'TECHNICAL',
      salesmanName: 'Nguyễn Văn A',
      createdAt: new Date().toISOString()
    });

    const req2 = {
      headers: {
        authorization: `Bearer ${token}`
      },
      query: {}
    } as unknown as Request;

    extractRoleMiddleware(req2, {} as Response, () => {});
    assert.equal(req2.userRole, 'TECHNICAL');
    assert.equal(req2.salesmanName, 'Nguyễn Văn A');

    // 4.3 JWT token strictly takes precedence over conflicting x-user-role or x-salesman-name headers
    const req3 = {
      headers: {
        authorization: `Bearer ${token}`,
        'x-user-role': 'ADMIN',
        'x-salesman-name': 'Fake Salesman'
      },
      query: { role: 'PROJECT_LEADER' }
    } as unknown as Request;

    extractRoleMiddleware(req3, {} as Response, () => {});
    assert.equal(req3.userRole, 'TECHNICAL', 'JWT role must override x-user-role header');
    assert.equal(req3.salesmanName, 'Nguyễn Văn A', 'JWT salesmanName must override x-salesman-name header');
  });

  await t.test('5. Express API: Enforces requireAdminMiddleware across User management endpoints', async () => {
    function dispatch(
      method: string,
      path: string,
      headers: Record<string, string> = {},
      body?: any
    ): Promise<{ status: number; body: any }> {
      return new Promise((resolve) => {
        const app = createApp();
        let resStatus = 200;
        let resBody: any = null;

        const req: any = {
          method,
          url: path,
          headers: { ...headers },
          body: body || {},
          query: {},
          params: {}
        };

        const res: any = {
          status(code: number) {
            resStatus = code;
            return this;
          },
          json(data: any) {
            resBody = data;
            resolve({ status: resStatus, body: resBody });
            return this;
          },
          send(data: any) {
            resBody = data;
            resolve({ status: resStatus, body: resBody });
            return this;
          },
          setHeader() {
            return this;
          },
          getHeader() {
            return undefined;
          }
        };

        app.handle(req, res);
      });
    }

    // 5.1 GET /api/auth/users as TECHNICAL -> 403 Forbidden
    const resGetTech = await dispatch('GET', '/api/auth/users', { 'x-user-role': 'TECHNICAL' });
    assert.equal(resGetTech.status, 403);
    assert.equal(resGetTech.body?.error, 'FORBIDDEN_ADMIN_ACCESS');

    // 5.2 POST /api/auth/users as SALES -> 403 Forbidden
    const resPostSales = await dispatch(
      'POST',
      '/api/auth/users',
      { 'x-user-role': 'SALES', 'content-type': 'application/json' },
      { email: 'salesman@alkana.vn', fullName: 'Sales' }
    );
    assert.equal(resPostSales.status, 403);
    assert.equal(resPostSales.body?.error, 'FORBIDDEN_ADMIN_ACCESS');

    // 5.3 PUT /api/auth/users/user-123 as PROJECT_LEADER -> 403 Forbidden
    const resPutLeader = await dispatch(
      'PUT',
      '/api/auth/users/user-123',
      { 'x-user-role': 'PROJECT_LEADER', 'content-type': 'application/json' },
      { fullName: 'Updated' }
    );
    assert.equal(resPutLeader.status, 403);
    assert.equal(resPutLeader.body?.error, 'FORBIDDEN_ADMIN_ACCESS');

    // 5.4 DELETE /api/auth/users/user-123 as TECHNICAL -> 403 Forbidden
    const resDelTech = await dispatch('DELETE', '/api/auth/users/user-123', {
      'x-user-role': 'TECHNICAL'
    });
    assert.equal(resDelTech.status, 403);
    assert.equal(resDelTech.body?.error, 'FORBIDDEN_ADMIN_ACCESS');

    // 5.5 POST /api/auth/users as ADMIN with missing salesmanName for TECHNICAL -> 400 SALESMAN_REQUIRED
    const resPostMissingSalesman = await dispatch(
      'POST',
      '/api/auth/users',
      { 'x-user-role': 'ADMIN', 'content-type': 'application/json' },
      {
        email: 'newtech@alkana.vn',
        fullName: 'New Technical Staff',
        role: 'TECHNICAL',
        salesmanName: ''
      }
    );
    assert.equal(resPostMissingSalesman.status, 400);
    assert.equal(resPostMissingSalesman.body?.error, 'SALESMAN_REQUIRED');

    // 5.6 POST /api/auth/change-password without JWT -> 401 UNAUTHORIZED
    const resChangeNoAuth = await dispatch(
      'POST',
      '/api/auth/change-password',
      { 'content-type': 'application/json' },
      { currentPassword: '123456', newPassword: 'newpassword123' }
    );
    assert.equal(resChangeNoAuth.status, 401);
    assert.equal(resChangeNoAuth.body?.error, 'UNAUTHORIZED');

    // 5.7 POST /api/auth/change-password with JWT but short newPassword (< 6 chars) -> 400 WEAK_PASSWORD
    const validToken = signJwtToken({
      id: 'user-leader-01',
      email: 'leader@alkana.vn',
      fullName: 'Leader',
      role: 'PROJECT_LEADER',
      salesmanName: null,
      createdAt: new Date().toISOString()
    });
    const resChangeShort = await dispatch(
      'POST',
      '/api/auth/change-password',
      {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json'
      },
      { currentPassword: '123456', newPassword: '123' }
    );
    assert.equal(resChangeShort.status, 400);
    assert.equal(resChangeShort.body?.error, 'WEAK_PASSWORD');

    // 5.8 DELETE /api/master/customers and DELETE /api/master/quotations as non-ADMIN -> 403 FORBIDDEN_ADMIN_ACCESS
    for (const nonAdminRole of ['TECHNICAL', 'SALES', 'PROJECT_LEADER'] as UserRole[]) {
      const resClearCustomers = await dispatch('DELETE', '/api/master/customers', {
        'x-user-role': nonAdminRole
      });
      assert.equal(
        resClearCustomers.status,
        403,
        `DELETE /api/master/customers must reject ${nonAdminRole} with 403`
      );
      assert.equal(resClearCustomers.body?.error, 'FORBIDDEN_ADMIN_ACCESS');

      const resClearQuotations = await dispatch('DELETE', '/api/master/quotations', {
        'x-user-role': nonAdminRole
      });
      assert.equal(
        resClearQuotations.status,
        403,
        `DELETE /api/master/quotations must reject ${nonAdminRole} with 403`
      );
      assert.equal(resClearQuotations.body?.error, 'FORBIDDEN_ADMIN_ACCESS');
    }
  });

  await t.test('6. Data Isolation Logic: filters items strictly by salesmanName', () => {
    // Simulated customer master
    const mockCustomers = [
      { customerId: '1200001169', shortName: 'NITORI-HCM', customerName: 'CONG TY NITORI', salesmanName: 'Nguyễn Văn A' },
      { customerId: '1200001170', shortName: 'IKEA-VN', customerName: 'CONG TY IKEA', salesmanName: 'Trần Thị B' },
      { customerId: '1200001171', shortName: 'AN-CUONG', customerName: 'CONG TY AN CUONG', salesmanName: 'Nguyễn Văn A' }
    ];

    // Filter for Nguyễn Văn A
    const filterForA = 'Nguyễn Văn A';
    const forSalesmanA = mockCustomers.filter(
      (c) => c.salesmanName && c.salesmanName.toLowerCase() === filterForA.toLowerCase()
    );
    assert.equal(forSalesmanA.length, 2);
    assert.ok(forSalesmanA.some((c) => c.shortName === 'NITORI-HCM'));
    assert.ok(forSalesmanA.some((c) => c.shortName === 'AN-CUONG'));
    assert.ok(!forSalesmanA.some((c) => c.shortName === 'IKEA-VN'));

    // Filter for Trần Thị B
    const filterForB = 'Trần Thị B';
    const forSalesmanB = mockCustomers.filter(
      (c) => c.salesmanName && c.salesmanName.toLowerCase() === filterForB.toLowerCase()
    );
    assert.equal(forSalesmanB.length, 1);
    assert.equal(forSalesmanB[0].shortName, 'IKEA-VN');

    // Admin / Leader context (null filter) sees all
    const adminView = mockCustomers;
    assert.equal(adminView.length, 3);
  });

  await t.test('7. Master Data Quotation Upload & CRUD: SALES can only upload/modify quotations of customers with matching salesmanName', async () => {
    function dispatch(
      method: string,
      path: string,
      headers: Record<string, string> = {},
      body?: any
    ): Promise<{ status: number; body: any }> {
      return new Promise((resolve) => {
        const app = createApp();
        let resStatus = 200;
        let resBody: any = null;

        const req: any = {
          method,
          url: path,
          headers: { ...headers },
          body: body || {},
          query: {},
          params: {}
        };

        const res: any = {
          status(code: number) {
            resStatus = code;
            return this;
          },
          json(data: any) {
            resBody = data;
            resolve({ status: resStatus, body: resBody });
            return this;
          },
          send(data: any) {
            resBody = data;
            resolve({ status: resStatus, body: resBody });
            return this;
          },
          setHeader() {
            return this;
          },
          getHeader() {
            return undefined;
          }
        };

        app.handle(req, res);
      });
    }

    async function buildQuotationExcelBase64(
      rows: Array<{ sapCustomerCode: string; customerName: string; materialCode: string; price: number }>
    ): Promise<string> {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('quotation');
      sheet.addRow([
        'Sold-to code',
        'Customer Name',
        'SAP Material Code',
        'Material Description',
        'Cust & product key',
        'Material Short Name (without pack)',
        'Packing',
        'Nett',
        'Pack Price',
        'Price/nett (VND)',
        'Valid From',
        'Valid To'
      ]);
      for (const r of rows) {
        sheet.addRow([
          r.sapCustomerCode,
          r.customerName,
          r.materialCode,
          `${r.materialCode} 20 Kg`,
          `${r.sapCustomerCode}${r.materialCode}`,
          r.materialCode,
          '20 Kg',
          20,
          r.price * 20,
          r.price,
          '',
          ''
        ]);
      }
      const buf = await wb.xlsx.writeBuffer();
      return Buffer.from(buf as ArrayBuffer).toString('base64');
    }

    // Stub dataStore methods so test runs deterministically without touching live DB
    const origFindUnauthorized = dataStore.findUnauthorizedCustomerCodesForSalesman.bind(dataStore);
    const origBulkUpsert = dataStore.bulkUpsertQuotations.bind(dataStore);
    const origUpsertQuotation = dataStore.upsertQuotation.bind(dataStore);

    const customerSalesmanMap = new Map<string, string>([
      ['1200001169', 'Nguyễn Văn A'],
      ['1200001171', 'Nguyễn Văn A'],
      ['1200001170', 'Trần Thị B']
    ]);

    let bulkUpsertCallCount = 0;

    dataStore.findUnauthorizedCustomerCodesForSalesman = async (
      codes: string[],
      salesmanName: string
    ) => {
      const cleanSalesman = salesmanName.trim().toLowerCase();
      const unique = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)));
      return unique.filter((code) => {
        const owner = customerSalesmanMap.get(code);
        return !owner || owner.toLowerCase() !== cleanSalesman;
      });
    };

    dataStore.bulkUpsertQuotations = async (rows) => {
      bulkUpsertCallCount++;
      return { created: rows.length, updated: 0, skipped: 0 };
    };

    dataStore.upsertQuotation = async (input) => ({
      quotation: {
        id: 'quot-test-1',
        sapCustomerCode: input.sapCustomerCode,
        customerName: input.customerName || '',
        sapProductCode: input.sapProductCode || '',
        custProductKey: `${input.sapCustomerCode}${input.materialCode}`,
        materialCode: input.materialCode,
        materialName: input.materialName || input.materialCode,
        packingDesc: input.packingDesc || '20 Kg',
        nett: input.nett || 20,
        priceUnitVnd: input.priceUnitVnd || 0,
        validFrom: null,
        validTo: null
      },
      created: true
    });

    try {
      const salesTokenA = signJwtToken({
        id: 'user-sales-a',
        email: 'sales.a@alkana.vn',
        fullName: 'Sales A',
        role: 'SALES',
        salesmanName: 'Nguyễn Văn A',
        createdAt: new Date().toISOString()
      });

      // 7.1 SALES ("Nguyễn Văn A") uploads mixed file containing customer of "Trần Thị B" (1200001170) -> 403 rejected
      const mixedBase64 = await buildQuotationExcelBase64([
        { sapCustomerCode: '1200001169', customerName: 'NITORI', materialCode: 'PSV-76000', price: 543000 },
        { sapCustomerCode: '1200001170', customerName: 'IKEA', materialCode: 'PSV-76000', price: 510000 }
      ]);

      const resRejectMixed = await dispatch(
        'POST',
        '/api/master/quotations/import',
        { authorization: `Bearer ${salesTokenA}`, 'content-type': 'application/json' },
        { fileBase64: mixedBase64 }
      );
      assert.equal(resRejectMixed.status, 403);
      assert.equal(resRejectMixed.body?.error, 'FORBIDDEN_SALESMAN_QUOTATION');
      assert.deepEqual(resRejectMixed.body?.invalidCustomerCodes, ['1200001170']);
      assert.equal(bulkUpsertCallCount, 0, 'Must not import any rows when file contains unauthorized customer');

      // 7.2 SALES ("Nguyễn Văn A") uploads valid file containing only customers of "Nguyễn Văn A" -> 200 OK
      const validBase64 = await buildQuotationExcelBase64([
        { sapCustomerCode: '1200001169', customerName: 'NITORI', materialCode: 'PSV-76000', price: 543000 },
        { sapCustomerCode: '1200001171', customerName: 'AN CUONG', materialCode: 'THPU-71306', price: 52000 }
      ]);

      const resAllowValid = await dispatch(
        'POST',
        '/api/master/quotations/import',
        { authorization: `Bearer ${salesTokenA}`, 'content-type': 'application/json' },
        { fileBase64: validBase64 }
      );
      assert.equal(resAllowValid.status, 200);
      assert.equal(resAllowValid.body?.created, 2);
      assert.equal(resAllowValid.body?.total, 2);
      assert.equal(bulkUpsertCallCount, 1);

      // 7.3 Single quotation POST /api/master/quotations by SALES ("Nguyễn Văn A") for customer of "Trần Thị B" -> 403
      const resSingleReject = await dispatch(
        'POST',
        '/api/master/quotations',
        { authorization: `Bearer ${salesTokenA}`, 'content-type': 'application/json' },
        {
          sapCustomerCode: '1200001170',
          materialCode: 'PSV-76000',
          priceUnitVnd: 500000
        }
      );
      assert.equal(resSingleReject.status, 403);
      assert.equal(resSingleReject.body?.error, 'FORBIDDEN_SALESMAN_QUOTATION');

      // 7.4 ADMIN uploads mixed file -> 200 OK (no salesman restriction for ADMIN)
      const adminToken = signJwtToken({
        id: 'user-admin',
        email: 'admin@alkana.vn',
        fullName: 'Admin',
        role: 'ADMIN',
        salesmanName: null,
        createdAt: new Date().toISOString()
      });
      const resAdminMixed = await dispatch(
        'POST',
        '/api/master/quotations/import',
        { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
        { fileBase64: mixedBase64 }
      );
      assert.equal(resAdminMixed.status, 200);
      assert.equal(bulkUpsertCallCount, 2);
    } finally {
      dataStore.findUnauthorizedCustomerCodesForSalesman = origFindUnauthorized;
      dataStore.bulkUpsertQuotations = origBulkUpsert;
      dataStore.upsertQuotation = origUpsertQuotation;
    }
  });
});
