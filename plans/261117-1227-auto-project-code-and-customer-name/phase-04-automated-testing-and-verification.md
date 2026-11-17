# Phase 4 — Automated Testing & End-to-End Verification

## Context
Sau khi hoàn thành cập nhật trên `@cscc/shared`, `@cscc/backend` và `@cscc/frontend`, cần viết bộ kiểm thử tự động toàn diện để chứng minh tất cả các yêu cầu nghiệp vụ hoạt động chính xác và không làm gãy bất kỳ tính năng hiện có nào.

## Requirements
1. **Viết file kiểm thử mới `apps/backend/test/auto-project-code.test.ts`:**
   - **Test 1 (Sinh mã tự động theo từng khách hàng):** Tạo khách hàng `NTRI` (`customerName: "DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM"`, `shortName: "NTRI"`). Tạo 2 dự án liên tiếp mà không truyền `projectCode` $\rightarrow$ Hệ thống tự động sinh `NTRI 0001` và `NTRI 0002`.
   - **Test 2 (Chống trùng mã khi xóa hồ sơ cũ):** Xóa dự án `NTRI 0001` (khi `NTRI 0002` vẫn còn), tạo dự án tiếp theo $\rightarrow$ Hệ thống cấp `NTRI 0003` (không bị trùng với `NTRI 0002`).
   - **Test 3 (Tự động cấp lại mã khi đổi Khách hàng trên bản nháp `DRAFT`):** Đang ở bản nháp của dự án `NTRI 0002`, gọi `PUT /api/revisions/:id` đổi `customerId` sang khách hàng `IKEA` (`shortName: "IKEA"`) $\rightarrow$ Mã dự án tự động chuyển thành `IKEA 0001`.
   - **Test 4 (Chặn và báo nhắc khi khách hàng chưa cập nhật `Short Name` 2–6 ký tự):** Với một khách hàng trong DB có `shortName = "CONG TY TNHH GO DAI VIET"` (> 6 ký tự), khi gọi `GET /api/projects/next-code`, `POST /api/projects` hoặc đổi sang khách hàng này ở `PUT /api/revisions/:id` $\rightarrow$ Hệ thống trả về HTTP 400 (`INVALID_CUSTOMER_SHORT_NAME`) yêu cầu cập nhật `Short Name` trước.
   - **Test 5 (Validate `Short Name` 2–6 ký tự trong Customer Master API):** `POST /api/master/customers` với `shortName` 1 ký tự hoặc > 6 ký tự trả về HTTP 400; với 2–6 ký tự (`ACG`, `NTRI`, `ABCDEF`) trả về 201/200 và tự động chuẩn hóa in hoa.
   - **Test 6 (Kiểm tra xuất Excel & Reports dùng `customerName`):** Xuất workbook Excel cho revision của khách hàng Nitori $\rightarrow$ Ô `B2` trên sheet `CS` và ô `A2` trên sheet `CC` chứa `customerName` đầy đủ (`"DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM"`) thay vì chỉ chứa mã ngắn `NTRI`.
2. **Đảm bảo toàn bộ các bài test hiện hữu (`npm test`) pass 100%:**
   - Kiểm tra và cập nhật dữ liệu seed/test nếu có bài test cũ tạo customer với `shortName` dài hơn 6 ký tự khi gọi `createProject`.

## Files
- Create: `apps/backend/test/auto-project-code.test.ts`
- Modify (if needed for test fixture compatibility): `apps/backend/test/*.test.ts`

## Steps
1. Viết `apps/backend/test/auto-project-code.test.ts` bao phủ đủ 6 kịch bản trên.
2. Chạy toàn bộ test suite (`npm test`) và kiểm tra kiểu (`npm run typecheck`) trên cả 3 workspaces (`@cscc/shared`, `@cscc/backend`, `@cscc/frontend`).
3. Cập nhật trạng thái các Phase trong `plan.md` sang `Completed`.

## Validation
- `npm run typecheck` pass 100% trên toàn monorepo.
- `npm test` pass 100% tất cả các file test.
- `npm run build` pass 100%.

## Risk / Rollback
- Các bài test chạy độc lập và khôi phục trạng thái sau khi kết thúc.
