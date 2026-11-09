---
title: "Phase 01: Pagination Budget Optimization"
phase: 1
status: completed
effort: "0.75h"
tags: [shared, pagination, print, unit-tests]
---

# Phase 01: Pagination Budget Optimization

## Context Links
- Plan: [plan.md](./plan.md)
- Pagination Engine: [calculator.ts](../../packages/shared/src/calculator.ts#L378-L620)
- Unit Tests: [calculator.test.ts](../../packages/shared/src/calculator.test.ts#L211-L350)

## Overview
- **Priority**: P1 · **Status**: Completed
- Hiệu chỉnh ngân sách phân trang (`CS_FIRST_PAGE_MAX_UNITS`, `CS_NEXT_PAGE_MAX_UNITS`, `CC_FIRST_PAGE_MAX_UNITS`, `CC_NEXT_PAGE_MAX_UNITS`, `WRAP_LINE_UNITS`) khớp với chiều cao dòng render thực tế (`4.25mm` ở CS và `3.90mm` ở CC) để mở khóa phần diện tích `~44mm` đang bị bỏ trống ở cuối Trang 1.

## Key Insights (Số đo thực nghiệm trên A4 dọc)
- Khổ A4 cao `297mm`, trừ lề `@page { margin: 6mm }` còn **`285mm`** (`~808pt`).
- Chiều cao thực tế trên Chromium:
  - Header + Metadata + Table Header Trang 1 chỉ tốn tổng cộng **`~62mm`** (`~176pt`), còn lại **`~223mm`** (`~632pt`) cho thân bảng và footer.
  - **Mỗi dòng CS (9pt, leading 1.2, py 1pt, border-collapse):** cao chính xác **`4.25mm` (`12.05pt`)**. Một nhóm bước chuẩn (1 dải Chà nhám + 5 dòng hóa chất = 6 units) cao `25.5mm`.
    - Với **8 bước trên Trang 1** (`48 units`): chiều cao thân bảng = `48 × 4.25mm = 204mm`. Tổng chiều cao nội dung Trang 1 = `62 + 204 = 266mm / 285mm` (chừa khoảng đệm an toàn `~19mm` dưới đáy trang, lấp đầy 93.3% vùng in).
  - **Mỗi dòng CC (8pt, leading 1.2, py 1pt, border-collapse):** cao chính xác **`3.90mm` (`11.05pt`)**. Một bước 5 dòng hóa chất cao `19.5mm`.
    - Với **10 bước trên Trang 1** (`50 units`): chiều cao thân bảng = `50 × 3.90mm = 195mm`. Cộng thêm Header + Metadata + Table Header (`~62mm`) + Footer Total/Notes/Remark (`~16mm` ≈ `4–5 units`) = **`273mm / 285mm`** (chừa khoảng đệm an toàn `~12mm` dưới đáy trang).
    - Do đó, quy trình chuẩn **10 bước `NTR 001` của CC hoàn toàn nằm gọn trong 1 trang A4 duy nhất (`Page 1 / 1`)**! Nếu quy trình dài 11–12 bước, Trang 1 chứa trọn 10 bước (`257mm`) rồi mới sang Trang 2.

## Requirements
1. Cập nhật hằng số phân trang trong `packages/shared/src/calculator.ts`:
   - `CS_FIRST_PAGE_MAX_UNITS = 50` (cho phép 8 nhóm bước × 6 units = 48 ≤ 50 trên Trang 1).
   - `CS_NEXT_PAGE_MAX_UNITS = 56` (trang không có Metadata có thêm ~25mm tương đương ~6 units).
   - `CC_FIRST_PAGE_MAX_UNITS = 55` (cho phép 10 bước × 5 units = 50 + Footer 5 units = 55 ≤ 55 nằm gọn trên 1 trang A4; hoặc nếu > 10 bước thì Trang 1 chứa 10 bước = 50 units).
   - `CC_NEXT_PAGE_MAX_UNITS = 62`.
   - `WRAP_LINE_UNITS = 0.85` (tăng nhẹ từ `0.75` lên `0.85` để khi tên vật tư dài gãy làm nhiều dòng, hệ thống tự động trừ hao đủ chiều cao dòng gãy và không bao giờ tràn qua `285mm`).
2. Giữ nguyên bất biến an toàn:
   - Không tách cặp `SANDING` + bước sơn kế tiếp.
   - Trong `paginateCcSteps`: nếu các bước vừa khít Trang 1 nhưng cộng thêm Footer (`4–5 units`) bị vượt `CC_FIRST_PAGE_MAX_UNITS` (ví dụ quy trình có 11 bước hoặc 10 bước có nhiều tên hóa chất dài gãy dòng), hệ thống vẫn mang bước cuối sang Trang 2 đi kèm với dòng `TOTAL COATING COST` + `Notes` để dòng Tổng không bao giờ đứng bơ vơ một mình.
3. Cập nhật bộ Unit Tests trong `packages/shared/src/calculator.test.ts`:
   - Test `NTR 001` CS (10 bước × 5 hóa chất + 10 dải chà nhám):
     - Trang 1 (`1/2`): `16 entries` (**8 dải chà nhám + 8 bước sơn**, Bước 1 → Bước 8).
     - Trang 2 (`2/2`): `4 entries` (**2 dải chà nhám + 2 bước sơn**, Bước 9 → Bước 10) + Remark + 4 ô Chữ ký.
   - Test `NTR 001` CC:
     - **10 bước (50 dòng) + Remark**: nằm gọn trong **1 trang A4 duy nhất (`1/1`)**, `steps.length === 10`, `showTotalAndNotes === true`.
     - **11 bước (55 dòng) có Remark (`55 + 5 = 60 > 55`)**: chia thành **2 trang (`1/2`, `2/2`)** — Trang 1 chứa **10 bước** (`50 units`), Trang 2 chứa **Bước 11 + Total + Notes**.
     - **12 bước (60 dòng)**: chia thành **2 trang (`1/2`, `2/2`)** — Trang 1 chứa **11 bước** (`55 units`), Trang 2 chứa **Bước 12 + Total + Notes**.

## Related Code Files
- Modify: `c:\dev\cscc\packages\shared\src\calculator.ts`
- Modify: `c:\dev\cscc\packages\shared\src\calculator.test.ts`

## Implementation Steps
1. Chỉnh sửa các hằng số `CS_FIRST_PAGE_MAX_UNITS`, `CS_NEXT_PAGE_MAX_UNITS`, `CC_FIRST_PAGE_MAX_UNITS`, `CC_NEXT_PAGE_MAX_UNITS`, `WRAP_LINE_UNITS` và JSDoc giải thích hình học thực tế trong `packages/shared/src/calculator.ts`.
2. Cập nhật và bổ sung các kịch bản kiểm thử trong `packages/shared/src/calculator.test.ts` (5 bước, 10 bước `NTR 001`, 11 bước, 12 bước, và tên hóa chất dài).
3. Chạy `npm run typecheck --workspace=@cscc/shared` và `npm test --workspace=@cscc/shared`.

## Todo List
- [x] Cập nhật hằng số phân trang CS (50/56) và CC (55/62) + `WRAP_LINE_UNITS = 0.85`
- [x] Cập nhật unit tests cho CS (Trang 1 = 8 bước, Trang 2 = 2 bước + Chữ ký)
- [x] Cập nhật unit tests cho CC (10 bước = 1 trang; 11–12 bước = 2 trang với Trang 1 chứa 10–11 bước)
- [x] Chạy pass `typecheck` và `test` trong `@cscc/shared`

## Success Criteria
- Toàn bộ unit tests trong `@cscc/shared` pass 100%.
- `NTR 001` CS phân trang chính xác 8 bước ở Trang 1 và 2 bước + Chữ ký ở Trang 2.
- `NTR 001` CC phân trang trọn vẹn 10 bước + Total + Notes vào 1 trang duy nhất.

## Risk Assessment
- **Rủi ro**: Quy trình 10 bước CC nhưng có trường `REMARK` rất dài (nhiều dòng) hoặc nhiều tên sản phẩm dài hơn 25 ký tự có thể làm chiều cao vượt 1 trang.
- **Giảm thiểu**: Tham số `hasRemark` (hoặc độ dài `remark`) và `WRAP_LINE_UNITS = 0.85` tự động cộng thêm units để khi gặp tên dài/ghi chú dài, bộ phân trang tự động đẩy Bước 10 sang Trang 2 an toàn.

