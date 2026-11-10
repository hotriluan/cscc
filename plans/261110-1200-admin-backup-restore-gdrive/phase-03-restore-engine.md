# Phase 3 — Phục hồi an toàn + chế độ bảo trì

## Requirements
- `runRestore(source, scope, user, confirmName)`: nguồn = bản trong `BACKUP_DIR`, file tải lên, hoặc tải từ Drive. Phạm vi phục hồi: Database / Website / Toàn bộ (tuỳ nội dung bản sao lưu cho phép).
- Trình tự: xác thực quyền → khóa → xác minh header, giải mã, checksum, manifest tương thích phiên bản → **tạo bản sao lưu an toàn PRE_RESTORE** → bật cờ bảo trì (file cờ trên đĩa + middleware trả 503 cho route không phải backup) → thực hiện → tắt cờ.
- DB: `prisma.$disconnect()`, `pg_restore --clean --if-exists --single-transaction --no-owner`, kết nối lại, so khớp số bản ghi với manifest. Lỗi → tự `pg_restore` lại bản PRE_RESTORE.
- Website: giải nén vào thư mục tạm, kiểm tra, sau đó thay file mã nguồn/`.env`; không tự restart. Trả về hướng dẫn: chạy `deploy.sh` hoặc `sudo systemctl restart alkana_cscc`.
- Xác nhận: UI yêu cầu nhập đúng tên bản sao lưu; API yêu cầu `confirm` khớp.
- Nếu tiến trình chết giữa chừng: khi khởi động, đọc cờ bảo trì còn sót và ghi `BackupJob` FAILED + cảnh báo trên UI.

## Files
- Create: `services/backup/restore.service.ts`, `maintenance.ts`
- Modify: `src/app.ts` (gắn middleware bảo trì sau `extractRoleMiddleware`)

## Validation
- Test e2e: backup → sửa dữ liệu → restore → dữ liệu về như cũ.
- Test: file hỏng/sai mật khẩu → dữ liệu hiện tại nguyên vẹn.
- Test: giả lập `pg_restore` lỗi → tự quay lại PRE_RESTORE.
- Test: request thường trong lúc bảo trì nhận 503.

## Risk / Rollback
Rủi ro cao nhất của tính năng; luôn có PRE_RESTORE. Không thử trực tiếp trên production trước khi test trên DB thử.

