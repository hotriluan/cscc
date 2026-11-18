import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ExcelJS from 'exceljs';
import { createApp } from '../src/app';
import { dataStore } from '../src/store/data-store';
import { prisma } from '../src/store/prisma';
import type { Customer, Project, ProjectRevision } from '@cscc/shared';

describe('Auto-Generate Project Code ([SHORT][0001]) & Customer Name Display', () => {
  let server: http.Server;
  let baseUrl = '';

  const ntriCustomerId = '9900000001';
  const ntriCustomerName = 'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM';
  const ikeaCustomerId = '9900000002';
  const ikeaCustomerName = 'IKEA SUPPLY AG VIETNAM';
  const legacyCustomerId = '9900000003';
  const legacyCustomerName = 'CÔNG TY TNHH GỖ ĐẠI VIỆT';
  const legacyLongShortName = 'CONG TY TNHH GO DAI VIET';

  let ntriProject1Id = '';
  let ntriProject2Id = '';
  let ntriRev2Id = '';

  before(async () => {
    await dataStore.init(true);
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4098;
    baseUrl = `http://127.0.0.1:${port}`;

    // Create test customers NTRI and IKEA via API
    const resNtri = await fetch(`${baseUrl}/api/master/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ntriCustomerId,
        shortName: 'ntri',
        customerName: ntriCustomerName
      })
    });
    assert.equal(resNtri.status, 201);

    const resIkea = await fetch(`${baseUrl}/api/master/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ikeaCustomerId,
        shortName: 'IKEA',
        customerName: ikeaCustomerName
      })
    });
    assert.equal(resIkea.status, 201);

    // Seed a legacy customer with unshortened >6-char shortName directly in DB
    await prisma.customer.upsert({
      where: { customerId: legacyCustomerId },
      update: {
        shortName: legacyLongShortName,
        customerName: legacyCustomerName
      },
      create: {
        id: `cust-${legacyCustomerId}`,
        customerId: legacyCustomerId,
        shortName: legacyLongShortName,
        customerName: legacyCustomerName
      }
    });
  });

  after(async () => {
    if (server) server.close();
    await dataStore.init(true);
    await dataStore.disconnect();
  });

  it('1. Auto-generates sequential project codes per customer (NTRI0001, NTRI0002)', async () => {
    const previewRes = await fetch(
      `${baseUrl}/api/projects/next-code?customerId=${ntriCustomerId}`,
      { headers: { 'x-user-role': 'PROJECT_LEADER' } }
    );
    assert.equal(previewRes.status, 200);
    const previewBody = (await previewRes.json()) as { nextCode: string };
    assert.equal(previewBody.nextCode, 'NTRI0001');

    const create1 = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ntriCustomerId,
        productName: 'TABLE A',
        colorName: 'OAK',
        substrate: 'OAK',
        finishingSystem: 'PU'
      })
    });
    assert.equal(create1.status, 201);
    const body1 = (await create1.json()) as { project: Project; revision: ProjectRevision };
    assert.equal(body1.project.projectCode, 'NTRI0001');
    ntriProject1Id = body1.project.id;

    const create2 = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ntriCustomerId,
        productName: 'CHAIR B',
        colorName: 'WALNUT',
        substrate: 'ASH',
        finishingSystem: 'NC'
      })
    });
    assert.equal(create2.status, 201);
    const body2 = (await create2.json()) as { project: Project; revision: ProjectRevision };
    assert.equal(body2.project.projectCode, 'NTRI0002');
    ntriProject2Id = body2.project.id;
    ntriRev2Id = body2.revision.id;
  });

  it('2. Prevents code collision when an earlier project is deleted (NTRI0001 deleted -> next is NTRI0003)', async () => {
    const delRes = await fetch(`${baseUrl}/api/projects/${ntriProject1Id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    assert.equal(delRes.status, 200);

    const create3 = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ntriCustomerId,
        productName: 'CABINET C',
        colorName: 'NATURAL',
        substrate: 'MDF',
        finishingSystem: 'PU'
      })
    });
    assert.equal(create3.status, 201);
    const body3 = (await create3.json()) as { project: Project };
    assert.equal(body3.project.projectCode, 'NTRI0003');
  });

  it('3. Auto-regenerates projectCode when switching customer on a DRAFT revision', async () => {
    const updateRes = await fetch(`${baseUrl}/api/revisions/${ntriRev2Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ikeaCustomerId
      })
    });
    assert.equal(updateRes.status, 200);
    const updated = (await updateRes.json()) as { revision: ProjectRevision };
    assert.equal(updated.revision.customer.customerId, ikeaCustomerId);
    assert.equal(updated.revision.projectCode, 'IKEA0001');
  });

  it('4. Blocks and warns (HTTP 400 INVALID_CUSTOMER_SHORT_NAME) when customer Short Name is not 2-6 chars', async () => {
    const nextRes = await fetch(
      `${baseUrl}/api/projects/next-code?customerId=${legacyCustomerId}`,
      { headers: { 'x-user-role': 'PROJECT_LEADER' } }
    );
    assert.equal(nextRes.status, 400);
    const nextErr = (await nextRes.json()) as { error: string; message: string };
    assert.equal(nextErr.error, 'INVALID_CUSTOMER_SHORT_NAME');

    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: legacyCustomerId,
        productName: 'DESK',
        colorName: 'CLEAR',
        substrate: 'OAK',
        finishingSystem: 'PU'
      })
    });
    assert.equal(createRes.status, 400);
    const createErr = (await createRes.json()) as { error: string };
    assert.equal(createErr.error, 'INVALID_CUSTOMER_SHORT_NAME');

    const switchRes = await fetch(`${baseUrl}/api/revisions/${ntriRev2Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ customerId: legacyCustomerId })
    });
    assert.equal(switchRes.status, 400);
    const switchErr = (await switchRes.json()) as { error: string };
    assert.equal(switchErr.error, 'INVALID_CUSTOMER_SHORT_NAME');
  });

  it('5. Enforces 2-6 char Short Name validation and uppercase normalization in Customer Master API', async () => {
    const tooShort = await fetch(`${baseUrl}/api/master/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: '9900000010',
        shortName: 'A',
        customerName: 'TEST SHORT'
      })
    });
    assert.equal(tooShort.status, 400);

    const tooLong = await fetch(`${baseUrl}/api/master/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: '9900000011',
        shortName: 'ABCDEFG',
        customerName: 'TEST LONG'
      })
    });
    assert.equal(tooLong.status, 400);

    const validRes = await fetch(`${baseUrl}/api/master/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: '9900000012',
        shortName: 'acg',
        customerName: 'AN CUONG GROUP'
      })
    });
    assert.equal(validRes.status, 201);
    const validCust = (await validRes.json()) as Customer;
    assert.equal(validCust.shortName, 'ACG');
  });

  it('6. Exports full customerName in Excel CS (B2) and CC (A2) headers', async () => {
    const revRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/export-excel`, {
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    assert.equal(revRes.status, 200);
    const buffer = Buffer.from(await revRes.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const csSheet = workbook.getWorksheet('CS');
    assert.ok(csSheet);
    assert.equal(csSheet.getCell('B2').value, 'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM');

    const ccSheet = workbook.getWorksheet('CC');
    assert.ok(ccSheet);
    assert.equal(
      String(ccSheet.getCell('A2').value),
      'Customer / Khách hàng: DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM'
    );
  });

  it('7. Supports optional buyer field across create, update, clone, and Excel export', async () => {
    // 7a. Create without buyer -> defaults to ''
    const createDefault = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ntriCustomerId,
        productName: 'DESK NO BUYER',
        colorName: 'OAK',
        substrate: 'OAK',
        finishingSystem: 'PU'
      })
    });
    assert.equal(createDefault.status, 201);
    const bodyDefault = (await createDefault.json()) as { revision: ProjectRevision };
    assert.equal(bodyDefault.revision.buyer, '');

    // 7b. Create with buyer -> persists 'IKEA'
    const createWithBuyer = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ntriCustomerId,
        buyer: 'IKEA',
        productName: 'DESK WITH BUYER',
        colorName: 'OAK',
        substrate: 'OAK',
        finishingSystem: 'PU'
      })
    });
    assert.equal(createWithBuyer.status, 201);
    const bodyWithBuyer = (await createWithBuyer.json()) as { revision: ProjectRevision };
    assert.equal(bodyWithBuyer.revision.buyer, 'IKEA');

    // 7c. Update buyer and referenceStandard
    const updateRes = await fetch(`${baseUrl}/api/revisions/${bodyWithBuyer.revision.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        buyer: 'WILLIAMS-SONOMA',
        referenceStandard: 'ANSI/BIFMA X5.5'
      })
    });
    assert.equal(updateRes.status, 200);
    const updated = (await updateRes.json()) as { revision: ProjectRevision };
    assert.equal(updated.revision.buyer, 'WILLIAMS-SONOMA');
    assert.equal(updated.revision.referenceStandard, 'ANSI/BIFMA X5.5');

    // 7d. Clone revision -> copies buyer
    const cloneRes = await fetch(`${baseUrl}/api/revisions/${bodyWithBuyer.revision.id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ refreshPricesFromMaster: false })
    });
    assert.equal(cloneRes.status, 201);
    const cloned = (await cloneRes.json()) as ProjectRevision;
    assert.equal(cloned.buyer, 'WILLIAMS-SONOMA');

    // 7e. Export Excel -> includes Buyer / Nhà mua hàng and Reference / Tiêu chuẩn tham chiếu
    const exportRes = await fetch(`${baseUrl}/api/revisions/${cloned.id}/export-excel`, {
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    assert.equal(exportRes.status, 200);
    const buffer = Buffer.from(await exportRes.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const csSheet = workbook.getWorksheet('CS');
    assert.ok(csSheet);
    assert.equal(csSheet.getCell('D2').value, 'Buyer / Nhà mua hàng:');
    assert.equal(csSheet.getCell('E2').value, 'WILLIAMS-SONOMA');
    assert.equal(csSheet.getCell('A5').value, 'Reference / Tiêu chuẩn tham chiếu:');
    assert.equal(csSheet.getCell('B5').value, 'ANSI/BIFMA X5.5');

    const ccSheet = workbook.getWorksheet('CC');
    assert.ok(ccSheet);
    assert.equal(String(ccSheet.getCell('D2').value), 'Buyer / Nhà mua hàng: WILLIAMS-SONOMA');
    assert.equal(
      String(ccSheet.getCell('A5').value),
      'Reference / Tiêu chuẩn tham chiếu: ANSI/BIFMA X5.5'
    );
  });

  it('8. Leaves unentered Coating Schedule fields empty on new project creation', async () => {
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({
        customerId: ntriCustomerId
      })
    });
    assert.equal(createRes.status, 201);
    const { revision } = (await createRes.json()) as { revision: ProjectRevision };

    assert.equal(revision.buyer, '');
    assert.equal(revision.productName, '');
    assert.equal(revision.colorName, '');
    assert.equal(revision.substrate, '');
    assert.equal(revision.positioning, '');
    assert.equal(revision.finishingSystem, '');
    assert.equal(revision.glossLevel, '');
    assert.equal(revision.referenceStandard, '');
    assert.equal(revision.mcWood, '');
    assert.equal(revision.roomHumidity, '');
    assert.equal(revision.roomTemp, '');
    assert.equal(revision.lineSpeed, '');
    assert.equal(revision.dryingCondition, '');
    assert.equal(revision.remark, '');
    assert.equal(revision.preparedByTa, '');
    assert.equal(revision.checkedByLeader, '');
    assert.equal(revision.approvedByPdPm, '');
    assert.equal(revision.customerConfirmName, '');
  });
});
