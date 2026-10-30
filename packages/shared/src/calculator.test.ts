import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCaInput,
  calculateCoatingCostTable,
  calculateBomSummary,
  redactRevisionForRole
} from './calculator';
import { ScheduleStep, ProjectRevision } from './types';

function makeChemStep(
  stepOrder: number,
  stepNumber: number,
  stepName: string,
  methodName: 'WIPING' | 'SPRAY',
  caInputRaw = '100-120',
  extraItems = false
): ScheduleStep {
  const stepId = `step-${stepNumber}`;
  const baseItems = [
    {
      id: `${stepId}-i1`,
      stepId,
      itemOrder: 1,
      materialCode: 'PSV-76000 SB HC MY VN',
      materialName: 'PROSEAL WOOD FILLER SB HICKORY BROWN,20K',
      packingDesc: '20 Kg',
      nettWeight: 20,
      mixingRatio: 2,
      visco: null,
      priceSnapshotVnd: 543000
    },
    {
      id: `${stepId}-i2`,
      stepId,
      itemOrder: 2,
      materialCode: 'THPU-71306 01 KD VN',
      materialName: 'PU THINNER STANDARD TYPE 01, 16K',
      packingDesc: '16 Kg',
      nettWeight: 16,
      mixingRatio: 1,
      visco: null,
      priceSnapshotVnd: 52000
    }
  ];

  if (extraItems) {
    baseItems.push(
      {
        id: `${stepId}-i3`,
        stepId,
        itemOrder: 3,
        materialCode: 'PSV-76000 SB HC MY VN',
        materialName: 'PROSEAL WOOD FILLER SB HICKORY BROWN,20K',
        packingDesc: '20 Kg',
        nettWeight: 20,
        mixingRatio: 2,
        visco: null,
        priceSnapshotVnd: 543000
      },
      {
        id: `${stepId}-i4`,
        stepId,
        itemOrder: 4,
        materialCode: 'THPU-71306 01 KD VN',
        materialName: 'PU THINNER STANDARD TYPE 01, 16K',
        packingDesc: '16 Kg',
        nettWeight: 16,
        mixingRatio: 1,
        visco: null,
        priceSnapshotVnd: 52000
      },
      {
        id: `${stepId}-i5`,
        stepId,
        itemOrder: 5,
        materialCode: 'PSV-76000 SB HC MY VN',
        materialName: 'PROSEAL WOOD FILLER SB HICKORY BROWN,20K',
        packingDesc: '20 Kg',
        nettWeight: 20,
        mixingRatio: 0,
        visco: null,
        priceSnapshotVnd: 543000
      }
    );
  }

  return {
    id: stepId,
    stepOrder,
    stepNumber,
    rowType: 'CHEMICAL_STEP',
    stepName,
    sandingSpec: null,
    caInputRaw,
    caMin: 100,
    caMax: 120,
    caAvg: 110,
    methodName,
    efficiencySnapshot: methodName === 'WIPING' ? 0.35 : 0.6,
    dryingTime: '30 MIN',
    stepRemark: null,
    items: baseItems
  };
}

const goldenSteps: ScheduleStep[] = [
  {
    id: 'sanding-1',
    stepOrder: 1,
    stepNumber: null,
    rowType: 'SANDING',
    stepName: 'SANDING',
    sandingSpec: 'SANDING PAPER # 180-240',
    items: []
  },
  makeChemStep(2, 1, 'WIPING FILLER', 'WIPING', '100-120'),
  makeChemStep(3, 2, 'SANDING SEALER', 'SPRAY', '100-120'),
  makeChemStep(4, 3, 'TOP COAT COLOR', 'WIPING', '100-120'),
  makeChemStep(5, 4, 'TOP COAT COLOR', 'SPRAY', '100-120'),
  makeChemStep(6, 5, 'TOP COAT COLOR', 'WIPING', '100-120'),
  makeChemStep(7, 6, 'STAIN + EQUALIZER/ STAIN + SỬA GỖ', 'SPRAY', '100-120'),
  makeChemStep(8, 7, 'TOP COAT COLOR', 'WIPING', '100-120', true), // 5 items in Step 7
  makeChemStep(9, 8, 'GLAZE', 'SPRAY', '100-120'),
  makeChemStep(10, 9, 'SEALER/ LÓT TRONG', 'SPRAY', '100-120'),
  makeChemStep(11, 10, 'TOP COAT COLOR', 'SPRAY', '100-120')
];

describe('Shared Calculation Engine (@cscc/shared)', () => {
  it('parses CA range strings like "100-120" into caMin=100, caMax=120, caAvg=110', () => {
    const res = parseCaInput('100-120');
    assert.equal(res.caMin, 100);
    assert.equal(res.caMax, 120);
    assert.equal(res.caAvg, 110);
  });

  it('matches Golden Dataset NITORI-HO CHI MINH (NTR 001) exact Excel values and total 894,143 VND/m²', () => {
    const cc = calculateCoatingCostTable('rev-ntr001-00', goldenSteps);

    assert.equal(cc.steps.length, 10);

    // Step 1: WIPING FILLER (WIPING = 35% -> 119,219.05 VND/m²)
    const step1 = cc.steps[0];
    assert.equal(step1.mixedPriceDisplay, 379333);
    assert.equal(step1.caPlusLossDisplay, 314.29);
    assert.equal(step1.coverageDisplay, 3.18);
    assert.equal(step1.coatingCostDisplay, 119219.05);

    // Step 2: SANDING SEALER (SPRAY = 60% -> 69,544.44 VND/m²)
    const step2 = cc.steps[1];
    assert.equal(step2.mixedPriceDisplay, 379333);
    assert.equal(step2.caPlusLossDisplay, 183.33);
    assert.equal(step2.coverageDisplay, 5.45);
    assert.equal(step2.coatingCostDisplay, 69544.44);

    // Total Coating Cost across all 10 steps (4 WIPING + 6 SPRAY) = 894,142.8571428573 -> 894,143 VND/m²
    assert.equal(cc.totalCoatingCostDisplay, 894143);
    assert.ok(Math.abs(cc.totalCoatingCostRaw - 894142.8571428573) < 1e-6);
  });

  it('computes dynamic rowSpan and Excel merge coordinates when steps have variable item counts (2 items vs 5 items)', () => {
    const cc = calculateCoatingCostTable('rev-ntr001-00', goldenSteps);
    assert.equal(cc.steps[0].rowSpan, 2);
    assert.equal(cc.steps[6].rowSpan, 5); // Step 7 has 5 chemical rows
  });

  it('groups identical products in BOM Summary and calculates required Kg/Ltr and rounded Packs', () => {
    const bom = calculateBomSummary('rev-ntr001-00', 100, goldenSteps, 'PROJECT_LEADER');
    assert.equal(bom.items.length, 2);
    assert.ok(bom.items[0].packsToOrderRounded > 0);
    assert.ok(bom.totalProjectMaterialCostDisplay! > 0);
  });

  it('redacts all price and cost fields when role is TECHNICAL', () => {
    const bomTech = calculateBomSummary('rev-ntr001-00', 100, goldenSteps, 'TECHNICAL');
    assert.equal(bomTech.totalProjectMaterialCostDisplay, null);
    assert.equal(bomTech.items[0].priceUnitVnd, null);

    const dummyRev = {
      id: 'rev-1',
      projectId: 'proj-1',
      projectCode: 'NTR 001',
      customer: { id: 'c1', customerId: '1200001169', shortName: 'NITORI', customerName: 'NITORI' },
      revisionNo: 0,
      status: 'DRAFT',
      scheduleDate: '2025-11-08',
      productName: 'BÀN',
      colorName: 'HICKORY',
      substrate: 'TẦN BÌ',
      positioning: 'MID HIGH',
      finishingSystem: 'NC-PU',
      glossLevel: '30 GU',
      referenceStandard: 'SAMPLE',
      mcWood: '<12%',
      roomHumidity: '<80%',
      roomTemp: '<35 oC',
      defaultAreaM2: 100,
      steps: goldenSteps,
      createdAt: '',
      updatedAt: ''
    } satisfies ProjectRevision;

    const redacted = redactRevisionForRole(dummyRev, 'TECHNICAL');
    assert.equal(redacted.steps[1].items[0].priceSnapshotVnd, null);
  });
});
