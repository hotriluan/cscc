# Phase 1 — Nền tảng: schema, khóa, lưu trữ, bảo mật route

## Context
`apps/backend/src/app.ts` dùng `extractRoleMiddleware` + `requireAdminMiddleware` (`middleware/auth-rbac.middleware.ts`). Prisma schema: `apps/backend/prisma/schema.prisma` (deploy dùng `prisma db push`).

## Requirements
- Bảng `BackupJob`: id, kind (DATABASE|WEBSITE|FULL), trigger (MANUAL|SCHEDULE|PRE_RESTORE|UPLOAD), status (RUNNING|SUCCESS|FAILED), fileName, sizeBytes, sha256, driveFileId?, driveStatus (NONE|PENDING|OK|FAILED), error?, createdBy, startedAt, finishedAt, manifest (Json).
- Bảng `BackupSetting` (1 hàng): lịch DB/Full (cron + bật/tắt), retention (số bản), `driveEnabled`, `encryptedSecrets` (Client ID/Secret, refresh token, mật khẩu mã hóa — mã hóa bằng `BACKUP_MASTER_KEY`), `driveFolderId`, `driveAccountEmail`.
- Biến môi trường: `BACKUP_MASTER_KEY` (32 byte base64), `BACKUP_DIR` (mặc định `/var/backups/cscc`, dev `./.backups`), `PG_BIN_DIR` tùy chọn.
- Middleware mới `requireAdminJwt`: chấp nhận chỉ khi `req.authUser?.role === 'ADMIN'` (bỏ qua `x-user-role`/`?role=`).

- Mật khẩu mã hóa do admin tự đặt (tối thiểu 12 ký tự); lưu `encryptedSecrets.passphrase` mã hóa bằng master key cùng một hash xác minh (scrypt) để kiểm tra khi đổi/nhập lại. Đổi mật khẩu chỉ ảnh hưởng bản sao lưu mới; bản cũ cần mật khẩu cũ khi phục hồi (hỏi lại trong hộp thoại phục hồi).

## Files
- Modify: `apps/backend/prisma/schema.prisma`, `apps/backend/.env.example`, `apps/backend/src/middleware/auth-rbac.middleware.ts`
- Create: `apps/backend/src/services/backup/crypto-box.ts` (mã hóa secret bằng master key), `backup-paths.ts` (resolve & kiểm tra `BACKUP_DIR` nằm ngoài web root, tạo thư mục mode 0700)

## Steps
1. Khảo sát: xác nhận `pg_dump --version` và quyền ghi `BACKUP_DIR` (local + chạy `ssh` kiểm tra server nếu có quyền; nếu không, nhờ admin chạy lệnh).
2. Thêm model và chạy `prisma db push` trên DB dev.
3. Viết `crypto-box.ts` (AES-256-GCM, IV ngẫu nhiên, định dạng `v1:iv:tag:ciphertext`).
4. Viết `requireAdminJwt` và test 403 cho: không token, role khác, chỉ header `x-user-role`.

## Validation
- `npm run typecheck` pass; unit test encrypt/decrypt round-trip, sai khóa thì lỗi.
- Test 403 như trên.

## Risk / Rollback
Thay đổi schema chỉ thêm bảng (db push không mất dữ liệu). Rollback: xoá 2 model.

