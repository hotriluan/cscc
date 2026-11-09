# 2026-11-09 — A4 print readability plan

**Context:** The A4 portrait CS/CC PDFs were hard to read: data text was about 6.4–6.75pt and table headers about 5.6–6pt. Columns were half-empty, and page 1 of CC was about 78mm blank at the bottom.

**Finding:** I measured the rendered NTR 001 PDFs. A CS row is about 13pt tall, but the text inside it is only 6.75pt; leading and padding take the rest. Tightening line-height to 1.2 and vertical padding to 1pt allows 9pt text with about 5% more row height.

**Decisions (user-approved):**
- CS data text at 9pt, CC data text at 8pt.
- Sanding rows become a single full-width band (`colSpan 7`). The user accepted that this differs from the original Excel layout.
- The pagination heuristic is kept, but its constants are recalibrated against real Chromium PDF output.

**Expected:** NTR 001 should stay at 2 pages for both CS and CC. Very long schedules may go to 3 pages; the user accepted this.

**Implementation & Real Print Verification (Completed):**
- Recalibrated pagination constants (`CS_FIRST_PAGE_MAX_UNITS = 44`, `CS_NEXT_PAGE_MAX_UNITS = 49`, `CC_FIRST_PAGE_MAX_UNITS = 48`, `CC_NEXT_PAGE_MAX_UNITS = 54`, `WRAP_LINE_UNITS = 0.75`) and 1-line sanding band estimation in `packages/shared/src/calculator.ts`.
- Updated `PrintableSheetA4.tsx` with unified `pt` typography (CS `9pt`/`7.5pt`, CC `8pt`/`7pt`, metadata `8.5pt`, title `12pt`), `colSpan={7}` sanding bands, rebalanced column widths, and `keepRangesTogether()` to prevent line breaks inside numeric ranges (`40-45°C`, `#180-240`, `100-120`).
- Verified against real Chromium `Page.printToPDF` (`preferCSSPageSize: true`) across 5 cases (A: NTR 001 CS = 2 pages, B: NTR 001 CC = 2 pages, C: 5-step CS/CC = 1 page, D: 58-char names & 96-char sandingSpec = 4/3 pages with zero overflow, E: `TECHNICAL` RBAC enforced).
- Updated `docs/user-guide/screenshots/14-print-a4-preview.png` and saved comparison PDFs + `verification.md` under `plans/261109-1227-a4-print-readability-typography/reports/`.

**Plan:** `plans/261109-1227-a4-print-readability-typography/`

