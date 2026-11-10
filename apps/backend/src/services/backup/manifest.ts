import crypto from 'crypto';
import fs from 'fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../store/prisma';

export type BackupKind = 'DATABASE' | 'WEBSITE' | 'FULL';
export type BackupTrigger = 'MANUAL' | 'SCHEDULE' | 'PRE_RESTORE' | 'UPLOAD';

export const MANIFEST_FORMAT = 1;

/** Tables that describe the backup system itself; never part of a dump so a restore keeps job history/settings. */
export const BACKUP_SYSTEM_MODELS = ['BackupJob', 'BackupSetting'];

export interface BackupManifest {
  format: number;
  kind: BackupKind;
  createdAt: string;
  appVersion: string;
  hostName: string;
  /** SHA-256 of each inner payload (file name -> hex). */
  payloads: Record<string, string>;
  database?: {
    tables: number;
    records: number;
    counts: Record<string, number>;
    approximate: boolean;
  };
  website?: { systemConfigFiles: string[] };
}

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (c) => hash.update(c))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function dataModelNames(): string[] {
  return Prisma.dmmf.datamodel.models
    .map((m) => m.name)
    .filter((n) => !BACKUP_SYSTEM_MODELS.includes(n));
}

/** Row count per application table (excludes backup bookkeeping tables). */
export async function countDatabaseRecords(
  client: PrismaClient = prisma
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const name of dataModelNames()) {
    const delegate = (client as unknown as Record<string, { count: () => Promise<number> }>)[
      name.charAt(0).toLowerCase() + name.slice(1)
    ];
    counts[name] = await delegate.count();
  }
  return counts;
}

export function summarizeCounts(
  counts: Record<string, number>,
  approximate: boolean
): NonNullable<BackupManifest['database']> {
  return {
    tables: Object.keys(counts).length,
    records: Object.values(counts).reduce((a, b) => a + b, 0),
    counts,
    approximate
  };
}

export function countsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  }
  return true;
}

export function parseManifest(raw: string): BackupManifest {
  let parsed: BackupManifest;
  try {
    parsed = JSON.parse(raw) as BackupManifest;
  } catch {
    throw new Error('manifest.json trong bản sao lưu bị hỏng.');
  }
  if (parsed.format !== MANIFEST_FORMAT) {
    throw new Error(`Định dạng bản sao lưu (v${parsed.format}) không tương thích với phiên bản hiện tại.`);
  }
  if (!['DATABASE', 'WEBSITE', 'FULL'].includes(parsed.kind) || !parsed.payloads) {
    throw new Error('manifest.json trong bản sao lưu không hợp lệ.');
  }
  return parsed;
}

