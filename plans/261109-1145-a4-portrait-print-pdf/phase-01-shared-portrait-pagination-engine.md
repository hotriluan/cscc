---
title: "Phase 01: Shared Portrait Pagination Engine"
phase: 1
status: completed
effort: "0.5h"
tags: [shared, pagination, print, a4-portrait]
---

# Phase 01: Shared Portrait Pagination Engine

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Shared Calculator & Pagination Engine: [packages/shared/src/calculator.ts](../../packages/shared/src/calculator.ts)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Cập nhật các hằng số chiều cao trang và hàm ước lượng số dòng (`estimateCsStepUnits`, `estimateCcStepUnits`, `paginateCsSteps`, `paginateCcSteps`) trong [`packages/shared/src/calculator.ts`](../../packages/shared/src/calculator.ts) để khớp chính xác với kích thước vùng in của khổ giấy **A4 Dọc (`198mm × 285mm`)** thay vì khổ ngang cũ (`285mm × 198mm`).

## Key Insights
- Khi chuyển sang **A4 Portrait (`210mm × 297mm`, margin `6mm`)**:
  - Chiều cao vùng in tăng từ `198mm` lên `285mm` (`+43.9%`).
  - Do đó, ngân sách dòng (row units) trên mỗi trang tăng tương ứng:
    - **Bảng CS**: Trang 1 (có lưới Metadata) tăng từ `30` lên **`44` units** (`CS_FIRST_PAGE_MAX_UNITS = 44`); các trang tiếp theo (không có lưới Metadata) tăng từ `30` lên **`46` units** (`CS_NEXT_PAGE_MAX_UNITS = 46`).
    - **Bảng CC**: Trang 1 (có lưới Metadata) tăng từ `25` lên **`40` units** (`CC_FIRST_PAGE_MAX_UNITS = 40`); các trang tiếp theo tăng từ `25` lên **`42` units** (`CC_NEXT_PAGE_MAX_UNITS = 42`).
  - Bề ngang cột trên khổ dọc hẹp hơn nhưng cột `Product Name` được chuyển sang font sans-serif (`font-sans`), nên ngưỡng ký tự trên 1 dòng được hiệu chỉnh thực tế:
    - Trong `estimateCsStepUnits`: `nameLen / 38` (thay vì `44`), `stepName / 14` (thay vì `16`), `dryingTime / 16` (thay vì `20`), `sandingSpec > 24` (thay vì `32`).
    - Trong `estimateCcStepUnits`: `nameLen / 32` (thay vì `40`), `stepName / 11` (thay vì `12`).

## Requirements
- **Functional**:
  - Cập nhật các hằng số phân trang trong [`packages/shared/src/calculator.ts`](../../packages/shared/src/calculator.ts):
    - `CS_FIRST_PAGE_MAX_UNITS = 44`
    - `CS_NEXT_PAGE_MAX_UNITS = 46`
    - `CC_FIRST_PAGE_MAX_UNITS = 40`
    - `CC_NEXT_PAGE_MAX_UNITS = 42`
  - Cập nhật `estimateCsStepUnits` và `estimateCcStepUnits` theo ngưỡng ký tự của cột A4 dọc.
  - Cập nhật JSDoc của `paginateCsSteps` và `paginateCcSteps` ghi rõ phân trang theo khổ **A4 Portrait**.
- **Non-functional**:
  - Đảm bảo tính chất nguyên vẹn của nhóm bước: không bao giờ tách rời dòng `SANDING` khỏi bước `CHEMICAL_STEP` đi kèm ngay sau nó, và không bao giờ để phần `Remark + Signatures` (CS) hay `Total + Notes` (CC) bị tràn khỏi chiều cao trang A4 dọc.

## Related Code Files
- Modify: `packages/shared/src/calculator.ts`

## Implementation Steps
1. Mở [`packages/shared/src/calculator.ts`](../../packages/shared/src/calculator.ts#L378-L609).
2. Cập nhật bộ hằng số `CS_FIRST_PAGE_MAX_UNITS`, `CS_NEXT_PAGE_MAX_UNITS`, `CC_FIRST_PAGE_MAX_UNITS`, `CC_NEXT_PAGE_MAX_UNITS`.
3. Cập nhật hàm `estimateCsStepUnits` và `estimateCcStepUnits` với ngưỡng độ dài chuỗi phù hợp bề ngang cột A4 dọc.
4. Kiểm tra biên dịch TypeScript của gói `@cscc/shared`.

## Todo List
- [x] Cập nhật hằng số phân trang A4 Portrait trong `packages/shared/src/calculator.ts`
- [x] Cập nhật ngưỡng tính dòng wrap trong `estimateCsStepUnits` và `estimateCcStepUnits`
- [x] Chạy `npm run typecheck --workspace=@cscc/shared`

## Success Criteria
- Với quy trình tiêu chuẩn 5–7 bước (2–3 hóa chất/bước), cả CS và CC đều nằm gọn trong **1 trang A4 dọc (`1 / 1`)**.
- Với quy trình lớn 10 bước × 5 hóa chất/bước (`NTR 001` — 60 dòng trong CS, 50 dòng trong CC), cả CS và CC đều phân bố cân đối vào **2 trang A4 dọc (`1 / 2`, `2 / 2`)** thay vì bị kéo dài sang trang thứ 3.

