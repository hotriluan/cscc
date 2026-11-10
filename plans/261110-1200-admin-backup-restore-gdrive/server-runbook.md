# Runbook triển khai trên server (dành cho AI agent chạy qua SSH)

Chạy **sau khi** `/ak-cook` hoàn tất phase 1–7 và code đã được push lên GitHub (`origin main`), gồm `deploy.sh` mới. Thực hiện tuần tự; dừng và báo người dùng nếu bước nào không đạt điều kiện kiểm tra.

## Thông tin môi trường
- Server: `192.168.18.33`, Ubuntu 24.04, user `it` (đăng nhập SSH bằng user này).
- Thư mục ứng dụng: `/var/www/html/alkana_cscc`; service: `alkana_cscc` (Node, `127.0.0.1:4000`); DB: PostgreSQL 16 native, `cscc_db`, user `cscc`.
- Ứng dụng khác dùng chung server: `alkanakpi.com` (`alkana_kpi.service`, Gunicorn `:8000`, MySQL `:3306`).

## Quy tắc an toàn (bắt buộc)
1. **Không** sửa, restart hay dừng bất cứ thứ gì thuộc `alkanakpi.com` (`/var/www/html/alkana_kpi`, `alkana_kpi.service`, Nginx vhost của nó, MySQL).
2. **Không** in giá trị `BACKUP_MASTER_KEY`, mật khẩu DB, token, nội dung `.env` ra log/chat. Chỉ báo "có/không".
3. **Không** thử phục hồi trên DB `cscc_db` thật. Chỉ dùng DB phụ `cscc_restore_test`.
4. **Không** dùng `systemctl restart nginx`; nếu buộc phải nạp Nginx thì `sudo nginx -t` rồi `sudo systemctl reload nginx` (thường không cần trong runbook này).
5. Các lệnh `sudo` chỉ dùng cho đúng việc ghi rõ dưới đây. Nếu `sudo` đòi mật khẩu mà agent không có, dừng lại và nhờ người dùng nhập.

## Bước 0 — Ghi nhận trạng thái trước khi thay đổi
```bash
ssh it@192.168.18.33 'cd /var/www/html/alkana_cscc && git status --short && git log --oneline -1 && systemctl is-active alkana_cscc && systemctl show alkana_kpi -p MainPID && curl -fsS http://127.0.0.1:4000/api/health'
```
Ghi lại `MainPID` của `alkana_kpi` để so sánh ở bước cuối. Nếu cây làm việc có thay đổi chưa commit ngoài `deploy.sh`, dừng và hỏi.

## Bước 1 — Sao lưu thủ công trước khi nâng cấp (bảo hiểm)
```bash
ssh it@192.168.18.33 'mkdir -p ~/pre-backup-upgrade && PGPASSWORD="$(grep -E "^DATABASE_URL=" /var/www/html/alkana_cscc/apps/backend/.env | sed -E "s#.*://[^:]+:([^@]+)@.*#\1#")" pg_dump -h 127.0.0.1 -U cscc -Fc cscc_db -f ~/pre-backup-upgrade/cscc_db_$(date +%Y%m%d-%H%M%S).dump && ls -lh ~/pre-backup-upgrade'
```
Điều kiện đạt: file `.dump` tồn tại và dung lượng > 0. (Nếu `pg_dump` chưa cài, làm bước 2 trước rồi quay lại.)

## Bước 2 — Cài `postgresql-client` nếu thiếu
```bash
ssh it@192.168.18.33 'command -v pg_dump pg_restore || sudo apt install -y postgresql-client-16'
```
Điều kiện đạt: `pg_dump --version` và `pg_restore --version` in phiên bản 16.x.

## Bước 3 — Chuyển `deploy.sh` cũ sang file được git theo dõi (chỉ lần đầu)
File `deploy.sh` cũ trên server chưa tracked nên `git pull` sẽ lỗi ghi đè.
```bash
ssh it@192.168.18.33 'cd /var/www/html/alkana_cscc && git ls-files --error-unmatch deploy.sh 2>/dev/null || (mv deploy.sh /tmp/deploy.sh.old && git pull --ff-only origin main && chmod +x deploy.sh)'
```
Điều kiện đạt: `git ls-files deploy.sh` có kết quả; `head -1 deploy.sh` là `#!/usr/bin/env bash`; `bash -n deploy.sh` không lỗi.

## Bước 4 — Đặt cấu hình sao lưu trong `.env` (chỉ nếu chưa có)
```bash
ssh it@192.168.18.33 'cd /var/www/html/alkana_cscc/apps/backend && grep -q "^BACKUP_MASTER_KEY=" .env || echo "BACKUP_MASTER_KEY=$(openssl rand -base64 32)" >> .env; grep -q "^BACKUP_DIR=" .env || echo "BACKUP_DIR=/var/backups/cscc" >> .env; chmod 600 .env; grep -c "^BACKUP_MASTER_KEY=" .env'
```
Điều kiện đạt: lệnh in `1`. **Không** in lại giá trị khóa. Khi khóa vừa được tạo, **nhắc người dùng** tự sao chép `BACKUP_MASTER_KEY` ra nơi an toàn ngoài server (agent không được hiển thị khóa trong chat; người dùng tự đọc bằng `ssh` nếu cần). Mất khóa này thì mật khẩu mã hóa đã lưu không đọc lại được.

## Bước 5 — Triển khai
```bash
ssh -t it@192.168.18.33 '/var/www/html/alkana_cscc/deploy.sh'
```
(`-t` để `sudo` có thể hỏi mật khẩu.) `deploy.sh` sẽ pull, kiểm tra `pg_dump`/`pg_restore`, tạo `/var/backups/cscc` (chủ `it`, mode 0700), `npm ci`, `prisma db push` (thêm bảng `BackupJob`, `BackupSetting`), build, restart `alkana_cscc`, health check. Điều kiện đạt: kết thúc bằng "Hoàn tất triển khai", không có dòng `[CẢNH BÁO]` về `pg_dump` hay `BACKUP_MASTER_KEY`.

## Bước 6 — Kiểm tra sau triển khai
```bash
ssh it@192.168.18.33 'stat -c "%U:%G %a %n" /var/backups/cscc; systemctl is-active alkana_cscc; curl -fsS http://127.0.0.1:4000/api/health; systemctl show alkana_kpi -p MainPID; sudo journalctl -u alkana_cscc -n 50 --no-pager | grep -iE "error|fatal" || echo "no errors in recent log"'
```
Điều kiện đạt:
- Thư mục: `it:it 700 /var/backups/cscc`.
- `alkana_cscc` là `active`, health trả HTTP 200.
- `MainPID` của `alkana_kpi` **giống bước 0**.
- Log không có lỗi nghiêm trọng.
- Từ máy ngoài: `curl -I -H "Host: alkanacscc.com" http://192.168.18.33/` và `Host: alkanakpi.com` đều 200.

## Bước 7 — Kiểm thử chức năng sao lưu (không động vào DB thật)
1. Kiểm tra bảo mật: `curl -s -o /dev/null -w "%{http_code}" -H "x-user-role: ADMIN" http://127.0.0.1:4000/api/admin/backup/jobs` phải ra **403** (không JWT). Không JWT mà trả 200 là lỗi nghiêm trọng, dừng và báo.
2. Tạo DB phụ để thử phục hồi: `sudo -u postgres createdb -O cscc cscc_restore_test` (chỉ khi người dùng đồng ý vì cần quyền postgres).
3. Nhờ người dùng đăng nhập ADMIN trên UI để: đặt mật khẩu mã hóa, bấm "Sao lưu ngay" (Database), xác nhận file xuất hiện trong `/var/backups/cscc` (`ls -lh`), tải về, và chạy thử phục hồi vào DB phụ nếu UI/CLI hỗ trợ chọn đích; không phục hồi vào `cscc_db`.
4. Kiểm tra bản sao lưu không đọc được nếu không có mật khẩu: `head -c 16 /var/backups/cscc/*.cscc-backup | xxd` phải thấy header `CSCCBK1`, không thấy nội dung SQL rõ ràng; `strings` file không chứa tên bảng/khách hàng.
5. Google Drive (người dùng thực hiện, agent hỗ trợ kiểm tra): sau khi người dùng kết nối Drive trong UI và bật "Lưu thêm lên Drive", chạy một lần sao lưu và xác nhận trạng thái Drive là OK trong UI.
6. Dọn dẹp: `sudo -u postgres dropdb cscc_restore_test` khi xong.

## Bước 8 — Báo cáo
Agent báo ngắn gọn: commit đã triển khai, kết quả từng bước (Đạt/Không đạt), `MainPID` của `alkana_kpi` trước và sau, đường dẫn bản sao lưu bảo hiểm ở bước 1, và các việc người dùng còn phải làm (lưu `BACKUP_MASTER_KEY` ngoài server, tạo OAuth client Google Cloud, kết nối Drive, lưu mật khẩu mã hóa offline).

## Rollback
- Ứng dụng lỗi sau triển khai: `cd /var/www/html/alkana_cscc && git log --oneline -3`, `git checkout <commit-trước>` rồi `npm ci && npm run build && sudo systemctl restart alkana_cscc`. Hai bảng mới của Prisma vô hại với bản code cũ.
- Dữ liệu: dùng bản `.dump` ở bước 1 (`pg_restore --clean --if-exists -d cscc_db`) **chỉ khi người dùng yêu cầu rõ ràng**.

