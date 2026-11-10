import fs from 'fs';
import path from 'path';
import { prisma } from '../../store/prisma';
import { getAppRoot } from './backup-paths';
import {
  hashPassphrase,
  isMasterKeyConfigured,
  openSecret,
  sealSecret,
  verifyPassphraseHash
} from './crypto-box';

export interface BackupSecrets {
  driveClientId?: string;
  driveClientSecret?: string;
  driveRefreshToken?: string;
  passphrase?: string;
}

export const MIN_PASSPHRASE_LENGTH = 12;

type SettingRow = Awaited<ReturnType<typeof prisma.backupSetting.upsert>>;

export async function getSettingRow(): Promise<SettingRow> {
  return prisma.backupSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function readSecrets(row: SettingRow): BackupSecrets {
  if (!row.encryptedSecrets) return {};
  return JSON.parse(openSecret(row.encryptedSecrets)) as BackupSecrets;
}

export async function updateSecrets(patch: Partial<BackupSecrets>, extra: Record<string, unknown> = {}) {
  const row = await getSettingRow();
  const merged: BackupSecrets = { ...readSecrets(row), ...patch };
  for (const k of Object.keys(merged) as (keyof BackupSecrets)[]) {
    if (merged[k] === undefined || merged[k] === null) delete merged[k];
  }
  return prisma.backupSetting.update({
    where: { id: 1 },
    data: { encryptedSecrets: sealSecret(JSON.stringify(merged)), ...extra }
  });
}

export async function getPassphrase(): Promise<string> {
  const row = await getSettingRow();
  const pass = readSecrets(row).passphrase;
  if (!pass) {
    throw new BackupConfigError(
      'Chưa đặt mật khẩu mã hóa sao lưu. Vào Sao lưu & Phục hồi để thiết lập trước.'
    );
  }
  return pass;
}

export async function setPassphrase(passphrase: string): Promise<void> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new BackupConfigError(`Mật khẩu mã hóa phải có tối thiểu ${MIN_PASSPHRASE_LENGTH} ký tự.`);
  }
  await updateSecrets({ passphrase }, { passphraseHash: hashPassphrase(passphrase) });
}

export function checkPassphrase(row: SettingRow, passphrase: string): boolean {
  return Boolean(row.passphraseHash) && verifyPassphraseHash(passphrase, row.passphraseHash as string);
}

export class BackupConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupConfigError';
  }
}

/**
 * Automatically discovers Google Drive OAuth credentials from client_secret*.json or environment variables,
 * sealing them securely with BACKUP_MASTER_KEY if not already configured.
 */
export async function autoDetectAndSeedDriveCredentials(): Promise<boolean> {
  if (!isMasterKeyConfigured()) return false;
  try {
    const row = await getSettingRow();
    const secrets = readSecrets(row);
    if (secrets.driveClientId && secrets.driveClientSecret) {
      return false;
    }

    const envClientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
    const envClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
    if (envClientId && envClientSecret) {
      await updateSecrets({ driveClientId: envClientId, driveClientSecret: envClientSecret });
      return true;
    }

    const roots = [getAppRoot(), path.join(getAppRoot(), 'apps', 'backend')];
    for (const r of roots) {
      if (!fs.existsSync(r)) continue;
      const files = fs.readdirSync(r);
      for (const f of files) {
        if (f.startsWith('client_secret') && f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(r, f), 'utf-8');
            const parsed = JSON.parse(raw);
            const info = parsed.installed || parsed.web;
            if (info?.client_id && info?.client_secret) {
              await updateSecrets({
                driveClientId: String(info.client_id).trim(),
                driveClientSecret: String(info.client_secret).trim()
              });
              return true;
            }
          } catch {
            // ignore malformed file
          }
        }
      }
    }
  } catch {
    // best-effort discovery
  }
  return false;
}

/** Settings payload for the UI: no secret ever leaves this function. */
export async function publicSettings() {
  await autoDetectAndSeedDriveCredentials();
  const row = await getSettingRow();
  let driveConfigured = false;
  let driveConnected = false;
  if (isMasterKeyConfigured()) {
    try {
      const s = readSecrets(row);
      driveConfigured = Boolean(s.driveClientId && s.driveClientSecret);
      driveConnected = Boolean(s.driveRefreshToken);
    } catch {
      // unreadable secrets are reported as "not configured"
    }
  }
  return {
    masterKeyConfigured: isMasterKeyConfigured(),
    passphraseSet: Boolean(row.passphraseHash),
    schedule: {
      db: {
        enabled: row.dbScheduleEnabled,
        hour: row.dbScheduleHour,
        minute: row.dbScheduleMinute,
        retention: row.dbRetention
      },
      full: {
        enabled: row.fullScheduleEnabled,
        weekday: row.fullScheduleWeekday,
        hour: row.fullScheduleHour,
        minute: row.fullScheduleMinute,
        retention: row.fullRetention
      }
    },
    drive: {
      enabled: row.driveEnabled,
      configured: driveConfigured,
      connected: driveConnected,
      accountEmail: row.driveAccountEmail,
      folderId: row.driveFolderId,
      needsReconnect: row.driveNeedsReconnect
    }
  };
}

export interface SettingsPatch {
  schedule?: {
    db?: { enabled?: boolean; hour?: number; minute?: number; retention?: number };
    full?: { enabled?: boolean; weekday?: number; hour?: number; minute?: number; retention?: number };
  };
  driveEnabled?: boolean;
}

function intIn(v: unknown, min: number, max: number, label: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new BackupConfigError(`${label} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return n;
}

export async function applySettingsPatch(patch: SettingsPatch): Promise<void> {
  await getSettingRow();
  const data: Record<string, unknown> = {};
  const db = patch.schedule?.db;
  if (db) {
    if (db.enabled !== undefined) data.dbScheduleEnabled = Boolean(db.enabled);
    if (db.hour !== undefined) data.dbScheduleHour = intIn(db.hour, 0, 23, 'Giờ chạy');
    if (db.minute !== undefined) data.dbScheduleMinute = intIn(db.minute, 0, 59, 'Phút chạy');
    if (db.retention !== undefined) data.dbRetention = intIn(db.retention, 1, 365, 'Số bản giữ');
  }
  const full = patch.schedule?.full;
  if (full) {
    if (full.enabled !== undefined) data.fullScheduleEnabled = Boolean(full.enabled);
    if (full.weekday !== undefined) data.fullScheduleWeekday = intIn(full.weekday, 0, 6, 'Ngày trong tuần');
    if (full.hour !== undefined) data.fullScheduleHour = intIn(full.hour, 0, 23, 'Giờ chạy');
    if (full.minute !== undefined) data.fullScheduleMinute = intIn(full.minute, 0, 59, 'Phút chạy');
    if (full.retention !== undefined) data.fullRetention = intIn(full.retention, 1, 365, 'Số bản giữ');
  }
  if (patch.driveEnabled !== undefined) data.driveEnabled = Boolean(patch.driveEnabled);
  if (Object.keys(data).length) await prisma.backupSetting.update({ where: { id: 1 }, data });
}

