# Phase 2 — Sao lưu lõi + mã hóa + manifest

## Requirements
- Hàm `runBackup(kind, trigger, user)`; khóa toàn cục (một tác vụ backup/restore tại một thời điểm, trả 409 nếu bận).
- DB: parse `DATABASE_URL`, chạy `pg_dump -Fc` với `PGPASSWORD` qua env (không đưa mật khẩu vào argv/log).
- Website: tar.gz theo danh sách bao gồm/loại trừ (loại `node_modules`, `dist`, `.git`, `BACKUP_DIR`), thêm `.env`; Nginx/systemd chỉ thêm nếu đọc được.
- Gói theo luồng: tar → gzip → mã hóa AES-256-GCM (khóa dẫn xuất scrypt từ mật khẩu + salt) → ghi `.cscc-backup`; `manifest.json` nằm trong gói kèm bản sao nhẹ (`.json` không bí mật) để liệt kê nhanh.
- Kiểm tra dung lượng trống trước; ghi SHA-256; cập nhật `BackupJob`; xóa file dở dang khi lỗi.

## Files
- Create: `services/backup/backup.service.ts`, `pg-tools.ts`, `archive.ts`, `encrypted-stream.ts`, `manifest.ts`
- Modify: `apps/backend/package.json` (thêm `tar`)

## Steps
1. `pg-tools.ts`: dò `pg_dump`/`pg_restore` (PG_BIN_DIR → PATH), chạy spawn, thu stderr.
2. `archive.ts`: dựng tar với bộ lọc; thống kê số bản ghi DB cho manifest (qua Prisma count từng model).
3. `encrypted-stream.ts`: Transform stream mã hóa/giải mã có header `CSCCBK1 | salt | iv`, tag cuối file.
4. `backup.service.ts`: ghép các bước, xử lý lỗi và dọn dẹp.

## Validation
- Test: backup DB trên DB thử → file tồn tại, sai mật khẩu giải mã thất bại, checksum trùng manifest.
- Test: backup bị chặn khi đang chạy tác vụ khác (409).

## Risk / Rollback
Backup lớn dùng stream, không nạp vào RAM. Rollback: xoá thư mục `services/backup`.

