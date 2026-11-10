import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getBackupDir } from './backup-paths';

/** Disk-backed maintenance flag so a crash mid-restore is detected on the next start. */

let active = false;

function flagFile(): string {
  return path.join(getBackupDir(), '.maintenance');
}

export function isMaintenanceActive(): boolean {
  return active;
}

export function enableMaintenance(reason: string): void {
  active = true;
  fs.mkdirSync(getBackupDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(flagFile(), JSON.stringify({ reason, since: new Date().toISOString() }));
}

export function disableMaintenance(): void {
  active = false;
  fs.rmSync(flagFile(), { force: true });
}

/** Returns the stale flag left by a process that died mid-restore (and clears it). */
export function consumeStaleMaintenanceFlag(): { reason: string; since: string } | null {
  try {
    const raw = fs.readFileSync(flagFile(), 'utf8');
    fs.rmSync(flagFile(), { force: true });
    active = false;
    return JSON.parse(raw) as { reason: string; since: string };
  } catch {
    return null;
  }
}

/** 503 for everything except the backup admin API while a restore is running. */
export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!active || req.path.startsWith('/api/admin/backup')) {
    next();
    return;
  }
  res.status(503).json({
    error: 'MAINTENANCE',
    message: 'Hệ thống đang được phục hồi dữ liệu. Vui lòng thử lại sau ít phút.'
  });
}

