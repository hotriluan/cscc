---
title: "Plan Product Usage On-Demand Selection & Revision Breakdown"
date: 2026-11-09
summary: "Created 3-phase implementation plan for Tab 1 (Product Usage) on-demand selection, Revision-level rollup with Step breakdown on Web, preserving flat Step-level Excel export for PivotTable, and removing Export All 7 Reports."
---

## What happened
- Analyzed `ReportsAnalyticsView.tsx`, `report.service.ts`, `report-excel.service.ts`, and `packages/shared/src/types.ts`.
- Identified that Tab 1 (`PRODUCT_USAGE`) currently loads and renders all `ScheduleStepItem` rows across all products when `selectedMaterialCode === 'ALL'`, causing visual clutter, statistically meaningless cross-product averages, and unnecessary payload/DOM overhead.

## Decision
- Eliminate the `'ALL'` mode on Tab 1 in favor of **On-Demand Single-Product Selection** with Quick-Pick product chips when no product is selected yet.
- Display the Web table grouped by **Revision** (`ProductUsageRevisionRow`, 1 row per Revision with summed `g/m²`, summed `VND/m²`, and `% Share of Rev CC`) with an expandable **Step Breakdown** sub-table (`ProductUsageStepBreakdownRow[]`).
- Preserve the existing flat Step-level structure in `report-excel.service.ts` for `Export Active Tab (.xlsx)` so users can run PivotTables in Excel, and remove the redundant `Export All 7 Reports (.xlsx)` button.

## Next steps
- Execute `/ak-cook` on `plans/261109-0944-product-usage-revision-breakdown/plan.md`.

