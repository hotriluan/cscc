---
title: "Phase 04: Automated Testing & End-to-End Verification"
phase: 4
status: completed
effort: "1h"
tags: [testing, vitest, rbac, status-history, e2e]
---

# Phase 04: Automated Testing & End-to-End Verification

## Mục tiêu
Viết bộ kiểm thử tự động kiểm tra toàn diện các quy tắc nghiệp vụ của trạng thái `INACTIVE`, phân quyền RBAC (`TECHNICAL`/`SALES` vs `PROJECT_LEADER`/`ADMIN`), bắt buộc nhập lý do, quy tắc chuyển đổi trạng thái, cơ chế Auto-supersede trong cùng Project và lưu trữ lịch sử `RevisionStatusHistory`.

## Các bước thực hiện

### 1. Tạo File Kiểm thử `apps/backend/test/revision-status-history-rbac.test.ts`
- Kiểm thử các kịch bản cốt lõi:
  1. **RBAC Enforcement (`403 Forbidden`)**:
     - Gọi `PATCH /api/revisions/:id/status` với `x-user-role: TECHNICAL` và `x-user-role: SALES` ➔ trả về `403 Forbidden` (`FORBIDDEN_STATUS_CHANGE`).
  2. **Mandatory Reason Validation (`400 Bad Request`)**:
     - Gọi `PATCH /api/revisions/:id/status` với `PROJECT_LEADER` hoặc `ADMIN` nhưng `note: ""` hoặc không truyền `note` ➔ trả về `400 Bad Request` (`REASON_REQUIRED`).
  3. **State Transition Rule (`DRAFT` không được sang `INACTIVE`)**:
     - Hồ sơ đang ở `DRAFT`, gọi `PATCH /api/revisions/:id/status` với `status: 'INACTIVE'` và có `note` ➔ trả về `400 Bad Request` (`INVALID_STATUS_TRANSITION`).
  4. **Valid Transition `DRAFT` ➔ `APPROVED` ➔ `INACTIVE` & Audit History**:
     - `PROJECT_LEADER` duyệt `Rev 00` từ `DRAFT` ➔ `APPROVED` kèm lý do ➔ thành công (`200`), tạo 1 bản ghi lịch sử.
     - `ADMIN` chuyển `Rev 00` từ `APPROVED` ➔ `INACTIVE` kèm lý do ➔ thành công (`200`), tạo bản ghi lịch sử thứ 2.
  5. **Auto-Supersede Sibling Revisions (`Rev 01` ➔ `APPROVED` tự động chuyển `Rev 00` ➔ `INACTIVE`)**:
     - Khôi phục `Rev 00` về `APPROVED`, nhân bản ra `Rev 01` (`DRAFT`).
     - `PROJECT_LEADER` duyệt `Rev 01` sang `APPROVED` kèm lý do.
     - Kiểm tra `Rev 01` có `status === 'APPROVED'` và `Rev 00` tự động chuyển sang `status === 'INACTIVE'`.
     - Kiểm tra lịch sử `GET /api/revisions/:rev00Id/status-history` có bản ghi tự động (`isAutoSupersede: true`, `fromStatus: 'APPROVED'`, `toStatus: 'INACTIVE'`).
  6. **Immutability of `INACTIVE` Revision**:
     - Thử gọi `PUT /api/revisions/:rev00Id` (sửa), `DELETE /api/revisions/:rev00Id` (xóa), và `POST /api/revisions/:rev00Id/refresh-prices` trên bản đang `INACTIVE` ➔ tất cả đều bị chặn (`400 Bad Request`), nhưng `POST /api/revisions/:rev00Id/clone` vẫn hoạt động bình thường (`201 Created`).

### 2. Chạy Toàn bộ Test Suite & Kiểm tra Build
- Chạy `npm run build` trên toàn monorepo (`@cscc/shared`, `backend`, `frontend`).
- Chạy `npm test` tại `packages/shared` và `apps/backend` để đảm bảo toàn bộ test cũ và mới đều PASS 100%.

## Tiêu chí hoàn thành (Verification)
- [x] `apps/backend/test/revision-status-history-rbac.test.ts` PASS 100%.
- [x] Không có lỗi biên dịch TypeScript hoặc regression ở các bài test hiện có (`e2e-ntr001.test.ts`, `user-salesman-rbac.test.ts`, `reports-analytics-rbac.test.ts`).

