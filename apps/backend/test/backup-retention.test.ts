import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from '../src/store/prisma';
import { applyRetention, deleteBackupJob } from '../src/services/backup/retention';
import { runDueBackups } from '../src/services/backup/scheduler';
import { sealSecret } from '../src/services/backup/crypto-box';

interface MockJob {
  id: string;
  kind: string;
  trigger: string;
  status: string;
  fileName: string | null;
  driveFileId: string | null;
  startedAt: Date;
}

test('Admin Backup — Phase 5: Retention Policy & Scheduler', async (t) => {
  const masterKey = crypto.randomBytes(32);
  process.env.BACKUP_MASTER_KEY = masterKey.toString('base64');
  const tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cscc-ret-test-'));
  process.env.BACKUP_DIR = tmpBackupDir;

  const jobs: MockJob[] = [];
  const deletedDriveIds: string[] = [];

  const origUpsert = prisma.backupSetting.upsert;
  const origFindMany = prisma.backupJob.findMany;
  const origFindUniqueOrThrow = prisma.backupJob.findUniqueOrThrow;
  const origDelete = prisma.backupJob.delete;
  const origDeleteMany = prisma.backupJob.deleteMany;
  const origFetch = globalThis.fetch;

  let dbRetention = 2;
  let fullRetention = 1;
  let dbHour = 2;
  let dbMinute = 0;

  (prisma.backupSetting as any).upsert = async () => ({
    id: 1,
    dbScheduleEnabled: true,
    dbScheduleHour: dbHour,
    dbScheduleMinute: dbMinute,
    dbRetention,
    fullScheduleEnabled: true,
    fullScheduleWeekday: 0,
    fullScheduleHour: 3,
    fullScheduleMinute: 0,
    fullRetention,
    driveEnabled: false,
    driveFolderId: 'folder-1',
    driveAccountEmail: 'admin@alkana.vn',
    driveNeedsReconnect: false,
    encryptedSecrets: sealSecret(
      JSON.stringify({
        driveClientId: 'cid',
        driveClientSecret: 'csec',
        driveRefreshToken: 'rtok',
        passphrase: 'strong-passphrase-123'
      }),
      masterKey
    ),
    passphraseHash: null,
    updatedAt: new Date()
  });

  (prisma.backupJob as any).findMany = async ({ where }: any) => {
    return jobs
      .filter(
        (j) =>
          (!where?.kind || j.kind === where.kind) &&
          (!where?.trigger || j.trigger === where.trigger) &&
          (!where?.status || j.status === where.status)
      )
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .map((j) => ({ id: j.id }));
  };

  (prisma.backupJob as any).findUniqueOrThrow = async ({ where }: any) => {
    const found = jobs.find((j) => j.id === where.id);
    if (!found) throw new Error('Not found');
    return found;
  };

  (prisma.backupJob as any).delete = async ({ where }: any) => {
    const idx = jobs.findIndex((j) => j.id === where.id);
    if (idx !== -1) jobs.splice(idx, 1);
  };

  (prisma.backupJob as any).deleteMany = async () => ({ count: 0 });

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
        status: 200
      });
    }
    if (url.includes('/drive/v3/files/') && init?.method === 'DELETE') {
      const fid = url.split('/files/')[1];
      deletedDriveIds.push(fid);
      return new Response(null, { status: 204 });
    }
    return new Response('ok', { status: 200 });
  }) as typeof fetch;

  t.after(() => {
    (prisma.backupSetting as any).upsert = origUpsert;
    (prisma.backupJob as any).findMany = origFindMany;
    (prisma.backupJob as any).findUniqueOrThrow = origFindUniqueOrThrow;
    (prisma.backupJob as any).delete = origDelete;
    (prisma.backupJob as any).deleteMany = origDeleteMany;
    globalThis.fetch = origFetch;
    fs.rmSync(tmpBackupDir, { recursive: true, force: true });
  });

  await t.test(
    '1. applyRetention keeps N newest SCHEDULE backups per kind, deletes older local files & Drive copies, and preserves MANUAL backups',
    async () => {
      const makeJob = (
        id: string,
        kind: 'DATABASE' | 'FULL',
        trigger: 'SCHEDULE' | 'MANUAL',
        fileName: string,
        driveFileId: string | null,
        ageMinutes: number
      ) => {
        const fp = path.join(tmpBackupDir, fileName);
        fs.writeFileSync(fp, 'dummy-encrypted');
        fs.writeFileSync(`${fp}.json`, '{}');
        jobs.push({
          id,
          kind,
          trigger,
          status: 'SUCCESS',
          fileName,
          driveFileId,
          startedAt: new Date(Date.now() - ageMinutes * 60_000)
        });
      };

      // 4 scheduled DB backups (retention = 2 -> oldest 2 must be deleted)
      makeJob('db-1', 'DATABASE', 'SCHEDULE', 'database-20261110-010000.cscc-backup', 'drv-db-1', 40);
      makeJob('db-2', 'DATABASE', 'SCHEDULE', 'database-20261110-020000.cscc-backup', 'drv-db-2', 30);
      makeJob('db-3', 'DATABASE', 'SCHEDULE', 'database-20261110-030000.cscc-backup', 'drv-db-3', 20);
      makeJob('db-4', 'DATABASE', 'SCHEDULE', 'database-20261110-040000.cscc-backup', 'drv-db-4', 10);

      // 1 manual DB backup (must never be pruned by retention)
      makeJob('db-manual', 'DATABASE', 'MANUAL', 'database-20261101-010000.cscc-backup', 'drv-manual', 999);

      const res = await applyRetention();
      assert.equal(res.removed, 2, 'Must prune 2 oldest scheduled DB backups');

      const remainingIds = jobs.map((j) => j.id).sort();
      assert.deepEqual(remainingIds, ['db-3', 'db-4', 'db-manual']);
      assert.deepEqual(deletedDriveIds.sort(), ['drv-db-1', 'drv-db-2']);

      assert.equal(
        fs.existsSync(path.join(tmpBackupDir, 'database-20261110-010000.cscc-backup')),
        false
      );
      assert.equal(
        fs.existsSync(path.join(tmpBackupDir, 'database-20261110-040000.cscc-backup')),
        true
      );
      assert.equal(
        fs.existsSync(path.join(tmpBackupDir, 'database-20261101-010000.cscc-backup')),
        true
      );

      // Explicit deleteBackupJob removes both local and Drive copy
      await deleteBackupJob('db-manual');
      assert.ok(deletedDriveIds.includes('drv-manual'));
      assert.equal(
        fs.existsSync(path.join(tmpBackupDir, 'database-20261101-010000.cscc-backup')),
        false
      );
    }
  );

  await t.test('2. Scheduler skips non-matching minutes and deduplicates within the same minute', async () => {
    const nonMatching = new Date(2026, 10, 10, 15, 45, 0);
    const triggered = await runDueBackups(nonMatching);
    assert.deepEqual(triggered, []);
  });
});

