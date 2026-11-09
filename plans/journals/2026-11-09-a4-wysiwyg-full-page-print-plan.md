# Journal: A4 True-WYSIWYG Print Preview & Full-Height Sheet Pagination Plan

- **Date**: 2026-11-09
- **Plan**: [`plans/261109-1425-a4-wysiwyg-full-page-print/plan.md`](../261109-1425-a4-wysiwyg-full-page-print/plan.md)

## Context & Problem
After inspecting the printed A4 paper photos (`docs/printout/*.jpg`), the exported PDFs (`ALKANA_CS_NTR 001_Rev00.pdf`, `ALKANA_CC_NTR 001_Rev00.pdf`), and the user's screenshots of the on-screen Preview modal:
1. **Conservative Page 1 Pagination Budget**: Actual rendered row heights in Chromium are `4.25mm` (`12.05pt`) for CS and `3.90mm` (`11.05pt`) for CC due to collapsed table borders and compact metadata (`~62mm` total top block), leaving `~44mm` of unused space at the bottom of Page 1 in both CS and CC.
2. **Screen Preview vs. Real Print Drift**: The on-screen Preview modal used `max-w-[900px] p-5` and `.a4-print-page p-4` (`~218.5mm` content width, auto height) plus separate `print:*` utility overrides (`h-10 print:h-7`, `pb-2.5 print:pb-1`, `my-2.5 print:my-1.5`, `h-14 print:h-10`), so the user could not see the true `198mm × 285mm` printable A4 geometry on screen.

## Key Decisions
1. **Option 1 (Real-Print Calibrated Pagination Budget)**:
   - Raise `CS_FIRST_PAGE_MAX_UNITS` to `50` (`CS_NEXT_PAGE_MAX_UNITS = 56`) so `NTR 001` CS Page 1 holds **8 full steps (48 rows, ~266mm / 285mm)** and Page 2 holds Steps 9–10 + Remark + 4 Signatures.
   - Raise `CC_FIRST_PAGE_MAX_UNITS` to `55` (`CC_NEXT_PAGE_MAX_UNITS = 62`) so the entire 10-step `NTR 001` Coating Cost table (**50 rows + Total + Notes + Remark, ~273mm / 285mm**) fits cleanly onto **1 single A4 page (`Page 1 / 1`)**.
2. **Option 2 + True-WYSIWYG 1:1 Screen Preview**:
   - Wrap each page in an `.a4-sheet-preview` container (`210mm × 297mm`, `padding: 6mm` on screen; reset to `0` in `@media print`) with an inner `.a4-print-page` frame (`width: 198mm; min-height: 284mm; padding: 2mm; display: flex; flex-direction: column;`).
   - Unify all spacing, logo height (`h-7`), and padding between screen and print so the Preview modal matches the printed A4 sheet and exported PDF 100%.

