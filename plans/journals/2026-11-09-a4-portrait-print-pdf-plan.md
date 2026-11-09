---
title: "Plan A4 Portrait Print & PDF Export Layout for CS & CC"
date: 2026-11-09
summary: "Created 3-phase implementation plan to transition Coating Schedule (CS) and Coating Cost (CC) A4 Print / PDF Export from Landscape to A4 Portrait with optimized column widths, non-breaking tabular numbers, and portrait vertical pagination."
---

## What happened
- Reviewed `apps/frontend/src/index.css`, `apps/frontend/src/components/print/PrintableSheetA4.tsx`, and `packages/shared/src/calculator.ts` (`paginateCsSteps`, `paginateCcSteps`).
- Evaluated the transition from A4 Landscape (`285mm × 198mm` printable area) to A4 Portrait (`198mm × 285mm` printable area) across both the 8-column Coating Schedule (CS) and 11-column Coating Cost (CC) sheets.

## Decision
- Adopt **Approach 1 (Full A4 Portrait Standard)**:
  - Set `@page { size: A4 portrait; margin: 6mm; }` in `index.css` and resize the on-screen preview container in `PrintableSheetA4.tsx` to `max-w-[840px]` for true WYSIWYG portrait previewing.
  - Rebalance `<colgroup>` percentages for both CS (8 columns) and CC (11 columns), switch `Product Name` from `font-mono` to `font-sans font-semibold` to save ~22% horizontal space, and enforce `whitespace-nowrap tabular-nums` on all numeric/currency cells so prices never break mid-number.
  - Increase vertical page unit budgets in `calculator.ts` (`44/46 units` for CS, `40/42 units` for CC) so standard 5–7 step schedules fit on 1 page and 10-step schedules (`NTR 001`) fit cleanly on 2 pages instead of 3.

## Implementation & Verification (Completed)
- **Phase 1 — Shared Portrait Pagination Engine**: Updated [`packages/shared/src/calculator.ts`](../../packages/shared/src/calculator.ts) constants (`CS_FIRST_PAGE_MAX_UNITS = 44`, `CS_NEXT_PAGE_MAX_UNITS = 46`, `CC_FIRST_PAGE_MAX_UNITS = 40`, `CC_NEXT_PAGE_MAX_UNITS = 42`) and line-wrapping thresholds in `estimateCsStepUnits` and `estimateCcStepUnits`.
- **Phase 2 — Frontend A4 Portrait Layout & Print CSS**: Updated `@page { size: A4 portrait; margin: 6mm; }` in [`apps/frontend/src/index.css`](../../apps/frontend/src/index.css) and redesigned [`apps/frontend/src/components/print/PrintableSheetA4.tsx`](../../apps/frontend/src/components/print/PrintableSheetA4.tsx) with a `max-w-[840px]` WYSIWYG portrait preview container, rebalanced `<colgroup>` widths for CS (8 cols) and CC (11 cols), `font-sans font-semibold` product names, and `whitespace-nowrap tabular-nums` on all numeric/price cells.
- **Phase 3 — Automated Testing & Build**: Updated pagination unit tests in [`packages/shared/src/calculator.test.ts`](../../packages/shared/src/calculator.test.ts) and verified `npm run typecheck`, `npm test` (7/7 shared tests + 28/28 backend integration tests), and `npm run build` all pass 100%.


