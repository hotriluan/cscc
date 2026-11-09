---
title: "Phase 03: Automated Testing & Verification"
phase: 3
status: completed
effort: "0.5h"
tags: [testing, verification, shared, frontend]
---

# Phase 03: Automated Testing & Verification

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Shared Calculator Tests: [packages/shared/src/calculator.test.ts](../../packages/shared/src/calculator.test.ts)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Cập nhật và bổ sung bộ kiểm thử tự động trong [`packages/shared/src/calculator.test.ts`](../../packages/shared/src/calculator.test.ts) để xác nhận logic phân trang A4 Dọc (`paginateCsSteps`, `paginateCcSteps`), sau đó chạy kiểm tra `typecheck`, `test`, và `build` toàn bộ monorepo.

## Key Insights
- Trong [`packages/shared/src/calculator.test.ts`](../../packages/shared/src/calculator.test.ts#L211-L301), hai bài test phân trang hiện tại đang kiểm tra kỳ vọng của khổ giấy A4 Ngang cũ (10 bước `NTR 001` bị chia thành 3 trang cho cả CS và CC).
- Khi nâng sức chứa chiều dọc lên chuẩn **A4 Portrait**:
  - Với **CS (10 bước × 5 hóa chất + 10 dòng chà nhám)**: Toàn bộ quy trình + Ghi chú + 4 Chữ ký nằm gọn trong **2 trang A4 dọc** (Trang 1/2 chứa Metadata + Bước 1–7; Trang 2/2 chứa Bước 8–10 + Remark + 4 Chữ ký), không còn bị rớt chữ ký sang trang 3.
  - Với **CC (10 bước × 5 hóa chất = 50 dòng)**:
    - Trường hợp 8 bước (40 dòng): Trang 1/2 chứa Metadata + Bước 1–8; Trang 2/2 chứa Total + Notes (hoặc chuyển 1 bước sang Trang 2 cùng Total + Notes để không có trang tổng kết trơ trọi).
    - Trường hợp 10 bước (50 dòng): Trang 1/2 chứa Metadata + Bước 1–8; Trang 2/2 chứa Bước 9–10 + Total + Notes (gọn trong **2 trang A4 dọc** thay vì 3 trang).
    - Trường hợp quy trình tiêu chuẩn 5–6 bước: Gọn trong **1 trang A4 dọc duy nhất (`1 / 1`)**.

## Requirements
- **Functional**:
  - Cập nhật các test case `paginateCsSteps` và `paginateCcSteps` trong [`packages/shared/src/calculator.test.ts`](../../packages/shared/src/calculator.test.ts) phản ánh đúng phân trang A4 Portrait (bao gồm cả kịch bản 1 trang cho quy trình ngắn và 2 trang cho quy trình dài 10 bước `NTR 001`).
- **Verification**:
  - `npm run typecheck` pass 100%.
  - `npm test` pass 100%.
  - `npm run build` pass 100%.

## Related Code Files
- Modify: `packages/shared/src/calculator.test.ts`

## Implementation Steps
1. Cập nhật các bài test phân trang CS và CC trong [`packages/shared/src/calculator.test.ts`](../../packages/shared/src/calculator.test.ts).
2. Chạy `npm test` để xác nhận toàn bộ unit test và integration test trong monorepo đều pass.
3. Chạy `npm run typecheck` và `npm run build` để đảm bảo không có lỗi biên dịch ở cả `@cscc/shared`, `@cscc/backend`, và `@cscc/frontend`.

## Todo List
- [x] Cập nhật unit test phân trang A4 Portrait trong `packages/shared/src/calculator.test.ts`
- [x] Chạy `npm run typecheck`
- [x] Chạy `npm test`
- [x] Chạy `npm run build`

## Success Criteria
- Toàn bộ test suites trong `packages/shared` và `apps/backend` pass 100%.
- Bản build production của Frontend và Backend hoàn tất không có lỗi.

