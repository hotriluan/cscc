# Verification Report — A4 True-WYSIWYG Print Preview & Full-Height Sheet Pagination

## 1. Summary

All 3 phases of [plan.md](../plan.md) are implemented and verified with **0.00px geometry drift** between the Screen Preview and `@media print` / Chromium PDF output:

- **Coating Cost (CC) `NTR 001` (10 steps, 50 chemical rows + Total + Notes + Remark):**
  - Paginates cleanly onto **1 single A4 portrait page (`Page / Trang: 1 / 1`)**.
  - Measured frame geometry: `198.00mm × 284.00mm` (`748.34px × 1073.38px`), content height `265.47mm` (`93.5%` vertical fill), bottom breathing margin `18.53mm`.
  - Chromium PDF output (`docs/printout/ALKANA_CC_NTR 001_Rev00.pdf`): **1 page (`1 / 1`)**.
- **Coating Schedule (CS) `NTR 001` (10 steps + 10 sanding rows):**
  - Paginates into **2 A4 portrait pages (`1 / 2`, `2 / 2`)**.
  - **Page 1 (`1 / 2`):** Contains **Steps 1 to 8** (`48 tbody rows`: 8 sanding bands + 40 chemical rows), content height `275.69mm / 284.00mm` (`97.1%` vertical fill, `8.31mm` bottom padding).
  - **Page 2 (`2 / 2`):** Contains **Steps 9 and 10** (`12 tbody rows`: 2 sanding bands + 10 chemical rows) + `Remark / Ghi chú` + **4 Signature boxes** inside a full-height `198.00mm × 284.00mm` bordered A4 frame.
  - Chromium PDF output (`docs/printout/ALKANA_CS_NTR 001_Rev00.pdf`): **2 pages (`1 / 2`, `2 / 2`)**.

## 2. Measured DOM & Print Geometry (`0.00px` Drift)

| Mode & Page | Metric | Screen Preview (`media: 'screen'`) | Print / PDF (`media: 'print'`) | Drift |
|-------------|--------|------------------------------------|--------------------------------|-------|
| **CS Page 1 (`1/2`)** | `.a4-print-page` Width | `748.34px` (`198.00mm`) | `748.34px` (`198.00mm`) | **`0.00px`** |
| **CS Page 1 (`1/2`)** | `.a4-print-page` Height | `1073.38px` (`284.00mm`) | `1073.38px` (`284.00mm`) | **`0.00px`** |
| **CS Page 1 (`1/2`)** | Content Height / Rows | `275.69mm` (`48 rows`, Steps 1–8) | `275.69mm` (`48 rows`, Steps 1–8) | **`0.00mm`** |
| **CS Page 2 (`2/2`)** | `.a4-print-page` Box | `748.34px × 1073.38px` (`198×284mm`) | `748.34px × 1073.38px` (`198×284mm`) | **`0.00px`** |
| **CS Page 2 (`2/2`)** | Content Height / Rows | `128.94mm` (`12 rows`, Steps 9–10 + Remark + Signatures) | `128.94mm` (`12 rows`, Steps 9–10 + Remark + Signatures) | **`0.00mm`** |
| **CC Page 1 (`1/1`)** | `.a4-print-page` Width | `748.34px` (`198.00mm`) | `748.34px` (`198.00mm`) | **`0.00px`** |
| **CC Page 1 (`1/1`)** | `.a4-print-page` Height | `1073.38px` (`284.00mm`) | `1073.38px` (`284.00mm`) | **`0.00px`** |
| **CC Page 1 (`1/1`)** | Content Height / Rows | `265.47mm` (`50 rows`, Steps 1–10 + Total + Notes + Remark) | `265.47mm` (`50 rows`, Steps 1–10 + Total + Notes + Remark) | **`0.00mm`** |

## 3. Quality Gates

- `npm run typecheck`: **PASS** (`@cscc/shared`, `@cscc/backend`, `@cscc/frontend`)
- `npm test`: **PASS** (`9/9` unit tests in `@cscc/shared`, `28/28` E2E & RBAC tests in `@cscc/backend`)
- `npm run build`: **PASS** (`@cscc/shared`, `@cscc/backend`, `@cscc/frontend`)
- Process & port cleanup verified (`:4000`, `:5173`, `:9234` all closed).

