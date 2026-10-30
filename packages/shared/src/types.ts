export type UserRole = 'TECHNICAL' | 'SALES' | 'PROJECT_LEADER' | 'ADMIN';

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSessionResponse {
  token: string;
  user: UserAccount;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type RevisionStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';

export type StepRowType = 'CHEMICAL_STEP' | 'SANDING';

export interface Customer {
  id: string;
  customerId: string;   // SAP Customer ID, e.g., "1200001169"
  shortName: string;    // e.g., "NITORI-HO CHI MINH"
  customerName: string; // e.g., "DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM"
}

export interface PackingMapping {
  id: string;
  code: string;
  description: string;
  unitType: 'KG' | 'LTR' | 'SET';
  nettWeight: number;
}

export interface ApplicationStepMaster {
  id: string;
  stepName: string;
  sortOrder: number;
}

export interface ApplicationMethod {
  id: string;
  methodName: string; // e.g., "SPRAY", "WIPING"
  efficiency: number; // e.g., 0.60, 0.35
}

export interface QuotationItem {
  id: string;
  sapCustomerCode: string;
  customerName: string;
  sapProductCode: string;
  custProductKey: string; // Composite key: sapCustomerCode + materialCode
  materialCode: string;   // e.g., "PSV-76000 SB HC MY VN"
  materialName: string;   // e.g., "PROSEAL WOOD FILLER SB HICKORY BROWN,20K"
  packingDesc: string;    // e.g., "20 Kg"
  nett: number;           // e.g., 20
  priceUnitVnd: number | null; // Null when redacted for TECHNICAL role
  validFrom?: string | null;
  validTo?: string | null;
}

export interface ScheduleStepItem {
  id: string;
  stepId: string;
  itemOrder: number;
  materialCode: string;
  materialName: string;
  packingDesc?: string | null;
  nettWeight?: number | null;
  mixingRatio: number;
  visco?: number | null;
  priceSnapshotVnd: number | null; // Null when redacted for TECHNICAL role
}

export interface ScheduleStep {
  id: string;
  stepOrder: number;
  stepNumber: number | null; // 1..N for CHEMICAL_STEP, null for SANDING
  rowType: StepRowType;
  stepName: string;
  sandingSpec?: string | null;
  caInputRaw?: string | null; // e.g., "100-120"
  caMin?: number | null;
  caMax?: number | null;
  caAvg?: number | null;      // e.g., 110
  methodName?: string | null; // e.g., "WIPING", "SPRAY"
  efficiencySnapshot?: number | null;
  dryingTime?: string | null;
  stepRemark?: string | null;
  items: ScheduleStepItem[];
}

export interface ProjectRevisionSummary {
  id: string;
  revisionNo: number;
  status: RevisionStatus;
  scheduleDate: string;
  productName: string;
  colorName: string;
  substrate?: string;
  finishingSystem?: string;
  stepCount?: number;
  totalCoatingCostDisplay?: number | null;
  updatedAt: string;
}

export interface Project {
  id: string;
  projectCode: string;
  customerId: string;
  customer: Customer;
  revisions: ProjectRevisionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRevision {
  id: string;
  projectId: string;
  projectCode: string;
  customer: Customer;
  revisionNo: number;
  status: RevisionStatus;
  scheduleDate: string;
  productName: string;
  colorName: string;
  substrate: string;
  positioning: string;
  finishingSystem: string;
  glossLevel: string;
  referenceStandard: string;
  mcWood: string;
  roomHumidity: string;
  roomTemp: string;
  lineSpeed?: string | null;
  dryingCondition?: string | null;
  remark?: string | null;
  defaultAreaM2: number;
  preparedByTa?: string | null;
  checkedByLeader?: string | null;
  approvedByPdPm?: string | null;
  customerConfirmName?: string | null;
  steps: ScheduleStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ParsedCaRange {
  raw: string;
  caMin: number | null;
  caMax: number | null;
  caAvg: number;
}

export interface StepItemCostDetail {
  itemId: string;
  itemOrder: number;
  materialCode: string;
  materialName: string;
  packingDesc: string | null;
  nettWeight: number;
  mixingRatio: number;
  ratioShare: number;
  priceSnapshotVnd: number;
}

export interface StepCostCalculation {
  stepId: string;
  stepNumber: number | null;
  stepName: string;
  rowSpan: number;
  csExcelStartRow: number;
  csExcelEndRow: number;
  ccExcelStartRow: number;
  ccExcelEndRow: number;
  methodName: string;
  caInputRaw: string;
  caAvg: number;
  efficiency: number;
  efficiencyPercentDisplay: string;
  totalRatio: number;
  // Unrounded IEEE-754 floating-point values for exact Excel calculation parity
  mixedPriceRaw: number;
  caPlusLossRaw: number;
  coverageRaw: number;
  coatingCostRaw: number;
  // Display-rounded values (rounded only at final presentation layer)
  mixedPriceDisplay: number;
  caPlusLossDisplay: number;
  coverageDisplay: number;
  coatingCostDisplay: number;
  items: StepItemCostDetail[];
}

export interface CoatingCostSummary {
  revisionId: string;
  steps: StepCostCalculation[];
  totalCoatingCostRaw: number;
  totalCoatingCostDisplay: number;
}

export interface BomItemCalculation {
  materialCode: string;
  materialName: string;
  packingDesc: string | null;
  nettWeight: number;
  stepNumbers: number[];
  totalCaPlusLossGramPerM2Raw: number;
  totalCaPlusLossGramPerM2Display: number;
  totalRequiredKgOrLtrRaw: number;
  totalRequiredKgOrLtrDisplay: number;
  packsRequiredExact: number;
  packsToOrderRounded: number;
  priceUnitVnd: number | null;
  totalMaterialCostRaw: number | null;
  totalMaterialCostDisplay: number | null;
}

export interface BomSummary {
  revisionId: string;
  areaM2: number;
  items: BomItemCalculation[];
  totalRequiredKgOrLtrDisplay: number;
  totalProjectMaterialCostRaw: number | null;
  totalProjectMaterialCostDisplay: number | null;
}
