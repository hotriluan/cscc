# Phase 4 — Google Drive (OAuth Device Flow, REST)

## Requirements
- Cấu hình trong UI: dán Client ID/Secret → lưu mã hóa (`crypto-box`).
- Kết nối: `POST https://oauth2.googleapis.com/device/code` (scope `https://www.googleapis.com/auth/drive.file`) → trả `user_code` + `verification_url` cho UI → backend poll token endpoint theo `interval` → lưu refresh token mã hóa, lấy email tài khoản.
- Làm mới access token khi cần; lỗi `invalid_grant` → đánh dấu "cần kết nối lại" hiển thị trong UI.
- Tạo/tìm thư mục "CSCC Backups" (do app tạo → thuộc phạm vi `drive.file`); lưu `driveFolderId`.
- Upload resumable theo luồng (file lớn), xác minh `md5Checksum`/kích thước; liệt kê, tải về (stream), xoá theo `fileId`.
- Thử lại tự động tối đa 3 lần (backoff); thất bại → `driveStatus=FAILED`, nút "Thử lại" trong UI.
- Ngắt kết nối: revoke token + xoá secret.

## Files
- Create: `services/backup/gdrive.service.ts`, `gdrive-oauth.ts`
- Không thêm `googleapis` (dùng `fetch`).

## Validation
- Unit test với server giả (mock `fetch`): device flow, refresh, resumable upload, xoá, `invalid_grant`.
- Kiểm tra thủ công một lần với Gmail thật: kết nối, upload, liệt kê, tải về, xoá (ghi checklist trong phase 7).

## Risk / Rollback
- App Google ở "Testing": token hết hạn 7 ngày → hướng dẫn chuyển "In production" (hiển thị cảnh báo trong UI).
- Ngắt Drive không ảnh hưởng sao lưu cục bộ.

