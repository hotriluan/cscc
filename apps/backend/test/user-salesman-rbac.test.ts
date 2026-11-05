import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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
});
