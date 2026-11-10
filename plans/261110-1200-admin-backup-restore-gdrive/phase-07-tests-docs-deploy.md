# Phase 7 — Kiểm thử, tài liệu, triển khai

## Steps
1. Thêm các file test mới vào script `test` của backend (`test/backup-rbac.test.ts`, `backup-restore.test.ts`, `backup-retention.test.ts`, `gdrive.test.ts`); chạy toàn bộ `npm test` + typecheck backend/frontend.
2. Tài liệu: mục mới trong `docs/user-guide` (sử dụng trang Sao lưu, hướng dẫn Google Cloud 4 bước, cách lưu mật khẩu, cách khôi phục khi mất máy chủ) và ghi biến môi trường mới trong `.env.example`.
3. Triển khai Ubuntu: **đã hoàn thành** — `deploy.sh` nay nằm trong repo (gốc dự án, LF qua `.gitattributes`; cần `git add --chmod=+x deploy.sh` khi commit để giữ quyền thực thi — nếu không, chạy `chmod +x` trên server) và đã gồm: kiểm tra `pg_dump`/`pg_restore` (chỉ cảnh báo), tạo/chuẩn hóa `BACKUP_DIR` (mặc định `/var/backups/cscc`, chủ là user chạy script, 0700, dùng `sudo` một lần), nhắc thiếu `BACKUP_MASTER_KEY`, và health check sau restart. Việc còn lại cho người vận hành: đặt `BACKUP_MASTER_KEY` (`openssl rand -base64 32`) vào `apps/backend/.env` trên server và lưu bản sao khóa ngoài server.
   - **Lần đồng bộ đầu tiên:** file `deploy.sh` cũ trên server chưa được git theo dõi nên `git pull` sẽ báo lỗi ghi đè. Trên server chạy: `cd /var/www/html/alkana_cscc && mv deploy.sh /tmp/deploy.sh.old && git pull --ff-only origin main && chmod +x deploy.sh && ./deploy.sh`.
4. Smoke test trên production: làm theo [server-runbook.md](./server-runbook.md) (agent khác thực hiện qua SSH sau khi cook; không thuộc phạm vi cook).
5. Checklist thủ công Google Drive thật (kết nối, upload, tải về, xoá, ngắt kết nối).

## Acceptance
Thỏa 7 tiêu chí trong `plan.md`; không có secret trong log/response/bundle (kiểm tra bằng grep).

## Rollback
Gỡ router/scheduler, giữ nguyên bảng mới (không ảnh hưởng chức năng cũ).

