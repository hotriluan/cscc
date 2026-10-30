import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import {
  Customer,
  PackingMapping,
  ApplicationStepMaster,
  ApplicationMethod,
  QuotationItem,
  Project,
  ProjectRevision,
  ScheduleStep,
  parseCaInput
} from '@cscc/shared';

export interface ImportedMasterData {
  customers: Customer[];
  quotations: QuotationItem[];
  packingMappings: PackingMapping[];
  applicationSteps: ApplicationStepMaster[];
  applicationMethods: ApplicationMethod[];
}

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined && val.result !== null) {
      return String(val.result).trim();
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text.trim();
    }
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text).join('').trim();
    }
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
  }
  return String(val).trim();
}

function cellToNumber(val: ExcelJS.CellValue): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'object' && 'result' in val && typeof val.result === 'number') {
    return Number.isFinite(val.result) ? val.result : 0;
  }
  const parsed = Number(cellToString(val).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Parses `Form CS Industry.xlsx` from a file path or Buffer and extracts all 5 Master Data tables.
 */
export async function importMasterDataFromExcel(
  source: string | Buffer
): Promise<ImportedMasterData> {
  const workbook = new ExcelJS.Workbook();
  if (typeof source === 'string') {
    await workbook.xlsx.readFile(source);
  } else {
    await workbook.xlsx.load(source as unknown as ExcelJS.Buffer);
  }

  // 1. Parse `Customer` sheet
  const customerMap = new Map<string, Customer>();
  const customerSheet = workbook.getWorksheet('Customer');
  if (customerSheet) {
    customerSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const shortRaw = cellToString(row.getCell(1).value);
      const customerId = cellToString(row.getCell(2).value);
      const customerName = cellToString(row.getCell(3).value);
      if (!customerId || !customerName) return;

      const isNumericShort = /^\d+$/.test(shortRaw);
      const existing = customerMap.get(customerId);
      if (!existing) {
        customerMap.set(customerId, {
          id: `cust-${customerId}`,
          customerId,
          shortName: isNumericShort ? customerName : shortRaw || customerName,
          customerName
        });
      } else if (!isNumericShort && shortRaw) {
        // Override numeric row index with explicit short name (e.g., "NITORI-HO CHI MINH")
        existing.shortName = shortRaw;
        existing.customerName = customerName;
      }
    });
  }

  // 2. Parse `packing mapping` sheet (Col A = Code like "20LP", Col B = Nett like 20)
  const packingMappings: PackingMapping[] = [];
  const seenPackingCodes = new Set<string>();
  const packingSheet = workbook.getWorksheet('packing mapping');
  if (packingSheet) {
    packingSheet.eachRow((row) => {
      const code = cellToString(row.getCell(1).value);
      const nettWeight = cellToNumber(row.getCell(2).value) || cellToNumber(row.getCell(3).value);
      if (!code || code.toLowerCase() === 'code' || seenPackingCodes.has(code)) return;
      seenPackingCodes.add(code);
      const upperCode = code.toUpperCase();
      const unitType: 'KG' | 'LTR' | 'SET' = upperCode.includes('L')
        ? 'LTR'
        : upperCode.includes('SET')
          ? 'SET'
          : 'KG';
      packingMappings.push({
        id: `pack-${code}`,
        code,
        description: `${nettWeight} ${unitType === 'LTR' ? 'Ltr' : 'Kg'} (${code})`,
        unitType,
        nettWeight
      });
    });
  }

  // 3. Parse `Application Step Master` sheet
  const applicationSteps: ApplicationStepMaster[] = [];
  const seenStepNames = new Set<string>();
  const stepSheet = workbook.getWorksheet('Application Step Master');
  if (stepSheet) {
    let order = 1;
    stepSheet.eachRow((row) => {
      const stepName = cellToString(row.getCell(1).value).toUpperCase();
      if (
        !stepName ||
        stepName === 'APPLICATION STEP' ||
        stepName === 'STEP' ||
        seenStepNames.has(stepName)
      ) {
        return;
      }
      seenStepNames.add(stepName);
      applicationSteps.push({
        id: `step-master-${order}`,
        stepName,
        sortOrder: order++
      });
    });
  }
  // Ensure SANDING is always registered in ApplicationStepMaster
  if (!seenStepNames.has('SANDING')) {
    applicationSteps.unshift({
      id: 'step-master-sanding',
      stepName: 'SANDING',
      sortOrder: 0
    });
  }

  // 4. Parse `app-method` sheet
  const applicationMethods: ApplicationMethod[] = [];
  const seenMethods = new Set<string>();
  const methodSheet = workbook.getWorksheet('app-method');
  if (methodSheet) {
    methodSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const methodName = cellToString(row.getCell(1).value).toUpperCase();
      const efficiency = cellToNumber(row.getCell(2).value);
      if (!methodName || seenMethods.has(methodName) || efficiency <= 0) return;
      seenMethods.add(methodName);
      applicationMethods.push({
        id: `method-${methodName.toLowerCase()}`,
        methodName,
        efficiency
      });
    });
  }

  // 5. Parse `quotation` sheet
  // Columns in Form CS Industry.xlsx:
  // A(1)=Sold-to code, B(2)=Customer Name, C(3)=SAP Material Code, D(4)=Material Description,
  // E(5)=Cust&product key, F(6)=Material Short Name (without pack), G(7)=Packing code, H(8)=Nett, I(9)=Pack Price, J(10)=Price/nett
  const quotationMap = new Map<string, QuotationItem>();
  const quotationSheet = workbook.getWorksheet('quotation');
  if (quotationSheet) {
    quotationSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const sapCustomerCode = cellToString(row.getCell(1).value);
      const customerName = cellToString(row.getCell(2).value);
      const sapProductCode = cellToString(row.getCell(3).value);
      // Use clean Name without pack (Col F) as both materialCode and clean materialName (no packing suffix)
      const materialCode = cellToString(row.getCell(6).value);
      const materialName = materialCode;
      const packingDesc = cellToString(row.getCell(7).value);
      const nett = cellToNumber(row.getCell(8).value) || 20;
      const priceUnitVnd = cellToNumber(row.getCell(10).value);
      const validFrom = cellToString(row.getCell(11).value) || null;
      const validTo = cellToString(row.getCell(12).value) || null;

      if (!sapCustomerCode || !materialCode) return;
      const custProductKey = `${sapCustomerCode}${materialCode}`;
      quotationMap.set(custProductKey, {
        id: `quot-${quotationMap.size + 1}`,
        sapCustomerCode,
        customerName,
        sapProductCode,
        custProductKey,
        materialCode,
        materialName,
        packingDesc,
        nett,
        priceUnitVnd,
        validFrom,
        validTo
      });
    });
  }

  const sortedCustomers = Array.from(customerMap.values()).sort((a, b) => {
    const aHasShort = a.shortName !== a.customerName ? 0 : 1;
    const bHasShort = b.shortName !== b.customerName ? 0 : 1;
    if (aHasShort !== bHasShort) return aHasShort - bHasShort;
    return a.shortName.localeCompare(b.shortName);
  });

  return {
    customers: sortedCustomers,
    quotations: Array.from(quotationMap.values()).map((q, idx) => ({
      ...q,
      id: `quot-${idx + 1}`
    })),
    packingMappings,
    applicationSteps,
    applicationMethods
  };
}

/**
 * Builds the Golden Dataset project `NITORI-HO CHI MINH (NTR 001)` (`Rev 00`)
 * matching `docs/Form CS Industry.xlsx` (`CS` & `CC` sheets) with 10 interleaved
 * SANDING rows + 10 chemical steps -> Total Coating Cost = 894,142.8571428573 VND/m2 (894,143).
 */
export function buildGoldenDatasetNtr001(master: ImportedMasterData): {
  project: Project;
  revision: ProjectRevision;
} {
  const customer =
    master.customers.find((c) => c.customerId === '1200001169') ?? {
      id: 'cust-1200001169',
      customerId: '1200001169',
      shortName: 'NITORI-HO CHI MINH',
      customerName: 'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM'
    };

  const findQuot = (materialCode: string) => {
    const key = `${customer.customerId}${materialCode}`;
    return master.quotations.find((q) => q.custProductKey === key);
  };

  const makeItem = (
    stepId: string,
    itemOrder: number,
    materialCode: string,
    fallbackName: string,
    mixingRatio: number,
    visco: number | null,
    fallbackPrice: number
  ) => {
    const q = findQuot(materialCode);
    return {
      id: `${stepId}-item-${itemOrder}`,
      stepId,
      itemOrder,
      materialCode,
      materialName: q?.materialName ?? fallbackName,
      packingDesc: q?.packingDesc ?? null,
      nettWeight: q?.nett ?? null,
      mixingRatio,
      visco,
      priceSnapshotVnd: q?.priceUnitVnd ?? fallbackPrice
    };
  };

  const makeSandingStep = (stepOrder: number, sandingSpec: string): ScheduleStep => ({
    id: `ntr001-rev0-step-${stepOrder}`,
    stepOrder,
    stepNumber: null,
    rowType: 'SANDING',
    stepName: 'SANDING',
    sandingSpec,
    caInputRaw: null,
    caMin: null,
    caMax: null,
    caAvg: null,
    methodName: null,
    efficiencySnapshot: null,
    dryingTime: null,
    stepRemark: null,
    items: []
  });

  const makeChemStep = (
    stepOrder: number,
    stepNumber: number,
    stepName: string,
    caInputRaw: string,
    methodName: 'WIPING' | 'SPRAY',
    dryingTime: string,
    rawItems: Array<{
      code: string;
      name: string;
      ratio: number;
      visco: number | null;
      price: number;
    }>
  ): ScheduleStep => {
    const stepId = `ntr001-rev0-step-${stepOrder}`;
    const parsedCa = parseCaInput(caInputRaw);
    const eff =
      master.applicationMethods.find((m) => m.methodName === methodName)?.efficiency ??
      (methodName === 'WIPING' ? 0.35 : 0.6);

    return {
      id: stepId,
      stepOrder,
      stepNumber,
      rowType: 'CHEMICAL_STEP',
      stepName,
      sandingSpec: null,
      caInputRaw,
      caMin: parsedCa.caMin,
      caMax: parsedCa.caMax,
      caAvg: parsedCa.caAvg,
      methodName,
      efficiencySnapshot: eff,
      dryingTime,
      stepRemark: null,
      items: rawItems.map((it, idx) =>
        makeItem(stepId, idx + 1, it.code, it.name, it.ratio, it.visco, it.price)
      )
    };
  };

  // Clean 5-item block matching the exact CS & CC reference screenshots (PSV: 10, 10, 60; THPU: 20, 20)
  const makeStandardFiveItems = (viscoVal: number | null = null) => [
    {
      code: 'PSV-76000 SB HC MY VN',
      name: 'PSV-76000 SB HC MY VN',
      ratio: 10,
      visco: viscoVal,
      price: 543000
    },
    {
      code: 'PSV-76000 SB HC MY VN',
      name: 'PSV-76000 SB HC MY VN',
      ratio: 10,
      visco: null as number | null,
      price: 543000
    },
    {
      code: 'PSV-76000 SB HC MY VN',
      name: 'PSV-76000 SB HC MY VN',
      ratio: 60,
      visco: null as number | null,
      price: 543000
    },
    {
      code: 'THPU-71306 01 KD VN',
      name: 'THPU-71306 01 KD VN',
      ratio: 20,
      visco: null as number | null,
      price: 52000
    },
    {
      code: 'THPU-71306 01 KD VN',
      name: 'THPU-71306 01 KD VN',
      ratio: 20,
      visco: null as number | null,
      price: 52000
    }
  ];

  const steps: ScheduleStep[] = [
    // Step 1 (WIPING = 35% -> 119,219.05 VND/m2)
    makeSandingStep(1, 'SANDING PAPER #180-240'),
    makeChemStep(
      2,
      1,
      'WIPING FILLER',
      '100-120',
      'WIPING',
      '10-15 min',
      makeStandardFiveItems(null)
    ),
    // Step 2 (SPRAY = 60% -> 69,544.44 VND/m2)
    makeSandingStep(3, 'SANDING PAPER #180-240'),
    makeChemStep(
      4,
      2,
      'SANDING SEALER',
      '100-120',
      'SPRAY',
      '60 min OVEN 45-50°C',
      makeStandardFiveItems(50)
    ),
    // Step 3 (WIPING = 35% -> 119,219.05 VND/m2)
    makeSandingStep(5, 'SANDING PAPER #320'),
    makeChemStep(
      6,
      3,
      'TOP COAT COLOR',
      '100-120',
      'WIPING',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    ),
    // Step 4 (SPRAY = 60% -> 69,544.44 VND/m2)
    makeSandingStep(7, 'SANDING PAPER #320'),
    makeChemStep(
      8,
      4,
      'TOP COAT COLOR',
      '100-120',
      'SPRAY',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    ),
    // Step 5 (WIPING = 35% -> 119,219.05 VND/m2)
    makeSandingStep(9, 'SANDING PAPER #320'),
    makeChemStep(
      10,
      5,
      'TOP COAT COLOR',
      '100-120',
      'WIPING',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    ),
    // Step 6 (SPRAY = 60% -> 69,544.44 VND/m2)
    makeSandingStep(11, 'SANDING PAPER #320'),
    makeChemStep(
      12,
      6,
      'STAIN + EQUALIZER/ STAIN + SỬA GỖ',
      '100-120',
      'SPRAY',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    ),
    // Step 7 (WIPING = 35% -> 119,219.05 VND/m2)
    makeSandingStep(13, 'SANDING PAPER #320'),
    makeChemStep(
      14,
      7,
      'TOP COAT COLOR',
      '100-120',
      'WIPING',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    ),
    // Step 8 (SPRAY = 60% -> 69,544.44 VND/m2)
    makeSandingStep(15, 'SANDING PAPER #320'),
    makeChemStep(
      16,
      8,
      'GLAZE',
      '100-120',
      'SPRAY',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    ),
    // Step 9 (SPRAY = 60% -> 69,544.44 VND/m2)
    makeSandingStep(17, 'SANDING PAPER #320'),
    makeChemStep(
      18,
      9,
      'SEALER/ LÓT TRONG',
      '100-120',
      'SPRAY',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    ),
    // Step 10 (SPRAY = 60% -> 69,544.44 VND/m2)
    makeSandingStep(19, 'SANDING PAPER #320'),
    makeChemStep(
      20,
      10,
      'TOP COAT COLOR',
      '100-120',
      'SPRAY',
      '120 min OVEN 40-45°C',
      makeStandardFiveItems(50)
    )
  ];

  const revisionId = 'rev-ntr001-00';
  const projectId = 'proj-ntr001';

  const revision: ProjectRevision = {
    id: revisionId,
    projectId,
    projectCode: 'NTR 001',
    customer,
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
    remark: 'THỰC TẾ HAO HỤT KHOẢNG 40%',
    defaultAreaM2: 100,
    preparedByTa: 'TA',
    checkedByLeader: 'PROJECT LEADER',
    approvedByPdPm: 'PD/PM',
    customerConfirmName: 'CUSTOMER',
    steps,
    createdAt: '2026-10-09T08:00:00.000Z',
    updatedAt: '2026-10-09T08:00:00.000Z'
  };

  const project: Project = {
    id: projectId,
    projectCode: 'NTR 001',
    customerId: customer.id,
    customer,
    revisions: [
      {
        id: revision.id,
        revisionNo: revision.revisionNo,
        status: revision.status,
        scheduleDate: revision.scheduleDate,
        productName: revision.productName,
        colorName: revision.colorName,
        updatedAt: revision.updatedAt
      }
    ],
    createdAt: '2025-11-08T08:00:00.000Z',
    updatedAt: '2025-11-08T08:00:00.000Z'
  };

  return { project, revision };
}

/**
 * Resolves the default path to `docs/Form CS Industry.xlsx` in the repository.
 */
export function resolveDefaultExcelPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'docs/Form CS Industry.xlsx'),
    path.resolve(process.cwd(), '../../docs/Form CS Industry.xlsx'),
    path.resolve(__dirname, '../../../../docs/Form CS Industry.xlsx')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}
