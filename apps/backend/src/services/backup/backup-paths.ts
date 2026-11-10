import fs from 'fs';
import os from 'os';
import path from 'path';

/** Project root (repository root, or APP_ROOT when set). Used for the "Website" backup scope. */
export function getAppRoot(): string {
  if (process.env.APP_ROOT) return path.resolve(process.env.APP_ROOT);
  // apps/backend/src/services/backup -> repository root
  return path.resolve(__dirname, '../../../../..');
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function getBackupDir(): string {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.platform === 'win32') return path.join(getAppRoot(), '.backups');
  return '/var/backups/cscc';
}

/**
 * Returns the backup directory, creating it (mode 0700) when missing and verifying it is writable.
 * In production the directory must not live inside the web root (dist/ is served by Nginx);
 * the development fallback `<root>/.backups` is allowed only when it is not configured explicitly.
 */
export function ensureBackupDir(): string {
  const dir = getBackupDir();
  const explicit = Boolean(process.env.BACKUP_DIR?.trim());
  const root = getAppRoot();
  const frontendDist = path.join(root, 'apps', 'frontend', 'dist');
  if (isInside(dir, frontendDist)) {
    throw new Error('BACKUP_DIR không được nằm trong thư mục web (apps/frontend/dist).');
  }
  if (explicit && isInside(dir, root) && !isInside(dir, path.join(root, '.backups'))) {
    throw new Error('BACKUP_DIR phải nằm ngoài thư mục mã nguồn của dự án.');
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    throw new Error(`Không có quyền ghi vào thư mục sao lưu: ${dir}`);
  }
  return dir;
}

export function getTempDir(): string {
  const dir = path.join(ensureBackupDir(), '.tmp');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function makeWorkDir(prefix: string): string {
  return fs.mkdtempSync(path.join(getTempDir(), `${prefix}-`));
}

export function removeQuiet(target: string): void {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

/** Free bytes available on the volume holding `dir` (undefined when unknown). */
export function freeBytes(dir: string): number | undefined {
  try {
    const st = fs.statfsSync(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    return undefined;
  }
}

export function backupFileNamePattern(): RegExp {
  return /^(database|website|full)-\d{8}-\d{6}\.cscc-backup$/;
}

export function formatTimestamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function resolveBackupFile(fileName: string): string {
  if (!backupFileNamePattern().test(fileName)) {
    throw new Error('Tên file sao lưu không hợp lệ.');
  }
  return path.join(ensureBackupDir(), fileName);
}

export function hostName(): string {
  return os.hostname();
}

