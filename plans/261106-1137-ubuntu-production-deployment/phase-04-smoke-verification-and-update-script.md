---
title: "Phase 04: End-to-End Verification & GitHub Update Script"
phase: 4
status: completed
effort: "0.5h"
tags: [verification, smoke-test, github, deploy-script]
---

# Phase 04: End-to-End Verification & GitHub Update Script

## Context Links
- Previous Phase: [Phase 03](./phase-03-build-systemd-service-and-nginx-vhost.md)
- Plan Overview: [plan.md](./plan.md)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Tạo script `/var/www/html/alkana_cscc/deploy.sh` trên server để việc kéo code mới từ GitHub về sau chỉ cần chạy 1 lệnh duy nhất, đồng thời thực hiện bộ kiểm thử End-to-End xác nhận cả `alkanacscc.com` và `alkanakpi.com` đều hoạt động hoàn hảo.

## Key Insights
- Việc tạo sẵn `/var/www/html/alkana_cscc/deploy.sh` (`git pull origin main && npm ci && npx --workspace @cscc/backend prisma db push && npm run build && sudo systemctl restart alkana_cscc`) giúp quy trình CI/CD thủ công qua GitHub cực kỳ nhanh và chuẩn xác.

## Requirements
- **Functional**:
  - Tạo script `/var/www/html/alkana_cscc/deploy.sh` có quyền thực thi (`chmod +x`).
  - Kiểm tra thực tế từ bên ngoài (từ máy Windows hiện tại gọi tới `192.168.18.33` với header `Host: alkanacscc.com` và `Host: alkanakpi.com`):
    1. `http://alkanakpi.com` vẫn trả về HTTP `200 OK` và PID của Gunicorn giữ nguyên 100% so với trước khi triển khai.
    2. `http://alkanacscc.com` trả về trang giao diện HTML/JS của hệ thống ALKANA CSCC.
    3. `http://alkanacscc.com/api/health`, `/api/projects`, `/api/customers` trả về đầy đủ dữ liệu đã backup từ máy local.

## Related Code Files
- Server helper script: `/var/www/html/alkana_cscc/deploy.sh`

## Implementation Steps
1. **Tạo script cập nhật tự động `/var/www/html/alkana_cscc/deploy.sh`**:
   - Viết script tự động `git pull origin main`, cài đặt dependencies, cập nhật schema Prisma (nếu có), build lại Frontend/Backend và khởi động lại `alkana_cscc.service`.
2. **Kiểm thử End-to-End từ máy Client tới `192.168.18.33`**:
   - Kiểm tra `http://192.168.18.33` với `Host: alkanacscc.com` cho cả trang chủ `/`, `/api/health`, `/api/projects`.
   - Kiểm tra `http://192.168.18.33` với `Host: alkanakpi.com` và đối chiếu PID của `alkana_kpi.service`.
3. **Cập nhật trạng thái Plan sang `completed`**.

## Todo List
- [x] Tạo `/var/www/html/alkana_cscc/deploy.sh` (`chmod +x`)
- [x] Kiểm thử HTTP & API của `alkanacscc.com` từ máy local tới `192.168.18.33`
- [x] Kiểm thử `alkanakpi.com` hoạt động bình thường và giữ nguyên PID Gunicorn
- [x] Cập nhật trạng thái hoàn tất vào `plan.md` và các file `phase-*.md`

## Success Criteria
- Cả hai tên miền `alkanakpi.com` và `alkanacscc.com` trên `192.168.18.33` đều phản hồi `200 OK` tức thì.
- Toàn bộ dữ liệu từ máy local xuất hiện đầy đủ trên `alkanacscc.com`.

