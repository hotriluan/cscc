import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { importMasterDataFromExcel } from '../src/services/excel-importer.service';

test('Customer Salesman Name Verification', async (t) => {
  await t.test('imports Customer sheet with Salesman Name in Column 4', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Customer');
    ws.addRow(['Short Name', 'Customer ID', 'Customer Name', 'Salesman Name']);
    ws.addRow(['NITORI-HCM', '1200001169', 'CONG TY NITORI', 'Nguyen Van A']);
    ws.addRow(['IKEA-VN', '1200001170', 'CONG TY IKEA', 'Tran Thi B']);
    ws.addRow(['NO-SALES', '1200001171', 'CONG TY KHONG SALES']); // No column 4

    const buffer = await wb.xlsx.writeBuffer();
    const result = await importMasterDataFromExcel(Buffer.from(buffer as ArrayBuffer));

    const nitori = result.customers.find((c) => c.customerId === '1200001169');
    assert.ok(nitori, 'NITORI customer should exist');
    assert.equal(nitori.salesmanName, 'Nguyen Van A');

    const ikea = result.customers.find((c) => c.customerId === '1200001170');
    assert.ok(ikea, 'IKEA customer should exist');
    assert.equal(ikea.salesmanName, 'Tran Thi B');

    const noSales = result.customers.find((c) => c.customerId === '1200001171');
    assert.ok(noSales, 'NO-SALES customer should exist');
    assert.equal(noSales.salesmanName, null);
  });
});

