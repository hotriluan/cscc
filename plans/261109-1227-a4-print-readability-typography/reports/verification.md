# Phase 03: Real Print Verification & Calibration Report

- **Date:** 2026-11-09
- **Plan:** [`261109-1227-a4-print-readability-typography`](../plan.md)
- **Print Engine Verified:** Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`, Chromium headless `Page.printToPDF` with `preferCSSPageSize: true`, `printBackground: true`, `@page { size: A4 portrait; margin: 6mm; }`, PDF page size `595.0 × 841.9pt`)
- **PDF Comparison Artifacts:**
  - Baseline (Before): [`docs/ALKANA_CS_NTR 001_Rev00.pdf`](../../../docs/ALKANA_CS_NTR%20001_Rev00.pdf), [`docs/ALKANA_CC_NTR 001_Rev00.pdf`](../../../docs/ALKANA_CC_NTR%20001_Rev00.pdf)
  - Calibrated (After): [`reports/ALKANA_CS_NTR 001_Rev00.pdf`](./ALKANA_CS_NTR%20001_Rev00.pdf), [`reports/ALKANA_CC_NTR 001_Rev00.pdf`](./ALKANA_CC_NTR%20001_Rev00.pdf)

---

## 1. Test Matrix Results (Cases A–E)

| Case | Scenario | Mode | Paginator Pages (`Page / Trang`) | Chromium PDF Pages | Page 1 Height (mm) | Page 2+ Height (mm) | Horizontal Cell Overflow | Pass / Fail |
|------|----------|------|----------------------------------|--------------------|--------------------|---------------------|--------------------------|-------------|
| **A** | `NTR 001` CS (10 sanding bands + 10 steps × 5 items) | CS | `2` (`1/2`, `2/2`) | `2` | `241.1 mm` (7 groups, 42 rows) | `151.8 mm` (3 groups, 18 rows + Remark + 4 Signatures) | `0` cells | **PASS** |
| **B** | `NTR 001` CC (10 steps × 5 items = 50 rows) | CC | `2` (`1/2`, `2/2`) | `2` | `240.3 mm` (9 steps, 45 rows) | `64.8 mm` (1 step, 5 rows + Total `894,143` + Notes + Remark) | `0` cells | **PASS** |
| **C.1** | 5-step schedule (5 sanding bands + 5 steps × 3 items) | CS | `1` (`1/1`) | `1` | `177.8 mm` (20 rows + Remark + 4 Signatures) | — | `0` cells | **PASS** |
| **C.2** | 5-step schedule (5 steps × 3 items = 15 rows) | CC | `1` (`1/1`) | `1` | `125.2 mm` (15 rows + Total + Notes + Remark) | — | `0` cells | **PASS** |
| **D.1** | Long material names (58 chars) + long `sandingSpec` (96 chars) | CS | `4` (`1/4`..`4/4`) | `4` | `184.4 mm` (3 groups) | P2: `167.6 mm`, P3: `167.6 mm`, P4: `114.0 mm` (1 group + Remark + Signatures) | `0` cells | **PASS** |
| **D.2** | Long material names (58 chars, 10 steps × 5 items) | CC | `3` (`1/3`..`3/3`) | `3` | `160.5 mm` (3 steps) | P2: `182.4 mm` (4 steps), P3: `159.1 mm` (3 steps + Total + Notes) | `0` cells | **PASS** |
| **E** | `TECHNICAL` Role RBAC (`tech@alkana.vn`) | CS only | CC button hidden (`false`), `/cost` API returns `403` | — | — | — | — | **PASS** |

---

## 2. Typography & Layout Verification

1. **Font Scale (`pt`, unified across screen preview and print):**
   - Document title (`h1`): `12pt`
   - Code / Rev / Date / Status / Page counter bar: `8pt`
   - Metadata 3-column grid: `8.5pt`
   - CS table header: `7.5pt` bold mixed-case (`leading-[1.15]`); CS data cells: **`9pt`** (`leading-[1.2]`, `py-[1pt]`)
   - CS sanding band: `8.5pt` semibold italic, single cell `colSpan={7}` (`SANDING / CHÀ NHÁM — <sandingSpec>`)
   - CC table header: `7pt` bold mixed-case (≤ 3 lines); CC data cells: **`8pt`** (`leading-[1.2]`, `py-[1pt]`); CC Total row: **`9pt`** bold
   - Remark / Notes / Signature labels: `8pt`; Signatory names: `8.5pt`
   - Minimum font size across all elements: `7pt` (no text `< 7pt`).
2. **Range & Number Integrity:**
   - `keepRangesTogether()` wraps numeric ranges (`45-50°C`, `40-45°C`, `100-120`, `#180-240`, `8-12%`, `40-80 %`, `25 – 40°C`) in `<span class="whitespace-nowrap">` while preserving verbatim copyable text.
   - `Efficiency` header fits cleanly inside its `7%` column without touching cell borders (`overflowingCells: []`).
3. **Before vs. After Improvements (`NTR 001`):**
   - **CS:** Data text increased from `~6.75pt` to `9pt` (+33%), sanding rows collapsed from 2-line wrapped cells into a 1-line `colSpan={7}` horizontal band (`17.25px` height), and all 10 steps + Remark + 4 Signatures still fit cleanly on **2 pages**.
   - **CC:** Data text increased from `~6.4pt` to `8pt` (+25%), Page 1 now holds **9 steps (45 rows, `240.3 mm`)** instead of 8 steps, eliminating the old `~78 mm` blank gap at the bottom of Page 1 while keeping Total + Notes + Remark with Step 10 on Page 2.

---

## 3. Final Calibrated Pagination Constants (`packages/shared/src/calculator.ts`)

No additional constant adjustments were needed after Phase 1 because the initial geometric model matched Chromium's actual rendered heights on the first pass:

- `CS_FIRST_PAGE_MAX_UNITS = 44`
- `CS_NEXT_PAGE_MAX_UNITS = 49`
- `CS_REMARK_UNITS = 3.5`
- `CS_SIGNATURES_UNITS = 5.5`
- `CC_FIRST_PAGE_MAX_UNITS = 48`
- `CC_NEXT_PAGE_MAX_UNITS = 54`
- `CC_FOOTER_BASE_UNITS = 4`
- `WRAP_LINE_UNITS = 0.75`
- `SANDING_LABEL_CHARS = 21`, `SANDING_BAND_LINE_CHARS = 95`
- Character wrap thresholds:
  - CS: `Product Name = 27`, `Application Step = 14`, `Drying Time = 20`
  - CC: `Product Name = 25`, `Item = 12`

---

## 4. Quality Gates & Process Cleanup

- `npm run typecheck`: **PASS** (`@cscc/shared`, `@cscc/backend`, `@cscc/frontend`)
- `npm test`: **PASS** (9/9 unit tests in `@cscc/shared`, 28/28 E2E/integration tests in `@cscc/backend`)
- `npm run build`: **PASS** (`@cscc/shared`, `@cscc/backend`, `@cscc/frontend` production bundle)
- Updated screenshot: [`docs/user-guide/screenshots/14-print-a4-preview.png`](../../../docs/user-guide/screenshots/14-print-a4-preview.png)
- Temporary draft revision (`rev-proj-ntr001-01-mw8veba4`) deleted; all spawned dev/browser processes terminated (`netstat` verified clean on `:4000`, `:5173`, `:9229`).

