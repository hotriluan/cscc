---
title: "Phase 03: Production Build, Systemd Service & Nginx Virtual Host"
phase: 3
status: completed
effort: "0.75h"
tags: [systemd, nginx, build, vite, express]
---

# Phase 03: Production Build, Systemd Service & Nginx Virtual Host

## Context Links
- Previous Phase: [Phase 02](./phase-02-postgresql-setup-and-local-data-restore.md)
- Frontend Config: [apps/frontend/vite.config.ts](../../apps/frontend/vite.config.ts)
- Backend Entrypoint: [apps/backend/src/index.ts](../../apps/backend/src/index.ts)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Biên dịch bản production cho toàn bộ monorepo (`@cscc/shared`, `@cscc/backend`, `@cscc/frontend`), thiết lập dịch vụ `systemd` `/etc/systemd/system/alkana_cscc.service` chạy ở port `4000`, và thêm cấu hình Nginx Virtual Host `/etc/nginx/sites-available/alkana_cscc` phục vụ tên miền `alkanacscc.com` mà không làm gián đoạn `alkanakpi.com`.

## Key Insights
- `alkana_kpi.service` đang chạy ở `127.0.0.1:8000` và được Nginx proxy thông qua `/etc/nginx/sites-enabled/alkana_kpi` (`server_name alkanakpi.com;`).
- Khi tạo file mới `/etc/nginx/sites-available/alkana_cscc` với `server_name alkanacscc.com www.alkanacscc.com;`, Nginx phân tách lưu lượng hoàn toàn theo HTTP `Host` header trên cùng port `80`.
- Lệnh `sudo nginx -t && sudo systemctl reload nginx` chỉ yêu cầu master process của Nginx đọc lại cấu hình và khởi tạo worker mới một cách êm ái (graceful), tuyệt đối không làm rớt bất kỳ request nào của `alkanakpi.com`.

## Requirements
- **Functional**:
  - Chạy `npm run build` tại `/var/www/html/alkana_cscc` để tạo thư mục `/var/www/html/alkana_cscc/apps/frontend/dist` và `apps/backend/dist`.
  - Tạo `/etc/systemd/system/alkana_cscc.service` chạy Backend tại `127.0.0.1:4000` với `Restart=always`, `User=it`, `Group=www-data`.
  - Tạo `/etc/nginx/sites-available/alkana_cscc` và symlink sang `/etc/nginx/sites-enabled/alkana_cscc`:
    - Phục vụ static files từ `/var/www/html/alkana_cscc/apps/frontend/dist` với `try_files $uri $uri/ /index.html;`.
    - Reverse-proxy `/api/` tới `http://127.0.0.1:4000` với `client_max_body_size 30M;` (hỗ trợ upload file Excel báo giá dung lượng lớn).

## Architecture
- **Systemd Service (`/etc/systemd/system/alkana_cscc.service`)**:
  - `WorkingDirectory=/var/www/html/alkana_cscc/apps/backend`
  - `ExecStart=/usr/bin/npm run start` (hoặc chạy trực tiếp node/tsx với biến môi trường từ `.env`)
- **Nginx Virtual Host (`/etc/nginx/sites-available/alkana_cscc`)**:
  - `listen 80;`
  - `server_name alkanacscc.com www.alkanacscc.com;`
  - `root /var/www/html/alkana_cscc/apps/frontend/dist;`
  - `location /api/ { proxy_pass http://127.0.0.1:4000; ... }`

## Related Code Files
- Server files to create:
  - `/etc/systemd/system/alkana_cscc.service`
  - `/etc/nginx/sites-available/alkana_cscc`
  - `/etc/nginx/sites-enabled/alkana_cscc` (symlink)

## Implementation Steps
1. **Build Production Monorepo**:
   - Tại `/var/www/html/alkana_cscc`, chạy `npm run build`.
   - Kiểm tra `/var/www/html/alkana_cscc/apps/frontend/dist/index.html` đã được tạo thành công.
2. **Thiết lập & Khởi chạy `alkana_cscc.service`**:
   - Tạo file `/etc/systemd/system/alkana_cscc.service`.
   - Chạy `sudo systemctl daemon-reload`, `sudo systemctl enable --now alkana_cscc.service`.
   - Kiểm tra trực tiếp `curl -s http://127.0.0.1:4000/api/health` trả về `{"status":"ok","database":"postgresql",...}`.
3. **Cấu hình Nginx Virtual Host cho `alkanacscc.com`**:
   - Tạo `/etc/nginx/sites-available/alkana_cscc` và tạo symlink `/etc/nginx/sites-enabled/alkana_cscc`.
   - Kiểm tra cú pháp bắt buộc bằng `sudo nginx -t`.
   - Nạp cấu hình bằng `sudo systemctl reload nginx`.

## Todo List
- [x] Chạy `npm run build` tại `/var/www/html/alkana_cscc`
- [x] Tạo và kích hoạt `alkana_cscc.service` (`systemctl enable --now alkana_cscc`)
- [x] Kiểm tra `http://127.0.0.1:4000/api/health` hoạt động tốt
- [x] Tạo `/etc/nginx/sites-available/alkana_cscc`, kiểm tra `sudo nginx -t` và `sudo systemctl reload nginx`

## Success Criteria
- `systemctl is-active alkana_cscc` trả về `active`.
- `sudo nginx -t` báo `syntax is ok` và `test is successful`.
- `curl -H "Host: alkanacscc.com" http://127.0.0.1/api/health` trả về JSON `status: "ok"`.

## Risk Assessment & Security Considerations
- **Risk**: Lỗi cú pháp trong file Nginx mới.
  - **Mitigation**: Luôn chạy `sudo nginx -t` trước khi reload; nếu có lỗi thì Nginx vẫn giữ nguyên cấu hình đang chạy mà không ảnh hưởng tới `alkanakpi.com`.

## Next Steps
- Chuyển sang [Phase 04](./phase-04-smoke-verification-and-update-script.md) để kiểm thử toàn diện và tạo script cập nhật tự động từ GitHub.

