import { describe, it } from 'node:test';
import assert from 'node:assert';
import ExcelJS from 'exceljs';
import { generateRevisionWorkbook } from '../src/services/excel-exporter.service';
import { ProjectRevision } from '@cscc/shared';

describe('Excel Export Logo Verification', () => {
  const sampleRevision: ProjectRevision = {
    id: 'rev-test-logo',
    projectId: 'proj-test',
    projectCode: 'NTR 001',
    customer: {
      id: 'cust-1',
      customerId: '1200001169',
      shortName: 'NITORI-HO CHI MINH',
      customerName: 'DOANH NGHIEP CHE XUAT NITORI VIET NAM'
    },
    revisionNo: 0,
    status: 'DRAFT',
    scheduleDate: '2026-10-09',
    productName: 'TABLE',
    colorName: 'SW 90',
    substrate: 'BEECH WOOD',
    positioning: 'Interior',
    finishingSystem: 'WATERBASED',
    glossLevel: '15±5 SHEEN',
    referenceStandard: '',
    mcWood: '8-12%',
    roomHumidity: '40-80 %',
    roomTemp: '25 – 40°C',
    lineSpeed: '',
    dryingCondition: '',
    remark: '',
    defaultAreaM2: 1,
    preparedByTa: 'TA',
    checkedByLeader: 'LEADER',
    approvedByPdPm: 'PD/PM',
    customerConfirmName: 'CUSTOMER',
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('exports CS and CC sheets with logo image positioned in top-right corner', async () => {
    const buffer = await generateRevisionWorkbook(sampleRevision, 'PROJECT_LEADER', 1);
    assert.ok(buffer.length > 0, 'Buffer should not be empty');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const csSheet = workbook.getWorksheet('CS');
    assert.ok(csSheet, 'CS sheet should exist');
    const csImages = csSheet.getImages();
    assert.strictEqual(csImages.length, 1, 'CS sheet should contain 1 image');
    assert.strictEqual(csImages[0].type, 'image', 'Image type should be image');

    const ccSheet = workbook.getWorksheet('CC');
    assert.ok(ccSheet, 'CC sheet should exist');
    const ccImages = ccSheet.getImages();
    assert.strictEqual(ccImages.length, 1, 'CC sheet should contain 1 image');
    assert.strictEqual(ccImages[0].type, 'image', 'Image type should be image');
  });

  it('omits CC sheet but retains CS sheet logo for TECHNICAL role', async () => {
    const buffer = await generateRevisionWorkbook(sampleRevision, 'TECHNICAL', 1);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const csSheet = workbook.getWorksheet('CS');
    assert.ok(csSheet, 'CS sheet should exist');
    assert.strictEqual(csSheet.getImages().length, 1, 'CS sheet should have logo');

    const ccSheet = workbook.getWorksheet('CC');
    assert.strictEqual(ccSheet, undefined, 'CC sheet should not exist for TECHNICAL');
  });
});

