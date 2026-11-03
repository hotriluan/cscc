import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { generateRevisionWorkbook } from '../src/services/excel-exporter.service';
import { ProjectRevision } from '@cscc/shared';

test('Visco preservation in Coating Schedule & Excel Export', async (t) => {
  await t.test('Excel exporter writes visco range and specification to column 5 correctly', async () => {
    const revision: ProjectRevision = {
      id: 'rev-test',
      projectId: 'proj-test',
      projectCode: 'TEST 001',
      customer: {
        id: 'cust-1',
        customerId: '1200001169',
        shortName: 'NITORI-HCM',
        customerName: 'CONG TY NITORI'
      },
      revisionNo: 0,
      status: 'DRAFT',
      scheduleDate: '2026-11-03',
      productName: 'TABLE',
      colorName: 'NATURAL',
      defaultAreaM2: 100,
      steps: [
        {
          id: 'step-1',
          stepOrder: 1,
          stepNumber: 1,
          rowType: 'CHEMICAL_STEP',
          stepName: 'WIPING FILLER',
          visco: '12-14',
          caInputRaw: '100-120',
          methodName: 'WIPING',
          dryingTime: '30 MIN',
          items: [
            {
              id: 'it-1',
              stepId: 'step-1',
              itemOrder: 1,
              materialCode: 'MAT-1',
              materialName: 'MATERIAL 1',
              mixingRatio: 2,
              visco: '12-14',
              priceSnapshotVnd: 50000
            }
          ]
        },
        {
          id: 'step-2',
          stepOrder: 2,
          stepNumber: 2,
          rowType: 'CHEMICAL_STEP',
          stepName: 'TOP COAT',
          visco: '40-60" DIN4',
          caInputRaw: '90-100',
          methodName: 'SPRAY',
          dryingTime: '4 HOURS',
          items: [
            {
              id: 'it-2',
              stepId: 'step-2',
              itemOrder: 1,
              materialCode: 'MAT-2',
              materialName: 'TOP COAT CLEAR',
              mixingRatio: 5,
              visco: '40-60" DIN4',
              priceSnapshotVnd: 200000
            }
          ]
        }
      ]
    };

    const buffer = await generateRevisionWorkbook(revision, 'PROJECT_LEADER', 1);
    assert.ok(buffer.length > 0, 'Excel buffer generated');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const csSheet = wb.getWorksheet('CS');
    assert.ok(csSheet, 'CS sheet should exist');

    // Find Step 1 row
    let step1ViscoFound = false;
    let step2ViscoFound = false;

    csSheet.eachRow((row) => {
      const val = row.getCell(5).value;
      if (val === '12-14') {
        step1ViscoFound = true;
      }
      if (val === '40-60" DIN4') {
        step2ViscoFound = true;
      }
    });

    assert.ok(step1ViscoFound, 'Step 1 visco "12-14" should be present in Column 5 of CS sheet');
    assert.ok(step2ViscoFound, 'Step 2 visco "40-60\\" DIN4" should be present in Column 5 of CS sheet');
  });
});
