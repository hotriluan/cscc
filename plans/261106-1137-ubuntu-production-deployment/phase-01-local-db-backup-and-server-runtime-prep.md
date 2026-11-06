---
title: "Phase 01: Local DB Backup & Server Runtime Preparation"
phase: 1
status: completed
effort: "0.5h"
tags: [backup, pg_dump, ubuntu, nodejs, postgresql]
---

# Phase 01: Local DB Backup & Server Runtime Preparation

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Local Backend Config: [apps/backend/.env.example](../../apps/backend/.env.example)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Ghi nhận trạng thái baseline của `alkanakpi.com` (PID Gunicorn, HTTP status), trích xuất toàn bộ dữ liệu PostgreSQL đang có trên máy local ra file SQL, truyền lên server `192.168.18.33`, và cài đặt hai môi trường còn thiếu trên server là **PostgreSQL 16** và **Node.js 22 LTS**.

## Key Insights
- Máy local đã cài sẵn `C:\Program Files\PostgreSQL\16\bin\pg_dump.exe` và PuTTY (`plink.exe`, `pscp.exe`).
- Server `192.168.18.33` đang chạy Ubuntu 24.04.2 LTS (`noble`), có sẵn gói `postgresql-16` chính thức trong kho `apt` của Ubuntu và hỗ trợ cài đặt `Node.js 22 LTS` từ NodeSource.
- Cài đặt `postgresql` và `nodejs` hoàn toàn độc lập với Python virtualenv, Gunicorn (`127.0.0.1:8000`) và MySQL (`3306`) của `alkanakpi.com`.

## Requirements
- **Functional**:
  - Kiểm tra và lưu lại PID hiện tại của `alkana_kpi.service` cùng HTTP response code của `http://alkanakpi.com`.
  - Tạo bản dump SQL đầy đủ (`schema + data`) từ database local `cscc_db` và tải lên `/tmp/cscc_local_backup.sql` trên server `192.168.18.33`.
  - Cài đặt thành công `postgresql` (v16) và `nodejs` (v22 LTS) + `npm` trên server.
- **Non-functional**:
  - Không dừng hay khởi động lại `nginx`, `mysql`, hoặc `alkana_kpi` trong quá trình cài gói.

## Architecture & Data Flow
`Local PostgreSQL (localhost:5432/cscc_db)` $\xrightarrow{\text{pg\_dump.exe}}$ `cscc_local_backup.sql` $\xrightarrow{\text{pscp.exe}}$ `192.168.18.33:/tmp/cscc_local_backup.sql`

## Related Code Files
- Read-only: `apps/backend/.env` (để lấy thông tin kết nối PostgreSQL local khi chạy `pg_dump.exe`).

## Implementation Steps
1. **Ghi nhận Baseline của `alkanakpi.com` trên server**:
   - Qua SSH, kiểm tra `systemctl status alkana_kpi --no-pager` và `curl -I -H "Host: alkanakpi.com" http://127.0.0.1/`.
2. **Sao lưu Database từ máy Local**:
   - Đọc kết nối từ `apps/backend/.env`, dùng `C:\Program Files\PostgreSQL\16\bin\pg_dump.exe --clean --if-exists --no-owner --no-privileges` xuất toàn bộ bảng và dữ liệu của `cscc_db` ra file tạm `cscc_local_backup.sql`.
   - Kiểm tra kích thước file và số dòng dữ liệu (`COPY public."Customer"`, `COPY public."Project"`, `COPY public."ProjectRevision"`, `COPY public."User"`...).
   - Dùng `C:\Program Files\PuTTY\pscp.exe` tải file backup lên `it@192.168.18.33:/tmp/cscc_local_backup.sql`.
3. **Cài đặt PostgreSQL 16 và Node.js 22 LTS trên Server `192.168.18.33`**:
   - Chạy `sudo apt-get update` và cài đặt `postgresql postgresql-contrib curl ca-certificates gnupg`.
   - Thiết lập kho NodeSource Node.js 22.x (`setup_22.x`) và cài đặt `nodejs`.
   - Kiểm tra `node -v`, `npm -v`, `psql --version` và trạng thái `systemctl is-active postgresql`.

## Todo List
- [x] Kiểm tra baseline PID và HTTP 200 của `alkanakpi.com`
- [x] Xuất file `cscc_local_backup.sql` từ PostgreSQL local và truyền lên `192.168.18.33:/tmp/cscc_local_backup.sql`
- [x] Cài đặt PostgreSQL 16 và Node.js 22 LTS trên server `192.168.18.33`

## Success Criteria
- File `/tmp/cscc_local_backup.sql` tồn tại trên server và chứa đầy đủ dữ liệu từ máy local.
- `node -v` trả về `v22.x`, `psql --version` trả về `16.x`, và `alkana_kpi.service` vẫn chạy nguyên PID ban đầu.

## Risk Assessment & Security Considerations
- **Risk**: Lệnh `apt-get` hỏi xác nhận tương tác.
  - **Mitigation**: Sử dụng `DEBIAN_FRONTEND=noninteractive apt-get install -y ...`.
- **Security**: Không in mật khẩu database ra màn hình log; xóa file tạm `/tmp/cscc_local_backup.sql` sau khi khôi phục xong ở Phase 02.

## Next Steps
- Chuyển sang [Phase 02](./phase-02-postgresql-setup-and-local-data-restore.md) để tạo database `cscc_db`, clone source code từ GitHub và restore dữ liệu.

