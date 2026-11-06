---
title: "Phase 02: PostgreSQL Setup, GitHub Clone & Local Data Restore"
phase: 2
status: completed
effort: "0.75h"
tags: [postgresql, github, prisma, restore, migration]
---

# Phase 02: PostgreSQL Setup, GitHub Clone & Local Data Restore

## Context Links
- Previous Phase: [Phase 01](./phase-01-local-db-backup-and-server-runtime-prep.md)
- Prisma Schema: [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Khởi tạo user `cscc` và database `cscc_db` trên PostgreSQL 16 của server, clone mã nguồn dự án từ GitHub (`https://github.com/hotriluan/cscc.git`) vào `/var/www/html/alkana_cscc`, nạp toàn bộ bản sao lưu dữ liệu từ máy local vào PostgreSQL trên server và đồng bộ Prisma Client.

## Key Insights
- Khi `dataStore.init()` trong `apps/backend/src/store/data-store.ts` khởi chạy, nếu database đã có sẵn dữ liệu (`customerCount > 0`), hệ thống sẽ **giữ nguyên toàn bộ dữ liệu đã restore** mà không ghi đè lại từ file Excel.
- Trước khi clone lên server, cần đảm bảo mọi thay đổi code hợp lệ ở máy local đã được push lên `origin/main` của `https://github.com/hotriluan/cscc.git`.

## Requirements
- **Functional**:
  - Tạo PostgreSQL user `cscc` và database `cscc_db` trên `127.0.0.1:5432`.
  - Clone `https://github.com/hotriluan/cscc.git` vào `/var/www/html/alkana_cscc`.
  - Tạo file `/var/www/html/alkana_cscc/apps/backend/.env` với `DATABASE_URL` kết nối tới `cscc_db` và `PORT=4000`, quyền đọc giới hạn `chmod 600`.
  - Nạp dữ liệu từ `/tmp/cscc_local_backup.sql` vào `cscc_db` và chạy `npx prisma generate` + `npx prisma db push` (đảm bảo schema khớp tuyệt đối).
  - Đối chiếu số lượng bản ghi giữa máy local và server.

## Architecture & Data Flow
`GitHub (hotriluan/cscc.git)` $\xrightarrow{\text{git clone}}$ `/var/www/html/alkana_cscc`
`/tmp/cscc_local_backup.sql` $\xrightarrow{\text{psql cscc\_db}}$ `PostgreSQL 16 (127.0.0.1:5432/cscc_db)`

## Related Code Files
- Server path to create: `/var/www/html/alkana_cscc/apps/backend/.env`

## Implementation Steps
1. **Khởi tạo User & Database trên PostgreSQL 16 của Server**:
   - Dùng `sudo -u postgres psql` tạo user `cscc` với mật khẩu riêng và tạo database `cscc_db OWNER cscc`.
   - Đảm bảo PostgreSQL chỉ lắng nghe ở `localhost` (`127.0.0.1:5432`) để bảo mật tối đa.
2. **Nạp dữ liệu Backup từ máy Local vào `cscc_db` trên Server**:
   - Chạy `PGPASSWORD=... psql -h 127.0.0.1 -U cscc -d cscc_db -f /tmp/cscc_local_backup.sql`.
   - Xóa file tạm `/tmp/cscc_local_backup.sql` sau khi nạp xong.
3. **Clone dự án từ GitHub & Cài đặt Dependencies**:
   - Tại `/var/www/html`, chạy `git clone https://github.com/hotriluan/cscc.git alkana_cscc`.
   - Tạo `/var/www/html/alkana_cscc/apps/backend/.env` (`chmod 600`).
   - Chạy `npm ci` tại `/var/www/html/alkana_cscc` và `npx prisma generate` + `npx prisma db push` trong `apps/backend`.
4. **Kiểm tra số lượng bản ghi sau khi Restore**:
   - Kiểm tra số lượng `User`, `Customer`, `QuotationItem`, `PackingMapping`, `ApplicationStepMaster`, `ApplicationMethod`, `Project`, `ProjectRevision`, `RevisionStatusHistory` trên server khớp 100% với máy local.

## Todo List
- [x] Tạo user `cscc` và database `cscc_db` trên PostgreSQL 16 của server
- [x] Khôi phục dữ liệu từ `/tmp/cscc_local_backup.sql` vào `cscc_db`
- [x] Clone `https://github.com/hotriluan/cscc.git` vào `/var/www/html/alkana_cscc`
- [x] Cấu hình `apps/backend/.env`, chạy `npm ci` và `prisma generate`
- [x] Xác minh số lượng bản ghi trên server khớp 100% với máy local

## Success Criteria
- Kết nối `psql -h 127.0.0.1 -U cscc -d cscc_db` thành công.
- Số lượng bản ghi trên server khớp chính xác với cơ sở dữ liệu local.

## Risk Assessment & Security Considerations
- **Risk**: Quyền sở hữu thư mục `/var/www/html/alkana_cscc` không khớp với user chạy service.
  - **Mitigation**: Thực hiện `git clone` và `npm ci` trực tiếp bằng tài khoản `it` (chủ sở hữu `/var/www/html`).
- **Security**: Đặt `chmod 600` cho `/var/www/html/alkana_cscc/apps/backend/.env` để bảo vệ chuỗi kết nối DB.

## Next Steps
- Chuyển sang [Phase 03](./phase-03-build-systemd-service-and-nginx-vhost.md) để build production bundle, cấu hình `alkana_cscc.service` và Nginx Virtual Host.

