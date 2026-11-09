export type UserRole = 'TECHNICAL' | 'SALES' | 'PROJECT_LEADER' | 'ADMIN';

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  salesmanName?: string | null;
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

export type RevisionStatus = 'DRAFT' | 'APPROVED' | 'INACTIVE' | 'LOCKED';

export interface RevisionStatusHistoryEntry {
  id: string;
  revisionId: string;
  fromStatus: RevisionStatus | null;
  toStatus: RevisionStatus;
  changedByUserId?: string | null;
  changedByName: string;
  changedByRole: UserRole;
  note: string;
  isAutoSupersede?: boolean;
  changedAt: string;
}

export type StepRowType = 'CHEMICAL_STEP' | 'SANDING';

export interface Customer {
  id: string;
  customerId: string;   // SAP Customer ID, e.g., "1200001169"
  shortName: string;    // e.g., "NITORI-HO CHI MINH"
  customerName: string; // e.g., "DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM"
  salesmanName?: string | null; // e.g., "Nguyễn Văn A"
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
  visco?: string | number | null;
  priceSnapshotVnd: number | null; // Null when redacted for TECHNICAL role
}

export interface ScheduleStep {
  id: string;
  stepOrder: number;
  stepNumber: number | null; // 1..N for CHEMICAL_STEP, null for SANDING
  rowType: StepRowType;
  stepName: string;
  sandingSpec?: string | null;
  visco?: string | number | null; // Step-level viscosity specification (e.g., "12-14", "40-60 DIN4")
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
  statusHistory?: RevisionStatusHistoryEntry[];
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

// ============================================================================
// REPORTS & ANALYTICS SYSTEM TYPES (7 REPORTS + RBAC + REVISION SCOPE)
// ============================================================================

export type RevisionScopeFilter = 'ALL' | 'LATEST' | 'APPROVED';

export type ReportSubTab =
  | 'PRODUCT_USAGE'
  | 'CUSTOMER_PORTFOLIO'
  | 'REVISION_VARIANCE'
  | 'PRICE_DRIFT'
  | 'STEP_BENCHMARK'
  | 'BOM_FORECAST'
  | 'ACTIVITY_FUNNEL';

export interface ReportFilterQuery {
  revisionScope?: RevisionScopeFilter;
  salesmanName?: string;
  customerId?: string;
  materialCode?: string;
  productName?: string;
  finishingSystem?: string;
  substrate?: string;
  q?: string;
  compareProjectId?: string;
  baseRevId?: string;
  targetRevId?: string;
}

export interface ProductCatalogOption {
  materialCode: string;
  materialName: string;
  packingDesc: string | null;
  nettWeight: number;
  usageRevisionCount: number;
  usageStepCount: number;
  customerCount: number;
}

export interface ProductUsageRow {
  revisionId: string;
  projectId: string;
  projectCode: string;
  customerId: string;
  customerShortName: string;
  customerName: string;
  salesmanName: string | null;
  revisionNo: number;
  status: RevisionStatus;
  scheduleDate: string;
  productName: string;
  colorName: string;
  substrate: string;
  finishingSystem: string;
  stepId: string;
  stepNumber: number | null;
  stepName: string;
  methodName: string;
  efficiencyPercent: string;
  materialCode: string;
  materialName: string;
  packingDesc: string | null;
  nettWeight: number;
  mixingRatio: number;
  ratioSharePercent: number;
  stepCaAvgGramM2: number;
  stepCaPlusLossGramM2: number;
  itemCaPlusLossGramM2: number;
  priceSnapshotVnd: number | null;
  itemCoatingCostVndM2: number | null;
  stepCoatingCostVndM2: number | null;
  revisionTotalCostVndM2: number | null;
}

export interface ProductUsageStepBreakdownRow {
  stepId: string;
  stepNumber: number | null;
  stepName: string;
  methodName: string;
  efficiencyPercent: string;
  mixingRatio: number;
  ratioSharePercent: number;
  stepCaAvgGramM2: number;
  stepCaPlusLossGramM2: number;
  itemCaPlusLossGramM2: number;
  priceSnapshotVnd: number | null;
  itemCoatingCostVndM2: number | null;
  stepCoatingCostVndM2: number | null;
}

export interface ProductUsageRevisionRow {
  revisionId: string;
  projectId: string;
  projectCode: string;
  customerId: string;
  customerShortName: string;
  customerName: string;
  salesmanName: string | null;
  revisionNo: number;
  status: RevisionStatus;
  scheduleDate: string;
  productName: string;
  colorName: string;
  substrate: string;
  finishingSystem: string;
  materialCode: string;
  materialName: string;
  packingDesc: string | null;
  nettWeight: number;
  stepCount: number;
  totalItemCaPlusLossGramM2: number;
  priceSnapshotVnd: number | null;
  totalItemCoatingCostVndM2: number | null;
  revisionTotalCostVndM2: number | null;
  costShareOfRevPercent: number | null;
  steps: ProductUsageStepBreakdownRow[];
}

export interface ProductUsageReport {
  productCatalog: ProductCatalogOption[];
  furnitureProducts: string[];
  selectedMaterialCode: string | null;
  summary: {
    totalCustomers: number;
    totalProjects: number;
    totalRevisions: number;
    approvedRevisions: number;
    draftRevisions: number;
    totalOccurrences: number;
    avgCaPlusLossGramM2: number;
    avgItemCostVndM2: number | null;
    minItemCostVndM2: number | null;
    maxItemCostVndM2: number | null;
  };
  revisionUsages: ProductUsageRevisionRow[];
  usages: ProductUsageRow[];
}

export interface CustomerRevisionReportRow {
  revisionId: string;
  projectId: string;
  projectCode: string;
  revisionNo: number;
  status: RevisionStatus;
  scheduleDate: string;
  productName: string;
  colorName: string;
  substrate: string;
  finishingSystem: string;
  preparedByTa: string | null;
  stepCount: number;
  distinctMaterialCount: number;
  totalCaPlusLossGramM2: number;
  totalCoatingCostVndM2: number | null;
  defaultAreaM2: number;
}

export interface CustomerPortfolioRow {
  id: string;
  customerId: string;
  shortName: string;
  customerName: string;
  salesmanName: string | null;
  projectCount: number;
  totalRevisionCount: number;
  approvedRevisionCount: number;
  draftRevisionCount: number;
  distinctMaterialCount: number;
  distinctProductCount: number;
  quotationCount: number;
  totalConsumptionGramM2Avg: number;
  minCoatingCostVndM2: number | null;
  avgCoatingCostVndM2: number | null;
  maxCoatingCostVndM2: number | null;
  revisions: CustomerRevisionReportRow[];
}

export interface CustomerPortfolioReport {
  summary: {
    totalCustomers: number;
    activeCustomersWithProjects: number;
    totalProjects: number;
    totalRevisions: number;
    approvedRevisions: number;
    draftRevisions: number;
    avgRevisionCostVndM2: number | null;
  };
  customers: CustomerPortfolioRow[];
}

export interface RevisionMaterialDiffRow {
  materialCode: string;
  materialName: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
  baseGramM2: number;
  targetGramM2: number;
  deltaGramM2: number;
  basePriceVnd: number | null;
  targetPriceVnd: number | null;
  deltaPriceVnd: number | null;
  baseCostVndM2: number | null;
  targetCostVndM2: number | null;
  deltaCostVndM2: number | null;
}

export interface ProjectRevisionVarianceRow {
  projectId: string;
  projectCode: string;
  customerId: string;
  customerShortName: string;
  salesmanName: string | null;
  productName: string;
  colorName: string;
  finishingSystem: string;
  totalRevisionsCount: number;
  baseRevisionId: string;
  baseRevisionNo: number;
  baseStatus: RevisionStatus;
  targetRevisionId: string;
  targetRevisionNo: number;
  targetStatus: RevisionStatus;
  baseStepCount: number;
  targetStepCount: number;
  deltaStepCount: number;
  baseTotalGramM2: number;
  targetTotalGramM2: number;
  deltaTotalGramM2: number;
  baseCostVndM2: number | null;
  targetCostVndM2: number | null;
  deltaCostVndM2: number | null;
  deltaCostPercent: number | null;
  itemDiffs: RevisionMaterialDiffRow[];
}

export interface RevisionVarianceReport {
  projectComparisons: ProjectRevisionVarianceRow[];
}

export interface PriceDriftRow {
  revisionId: string;
  projectId: string;
  projectCode: string;
  customerId: string;
  customerShortName: string;
  salesmanName: string | null;
  revisionNo: number;
  status: RevisionStatus;
  productName: string;
  stepNumber: number | null;
  stepName: string;
  materialCode: string;
  materialName: string;
  itemCaPlusLossGramM2: number;
  snapshotPriceVnd: number | null;
  latestQuotationPriceVnd: number | null;
  deltaPriceVnd: number | null;
  deltaPricePercent: number | null;
  costImpactVndM2: number | null;
  validFrom: string | null;
  validTo: string | null;
  alertStatus: 'MATCHED' | 'PRICE_DRIFT' | 'EXPIRED' | 'MISSING_QUOTATION';
}

export interface PriceDriftReport {
  summary: {
    totalCheckedItems: number;
    matchedCount: number;
    priceDriftCount: number;
    expiredQuotationCount: number;
    missingQuotationCount: number;
    totalDriftImpactVndM2: number | null;
  };
  items: PriceDriftRow[];
}

export interface StepBenchmarkRow {
  stepName: string;
  occurrenceCount: number;
  revisionCount: number;
  distinctMaterialCount: number;
  avgCaGramM2: number;
  avgCaPlusLossGramM2: number;
  avgStepCostVndM2: number | null;
  minStepCostVndM2: number | null;
  maxStepCostVndM2: number | null;
  costSharePercent: number | null;
  gramSharePercent: number;
}

export interface FinishingSystemBenchmarkRow {
  finishingSystem: string;
  substrate: string;
  revisionCount: number;
  projectCount: number;
  customerCount: number;
  avgStepCount: number;
  avgTotalCaPlusLossGramM2: number;
  minCostVndM2: number | null;
  avgCostVndM2: number | null;
  maxCostVndM2: number | null;
}

export interface StepSystemBenchmarkReport {
  byStep: StepBenchmarkRow[];
  bySystem: FinishingSystemBenchmarkRow[];
}

export interface BomForecastInputAllocation {
  revisionId: string;
  areaM2: number;
  selected?: boolean;
}

export interface BomForecastRevisionAllocation {
  revisionId: string;
  projectId: string;
  projectCode: string;
  customerId: string;
  customerShortName: string;
  salesmanName: string | null;
  revisionNo: number;
  status: RevisionStatus;
  productName: string;
  colorName: string;
  areaM2: number;
  selected: boolean;
  revisionCostVndM2: number | null;
  estimatedProjectCostVnd: number | null;
}

export interface AggregatedBomMaterialRow {
  materialCode: string;
  materialName: string;
  packingDesc: string | null;
  nettWeight: number;
  usedInRevisionsCount: number;
  usedByCustomersCount: number;
  projectCodes: string[];
  totalRequiredKgOrLtr: number;
  totalPacksExact: number;
  totalPacksRounded: number;
  avgPriceUnitVnd: number | null;
  totalEstimatedCostVnd: number | null;
}

export interface AggregatedBomForecastReport {
  allocations: BomForecastRevisionAllocation[];
  materials: AggregatedBomMaterialRow[];
  summary: {
    selectedRevisionsCount: number;
    totalAreaM2: number;
    distinctMaterialsCount: number;
    totalRequiredKgOrLtr: number;
    totalPacksRounded: number;
    totalEstimatedCostVnd: number | null;
  };
}

export interface SalesmanActivityRow {
  salesmanName: string;
  customerCount: number;
  activeCustomerCount: number;
  projectCount: number;
  totalRevisions: number;
  approvedRevisions: number;
  draftRevisions: number;
  approvalRatePercent: number;
  avgRevisionsPerProject: number;
  avgCoatingCostVndM2: number | null;
}

export interface TechnicalTaActivityRow {
  preparedByTa: string;
  projectCount: number;
  customerCount: number;
  totalRevisions: number;
  approvedRevisions: number;
  draftRevisions: number;
  approvalRatePercent: number;
  distinctSystemsCount: number;
  avgStepCount: number;
  avgConsumptionGramM2: number;
}

export interface SalesTechnicalActivityReport {
  bySalesman: SalesmanActivityRow[];
  byTechnicalTa: TechnicalTaActivityRow[];
}

export interface ReportsOverviewResponse {
  meta: {
    generatedAt: string;
    userRole: UserRole;
    enforcedSalesmanScope: string | null;
    appliedFilters: ReportFilterQuery;
    availableSalesmen: string[];
    availableCustomers: Customer[];
    availableFinishingSystems: string[];
    availableSubstrates: string[];
  };
  productUsage: ProductUsageReport;
  customerPortfolio: CustomerPortfolioReport;
  revisionVariance: RevisionVarianceReport;
  priceDrift: PriceDriftReport;
  stepBenchmark: StepSystemBenchmarkReport;
  bomForecast: AggregatedBomForecastReport;
  activityFunnel: SalesTechnicalActivityReport;
}
