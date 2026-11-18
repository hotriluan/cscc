# Phase 4 — Automated Testing & End-to-End Verification

## Context
Đảm bảo tính năng Master Hệ sơn (`FinishingSystemMaster`), cơ chế tự động quét dữ liệu cũ từ `ProjectRevision` đưa vào Master, và các API `/api/master/finishing-systems` hoạt động chính xác, đồng thời không làm ảnh hưởng đến bất kỳ test case hiện có nào.

## Requirements
1. **Integration Tests (`apps/backend/test/`):**
   - Kiểm tra sau khi `dataStore.init()` chạy, `GET /api/master/finishing-systems` trả về danh sách có chứa hệ sơn của các `ProjectRevision` hiện có (ví dụ `"WATERBASE"` từ hồ sơ mẫu `NTR 001`).
   - Kiểm tra `POST /api/master/finishing-systems` thêm mới hệ sơn (chuẩn hóa viết hoa, trả về `201`) và gọi lại với cùng tên trả về `200` (idempotent).
   - Kiểm tra `PUT /api/master/finishing-systems/:id` cập nhật `systemName` và `sortOrder`, đồng thời trả về `409` nếu đổi tên trùng với hệ sơn khác.
   - Kiểm tra `DELETE /api/master/finishing-systems/:id` xóa thành công bản ghi vừa tạo.
2. **Full Monorepo Build & Test Verification:**
   - Chạy toàn bộ test suite và build trên cả 3 workspaces (`@cscc/shared`, `@cscc/backend`, `@cscc/frontend`).

## Files
- Modify: `apps/backend/test/e2e-ntr001.test.ts` (hoặc thêm test file chuyên biệt trong `apps/backend/test/`)

## Steps
1. Bổ sung bộ test kiểm tra `FinishingSystemMaster` (auto-seed từ `ProjectRevision` + CRUD `/api/master/finishing-systems`).
2. Chạy `npm test`, `npm run typecheck` và `npm run build` toàn bộ monorepo.

## Validation
- Toàn bộ bài test trong `packages/shared` và `apps/backend` PASS 100%.
- `npm run build` thành công cho cả 3 workspaces.

## Risk / Rollback
- Đảm bảo dọn dẹp dữ liệu test tạm sau khi chạy xong test để không làm bẩn trạng thái DB chung.
