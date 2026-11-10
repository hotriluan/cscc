# Phase 5 — API admin, lịch tự động, lưu giữ

## API (tất cả qua `requireAdminJwt`)
| Method | Route | Mục đích |
|---|---|---|
| GET | `/api/admin/backup/jobs` | Danh sách bản sao lưu và trạng thái |
| POST | `/api/admin/backup/jobs` | Sao lưu ngay `{kind, uploadToDrive}` |
| GET | `/api/admin/backup/jobs/:id/download` | Tải file (stream) |
| DELETE | `/api/admin/backup/jobs/:id` | Xoá (cục bộ + Drive nếu có) |
| POST | `/api/admin/backup/upload` | Tải bản sao lưu từ máy (stream thô, không dùng `express.json` 25MB) |
| POST | `/api/admin/backup/jobs/:id/restore` | Phục hồi `{scope, confirm, passphrase?}` |
| POST | `/api/admin/backup/drive/restore` | Phục hồi từ file trên Drive |
| GET/PUT | `/api/admin/backup/settings` | Lịch, lưu giữ, bật Drive, mật khẩu (không trả secret) |
| GET/POST/DELETE | `/api/admin/backup/drive/*` | Trạng thái, cấu hình client, bắt đầu kết nối, ngắt kết nối, kiểm tra, danh sách file |

## Scheduler & retention
- `node-cron` khởi tạo khi server chạy; đọc `BackupSetting`; áp dụng lại khi admin đổi lịch. Tránh chạy chồng khi tác vụ khác đang chạy (bỏ qua và ghi log).
- Sau mỗi backup thành công: nếu `driveEnabled` thì upload; rồi áp dụng retention theo từng loại (xoá bản cũ cục bộ và trên Drive cùng chính sách).
- Ghi nhật ký (ai, khi nào, kết quả) trong `BackupJob`; bản thất bại hiển thị trên UI.

## Files
- Create: `services/backup/scheduler.ts`, `retention.ts`, `routes/backup.routes.ts`
- Modify: `src/app.ts` (mount router, khởi động scheduler), `src/index.ts`, `package.json` (`node-cron`)

## Validation
- Test RBAC cho từng route (403 với non-admin và header giả).
- Test retention (giữ N bản mới nhất từng loại) và scheduler (dùng cron giả/khoảng thời gian ngắn).

