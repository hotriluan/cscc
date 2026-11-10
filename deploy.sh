#!/usr/bin/env bash
# Cập nhật ứng dụng ALKANA CSCC trên server Ubuntu:
#   git pull -> kiểm tra công cụ sao lưu -> npm ci -> prisma db push -> build -> restart -> health check
# Chạy:  /var/www/html/alkana_cscc/deploy.sh   (bằng user "it", cần sudo cho systemctl và thư mục sao lưu)

set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-alkana_cscc}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"
DEFAULT_BACKUP_DIR="/var/backups/cscc"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$APP_DIR/apps/backend/.env"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[CẢNH BÁO] %s\033[0m\n' "$*" >&2; }

# Đọc giá trị KEY=VALUE từ apps/backend/.env (bỏ dấu nháy), in rỗng nếu không có.
env_value() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" || true
}

# Kiểm tra pg_dump / pg_restore (cần cho tính năng Sao lưu & Phục hồi). Chỉ cảnh báo, không chặn deploy.
check_pg_tools() {
  log "Kiểm tra pg_dump / pg_restore"
  local missing=0 tool
  for tool in pg_dump pg_restore; do
    if command -v "$tool" >/dev/null 2>&1; then
      echo "OK: $tool -> $(command -v "$tool") ($("$tool" --version))"
    else
      warn "Không tìm thấy $tool."
      missing=1
    fi
  done
  if [ "$missing" -eq 1 ]; then
    warn "Cài đặt bằng: sudo apt install -y postgresql-client-16  (hoặc đặt PG_BIN_DIR trong apps/backend/.env)."
  fi
}

# Tạo thư mục sao lưu, chủ sở hữu là user đang chạy, mode 0700.
ensure_backup_dir() {
  local dir owner
  dir="$(env_value BACKUP_DIR)"
  dir="${dir:-$DEFAULT_BACKUP_DIR}"
  owner="$(id -un)"
  log "Chuẩn bị thư mục sao lưu: $dir"

  if [ ! -d "$dir" ]; then
    if ! sudo install -d -o "$owner" -g "$(id -gn)" -m 0700 "$dir"; then
      warn "Không tạo được $dir. Chạy thủ công: sudo install -d -o $owner -g $(id -gn) -m 0700 $dir"
      return 0
    fi
  fi

  if [ "$(stat -c '%U' "$dir")" != "$owner" ]; then
    sudo chown "$owner":"$(id -gn)" "$dir" || warn "Không đổi được chủ sở hữu của $dir"
  fi
  chmod 0700 "$dir" || warn "Không đặt được quyền 0700 cho $dir"
  echo "OK: $dir ($(stat -c '%U:%G %a' "$dir"))"
}

# Nhắc cấu hình bắt buộc cho tính năng sao lưu (không in giá trị khóa).
check_backup_env() {
  if [ -z "$(env_value BACKUP_MASTER_KEY)" ]; then
    warn "Chưa có BACKUP_MASTER_KEY trong $ENV_FILE. Tạo một lần: echo \"BACKUP_MASTER_KEY=\$(openssl rand -base64 32)\" >> $ENV_FILE  rồi lưu bản sao khóa này ở nơi an toàn ngoài server."
  fi
}

wait_for_health() {
  log "Kiểm tra dịch vụ phản hồi: $HEALTH_URL"
  local i
  for i in $(seq 1 15); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
      echo "OK: dịch vụ đã sẵn sàng (lần thử $i)"
      return 0
    fi
    sleep 2
  done
  warn "Dịch vụ chưa phản hồi sau 30 giây. Xem log: sudo journalctl -u $SERVICE_NAME -n 100 --no-pager"
  return 1
}

main() {
  cd "$APP_DIR"

  log "Kéo mã nguồn mới từ GitHub"
  git pull --ff-only origin main

  check_pg_tools
  ensure_backup_dir
  check_backup_env

  log "Cài dependencies (npm ci)"
  npm ci

  log "Cập nhật schema Prisma (db push)"
  npx --workspace @cscc/backend prisma db push

  log "Build"
  npm run build

  log "Khởi động lại $SERVICE_NAME"
  sudo systemctl restart "$SERVICE_NAME"

  wait_for_health
  log "Hoàn tất triển khai"
}

# Chạy trong hàm rồi thoát ngay để bash không đọc tiếp file nếu git pull vừa thay đổi chính script này.
main "$@"
exit $?

