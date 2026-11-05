import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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

    // Verify embedded logo matches pic/LOGO_WEB.png exactly
    const expectedLogoBuffer = fs.readFileSync(path.resolve(process.cwd(), 'pic/LOGO_WEB.png'));
    const expectedHash = crypto.createHash('sha256').update(expectedLogoBuffer).digest('hex');
    const embeddedLogo = workbook.getImage(Number(csImages[0].imageId));
    assert.ok(embeddedLogo, 'Embedded logo image should exist');
    const embeddedHash = crypto.createHash('sha256').update(embeddedLogo.buffer).digest('hex');
    assert.strictEqual(embeddedHash, expectedHash, 'Embedded logo in Excel must match pic/LOGO_WEB.png hash');
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

  it('renders product name (description) instead of SAP product code in CS and CC sheets', async () => {
    const revWithItem: ProjectRevision = {
      ...sampleRevision,
      steps: [
        {
          id: 'step-1',
          stepOrder: 1,
          stepNumber: 1,
          rowType: 'CHEMICAL_STEP',
          stepName: 'CHỐNG XÌ DẦU',
          sandingSpec: null,
          caInputRaw: '100-120',
          caMin: 100,
          caMax: 120,
          caAvg: 110,
          methodName: 'SPRAY',
          efficiencySnapshot: 0.6,
          dryingTime: '45',
          stepRemark: null,
          items: [
            {
              id: 'item-1',
              stepId: 'step-1',
              itemOrder: 1,
              materialCode: '100006668',
              materialName: 'PSV-76000 SB HC MY VN',
              packingDesc: '18KJ',
              nettWeight: 18,
              mixingRatio: 100,
              visco: null,
              priceSnapshotVnd: 543000
            }
          ]
        }
      ]
    };

    const buffer = await generateRevisionWorkbook(revWithItem, 'PROJECT_LEADER', 1);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const csSheet = workbook.getWorksheet('CS')!;
    assert.strictEqual(csSheet.getCell('C7').value, 'Product Name / Tên sản phẩm');
    assert.strictEqual(csSheet.getCell('C8').value, 'PSV-76000 SB HC MY VN');

    const ccSheet = workbook.getWorksheet('CC')!;
    assert.strictEqual(ccSheet.getCell('B6').value, 'Product Name / Tên sản phẩm');
    assert.strictEqual(ccSheet.getCell('B7').value, 'PSV-76000 SB HC MY VN');

    const bomSheet = workbook.getWorksheet('BOM Summary')!;
    assert.strictEqual(bomSheet.getCell('A3').value, 'Product Name / Tên sản phẩm');
    assert.strictEqual(bomSheet.getCell('A4').value, 'PSV-76000 SB HC MY VN');
  });
});

