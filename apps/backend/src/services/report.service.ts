import {
  AggregatedBomForecastReport,
  AggregatedBomMaterialRow,
  BomForecastInputAllocation,
  BomForecastRevisionAllocation,
  Customer,
  CustomerPortfolioReport,
  CustomerPortfolioRow,
  CustomerRevisionReportRow,
  FinishingSystemBenchmarkRow,
  PriceDriftReport,
  PriceDriftRow,
  ProductCatalogOption,
  ProductUsageReport,
  ProductUsageRow,
  ProjectRevision,
  ProjectRevisionVarianceRow,
  QuotationItem,
  ReportFilterQuery,
  ReportsOverviewResponse,
  RevisionMaterialDiffRow,
  RevisionScopeFilter,
  RevisionStatus,
  RevisionVarianceReport,
  SalesmanActivityRow,
  SalesTechnicalActivityReport,
  ScheduleStep,
  StepBenchmarkRow,
  StepRowType,
  StepSystemBenchmarkReport,
  TechnicalTaActivityRow,
  UserRole,
  calculateBomSummary,
  calculateCoatingCostTable
} from '@cscc/shared';
import { prisma } from '../store/prisma';

interface EnrichedRevisionContext {
  projectId: string;
  projectCode: string;
  customer: Customer;
  revision: ProjectRevision;
  costSummary: ReturnType<typeof calculateCoatingCostTable>;
  totalCaPlusLossGramM2Raw: number;
  totalCaPlusLossGramM2Display: number;
  chemicalStepCount: number;
  distinctMaterials: Set<string>;
}

function mapStepFromDb(step: {
  id: string;
  stepOrder: number;
  stepNumber: number | null;
  rowType: string;
  stepName: string;
  sandingSpec: string | null;
  visco?: string | null;
  caInputRaw: string | null;
  caMin: number | null;
  caMax: number | null;
  caAvg: number | null;
  methodName: string | null;
  efficiencySnapshot: number | null;
  dryingTime: string | null;
  stepRemark: string | null;
  items: Array<{
    id: string;
    stepId: string;
    itemOrder: number;
    materialCode: string;
    materialName: string;
    packingDesc: string | null;
    nettWeight: number | null;
    mixingRatio: number;
    visco: string | null;
    priceSnapshotVnd: number;
  }>;
}): ScheduleStep {
  const sortedItems = [...step.items].sort((a, b) => a.itemOrder - b.itemOrder);
  const stepVisco =
    step.visco !== null && step.visco !== undefined && String(step.visco).trim() !== ''
      ? String(step.visco).trim()
      : sortedItems[0]?.visco !== null &&
          sortedItems[0]?.visco !== undefined &&
          String(sortedItems[0].visco).trim() !== ''
        ? String(sortedItems[0].visco).trim()
        : null;

  return {
    id: step.id,
    stepOrder: step.stepOrder,
    stepNumber: step.stepNumber,
    rowType: step.rowType as StepRowType,
    stepName: step.stepName,
    sandingSpec: step.sandingSpec,
    visco: stepVisco,
    caInputRaw: step.caInputRaw,
    caMin: step.caMin,
    caMax: step.caMax,
    caAvg: step.caAvg,
    methodName: step.methodName,
    efficiencySnapshot: step.efficiencySnapshot,
    dryingTime: step.dryingTime,
    stepRemark: step.stepRemark,
    items: sortedItems.map((it, idx) => ({
      id: it.id,
      stepId: it.stepId,
      itemOrder: it.itemOrder,
      materialCode: it.materialCode,
      materialName: it.materialName,
      packingDesc: it.packingDesc,
      nettWeight: it.nettWeight,
      mixingRatio: it.mixingRatio,
      visco:
        it.visco !== null && it.visco !== undefined && String(it.visco).trim() !== ''
          ? String(it.visco).trim()
          : idx === 0
            ? stepVisco
            : null,
      priceSnapshotVnd: it.priceSnapshotVnd
    }))
  };
}

function parseFlexibleDate(raw: string | null | undefined): Date | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 23, 59, 59);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]), 23, 59, 59);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function filterRevisionsByScope<T extends { revisionNo: number; status: RevisionStatus }>(
  revisions: T[],
  scope: RevisionScopeFilter
): T[] {
  if (!revisions || revisions.length === 0) return [];
  const sorted = [...revisions].sort((a, b) => a.revisionNo - b.revisionNo);
  if (scope === 'LATEST') {
    return [sorted[sorted.length - 1]];
  }
  if (scope === 'APPROVED') {
    return sorted.filter((r) => r.status === 'APPROVED' || r.status === 'LOCKED');
  }
  return sorted;
}

function enrichProjectRevision(
  projId: string,
  projCode: string,
  customer: Customer,
  rawRev: {
    id: string;
    projectId: string;
    revisionNo: number;
    status: string;
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
    lineSpeed: string | null;
    dryingCondition: string | null;
    remark: string | null;
    defaultAreaM2: number;
    preparedByTa: string | null;
    checkedByLeader: string | null;
    approvedByPdPm: string | null;
    customerConfirmName: string | null;
    createdAt: Date;
    updatedAt: Date;
    steps: Parameters<typeof mapStepFromDb>[0][];
  },
  quotByCustAndCode: Map<string, QuotationItem>,
  quotByCode: Map<string, QuotationItem>
): EnrichedRevisionContext {
  const mappedSteps = rawRev.steps.map(mapStepFromDb);
  const custCode = customer.customerId.trim();

  for (const s of mappedSteps) {
    for (const it of s.items) {
      const code = (it.materialCode || '').trim();
      if (!code) continue;
      if (!it.materialName || it.materialName.trim() === code) {
        const matched = quotByCustAndCode.get(`${custCode}__${code}`) ?? quotByCode.get(code);
        if (matched?.materialName) {
          it.materialName = matched.materialName;
        }
      }
      if (!it.packingDesc) {
        const matched = quotByCustAndCode.get(`${custCode}__${code}`) ?? quotByCode.get(code);
        if (matched?.packingDesc) {
          it.packingDesc = matched.packingDesc;
        }
      }
      if (!it.nettWeight || it.nettWeight <= 0) {
        const matched = quotByCustAndCode.get(`${custCode}__${code}`) ?? quotByCode.get(code);
        if (matched?.nett && matched.nett > 0) {
          it.nettWeight = matched.nett;
        }
      }
    }
  }

  const revision: ProjectRevision = {
    id: rawRev.id,
    projectId: projId,
    projectCode: projCode,
    customer,
    revisionNo: rawRev.revisionNo,
    status: rawRev.status as RevisionStatus,
    scheduleDate: rawRev.scheduleDate,
    productName: rawRev.productName,
    colorName: rawRev.colorName,
    substrate: rawRev.substrate,
    positioning: rawRev.positioning,
    finishingSystem: rawRev.finishingSystem,
    glossLevel: rawRev.glossLevel,
    referenceStandard: rawRev.referenceStandard,
    mcWood: rawRev.mcWood,
    roomHumidity: rawRev.roomHumidity,
    roomTemp: rawRev.roomTemp,
    lineSpeed: rawRev.lineSpeed,
    dryingCondition: rawRev.dryingCondition,
    remark: rawRev.remark,
    defaultAreaM2: rawRev.defaultAreaM2 > 0 ? rawRev.defaultAreaM2 : 100,
    preparedByTa: rawRev.preparedByTa,
    checkedByLeader: rawRev.checkedByLeader,
    approvedByPdPm: rawRev.approvedByPdPm,
    customerConfirmName: rawRev.customerConfirmName,
    steps: mappedSteps,
    createdAt: rawRev.createdAt.toISOString(),
    updatedAt: rawRev.updatedAt.toISOString()
  };

  const costSummary = calculateCoatingCostTable(revision.id, mappedSteps);
  const totalCaPlusLossGramM2Raw = costSummary.steps.reduce(
    (sum, st) => sum + st.caPlusLossRaw,
    0
  );
  const distinctMaterials = new Set<string>();
  for (const st of costSummary.steps) {
    for (const it of st.items) {
      const code = (it.materialCode || '').trim();
      if (code) distinctMaterials.add(code);
    }
  }

  return {
    projectId: projId,
    projectCode: projCode,
    customer,
    revision,
    costSummary,
    totalCaPlusLossGramM2Raw,
    totalCaPlusLossGramM2Display: Number(totalCaPlusLossGramM2Raw.toFixed(2)),
    chemicalStepCount: costSummary.steps.length,
    distinctMaterials
  };
}

export async function generateReportsOverview(params: {
  userRole: UserRole;
  enforcedSalesmanScope: string | null;
  query: ReportFilterQuery;
  bomAllocations?: BomForecastInputAllocation[];
}): Promise<ReportsOverviewResponse> {
  const { userRole, enforcedSalesmanScope, query, bomAllocations } = params;
  const isTech = userRole === 'TECHNICAL';
  const revisionScope: RevisionScopeFilter =
    query.revisionScope === 'ALL' ||
    query.revisionScope === 'LATEST' ||
    query.revisionScope === 'APPROVED'
      ? query.revisionScope
      : 'ALL';

  // 1. Load all Customers, Projects+Revisions+Steps+Items, and Quotations from PostgreSQL
  const [rawCustomers, rawProjects, rawQuotations] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { shortName: 'asc' }
    }),
    prisma.project.findMany({
      include: {
        customer: true,
        revisions: {
          include: {
            steps: {
              include: {
                items: {
                  orderBy: { itemOrder: 'asc' }
                }
              },
              orderBy: { stepOrder: 'asc' }
            }
          },
          orderBy: { revisionNo: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.quotationItem.findMany({
      orderBy: [{ sapCustomerCode: 'asc' }, { materialCode: 'asc' }]
    })
  ]);

  const allCustomers: Customer[] = rawCustomers.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    shortName: c.shortName,
    customerName: c.customerName,
    salesmanName: c.salesmanName ?? null
  }));

  // 2. Apply Row-Level Salesman RBAC Isolation first
  const matchesEnforcedSalesman = (salesmanName: string | null | undefined): boolean => {
    if (!enforcedSalesmanScope) return true;
    if (enforcedSalesmanScope === '__NO_SALESMAN_ASSIGNED__') return false;
    const cleanTarget = enforcedSalesmanScope.trim().toLowerCase();
    const cleanActual = (salesmanName || '').trim().toLowerCase();
    return cleanActual === cleanTarget;
  };

  const rbacCustomers = allCustomers.filter((c) => matchesEnforcedSalesman(c.salesmanName));
  const rbacCustomerIds = new Set(rbacCustomers.map((c) => c.customerId));

  // Distinct available salesmen within RBAC scope
  const availableSalesmen = Array.from(
    new Set(
      rbacCustomers
        .map((c) => (c.salesmanName || '').trim())
        .filter((s) => s.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'vi'));

  // 3. Apply optional user-selected Salesman filter (for ADMIN / PROJECT_LEADER)
  const selectedSalesmanFilter =
    enforcedSalesmanScope ||
    (query.salesmanName && query.salesmanName.trim() !== '' && query.salesmanName !== 'ALL'
      ? query.salesmanName.trim()
      : null);

  const matchesActiveSalesmanFilter = (salesmanName: string | null | undefined): boolean => {
    if (!selectedSalesmanFilter) return true;
    if (selectedSalesmanFilter === '__NO_SALESMAN_ASSIGNED__') return false;
    if (selectedSalesmanFilter === '__UNASSIGNED__') {
      return !(salesmanName && salesmanName.trim().length > 0);
    }
    return (salesmanName || '').trim().toLowerCase() === selectedSalesmanFilter.toLowerCase();
  };

  const salesmanScopedCustomers = rbacCustomers.filter((c) =>
    matchesActiveSalesmanFilter(c.salesmanName)
  );
  const salesmanScopedCustomerCodes = new Set(salesmanScopedCustomers.map((c) => c.customerId));

  // Quotations scoped by RBAC & active salesman
  const scopedQuotations: QuotationItem[] = rawQuotations
    .filter((q) => {
      if (enforcedSalesmanScope) {
        return rbacCustomerIds.has(q.sapCustomerCode) && salesmanScopedCustomerCodes.has(q.sapCustomerCode);
      }
      if (selectedSalesmanFilter) {
        return salesmanScopedCustomerCodes.has(q.sapCustomerCode);
      }
      return true;
    })
    .map((q) => ({
      id: q.id,
      sapCustomerCode: q.sapCustomerCode,
      customerName: q.customerName,
      sapProductCode: q.sapProductCode,
      custProductKey: q.custProductKey,
      materialCode: q.materialCode,
      materialName: q.materialName,
      packingDesc: q.packingDesc,
      nett: q.nett,
      priceUnitVnd: q.priceUnitVnd,
      validFrom: q.validFrom,
      validTo: q.validTo
    }));

  const quotByCustAndCode = new Map<string, QuotationItem>();
  const quotByCode = new Map<string, QuotationItem>();
  const quotCountByCustomerCode = new Map<string, number>();

  for (const q of scopedQuotations) {
    const custCode = q.sapCustomerCode.trim();
    const matCode = q.materialCode.trim();
    quotByCustAndCode.set(`${custCode}__${matCode}`, q);
    if (!quotByCode.has(matCode)) {
      quotByCode.set(matCode, q);
    }
    quotCountByCustomerCode.set(custCode, (quotCountByCustomerCode.get(custCode) || 0) + 1);
  }

  // Enrich all projects within RBAC + Salesman scope
  const salesmanScopedProjects = rawProjects
    .filter((p) => matchesEnforcedSalesman(p.customer.salesmanName))
    .filter((p) => matchesActiveSalesmanFilter(p.customer.salesmanName))
    .map((p) => {
      const custDto: Customer = {
        id: p.customer.id,
        customerId: p.customer.customerId,
        shortName: p.customer.shortName,
        customerName: p.customer.customerName,
        salesmanName: p.customer.salesmanName ?? null
      };
      const allRevs = p.revisions.map((r) =>
        enrichProjectRevision(p.id, p.projectCode, custDto, r, quotByCustAndCode, quotByCode)
      );
      return {
        id: p.id,
        projectCode: p.projectCode,
        customerId: p.customerId,
        customer: custDto,
        allRevisions: allRevs
      };
    });

  // Collect available finishing systems and substrates before applying sub-filters
  const availableFinishingSystems = Array.from(
    new Set(
      salesmanScopedProjects.flatMap((p) =>
        p.allRevisions.map((r) => r.revision.finishingSystem.trim()).filter(Boolean)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  const availableSubstrates = Array.from(
    new Set(
      salesmanScopedProjects.flatMap((p) =>
        p.allRevisions.map((r) => r.revision.substrate.trim()).filter(Boolean)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  // Filter helper for customerId, finishingSystem, substrate, productName, q
  const filterCustomerCode =
    query.customerId && query.customerId.trim() !== '' && query.customerId !== 'ALL'
      ? query.customerId.trim()
      : null;
  const filterSystem =
    query.finishingSystem && query.finishingSystem.trim() !== '' && query.finishingSystem !== 'ALL'
      ? query.finishingSystem.trim().toLowerCase()
      : null;
  const filterSubstrate =
    query.substrate && query.substrate.trim() !== '' && query.substrate !== 'ALL'
      ? query.substrate.trim().toLowerCase()
      : null;
  const filterFurnitureProduct =
    query.productName && query.productName.trim() !== '' && query.productName !== 'ALL'
      ? query.productName.trim().toLowerCase()
      : null;
  const filterKeyword = query.q && query.q.trim() !== '' ? query.q.trim().toLowerCase() : null;

  const matchesRevisionSubFilters = (ctx: EnrichedRevisionContext): boolean => {
    if (
      filterCustomerCode &&
      ctx.customer.customerId !== filterCustomerCode &&
      ctx.customer.id !== filterCustomerCode
    ) {
      return false;
    }
    if (filterSystem && ctx.revision.finishingSystem.trim().toLowerCase() !== filterSystem) {
      return false;
    }
    if (filterSubstrate && ctx.revision.substrate.trim().toLowerCase() !== filterSubstrate) {
      return false;
    }
    if (
      filterFurnitureProduct &&
      ctx.revision.productName.trim().toLowerCase() !== filterFurnitureProduct
    ) {
      return false;
    }
    if (filterKeyword) {
      const matText = ctx.revision.steps
        .flatMap((s) => s.items.map((it) => `${it.materialCode} ${it.materialName}`))
        .join(' ');
      const hay = `${ctx.projectCode} ${ctx.customer.customerId} ${ctx.customer.shortName} ${ctx.customer.customerName} ${ctx.customer.salesmanName || ''} ${ctx.revision.productName} ${ctx.revision.colorName} ${ctx.revision.substrate} ${ctx.revision.finishingSystem} ${ctx.revision.preparedByTa || ''} ${matText}`.toLowerCase();
      if (!hay.includes(filterKeyword)) {
        return false;
      }
    }
    return true;
  };

  // Apply RevisionScopeFilter (`ALL` | `LATEST` | `APPROVED`) per project, then sub-filters
  const scopedProjectEntries = salesmanScopedProjects.map((proj) => {
    const scopeFiltered = filterRevisionsByScope(
      proj.allRevisions.map((c) => ({
        ...c,
        revisionNo: c.revision.revisionNo,
        status: c.revision.status
      })),
      revisionScope
    );
    const matchingRevs = scopeFiltered.filter(matchesRevisionSubFilters);
    return {
      ...proj,
      scopedRevisions: matchingRevs
    };
  });

  const allScopedRevisions: EnrichedRevisionContext[] = scopedProjectEntries.flatMap(
    (p) => p.scopedRevisions
  );

  // =========================================================================
  // REPORT 1: PRODUCT USAGE & WHERE-USED REPORT
  // =========================================================================
  const catalogMap = new Map<
    string,
    {
      materialCode: string;
      materialName: string;
      packingDesc: string | null;
      nettWeight: number;
      revisionIds: Set<string>;
      stepCount: number;
      customerIds: Set<string>;
    }
  >();

  // Populate catalog from all scoped revisions first
  for (const ctx of allScopedRevisions) {
    for (const stepCalc of ctx.costSummary.steps) {
      for (const item of stepCalc.items) {
        const code = (item.materialCode || '').trim();
        if (!code) continue;
        const existing = catalogMap.get(code);
        if (existing) {
          existing.revisionIds.add(ctx.revision.id);
          existing.stepCount += 1;
          existing.customerIds.add(ctx.customer.customerId);
          if ((!existing.materialName || existing.materialName === code) && item.materialName) {
            existing.materialName = item.materialName;
          }
        } else {
          catalogMap.set(code, {
            materialCode: code,
            materialName: item.materialName || code,
            packingDesc: item.packingDesc ?? '20 Kg',
            nettWeight: item.nettWeight > 0 ? item.nettWeight : 20,
            revisionIds: new Set([ctx.revision.id]),
            stepCount: 1,
            customerIds: new Set([ctx.customer.customerId])
          });
        }
      }
    }
  }

  const productCatalog: ProductCatalogOption[] = Array.from(catalogMap.values())
    .map((entry) => ({
      materialCode: entry.materialCode,
      materialName: entry.materialName,
      packingDesc: entry.packingDesc,
      nettWeight: entry.nettWeight,
      usageRevisionCount: entry.revisionIds.size,
      usageStepCount: entry.stepCount,
      customerCount: entry.customerIds.size
    }))
    .sort(
      (a, b) =>
        b.usageRevisionCount - a.usageRevisionCount ||
        b.usageStepCount - a.usageStepCount ||
        a.materialCode.localeCompare(b.materialCode)
    );

  const furnitureProducts = Array.from(
    new Set(
      salesmanScopedProjects.flatMap((p) =>
        p.allRevisions.map((r) => r.revision.productName.trim()).filter(Boolean)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  const selectedMaterialCode =
    query.materialCode && query.materialCode.trim() !== '' && query.materialCode !== 'ALL'
      ? query.materialCode.trim()
      : null;

  const productUsageRows: ProductUsageRow[] = [];
  for (const ctx of allScopedRevisions) {
    for (const stepCalc of ctx.costSummary.steps) {
      for (const item of stepCalc.items) {
        const code = (item.materialCode || '').trim();
        if (!code) continue;
        if (
          selectedMaterialCode &&
          code.toLowerCase() !== selectedMaterialCode.toLowerCase()
        ) {
          continue;
        }
        const itemCaPlusLossRaw = stepCalc.caPlusLossRaw * item.ratioShare;
        const itemCostRaw = (itemCaPlusLossRaw * item.priceSnapshotVnd) / 1000;

        productUsageRows.push({
          revisionId: ctx.revision.id,
          projectId: ctx.projectId,
          projectCode: ctx.projectCode,
          customerId: ctx.customer.customerId,
          customerShortName: ctx.customer.shortName,
          customerName: ctx.customer.customerName,
          salesmanName: ctx.customer.salesmanName ?? null,
          revisionNo: ctx.revision.revisionNo,
          status: ctx.revision.status,
          scheduleDate: ctx.revision.scheduleDate,
          productName: ctx.revision.productName,
          colorName: ctx.revision.colorName,
          substrate: ctx.revision.substrate,
          finishingSystem: ctx.revision.finishingSystem,
          stepId: stepCalc.stepId,
          stepNumber: stepCalc.stepNumber,
          stepName: stepCalc.stepName,
          methodName: stepCalc.methodName,
          efficiencyPercent: stepCalc.efficiencyPercentDisplay,
          materialCode: code,
          materialName: item.materialName || code,
          packingDesc: item.packingDesc,
          nettWeight: item.nettWeight,
          mixingRatio: item.mixingRatio,
          ratioSharePercent: Number((item.ratioShare * 100).toFixed(1)),
          stepCaAvgGramM2: Number(stepCalc.caAvg.toFixed(2)),
          stepCaPlusLossGramM2: stepCalc.caPlusLossDisplay,
          itemCaPlusLossGramM2: Number(itemCaPlusLossRaw.toFixed(2)),
          priceSnapshotVnd: isTech ? null : Math.round(item.priceSnapshotVnd),
          itemCoatingCostVndM2: isTech ? null : Number(itemCostRaw.toFixed(2)),
          stepCoatingCostVndM2: isTech ? null : stepCalc.coatingCostDisplay,
          revisionTotalCostVndM2: isTech ? null : ctx.costSummary.totalCoatingCostDisplay
        });
      }
    }
  }

  const usageRevIds = new Set(productUsageRows.map((r) => r.revisionId));
  const usageApprovedRevs = new Set(
    productUsageRows
      .filter((r) => r.status === 'APPROVED' || r.status === 'LOCKED')
      .map((r) => r.revisionId)
  );
  const usageDraftRevs = new Set(
    productUsageRows.filter((r) => r.status === 'DRAFT').map((r) => r.revisionId)
  );
  const usageItemCosts = productUsageRows
    .map((r) => r.itemCoatingCostVndM2)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const productUsage: ProductUsageReport = {
    productCatalog,
    furnitureProducts,
    selectedMaterialCode,
    summary: {
      totalCustomers: new Set(productUsageRows.map((r) => r.customerId)).size,
      totalProjects: new Set(productUsageRows.map((r) => r.projectId)).size,
      totalRevisions: usageRevIds.size,
      approvedRevisions: usageApprovedRevs.size,
      draftRevisions: usageDraftRevs.size,
      totalOccurrences: productUsageRows.length,
      avgCaPlusLossGramM2:
        productUsageRows.length > 0
          ? Number(
              (
                productUsageRows.reduce((s, r) => s + r.itemCaPlusLossGramM2, 0) /
                productUsageRows.length
              ).toFixed(2)
            )
          : 0,
      avgItemCostVndM2: isTech
        ? null
        : usageItemCosts.length > 0
          ? Number(
              (
                usageItemCosts.reduce((s, v) => s + v, 0) / usageItemCosts.length
              ).toFixed(2)
            )
          : 0,
      minItemCostVndM2: isTech
        ? null
        : usageItemCosts.length > 0
          ? Number(Math.min(...usageItemCosts).toFixed(2))
          : 0,
      maxItemCostVndM2: isTech
        ? null
        : usageItemCosts.length > 0
          ? Number(Math.max(...usageItemCosts).toFixed(2))
          : 0
    },
    usages: productUsageRows
  };

  // =========================================================================
  // REPORT 2: CUSTOMER CS/CC PORTFOLIO REPORT
  // =========================================================================
  const projectsByCustId = new Map<string, typeof scopedProjectEntries>();
  for (const proj of scopedProjectEntries) {
    const list = projectsByCustId.get(proj.customer.customerId) || [];
    list.push(proj);
    projectsByCustId.set(proj.customer.customerId, list);
  }

  const customerRows: CustomerPortfolioRow[] = [];
  for (const cust of salesmanScopedCustomers) {
    if (
      filterCustomerCode &&
      cust.customerId !== filterCustomerCode &&
      cust.id !== filterCustomerCode
    ) {
      continue;
    }

    const custProjects = projectsByCustId.get(cust.customerId) || [];
    const custScopedRevs = custProjects.flatMap((p) => p.scopedRevisions);

    const hasSubFilter = Boolean(
      filterSystem || filterSubstrate || filterFurnitureProduct
    );
    if (hasSubFilter && custScopedRevs.length === 0) {
      continue;
    }

    if (filterKeyword && custScopedRevs.length === 0) {
      const custHay = `${cust.customerId} ${cust.shortName} ${cust.customerName} ${cust.salesmanName || ''}`.toLowerCase();
      if (!custHay.includes(filterKeyword)) {
        continue;
      }
    }

    const distinctMats = new Set<string>();
    const distinctProds = new Set<string>();
    const revCosts: number[] = [];
    let sumGramM2 = 0;
    let approvedCount = 0;
    let draftCount = 0;

    const revReportRows: CustomerRevisionReportRow[] = custScopedRevs
      .sort(
        (a, b) =>
          a.projectCode.localeCompare(b.projectCode) ||
          b.revision.revisionNo - a.revision.revisionNo
      )
      .map((ctx) => {
        for (const m of ctx.distinctMaterials) distinctMats.add(m);
        if (ctx.revision.productName.trim()) {
          distinctProds.add(ctx.revision.productName.trim());
        }
        sumGramM2 += ctx.totalCaPlusLossGramM2Raw;
        revCosts.push(ctx.costSummary.totalCoatingCostDisplay);
        if (ctx.revision.status === 'APPROVED' || ctx.revision.status === 'LOCKED') {
          approvedCount += 1;
        } else {
          draftCount += 1;
        }

        return {
          revisionId: ctx.revision.id,
          projectId: ctx.projectId,
          projectCode: ctx.projectCode,
          revisionNo: ctx.revision.revisionNo,
          status: ctx.revision.status,
          scheduleDate: ctx.revision.scheduleDate,
          productName: ctx.revision.productName,
          colorName: ctx.revision.colorName,
          substrate: ctx.revision.substrate,
          finishingSystem: ctx.revision.finishingSystem,
          preparedByTa: ctx.revision.preparedByTa ?? null,
          stepCount: ctx.chemicalStepCount,
          distinctMaterialCount: ctx.distinctMaterials.size,
          totalCaPlusLossGramM2: ctx.totalCaPlusLossGramM2Display,
          totalCoatingCostVndM2: isTech ? null : ctx.costSummary.totalCoatingCostDisplay,
          defaultAreaM2: ctx.revision.defaultAreaM2
        };
      });

    const activeProjectsCount = hasSubFilter
      ? custProjects.filter((p) => p.scopedRevisions.length > 0).length
      : custProjects.length;

    customerRows.push({
      id: cust.id,
      customerId: cust.customerId,
      shortName: cust.shortName,
      customerName: cust.customerName,
      salesmanName: cust.salesmanName ?? null,
      projectCount: activeProjectsCount,
      totalRevisionCount: revReportRows.length,
      approvedRevisionCount: approvedCount,
      draftRevisionCount: draftCount,
      distinctMaterialCount: distinctMats.size,
      distinctProductCount: distinctProds.size,
      quotationCount: quotCountByCustomerCode.get(cust.customerId.trim()) || 0,
      totalConsumptionGramM2Avg:
        revReportRows.length > 0
          ? Number((sumGramM2 / revReportRows.length).toFixed(2))
          : 0,
      minCoatingCostVndM2: isTech
        ? null
        : revCosts.length > 0
          ? Math.min(...revCosts)
          : null,
      avgCoatingCostVndM2: isTech
        ? null
        : revCosts.length > 0
          ? Math.round(revCosts.reduce((s, v) => s + v, 0) / revCosts.length)
          : null,
      maxCoatingCostVndM2: isTech
        ? null
        : revCosts.length > 0
          ? Math.max(...revCosts)
          : null,
      revisions: revReportRows
    });
  }

  customerRows.sort(
    (a, b) =>
      b.totalRevisionCount - a.totalRevisionCount ||
      b.projectCount - a.projectCount ||
      b.quotationCount - a.quotationCount ||
      a.shortName.localeCompare(b.shortName)
  );

  const allPortfolioRevCosts = allScopedRevisions.map(
    (r) => r.costSummary.totalCoatingCostDisplay
  );

  const customerPortfolio: CustomerPortfolioReport = {
    summary: {
      totalCustomers: customerRows.length,
      activeCustomersWithProjects: customerRows.filter((c) => c.projectCount > 0).length,
      totalProjects: customerRows.reduce((s, c) => s + c.projectCount, 0),
      totalRevisions: customerRows.reduce((s, c) => s + c.totalRevisionCount, 0),
      approvedRevisions: customerRows.reduce((s, c) => s + c.approvedRevisionCount, 0),
      draftRevisions: customerRows.reduce((s, c) => s + c.draftRevisionCount, 0),
      avgRevisionCostVndM2: isTech
        ? null
        : allPortfolioRevCosts.length > 0
          ? Math.round(
              allPortfolioRevCosts.reduce((s, v) => s + v, 0) /
                allPortfolioRevCosts.length
            )
          : null
    },
    customers: customerRows
  };

  // =========================================================================
  // REPORT 3: REVISION COST & SPEC VARIANCE REPORT
  // =========================================================================
  const projectComparisons: ProjectRevisionVarianceRow[] = [];

  for (const proj of salesmanScopedProjects) {
    if (
      filterCustomerCode &&
      proj.customer.customerId !== filterCustomerCode &&
      proj.customer.id !== filterCustomerCode
    ) {
      continue;
    }

    const candidateRevs =
      revisionScope === 'APPROVED'
        ? proj.allRevisions.filter(
            (r) => r.revision.status === 'APPROVED' || r.revision.status === 'LOCKED'
          )
        : proj.allRevisions;

    if (candidateRevs.length === 0) continue;

    const sortedRevs = [...candidateRevs].sort(
      (a, b) => a.revision.revisionNo - b.revision.revisionNo
    );

    let baseCtx = sortedRevs[0];
    let targetCtx = sortedRevs[sortedRevs.length - 1];

    if (query.compareProjectId && query.compareProjectId === proj.id) {
      if (query.baseRevId) {
        const foundBase = proj.allRevisions.find((r) => r.revision.id === query.baseRevId);
        if (foundBase) baseCtx = foundBase;
      }
      if (query.targetRevId) {
        const foundTarget = proj.allRevisions.find(
          (r) => r.revision.id === query.targetRevId
        );
        if (foundTarget) targetCtx = foundTarget;
      }
    }

    if (!matchesRevisionSubFilters(baseCtx) && !matchesRevisionSubFilters(targetCtx)) {
      continue;
    }

    // Aggregate materials in baseCtx vs targetCtx
    const aggregateRevMaterials = (ctx: EnrichedRevisionContext) => {
      const map = new Map<
        string,
        {
          materialCode: string;
          materialName: string;
          gramM2Raw: number;
          priceVnd: number;
          costVndM2Raw: number;
        }
      >();
      for (const st of ctx.costSummary.steps) {
        for (const it of st.items) {
          const code = (it.materialCode || '').trim();
          if (!code) continue;
          const itemGram = st.caPlusLossRaw * it.ratioShare;
          const itemCost = (itemGram * it.priceSnapshotVnd) / 1000;
          const ex = map.get(code);
          if (ex) {
            ex.gramM2Raw += itemGram;
            ex.costVndM2Raw += itemCost;
            ex.priceVnd = it.priceSnapshotVnd;
          } else {
            map.set(code, {
              materialCode: code,
              materialName: it.materialName || code,
              gramM2Raw: itemGram,
              priceVnd: it.priceSnapshotVnd,
              costVndM2Raw: itemCost
            });
          }
        }
      }
      return map;
    };

    const baseMap = aggregateRevMaterials(baseCtx);
    const targetMap = aggregateRevMaterials(targetCtx);
    const allCodes = Array.from(new Set([...baseMap.keys(), ...targetMap.keys()])).sort();

    const itemDiffs: RevisionMaterialDiffRow[] = allCodes.map((code) => {
      const b = baseMap.get(code);
      const t = targetMap.get(code);
      const baseGram = b ? Number(b.gramM2Raw.toFixed(2)) : 0;
      const targetGram = t ? Number(t.gramM2Raw.toFixed(2)) : 0;
      const deltaGram = Number((targetGram - baseGram).toFixed(2));

      const basePrice = b ? Math.round(b.priceVnd) : 0;
      const targetPrice = t ? Math.round(t.priceVnd) : 0;
      const deltaPrice = targetPrice - basePrice;

      const baseCost = b ? Number(b.costVndM2Raw.toFixed(2)) : 0;
      const targetCost = t ? Number(t.costVndM2Raw.toFixed(2)) : 0;
      const deltaCost = Number((targetCost - baseCost).toFixed(2));

      let changeType: RevisionMaterialDiffRow['changeType'] = 'UNCHANGED';
      if (!b && t) {
        changeType = 'ADDED';
      } else if (b && !t) {
        changeType = 'REMOVED';
      } else if (Math.abs(deltaGram) > 0.01 || Math.abs(deltaPrice) >= 1) {
        changeType = 'MODIFIED';
      }

      return {
        materialCode: code,
        materialName: (t?.materialName || b?.materialName || code).trim(),
        changeType,
        baseGramM2: baseGram,
        targetGramM2: targetGram,
        deltaGramM2: deltaGram,
        basePriceVnd: isTech ? null : b ? basePrice : null,
        targetPriceVnd: isTech ? null : t ? targetPrice : null,
        deltaPriceVnd: isTech ? null : b && t ? deltaPrice : null,
        baseCostVndM2: isTech ? null : baseCost,
        targetCostVndM2: isTech ? null : targetCost,
        deltaCostVndM2: isTech ? null : deltaCost
      };
    });

    const baseCostDisplay = baseCtx.costSummary.totalCoatingCostDisplay;
    const targetCostDisplay = targetCtx.costSummary.totalCoatingCostDisplay;
    const deltaCostDisplay = targetCostDisplay - baseCostDisplay;
    const deltaCostPct =
      baseCostDisplay > 0
        ? Number(((deltaCostDisplay / baseCostDisplay) * 100).toFixed(2))
        : 0;

    projectComparisons.push({
      projectId: proj.id,
      projectCode: proj.projectCode,
      customerId: proj.customer.customerId,
      customerShortName: proj.customer.shortName,
      salesmanName: proj.customer.salesmanName ?? null,
      productName: targetCtx.revision.productName,
      colorName: targetCtx.revision.colorName,
      finishingSystem: targetCtx.revision.finishingSystem,
      totalRevisionsCount: proj.allRevisions.length,
      baseRevisionId: baseCtx.revision.id,
      baseRevisionNo: baseCtx.revision.revisionNo,
      baseStatus: baseCtx.revision.status,
      targetRevisionId: targetCtx.revision.id,
      targetRevisionNo: targetCtx.revision.revisionNo,
      targetStatus: targetCtx.revision.status,
      baseStepCount: baseCtx.chemicalStepCount,
      targetStepCount: targetCtx.chemicalStepCount,
      deltaStepCount: targetCtx.chemicalStepCount - baseCtx.chemicalStepCount,
      baseTotalGramM2: baseCtx.totalCaPlusLossGramM2Display,
      targetTotalGramM2: targetCtx.totalCaPlusLossGramM2Display,
      deltaTotalGramM2: Number(
        (
          targetCtx.totalCaPlusLossGramM2Display - baseCtx.totalCaPlusLossGramM2Display
        ).toFixed(2)
      ),
      baseCostVndM2: isTech ? null : baseCostDisplay,
      targetCostVndM2: isTech ? null : targetCostDisplay,
      deltaCostVndM2: isTech ? null : deltaCostDisplay,
      deltaCostPercent: isTech ? null : deltaCostPct,
      itemDiffs
    });
  }

  projectComparisons.sort(
    (a, b) =>
      b.totalRevisionsCount - a.totalRevisionsCount ||
      Math.abs(b.deltaTotalGramM2) - Math.abs(a.deltaTotalGramM2) ||
      a.projectCode.localeCompare(b.projectCode)
  );

  const revisionVariance: RevisionVarianceReport = {
    projectComparisons
  };

  // =========================================================================
  // REPORT 4: PRICE DRIFT & QUOTATION ALERT REPORT
  // =========================================================================
  const nowDate = new Date();
  const priceDriftItems: PriceDriftRow[] = [];
  let matchedCount = 0;
  let priceDriftCount = 0;
  let expiredQuotationCount = 0;
  let missingQuotationCount = 0;
  let totalDriftImpactRaw = 0;

  for (const ctx of allScopedRevisions) {
    const custCode = ctx.customer.customerId.trim();
    for (const stepCalc of ctx.costSummary.steps) {
      for (const item of stepCalc.items) {
        const code = (item.materialCode || '').trim();
        if (!code) continue;
        if (
          selectedMaterialCode &&
          code.toLowerCase() !== selectedMaterialCode.toLowerCase()
        ) {
          continue;
        }

        const quot =
          quotByCustAndCode.get(`${custCode}__${code}`) ?? quotByCode.get(code) ?? null;
        const itemGramRaw = stepCalc.caPlusLossRaw * item.ratioShare;
        const snapPrice = item.priceSnapshotVnd;
        const livePrice = quot ? quot.priceUnitVnd ?? 0 : null;

        const validToDate = parseFlexibleDate(quot?.validTo);
        const isExpired = validToDate ? validToDate.getTime() < nowDate.getTime() : false;

        let alertStatus: PriceDriftRow['alertStatus'] = 'MATCHED';
        if (!quot) {
          alertStatus = 'MISSING_QUOTATION';
          missingQuotationCount += 1;
        } else if (livePrice !== null && Math.abs(livePrice - snapPrice) >= 1) {
          alertStatus = 'PRICE_DRIFT';
          priceDriftCount += 1;
          if (isExpired) {
            expiredQuotationCount += 1;
          }
        } else if (isExpired) {
          alertStatus = 'EXPIRED';
          expiredQuotationCount += 1;
        } else {
          matchedCount += 1;
        }

        const deltaPrice = livePrice !== null ? Math.round(livePrice - snapPrice) : null;
        const deltaPct =
          deltaPrice !== null && snapPrice > 0
            ? Number(((deltaPrice / snapPrice) * 100).toFixed(2))
            : null;
        const impactRaw =
          deltaPrice !== null ? (deltaPrice * itemGramRaw) / 1000 : 0;
        totalDriftImpactRaw += impactRaw;

        priceDriftItems.push({
          revisionId: ctx.revision.id,
          projectId: ctx.projectId,
          projectCode: ctx.projectCode,
          customerId: ctx.customer.customerId,
          customerShortName: ctx.customer.shortName,
          salesmanName: ctx.customer.salesmanName ?? null,
          revisionNo: ctx.revision.revisionNo,
          status: ctx.revision.status,
          productName: ctx.revision.productName,
          stepNumber: stepCalc.stepNumber,
          stepName: stepCalc.stepName,
          materialCode: code,
          materialName: item.materialName || code,
          itemCaPlusLossGramM2: Number(itemGramRaw.toFixed(2)),
          snapshotPriceVnd: isTech ? null : Math.round(snapPrice),
          latestQuotationPriceVnd: isTech
            ? null
            : livePrice !== null
              ? Math.round(livePrice)
              : null,
          deltaPriceVnd: isTech ? null : deltaPrice,
          deltaPricePercent: isTech ? null : deltaPct,
          costImpactVndM2: isTech
            ? null
            : deltaPrice !== null
              ? Number(impactRaw.toFixed(2))
              : null,
          validFrom: quot?.validFrom ?? null,
          validTo: quot?.validTo ?? null,
          alertStatus
        });
      }
    }
  }

  const alertPriority: Record<PriceDriftRow['alertStatus'], number> = {
    PRICE_DRIFT: 1,
    EXPIRED: 2,
    MISSING_QUOTATION: 3,
    MATCHED: 4
  };
  priceDriftItems.sort(
    (a, b) =>
      alertPriority[a.alertStatus] - alertPriority[b.alertStatus] ||
      Math.abs(b.costImpactVndM2 || 0) - Math.abs(a.costImpactVndM2 || 0)
  );

  const priceDrift: PriceDriftReport = {
    summary: {
      totalCheckedItems: priceDriftItems.length,
      matchedCount,
      priceDriftCount,
      expiredQuotationCount,
      missingQuotationCount,
      totalDriftImpactVndM2: isTech ? null : Number(totalDriftImpactRaw.toFixed(2))
    },
    items: priceDriftItems
  };

  // =========================================================================
  // REPORT 5: STEP & FINISHING SYSTEM BENCHMARK REPORT
  // =========================================================================
  const stepGroupMap = new Map<
    string,
    {
      stepName: string;
      occurrenceCount: number;
      revisionIds: Set<string>;
      materialCodes: Set<string>;
      sumCaAvg: number;
      sumCaPlusLoss: number;
      sumStepCost: number;
      stepCosts: number[];
    }
  >();

  let grandTotalStepCostRaw = 0;
  let grandTotalStepGramRaw = 0;

  for (const ctx of allScopedRevisions) {
    for (const st of ctx.costSummary.steps) {
      const name = (st.stepName || 'UNSPECIFIED STEP').trim().toUpperCase();
      grandTotalStepCostRaw += st.coatingCostRaw;
      grandTotalStepGramRaw += st.caPlusLossRaw;

      const ex = stepGroupMap.get(name);
      if (ex) {
        ex.occurrenceCount += 1;
        ex.revisionIds.add(ctx.revision.id);
        for (const it of st.items) {
          if (it.materialCode.trim()) ex.materialCodes.add(it.materialCode.trim());
        }
        ex.sumCaAvg += st.caAvg;
        ex.sumCaPlusLoss += st.caPlusLossRaw;
        ex.sumStepCost += st.coatingCostRaw;
        ex.stepCosts.push(st.coatingCostDisplay);
      } else {
        const mats = new Set<string>();
        for (const it of st.items) {
          if (it.materialCode.trim()) mats.add(it.materialCode.trim());
        }
        stepGroupMap.set(name, {
          stepName: name,
          occurrenceCount: 1,
          revisionIds: new Set([ctx.revision.id]),
          materialCodes: mats,
          sumCaAvg: st.caAvg,
          sumCaPlusLoss: st.caPlusLossRaw,
          sumStepCost: st.coatingCostRaw,
          stepCosts: [st.coatingCostDisplay]
        });
      }
    }
  }

  const byStep: StepBenchmarkRow[] = Array.from(stepGroupMap.values())
    .map((g) => ({
      stepName: g.stepName,
      occurrenceCount: g.occurrenceCount,
      revisionCount: g.revisionIds.size,
      distinctMaterialCount: g.materialCodes.size,
      avgCaGramM2: Number((g.sumCaAvg / g.occurrenceCount).toFixed(2)),
      avgCaPlusLossGramM2: Number((g.sumCaPlusLoss / g.occurrenceCount).toFixed(2)),
      avgStepCostVndM2: isTech
        ? null
        : Number((g.sumStepCost / g.occurrenceCount).toFixed(2)),
      minStepCostVndM2: isTech ? null : Math.min(...g.stepCosts),
      maxStepCostVndM2: isTech ? null : Math.max(...g.stepCosts),
      costSharePercent: isTech
        ? null
        : grandTotalStepCostRaw > 0
          ? Number(((g.sumStepCost / grandTotalStepCostRaw) * 100).toFixed(1))
          : 0,
      gramSharePercent:
        grandTotalStepGramRaw > 0
          ? Number(((g.sumCaPlusLoss / grandTotalStepGramRaw) * 100).toFixed(1))
          : 0
    }))
    .sort((a, b) => b.avgCaPlusLossGramM2 - a.avgCaPlusLossGramM2);

  const systemGroupMap = new Map<
    string,
    {
      finishingSystem: string;
      substrate: string;
      revisionCount: number;
      projectIds: Set<string>;
      customerIds: Set<string>;
      sumSteps: number;
      sumGramM2: number;
      costs: number[];
    }
  >();

  for (const ctx of allScopedRevisions) {
    const sys = (ctx.revision.finishingSystem || 'STANDARD').trim().toUpperCase();
    const sub = (ctx.revision.substrate || 'STANDARD').trim().toUpperCase();
    const key = `${sys}__${sub}`;
    const ex = systemGroupMap.get(key);
    if (ex) {
      ex.revisionCount += 1;
      ex.projectIds.add(ctx.projectId);
      ex.customerIds.add(ctx.customer.customerId);
      ex.sumSteps += ctx.chemicalStepCount;
      ex.sumGramM2 += ctx.totalCaPlusLossGramM2Raw;
      ex.costs.push(ctx.costSummary.totalCoatingCostDisplay);
    } else {
      systemGroupMap.set(key, {
        finishingSystem: sys,
        substrate: sub,
        revisionCount: 1,
        projectIds: new Set([ctx.projectId]),
        customerIds: new Set([ctx.customer.customerId]),
        sumSteps: ctx.chemicalStepCount,
        sumGramM2: ctx.totalCaPlusLossGramM2Raw,
        costs: [ctx.costSummary.totalCoatingCostDisplay]
      });
    }
  }

  const bySystem: FinishingSystemBenchmarkRow[] = Array.from(systemGroupMap.values())
    .map((g) => ({
      finishingSystem: g.finishingSystem,
      substrate: g.substrate,
      revisionCount: g.revisionCount,
      projectCount: g.projectIds.size,
      customerCount: g.customerIds.size,
      avgStepCount: Number((g.sumSteps / g.revisionCount).toFixed(1)),
      avgTotalCaPlusLossGramM2: Number((g.sumGramM2 / g.revisionCount).toFixed(2)),
      minCostVndM2: isTech ? null : Math.min(...g.costs),
      avgCostVndM2: isTech
        ? null
        : Math.round(g.costs.reduce((s, v) => s + v, 0) / g.costs.length),
      maxCostVndM2: isTech ? null : Math.max(...g.costs)
    }))
    .sort((a, b) => b.revisionCount - a.revisionCount);

  const stepBenchmark: StepSystemBenchmarkReport = {
    byStep,
    bySystem
  };

  // =========================================================================
  // REPORT 6: AGGREGATED MULTI-PROJECT BOM FORECAST
  // =========================================================================
  const bomForecast = buildAggregatedBomForecast({
    scopedRevisions: allScopedRevisions,
    userRole,
    bomAllocations
  });

  // =========================================================================
  // REPORT 7: SALESMAN & TECHNICAL ACTIVITY FUNNEL
  // =========================================================================
  const salesmanMap = new Map<
    string,
    {
      salesmanName: string;
      customerIds: Set<string>;
      activeCustomerIds: Set<string>;
      projectIds: Set<string>;
      totalRevisions: number;
      approvedRevisions: number;
      draftRevisions: number;
      costs: number[];
    }
  >();

  for (const cust of salesmanScopedCustomers) {
    if (
      filterCustomerCode &&
      cust.customerId !== filterCustomerCode &&
      cust.id !== filterCustomerCode
    ) {
      continue;
    }
    const sName = (cust.salesmanName || '').trim() || 'Chưa gán Sales / Unassigned';
    if (!salesmanMap.has(sName)) {
      salesmanMap.set(sName, {
        salesmanName: sName,
        customerIds: new Set(),
        activeCustomerIds: new Set(),
        projectIds: new Set(),
        totalRevisions: 0,
        approvedRevisions: 0,
        draftRevisions: 0,
        costs: []
      });
    }
    salesmanMap.get(sName)!.customerIds.add(cust.customerId);
  }

  for (const ctx of allScopedRevisions) {
    const sName = (ctx.customer.salesmanName || '').trim() || 'Chưa gán Sales / Unassigned';
    if (!salesmanMap.has(sName)) {
      salesmanMap.set(sName, {
        salesmanName: sName,
        customerIds: new Set([ctx.customer.customerId]),
        activeCustomerIds: new Set(),
        projectIds: new Set(),
        totalRevisions: 0,
        approvedRevisions: 0,
        draftRevisions: 0,
        costs: []
      });
    }
    const entry = salesmanMap.get(sName)!;
    entry.customerIds.add(ctx.customer.customerId);
    entry.activeCustomerIds.add(ctx.customer.customerId);
    entry.projectIds.add(ctx.projectId);
    entry.totalRevisions += 1;
    if (ctx.revision.status === 'APPROVED' || ctx.revision.status === 'LOCKED') {
      entry.approvedRevisions += 1;
    } else {
      entry.draftRevisions += 1;
    }
    entry.costs.push(ctx.costSummary.totalCoatingCostDisplay);
  }

  const bySalesman: SalesmanActivityRow[] = Array.from(salesmanMap.values())
    .map((entry) => ({
      salesmanName: entry.salesmanName,
      customerCount: entry.customerIds.size,
      activeCustomerCount: entry.activeCustomerIds.size,
      projectCount: entry.projectIds.size,
      totalRevisions: entry.totalRevisions,
      approvedRevisions: entry.approvedRevisions,
      draftRevisions: entry.draftRevisions,
      approvalRatePercent:
        entry.totalRevisions > 0
          ? Number(((entry.approvedRevisions / entry.totalRevisions) * 100).toFixed(1))
          : 0,
      avgRevisionsPerProject:
        entry.projectIds.size > 0
          ? Number((entry.totalRevisions / entry.projectIds.size).toFixed(2))
          : 0,
      avgCoatingCostVndM2: isTech
        ? null
        : entry.costs.length > 0
          ? Math.round(entry.costs.reduce((s, v) => s + v, 0) / entry.costs.length)
          : null
    }))
    .sort(
      (a, b) =>
        b.totalRevisions - a.totalRevisions ||
        b.customerCount - a.customerCount ||
        a.salesmanName.localeCompare(b.salesmanName)
    );

  const taMap = new Map<
    string,
    {
      preparedByTa: string;
      projectIds: Set<string>;
      customerIds: Set<string>;
      totalRevisions: number;
      approvedRevisions: number;
      draftRevisions: number;
      systems: Set<string>;
      sumSteps: number;
      sumGramM2: number;
    }
  >();

  for (const ctx of allScopedRevisions) {
    const taName = (ctx.revision.preparedByTa || '').trim() || 'Chưa ghi tên TA / Unspecified TA';
    if (!taMap.has(taName)) {
      taMap.set(taName, {
        preparedByTa: taName,
        projectIds: new Set(),
        customerIds: new Set(),
        totalRevisions: 0,
        approvedRevisions: 0,
        draftRevisions: 0,
        systems: new Set(),
        sumSteps: 0,
        sumGramM2: 0
      });
    }
    const entry = taMap.get(taName)!;
    entry.projectIds.add(ctx.projectId);
    entry.customerIds.add(ctx.customer.customerId);
    entry.totalRevisions += 1;
    if (ctx.revision.status === 'APPROVED' || ctx.revision.status === 'LOCKED') {
      entry.approvedRevisions += 1;
    } else {
      entry.draftRevisions += 1;
    }
    if (ctx.revision.finishingSystem.trim()) {
      entry.systems.add(ctx.revision.finishingSystem.trim().toUpperCase());
    }
    entry.sumSteps += ctx.chemicalStepCount;
    entry.sumGramM2 += ctx.totalCaPlusLossGramM2Raw;
  }

  const byTechnicalTa: TechnicalTaActivityRow[] = Array.from(taMap.values())
    .map((entry) => ({
      preparedByTa: entry.preparedByTa,
      projectCount: entry.projectIds.size,
      customerCount: entry.customerIds.size,
      totalRevisions: entry.totalRevisions,
      approvedRevisions: entry.approvedRevisions,
      draftRevisions: entry.draftRevisions,
      approvalRatePercent:
        entry.totalRevisions > 0
          ? Number(((entry.approvedRevisions / entry.totalRevisions) * 100).toFixed(1))
          : 0,
      distinctSystemsCount: entry.systems.size,
      avgStepCount:
        entry.totalRevisions > 0
          ? Number((entry.sumSteps / entry.totalRevisions).toFixed(1))
          : 0,
      avgConsumptionGramM2:
        entry.totalRevisions > 0
          ? Number((entry.sumGramM2 / entry.totalRevisions).toFixed(2))
          : 0
    }))
    .sort((a, b) => b.totalRevisions - a.totalRevisions);

  const activityFunnel: SalesTechnicalActivityReport = {
    bySalesman,
    byTechnicalTa
  };

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      userRole,
      enforcedSalesmanScope,
      appliedFilters: {
        ...query,
        revisionScope
      },
      availableSalesmen,
      availableCustomers: salesmanScopedCustomers,
      availableFinishingSystems,
      availableSubstrates
    },
    productUsage,
    customerPortfolio,
    revisionVariance,
    priceDrift,
    stepBenchmark,
    bomForecast,
    activityFunnel
  };
}

export function buildAggregatedBomForecast(params: {
  scopedRevisions: EnrichedRevisionContext[];
  userRole: UserRole;
  bomAllocations?: BomForecastInputAllocation[];
}): AggregatedBomForecastReport {
  const { scopedRevisions, userRole, bomAllocations } = params;
  const isTech = userRole === 'TECHNICAL';
  const allocLookup = new Map<string, BomForecastInputAllocation>();
  if (Array.isArray(bomAllocations)) {
    for (const a of bomAllocations) {
      if (a && a.revisionId) {
        allocLookup.set(a.revisionId, a);
      }
    }
  }

  const hasCustomAllocations = allocLookup.size > 0;
  const allocations: BomForecastRevisionAllocation[] = [];

  const materialGroup = new Map<
    string,
    {
      materialCode: string;
      materialName: string;
      packingDesc: string | null;
      nettWeight: number;
      revisionIds: Set<string>;
      customerIds: Set<string>;
      projectCodes: Set<string>;
      totalRequiredKgRaw: number;
      totalCostVndRaw: number;
      priceSamples: number[];
    }
  >();

  let selectedRevisionsCount = 0;
  let totalAreaM2 = 0;

  for (const ctx of scopedRevisions) {
    const custom = allocLookup.get(ctx.revision.id);
    const selected = hasCustomAllocations ? Boolean(custom && custom.selected !== false) : true;
    const areaM2 =
      custom && Number(custom.areaM2) > 0
        ? Number(custom.areaM2)
        : ctx.revision.defaultAreaM2 > 0
          ? ctx.revision.defaultAreaM2
          : 100;

    const bom = calculateBomSummary(
      ctx.revision.id,
      areaM2,
      ctx.revision.steps,
      userRole
    );

    allocations.push({
      revisionId: ctx.revision.id,
      projectId: ctx.projectId,
      projectCode: ctx.projectCode,
      customerId: ctx.customer.customerId,
      customerShortName: ctx.customer.shortName,
      salesmanName: ctx.customer.salesmanName ?? null,
      revisionNo: ctx.revision.revisionNo,
      status: ctx.revision.status,
      productName: ctx.revision.productName,
      colorName: ctx.revision.colorName,
      areaM2,
      selected,
      revisionCostVndM2: isTech ? null : ctx.costSummary.totalCoatingCostDisplay,
      estimatedProjectCostVnd: isTech ? null : bom.totalProjectMaterialCostDisplay
    });

    if (!selected) continue;
    selectedRevisionsCount += 1;
    totalAreaM2 += areaM2;

    for (const bItem of bom.items) {
      const code = bItem.materialCode.trim();
      if (!code) continue;
      const ex = materialGroup.get(code);
      if (ex) {
        ex.revisionIds.add(ctx.revision.id);
        ex.customerIds.add(ctx.customer.customerId);
        ex.projectCodes.add(ctx.projectCode);
        ex.totalRequiredKgRaw += bItem.totalRequiredKgOrLtrRaw;
        ex.totalCostVndRaw += bItem.totalMaterialCostRaw ?? 0;
        if (typeof bItem.priceUnitVnd === 'number' && bItem.priceUnitVnd > 0) {
          ex.priceSamples.push(bItem.priceUnitVnd);
        }
      } else {
        materialGroup.set(code, {
          materialCode: code,
          materialName: bItem.materialName,
          packingDesc: bItem.packingDesc,
          nettWeight: bItem.nettWeight > 0 ? bItem.nettWeight : 20,
          revisionIds: new Set([ctx.revision.id]),
          customerIds: new Set([ctx.customer.customerId]),
          projectCodes: new Set([ctx.projectCode]),
          totalRequiredKgRaw: bItem.totalRequiredKgOrLtrRaw,
          totalCostVndRaw: bItem.totalMaterialCostRaw ?? 0,
          priceSamples:
            typeof bItem.priceUnitVnd === 'number' && bItem.priceUnitVnd > 0
              ? [bItem.priceUnitVnd]
              : []
        });
      }
    }
  }

  let totalReqKgAll = 0;
  let totalPacksAll = 0;
  let totalEstimatedCostAllRaw = 0;

  const materials: AggregatedBomMaterialRow[] = Array.from(materialGroup.values())
    .map((m) => {
      const safeNett = m.nettWeight > 0 ? m.nettWeight : 20;
      const packsExact = m.totalRequiredKgRaw / safeNett;
      const packsRounded = Math.ceil(packsExact);
      totalReqKgAll += m.totalRequiredKgRaw;
      totalPacksAll += packsRounded;
      totalEstimatedCostAllRaw += m.totalCostVndRaw;

      const avgPrice =
        m.priceSamples.length > 0
          ? Math.round(
              m.priceSamples.reduce((s, v) => s + v, 0) / m.priceSamples.length
            )
          : 0;

      return {
        materialCode: m.materialCode,
        materialName: m.materialName,
        packingDesc: m.packingDesc,
        nettWeight: safeNett,
        usedInRevisionsCount: m.revisionIds.size,
        usedByCustomersCount: m.customerIds.size,
        projectCodes: Array.from(m.projectCodes).sort(),
        totalRequiredKgOrLtr: Number(m.totalRequiredKgRaw.toFixed(2)),
        totalPacksExact: Number(packsExact.toFixed(2)),
        totalPacksRounded: packsRounded,
        avgPriceUnitVnd: isTech ? null : avgPrice,
        totalEstimatedCostVnd: isTech ? null : Math.round(m.totalCostVndRaw)
      };
    })
    .sort((a, b) => b.totalRequiredKgOrLtr - a.totalRequiredKgOrLtr);

  return {
    allocations,
    materials,
    summary: {
      selectedRevisionsCount,
      totalAreaM2: Number(totalAreaM2.toFixed(2)),
      distinctMaterialsCount: materials.length,
      totalRequiredKgOrLtr: Number(totalReqKgAll.toFixed(2)),
      totalPacksRounded: totalPacksAll,
      totalEstimatedCostVnd: isTech ? null : Math.round(totalEstimatedCostAllRaw)
    }
  };
}

