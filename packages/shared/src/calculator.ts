import {
  ParsedCaRange,
  ScheduleStep,
  StepCostCalculation,
  CoatingCostSummary,
  BomSummary,
  BomItemCalculation,
  ProjectRevision,
  UserRole
} from './types';

/**
 * Parses a CA (g/m²) input string from Coating Schedule.
 * Supports range strings like "100-120", "90 - 100", "100~120", or single numbers like "110".
 * Returns caMin, caMax, and exact arithmetic mean (caAvg) matching Excel's `(U13+V13)/2`.
 */
export function parseCaInput(caInputRaw: string | number | null | undefined): ParsedCaRange {
  if (typeof caInputRaw === 'number') {
    const val = Number.isFinite(caInputRaw) ? caInputRaw : 0;
    return { raw: String(val), caMin: val, caMax: val, caAvg: val };
  }
  const raw = (caInputRaw ?? '').toString().trim();
  if (!raw) {
    return { raw: '', caMin: null, caMax: null, caAvg: 0 };
  }

  const rangeMatch = raw.match(/^(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const caMin = parseFloat(rangeMatch[1]);
    const caMax = parseFloat(rangeMatch[2]);
    const caAvg = (caMin + caMax) / 2;
    return { raw, caMin, caMax, caAvg };
  }

  const singleVal = parseFloat(raw);
  if (Number.isFinite(singleVal)) {
    return { raw, caMin: singleVal, caMax: singleVal, caAvg: singleVal };
  }

  return { raw, caMin: null, caMax: null, caAvg: 0 };
}

/**
 * Computes dynamic Excel row indices and rowSpan blocks for both CS and CC tables.
 * Handles variable chemical counts per step (e.g., 1, 2, 3, 5, or N rows) and 1-row SANDING steps.
 */
export function computeDynamicRowSpanLayout(steps: ScheduleStep[]): Map<
  string,
  {
    rowSpan: number;
    csExcelStartRow: number;
    csExcelEndRow: number;
    ccExcelStartRow: number;
    ccExcelEndRow: number;
  }
> {
  const layoutMap = new Map<
    string,
    {
      rowSpan: number;
      csExcelStartRow: number;
      csExcelEndRow: number;
      ccExcelStartRow: number;
      ccExcelEndRow: number;
    }
  >();

  let currentCsRow = 8; // Row 7 is header in CS export
  let currentCcRow = 7; // Row 6 is header in CC export

  const orderedSteps = [...(steps || [])].sort((a, b) => a.stepOrder - b.stepOrder);

  for (const step of orderedSteps) {
    if (step.rowType === 'SANDING') {
      layoutMap.set(step.id, {
        rowSpan: 1,
        csExcelStartRow: currentCsRow,
        csExcelEndRow: currentCsRow,
        ccExcelStartRow: -1,
        ccExcelEndRow: -1
      });
      currentCsRow += 1;
    } else {
      const rowSpan = Math.max(1, step.items?.length || 0);
      const csStart = currentCsRow;
      const csEnd = currentCsRow + rowSpan - 1;
      const ccStart = currentCcRow;
      const ccEnd = currentCcRow + rowSpan - 1;

      layoutMap.set(step.id, {
        rowSpan,
        csExcelStartRow: csStart,
        csExcelEndRow: csEnd,
        ccExcelStartRow: ccStart,
        ccExcelEndRow: ccEnd
      });

      currentCsRow += rowSpan;
      currentCcRow += rowSpan;
    }
  }

  return layoutMap;
}

/**
 * Core Calculation Engine: Auto-maps Coating Schedule (CS) steps to Coating Cost (CC).
 *
 * DEVELOPER NOTE 1 (Floating-Point Precision):
 * All intermediate calculations (`mixedPriceRaw`, `caPlusLossRaw`, `coverageRaw`, `coatingCostRaw`)
 * retain full IEEE-754 double precision without early rounding:
 *   - mixedPriceRaw  = sum(price_i * ratio_i) / sum(ratio_i)
 *   - caPlusLossRaw  = (1 / efficiency) * caAvg
 *   - coverageRaw    = 1000 / caPlusLossRaw
 *   - coatingCostRaw = (caPlusLossRaw * mixedPriceRaw) / 1000   [exact Excel `=J7*F7/1000`]
 *   - totalCoatingCostRaw = sum(coatingCostRaw)                 [exact Excel `=SUM(L7:L56)`]
 * Rounding is performed ONLY on `*Display` fields for UI rendering.
 *
 * DEVELOPER NOTE 2 (Dynamic rowSpan / mergeCells):
 * Every coating step dynamically computes `rowSpan = Math.max(1, step.items.length)` and exact
 * start/end row coordinates so steps with 1, 2, 3, 5, or N items merge seamlessly on UI and Excel.
 */
export function calculateCoatingCostTable(
  revisionId: string,
  steps: ScheduleStep[]
): CoatingCostSummary {
  const safeSteps = Array.isArray(steps) ? steps : [];
  const layoutMap = computeDynamicRowSpanLayout(safeSteps);
  const orderedChemSteps = [...safeSteps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .filter((s) => s.rowType === 'CHEMICAL_STEP');

  const calculatedSteps: StepCostCalculation[] = [];
  let totalCoatingCostRaw = 0;

  for (const step of orderedChemSteps) {
    const items = step.items || [];
    const layout = layoutMap.get(step.id) ?? {
      rowSpan: Math.max(1, items.length),
      csExcelStartRow: 8,
      csExcelEndRow: 8 + Math.max(1, items.length) - 1,
      ccExcelStartRow: 7,
      ccExcelEndRow: 7 + Math.max(1, items.length) - 1
    };

    const parsedCa = parseCaInput(step.caInputRaw ?? step.caAvg);
    const caAvg = parsedCa.caAvg;

    const methodUpper = (step.methodName || 'SPRAY').toUpperCase().trim();
    const efficiency =
      typeof step.efficiencySnapshot === 'number' && step.efficiencySnapshot > 0
        ? step.efficiencySnapshot
        : methodUpper === 'WIPING'
          ? 0.35
          : 0.6;

    const totalRatio = items.reduce(
      (sum, it) => sum + (Number.isFinite(it.mixingRatio) ? Number(it.mixingRatio) : 0),
      0
    );

    let weightedPriceSumRaw = 0;
    const itemDetails = items.map((it, idx) => {
      const ratio = Number.isFinite(it.mixingRatio) ? Number(it.mixingRatio) : 0;
      const price = Number.isFinite(it.priceSnapshotVnd) ? Number(it.priceSnapshotVnd) : 0;
      weightedPriceSumRaw += price * ratio;
      return {
        itemId: it.id || `${step.id}-item-${idx + 1}`,
        itemOrder: it.itemOrder || idx + 1,
        materialCode: it.materialCode,
        materialName: it.materialName,
        packingDesc: it.packingDesc ?? null,
        nettWeight: Number(it.nettWeight) > 0 ? Number(it.nettWeight) : 20,
        mixingRatio: ratio,
        ratioShare: totalRatio > 0 ? ratio / totalRatio : 0,
        priceSnapshotVnd: price
      };
    });

    // Exact Excel formula F7: `=((C7*E7)+...)/(E7+...)`
    const mixedPriceRaw = totalRatio > 0 ? weightedPriceSumRaw / totalRatio : 0;

    // Exact Excel formula J7: `=(1/I7)*H7`
    const caPlusLossRaw = efficiency > 0 && caAvg > 0 ? (1 / efficiency) * caAvg : 0;

    // Exact Excel formula K7: `=1000/J7`
    const coverageRaw = caPlusLossRaw > 0 ? 1000 / caPlusLossRaw : 0;

    // Exact Excel formula L7: `=J7*F7/1000` (unrounded J7 * unrounded F7 / 1000)
    const coatingCostRaw = (caPlusLossRaw * mixedPriceRaw) / 1000;

    totalCoatingCostRaw += coatingCostRaw;

    calculatedSteps.push({
      stepId: step.id,
      stepNumber: step.stepNumber,
      stepName: step.stepName,
      rowSpan: layout.rowSpan,
      csExcelStartRow: layout.csExcelStartRow,
      csExcelEndRow: layout.csExcelEndRow,
      ccExcelStartRow: layout.ccExcelStartRow,
      ccExcelEndRow: layout.ccExcelEndRow,
      methodName: methodUpper,
      caInputRaw: step.caInputRaw || String(caAvg),
      caAvg,
      efficiency,
      efficiencyPercentDisplay: `${Math.round(efficiency * 100)}%`,
      totalRatio,
      mixedPriceRaw,
      caPlusLossRaw,
      coverageRaw,
      coatingCostRaw,
      mixedPriceDisplay: Math.round(mixedPriceRaw),
      caPlusLossDisplay: Number(caPlusLossRaw.toFixed(2)),
      coverageDisplay: Number(coverageRaw.toFixed(2)),
      coatingCostDisplay: Number(coatingCostRaw.toFixed(2)),
      items: itemDetails
    });
  }

  return {
    revisionId,
    steps: calculatedSteps,
    totalCoatingCostRaw,
    totalCoatingCostDisplay: Math.round(totalCoatingCostRaw)
  };
}

/**
 * Calculates BOM Summary by grouping identical `materialCode` across all steps,
 * summing their component `CA + Loss (g/m²)`, and multiplying by `areaM2`.
 */
export function calculateBomSummary(
  revisionId: string,
  areaM2: number,
  steps: ScheduleStep[],
  role: UserRole = 'PROJECT_LEADER'
): BomSummary {
  const safeArea = Number.isFinite(areaM2) && areaM2 > 0 ? areaM2 : 100;
  const isTechnical = role === 'TECHNICAL';
  const costTable = calculateCoatingCostTable(revisionId, steps);

  const grouped = new Map<
    string,
    {
      materialCode: string;
      materialName: string;
      packingDesc: string | null;
      nettWeight: number;
      stepNumbers: Set<number>;
      totalCaPlusLossGramPerM2Raw: number;
      priceUnitVnd: number;
    }
  >();

  for (const stepCalc of costTable.steps) {
    for (const item of stepCalc.items) {
      const code = (item.materialCode || '').trim();
      if (!code) continue;
      const componentCaPlusLossRaw = stepCalc.caPlusLossRaw * item.ratioShare;
      const existing = grouped.get(code);
      if (existing) {
        if (stepCalc.stepNumber !== null) existing.stepNumbers.add(stepCalc.stepNumber);
        existing.totalCaPlusLossGramPerM2Raw += componentCaPlusLossRaw;
      } else {
        const set = new Set<number>();
        if (stepCalc.stepNumber !== null) set.add(stepCalc.stepNumber);
        grouped.set(code, {
          materialCode: code,
          materialName: item.materialName,
          packingDesc: item.packingDesc ?? '20 Kg',
          nettWeight: item.nettWeight > 0 ? item.nettWeight : 20,
          stepNumbers: set,
          totalCaPlusLossGramPerM2Raw: componentCaPlusLossRaw,
          priceUnitVnd: item.priceSnapshotVnd
        });
      }
    }
  }

  let totalRequiredKgRaw = 0;
  let totalProjectMaterialCostRaw = 0;

  const items: BomItemCalculation[] = Array.from(grouped.values()).map((entry) => {
    const reqKgRaw = (entry.totalCaPlusLossGramPerM2Raw * safeArea) / 1000;
    const safeNett = entry.nettWeight > 0 ? entry.nettWeight : 20;
    const packsExact = reqKgRaw / safeNett;
    const packsRounded = Math.ceil(packsExact);
    const matCostRaw = reqKgRaw * entry.priceUnitVnd;

    totalRequiredKgRaw += reqKgRaw;
    totalProjectMaterialCostRaw += matCostRaw;

    return {
      materialCode: entry.materialCode,
      materialName: entry.materialName,
      packingDesc: entry.packingDesc,
      nettWeight: safeNett,
      stepNumbers: Array.from(entry.stepNumbers).sort((a, b) => a - b),
      totalCaPlusLossGramPerM2Raw: entry.totalCaPlusLossGramPerM2Raw,
      totalCaPlusLossGramPerM2Display: Number(entry.totalCaPlusLossGramPerM2Raw.toFixed(2)),
      totalRequiredKgOrLtrRaw: reqKgRaw,
      totalRequiredKgOrLtrDisplay: Number(reqKgRaw.toFixed(2)),
      packsRequiredExact: Number(packsExact.toFixed(2)),
      packsToOrderRounded: packsRounded,
      priceUnitVnd: isTechnical ? null : entry.priceUnitVnd,
      totalMaterialCostRaw: isTechnical ? null : matCostRaw,
      totalMaterialCostDisplay: isTechnical ? null : Math.round(matCostRaw)
    };
  });

  return {
    revisionId,
    areaM2: safeArea,
    items,
    totalRequiredKgOrLtrDisplay: Number(totalRequiredKgRaw.toFixed(2)),
    totalProjectMaterialCostRaw: isTechnical ? null : totalProjectMaterialCostRaw,
    totalProjectMaterialCostDisplay: isTechnical ? null : Math.round(totalProjectMaterialCostRaw)
  };
}

/**
 * Redacts all priceSnapshotVnd fields from a ProjectRevision when returned to a TECHNICAL role user.
 */
export function redactRevisionForRole(
  revision: ProjectRevision,
  role: UserRole
): ProjectRevision {
  if (role !== 'TECHNICAL') {
    return revision;
  }
  return {
    ...revision,
    steps: revision.steps.map((step) => ({
      ...step,
      items: step.items.map((item) => ({
        ...item,
        priceSnapshotVnd: null
      }))
    }))
  };
}

export function formatVnd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Math.round(value).toLocaleString('en-US');
}

export function formatDecimal2(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatCoverage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(2);
}
