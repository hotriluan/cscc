import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable, Writable } from 'stream';
import { createApp } from '../src/app';
import { prisma } from '../src/store/prisma';
import { signJwtToken } from '../src/services/auth.service';
import {
  BackupDecryptError,
  createDecryptStream,
  createEncryptStream,
  hasBackupMagic
} from '../src/services/backup/encrypted-stream';
import { packEncrypted, unpackEncrypted } from '../src/services/backup/archive';
import { sealSecret } from '../src/services/backup/crypto-box';
import { runBackup } from '../src/services/backup/backup.service';
import { restoreDeps, startRestore } from '../src/services/backup/restore.service';
import {
  disableMaintenance,
  enableMaintenance,
  isMaintenanceActive
} from '../src/services/backup/maintenance';
import { BackupBusyError, withTaskLock } from '../src/services/backup/task-lock';

function dispatch(
  app: ReturnType<typeof createApp>,
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: unknown
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    let resStatus = 200;
    const req: any = {
      method,
      url: urlPath,
      path: urlPath,
      headers: { ...headers },
      body: body ?? {},
      query: {},
      params: {}
    };
    const res: any = {
      status(code: number) {
        resStatus = code;
        return this;
      },
      json(data: any) {
        resolve({ status: resStatus, body: data });
        return this;
      },
      send(data: any) {
        resolve({ status: resStatus, body: data });
        return this;
      },
      setHeader() {
        return this;
      },
      getHeader() {
        return undefined;
      }
    };
    app.handle(req, res);
  });
}

test('Admin Backup — Phase 2 & 3: Encrypted Stream, Backup/Restore Engine, Safety Rollback & Maintenance Mode', async (t) => {
  const masterKey = crypto.randomBytes(32);
  process.env.BACKUP_MASTER_KEY = masterKey.toString('base64');
  const passphrase = 'super-secret-backup-passphrase-2026';

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cscc-bk-engine-'));
  const backupDir = path.join(tmpRoot, 'backups');
  const appRoot = path.join(tmpRoot, 'website-root');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(path.join(appRoot, 'apps', 'backend'), { recursive: true });
  fs.writeFileSync(
    path.join(appRoot, 'package.json'),
    JSON.stringify({ name: 'cscc-monorepo', version: '1.0.0' })
  );
  fs.writeFileSync(
    path.join(appRoot, 'apps', 'backend', 'package.json'),
    JSON.stringify({ name: '@cscc/backend', version: '1.0.0' })
  );
  fs.writeFileSync(path.join(appRoot, 'apps', 'backend', '.env'), 'SECRET_ENV=original_value\n');
  fs.writeFileSync(path.join(appRoot, 'README.md'), 'Original Website Content v1');

  process.env.BACKUP_DIR = backupDir;
  process.env.APP_ROOT = appRoot;

  // In-memory mock for BackupJob and BackupSetting tables so tests work with or without live Postgres
  const jobStore = new Map<string, any>();
  const origSettingUpsert = prisma.backupSetting.upsert;
  const origJobCreate = prisma.backupJob.create;
  const origJobUpdate = prisma.backupJob.update;
  const origJobFindUnique = prisma.backupJob.findUnique;
  const origJobFindUniqueOrThrow = prisma.backupJob.findUniqueOrThrow;
  const origJobFindMany = prisma.backupJob.findMany;
  const origJobDeleteMany = prisma.backupJob.deleteMany;

  (prisma.backupSetting as any).upsert = async () => ({
    id: 1,
    dbScheduleEnabled: true,
    dbScheduleHour: 2,
    dbScheduleMinute: 0,
    dbRetention: 14,
    fullScheduleEnabled: true,
    fullScheduleWeekday: 0,
    fullScheduleHour: 3,
    fullScheduleMinute: 0,
    fullRetention: 4,
    driveEnabled: false,
    driveFolderId: null,
    driveAccountEmail: null,
    driveNeedsReconnect: false,
    encryptedSecrets: sealSecret(JSON.stringify({ passphrase }), masterKey),
    passphraseHash: 'scrypt:dummy:dummy',
    updatedAt: new Date()
  });

  (prisma.backupJob as any).create = async ({ data }: any) => {
    const id = `job-${jobStore.size + 1}-${Date.now()}`;
    const row = {
      id,
      kind: data.kind,
      trigger: data.trigger,
      status: data.status,
      fileName: data.fileName ?? null,
      sizeBytes: data.sizeBytes ?? null,
      sha256: data.sha256 ?? null,
      driveFileId: data.driveFileId ?? null,
      driveStatus: data.driveStatus ?? 'NONE',
      error: data.error ?? null,
      createdBy: data.createdBy,
      startedAt: new Date(),
      finishedAt: data.finishedAt ?? null,
      manifest: data.manifest ?? null
    };
    jobStore.set(id, row);
    return row;
  };

  (prisma.backupJob as any).update = async ({ where, data }: any) => {
    const existing = jobStore.get(where.id);
    const updated = { ...existing, ...data };
    jobStore.set(where.id, updated);
    return updated;
  };

  (prisma.backupJob as any).findUnique = async ({ where }: any) => {
    return jobStore.get(where.id) ?? null;
  };

  (prisma.backupJob as any).findUniqueOrThrow = async ({ where }: any) => {
    const row = jobStore.get(where.id);
    if (!row) throw new Error('Job not found');
    return row;
  };

  (prisma.backupJob as any).findMany = async () => Array.from(jobStore.values());
  (prisma.backupJob as any).deleteMany = async () => ({ count: 0 });

  t.after(() => {
    (prisma.backupSetting as any).upsert = origSettingUpsert;
    (prisma.backupJob as any).create = origJobCreate;
    (prisma.backupJob as any).update = origJobUpdate;
    (prisma.backupJob as any).findUnique = origJobFindUnique;
    (prisma.backupJob as any).findUniqueOrThrow = origJobFindUniqueOrThrow;
    (prisma.backupJob as any).findMany = origJobFindMany;
    (prisma.backupJob as any).deleteMany = origJobDeleteMany;
    disableMaintenance();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  await t.test(
    '1. Streaming AES-256-GCM container (CSCCBK1) encrypts, verifies magic header, and rejects wrong passphrase or tampered bytes',
    async () => {
      const sample = Buffer.from('Sensitive database dump and .env secrets 1234567890');
      const chunks: Buffer[] = [];
      await pipeline(
        Readable.from([sample]),
        createEncryptStream(passphrase),
        new Writable({
          write(c, _e, cb) {
            chunks.push(c);
            cb();
          }
        })
      );
      const encrypted = Buffer.concat(chunks);
      assert.equal(hasBackupMagic(encrypted), true);
      assert.equal(
        encrypted.includes(Buffer.from('Sensitive database')),
        false,
        'Ciphertext on disk must not contain plaintext'
      );

      // Decrypt with correct passphrase
      const outChunks: Buffer[] = [];
      await pipeline(
        Readable.from([encrypted]),
        createDecryptStream(passphrase),
        new Writable({
          write(c, _e, cb) {
            outChunks.push(c);
            cb();
          }
        })
      );
      assert.deepEqual(Buffer.concat(outChunks), sample);

      // Decrypt with wrong passphrase must fail
      await assert.rejects(
        () =>
          pipeline(
            Readable.from([encrypted]),
            createDecryptStream('wrong-passphrase-12345'),
            new Writable({
              write(_c, _e, cb) {
                cb();
              }
            })
          ),
        BackupDecryptError
      );
    }
  );

  await t.test('2. Task lock rejects concurrent backup/restore with BackupBusyError (409)', async () => {
    await withTaskLock('backup DATABASE', async () => {
      await assert.rejects(
        () => withTaskLock('restore FULL', async () => {}),
        (err: unknown) => err instanceof BackupBusyError
      );
    });
  });

  await t.test(
    '3. Full Website backup -> mutate files -> restore Website brings back original files and .env, and creates PRE_RESTORE safety backup',
    async () => {
      // 3.1 Run Website backup
      const bkJob = await runBackup('WEBSITE', 'MANUAL', 'admin@alkana.vn', {
        appRoot,
        uploadToDrive: false
      });
      assert.equal(bkJob.status, 'SUCCESS');
      assert.ok(bkJob.fileName);
      const bkFilePath = path.join(backupDir, bkJob.fileName);
      assert.equal(fs.existsSync(bkFilePath), true);

      // 3.2 Mutate Website files
      fs.writeFileSync(path.join(appRoot, 'README.md'), 'Modified Website Content v2');
      fs.writeFileSync(path.join(appRoot, 'apps', 'backend', '.env'), 'SECRET_ENV=mutated\n');

      // 3.3 Restore with wrong confirmation name must be rejected
      await assert.rejects(
        () =>
          startRestore({
            source: { type: 'job', id: bkJob.id },
            scope: 'WEBSITE',
            user: 'admin@alkana.vn',
            confirm: 'wrong-name.cscc-backup',
            appRoot
          }),
        /Tên xác nhận không khớp/
      );

      // 3.4 Restore with wrong passphrase must fail without losing current mutated state
      const badHandle = await startRestore({
        source: { type: 'job', id: bkJob.id },
        scope: 'WEBSITE',
        user: 'admin@alkana.vn',
        confirm: bkJob.fileName,
        passphrase: 'completely-wrong-passphrase',
        appRoot
      });
      await assert.rejects(() => badHandle.done);
      assert.equal(
        fs.readFileSync(path.join(appRoot, 'README.md'), 'utf8'),
        'Modified Website Content v2',
        'Failed decrypt must leave current files untouched'
      );

      // 3.5 Restore with valid passphrase restores original Website files & returns restart instructions
      const handle = await startRestore({
        source: { type: 'job', id: bkJob.id },
        scope: 'WEBSITE',
        user: 'admin@alkana.vn',
        confirm: bkJob.fileName,
        appRoot
      });
      const doneJob = await handle.done;
      assert.equal(doneJob.status, 'SUCCESS');
      assert.ok((doneJob.manifest as any)?.safetyBackup, 'Must record PRE_RESTORE safety backup');
      assert.ok(
        String((doneJob.manifest as any)?.instructions).includes('deploy.sh'),
        'Website restore must include service restart instructions'
      );
      assert.equal(
        fs.readFileSync(path.join(appRoot, 'README.md'), 'utf8'),
        'Original Website Content v1'
      );
      assert.equal(
        fs.readFileSync(path.join(appRoot, 'apps', 'backend', '.env'), 'utf8'),
        'SECRET_ENV=original_value\n'
      );
    }
  );

  await t.test(
    '4. Maintenance mode middleware returns 503 for regular routes while allowing /api/admin/backup/* routes',
    async () => {
      const app = createApp();
      enableMaintenance('restore DATABASE');
      assert.equal(isMaintenanceActive(), true);

      const healthRes = await dispatch(app, 'GET', '/api/health');
      assert.equal(healthRes.status, 503);
      assert.equal(healthRes.body?.error, 'MAINTENANCE');

      const adminToken = signJwtToken({
        id: 'admin-1',
        email: 'admin@alkana.vn',
        fullName: 'Admin',
        role: 'ADMIN',
        salesmanName: null,
        createdAt: new Date().toISOString()
      });
      const backupJobsRes = await dispatch(app, 'GET', '/api/admin/backup/jobs', {
        authorization: `Bearer ${adminToken}`
      });
      assert.equal(backupJobsRes.status, 200);
      assert.equal(backupJobsRes.body?.maintenance, true);

      disableMaintenance();
      assert.equal(isMaintenanceActive(), false);
    }
  );
});

