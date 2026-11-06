---
title: "Phase 04: Automated Testing & Performance Verification"
phase: 4
status: completed
effort: "0.5h"
tags: [testing, verification, backend, frontend, typecheck]
---

# Phase 04: Automated Testing & Performance Verification

## Mục tiêu
Kiểm chứng bằng bộ test tự động và kiểm tra kiểu tĩnh (`typecheck` / `build`) rằng tính năng Auto-Save hoạt động chính xác, bảo toàn ID dòng, cho phép lưu nháp từng phần và không gây lỗi hồi quy.

## Các bước thực hiện

### 1. Viết bộ kiểm thử tự động cho luồng Auto-Save (`apps/backend/src/__tests__/auto-save-revision.test.ts`)
- Kiểm tra các kịch bản:
  1. **Bảo toàn `step.id` và `item.id` ổn định qua nhiều lần Auto-Save**:
     - Tạo dự án nháp (`DRAFT`), thêm bước sơn mới và dòng vật tư mới với ID theo định dạng `${revId}-step-...` và `${stepId}-item-...`.
     - Gọi `PUT /api/revisions/:id` liên tiếp nhiều lần (mô phỏng người dùng thêm bước -> chọn bước -> chọn vật tư -> nhập tỷ lệ pha -> nhập CA).
     - Xác nhận `step.id` và `item.id` trả về từ API và từ `GET /api/revisions/:id` giữ nguyên 100%, không bị sinh lại ngẫu nhiên.
  2. **Lưu nháp (`DRAFT`) khi bước thi công hoặc vật tư còn để trống một phần**:
     - Gửi `PUT /api/revisions/:id` với bước sơn mới có `stepName: ''`, `methodName: ''`, `caInputRaw: ''` và vật tư có `materialCode: ''`, `mixingRatio: 0`.
     - Xác nhận API trả về `200 OK`, lưu đúng số lượng bước và vật tư vào PostgreSQL.
  3. **Tính toán chính xác `costSummary` và `bomSummary` ngay trong response của Auto-Save**:
     - Khi cập nhật định mức `CA`, phương pháp thi công và vật tư, response của `PUT /api/revisions/:id` trả về `costSummary.totalCoatingCostDisplay` chính xác để Frontend cập nhật ngay vào Sidebar mà không cần gọi lại `GET /api/projects`.

### 2. Chạy Kiểm tra Kiểu dữ liệu & Build toàn hệ thống
- Chạy `npm test` trong `apps/backend` để đảm bảo toàn bộ test cũ (bao gồm RBAC, Status History, Auto-supersede) và test mới đều `PASS`.
- Chạy `npm run build` / `tsc --noEmit` cho `packages/shared`, `apps/backend` và `apps/frontend`.

## Tiêu chí hoàn thành (Verification)
- [x] Tất cả các bài test tự động trong `apps/backend` đều `PASS` 100%.
- [x] Build Frontend và Backend thành công, không có lỗi TypeScript hay lint.

