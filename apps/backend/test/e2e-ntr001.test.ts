import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ExcelJS from 'exceljs';
import { createApp } from '../src/app';
import { dataStore } from '../src/store/data-store';

describe('CSCC Backend E2E Verification — Golden Dataset NTR 001, RBAC & Dynamic Excel Export', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    await dataStore.init(true);
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4099;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) server.close();
    await dataStore.disconnect();
  });

  it('imports all 5 Master Data sheets from docs/Form CS Industry.xlsx into PostgreSQL', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      status: string;
      database: string;
      counts: Record<string, number>;
    };
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'postgresql');
    assert.ok(body.counts.users >= 4, `Expected >=4 seeded users, got ${body.counts.users}`);
    assert.ok(body.counts.customers >= 500, `Expected >=500 customers, got ${body.counts.customers}`);
    assert.ok(body.counts.quotations >= 2500, `Expected >=2500 quotations, got ${body.counts.quotations}`);
    assert.ok(body.counts.packingMappings >= 30);
    assert.ok(body.counts.applicationSteps >= 7);
    assert.equal(body.counts.applicationMethods, 2);
  });

  it('authenticates users against PostgreSQL User table (JWT) and enforces RBAC from Bearer token', async () => {
    // 1. Login as TECHNICAL user (tech@alkana.vn)
    const techLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tech@alkana.vn', password: '123456' })
    });
    assert.equal(techLoginRes.status, 200);
    const techSession = (await techLoginRes.json()) as {
      token: string;
      user: { email: string; role: string };
    };
    assert.equal(techSession.user.email, 'tech@alkana.vn');
    assert.equal(techSession.user.role, 'TECHNICAL');
    assert.ok(techSession.token.length > 20);

    // 2. Verify /api/auth/me with Bearer token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${techSession.token}` }
    });
    assert.equal(meRes.status, 200);
    const meBody = (await meRes.json()) as { user: { email: string; role: string } };
    assert.equal(meBody.user.role, 'TECHNICAL');

    // 3. Using only Bearer token (without x-user-role header), TECHNICAL is blocked from /cost (403)
    const costRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/cost`, {
      headers: { Authorization: `Bearer ${techSession.token}` }
    });
    assert.equal(costRes.status, 403);
  });

  it('supports server-side paginated & filtered Customers and Quotations from PostgreSQL', async () => {
    const custPagedRes = await fetch(
      `${baseUrl}/api/master/customers/paged?q=NITORI&page=1&pageSize=10`,
      { headers: { 'x-user-role': 'PROJECT_LEADER' } }
    );
    assert.equal(custPagedRes.status, 200);
    const custPaged = (await custPagedRes.json()) as {
      items: Array<{ customerId: string; shortName: string }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    assert.ok(custPaged.total >= 1);
    assert.equal(custPaged.page, 1);
    assert.ok(custPaged.items.some((c) => c.customerId === '1200001169'));

    const quotPagedRes = await fetch(
      `${baseUrl}/api/master/quotations/paged?customerCode=1200001169&page=1&pageSize=10`,
      { headers: { 'x-user-role': 'TECHNICAL' } }
    );
    assert.equal(quotPagedRes.status, 200);
    const quotPaged = (await quotPagedRes.json()) as {
      items: Array<{ sapCustomerCode: string; priceUnitVnd: number | null }>;
      total: number;
      page: number;
    };
    assert.ok(quotPaged.total >= 2);
    assert.ok(quotPaged.items.length >= 2);
    for (const item of quotPaged.items) {
      assert.equal(item.sapCustomerCode, '1200001169');
      assert.equal(item.priceUnitVnd, null); // Redacted for TECHNICAL
    }

    const allQuotPagedRes = await fetch(
      `${baseUrl}/api/master/quotations/paged?page=1&pageSize=25`,
      { headers: { 'x-user-role': 'PROJECT_LEADER' } }
    );
    assert.equal(allQuotPagedRes.status, 200);
    const allQuotPaged = (await allQuotPagedRes.json()) as {
      items: Array<{ priceUnitVnd: number | null }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    assert.ok(allQuotPaged.total >= 2500);
    assert.equal(allQuotPaged.items.length, 25);
    assert.ok(allQuotPaged.totalPages >= 100);
  });

  it('computes exact Golden Dataset NTR 001 Coating Cost (894,143 VND/m²) for PROJECT_LEADER', async () => {
    const res = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/cost`, {
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    assert.equal(res.status, 200);
    const cost = (await res.json()) as {
      totalCoatingCostRaw: number;
      totalCoatingCostDisplay: number;
      steps: Array<{
        stepNumber: number;
        rowSpan: number;
        coatingCostDisplay: number;
      }>;
    };

    assert.equal(cost.steps.length, 10);
    assert.equal(cost.steps[0].coatingCostDisplay, 119219.05);
    assert.equal(cost.steps[1].coatingCostDisplay, 69544.44);
    assert.equal(cost.steps[4].coatingCostDisplay, 119219.05);
    assert.equal(cost.steps[6].rowSpan, 5); // Each step has 5 items matching reference image
    assert.equal(cost.steps[6].coatingCostDisplay, 119219.05);
    assert.equal(cost.totalCoatingCostDisplay, 894143);
    assert.ok(Math.abs(cost.totalCoatingCostRaw - 894142.8571428573) < 1e-6);
  });

  it('enforces RBAC: blocks TECHNICAL from /cost (403) and redacts prices from schedule & quotations', async () => {
    const costRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/cost`, {
      headers: { 'x-user-role': 'TECHNICAL' }
    });
    assert.equal(costRes.status, 403);

    const revRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00`, {
      headers: { 'x-user-role': 'TECHNICAL' }
    });
    assert.equal(revRes.status, 200);
    const rev = (await revRes.json()) as {
      steps: Array<{ items: Array<{ priceSnapshotVnd: number | null }> }>;
    };
    for (const step of rev.steps) {
      for (const item of step.items) {
        assert.equal(item.priceSnapshotVnd, null);
      }
    }

    const quotRes = await fetch(
      `${baseUrl}/api/master/quotations?customerCode=1200001169&limit=5`,
      { headers: { 'x-user-role': 'TECHNICAL' } }
    );
    assert.equal(quotRes.status, 200);
    const quots = (await quotRes.json()) as Array<{ priceUnitVnd: number | null }>;
    assert.ok(quots.length > 0);
    for (const q of quots) {
      assert.equal(q.priceUnitVnd, null);
    }
  });

  it('exports dynamic merged Excel (.xlsx) with live formulas for PROJECT_LEADER and omits CC sheet for TECHNICAL', async () => {
    // 1. PROJECT_LEADER export includes CS, CC, BOM Summary
    const leaderRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/export-excel`, {
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    assert.equal(leaderRes.status, 200);
    const leaderBuf = Buffer.from(await leaderRes.arrayBuffer());

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(leaderBuf as unknown as ExcelJS.Buffer);
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    assert.deepEqual(sheetNames, ['CS', 'CC', 'BOM Summary']);

    const ccSheet = wb.getWorksheet('CC')!;
    // Step 1 occupies rows 7..11 (rowSpan=5), Step 7 occupies rows 37..41 (rowSpan=5)
    const step1FormulaCell = ccSheet.getCell('K7').value as ExcelJS.CellFormulaValue;
    assert.equal(step1FormulaCell.formula, 'I7*E7/1000');
    assert.equal(Math.round(Number(step1FormulaCell.result)), 119219);

    const step7MixedFormula = ccSheet.getCell('E37').value as ExcelJS.CellFormulaValue;
    assert.equal(
      step7MixedFormula.formula,
      'IFERROR(SUMPRODUCT(C37:C41,D37:D41)/SUM(D37:D41),0)'
    );

    // Total row at row 57 (6 header rows + 50 item rows = 56, total at 57)
    const totalCell = ccSheet.getCell('K57').value as ExcelJS.CellFormulaValue;
    assert.equal(totalCell.formula, 'SUM(K7:K56)');
    assert.equal(Math.round(Number(totalCell.result)), 894143);

    // 2. TECHNICAL export omits CC sheet completely
    const techRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/export-excel`, {
      headers: { 'x-user-role': 'TECHNICAL' }
    });
    assert.equal(techRes.status, 200);
    const techBuf = Buffer.from(await techRes.arrayBuffer());
    const techWb = new ExcelJS.Workbook();
    await techWb.xlsx.load(techBuf as unknown as ExcelJS.Buffer);
    assert.deepEqual(
      techWb.worksheets.map((ws) => ws.name),
      ['CS', 'BOM Summary']
    );
  });

  it('supports Revision cloning (Rev 00 -> Rev 01) and LOCKED snapshot immutability', async () => {
    // Clone Rev 00 -> Rev 01
    const cloneRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ refreshPrices: true })
    });
    assert.equal(cloneRes.status, 201);
    const cloned = (await cloneRes.json()) as { id: string; revisionNo: number; status: string };
    assert.equal(cloned.revisionNo, 1);
    assert.equal(cloned.status, 'DRAFT');

    // Lock Rev 00
    const lockRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ status: 'LOCKED' })
    });
    assert.equal(lockRes.status, 200);

    // Attempt to edit locked Rev 00 -> should fail with 400
    const editLockedRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ productName: 'SHOULD FAIL' })
    });
    assert.equal(editLockedRes.status, 400);

    // Restore Rev 00 back to DRAFT and delete cloned Rev 01 so database stays in clean Golden state
    await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ status: 'DRAFT' })
    });
    await fetch(`${baseUrl}/api/revisions/${cloned.id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
  });
});
