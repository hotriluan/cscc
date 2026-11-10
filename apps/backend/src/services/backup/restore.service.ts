import fs from 'fs';
import path from 'path';
import { prisma } from '../../store/prisma';
import { WEBSITE_ARCHIVE_NAME, extractWebsiteArchive, unpackEncrypted } from './archive';
import { defaultDatabaseUrl, runBackup, withDbClient } from './backup.service';
import { BackupDecryptError } from './encrypted-stream';
import {
  ensureBackupDir,
  getAppRoot,
  getTempDir,
  makeWorkDir,
  removeQuiet,
  resolveBackupFile
} from './backup-paths';
import { consumeStaleMaintenanceFlag, disableMaintenance, enableMaintenance } from './maintenance';
import {
  BackupKind,
  BackupManifest,
  countDatabaseRecords,
  countsEqual,
  parseManifest,
  sha256File
} from './manifest';
import { parseDatabaseUrl, pgRestore } from './pg-tools';
import { BackupConfigError, getPassphrase } from './settings.service';
import { acquireTaskLock } from './task-lock';

export type RestoreSource =
  | { type: 'job'; id: string }
  | { type: 'drive'; fileId: string }
  | { type: 'file'; path: string };

export interface RestoreRequest {
  source: RestoreSource;
  scope: BackupKind;
  user: string;
  /** Must equal the backup file name (typed by the admin in the confirmation dialog). */
  confirm: string;
  passphrase?: string;
  /** Test overrides. */
  databaseUrl?: string;
  appRoot?: string;
}

/** Replaceable in tests to simulate a failing restore. */
export const restoreDeps = { pgRestore };

const RESTART_HINT =
  'Mã nguồn/.env đã được thay. Hãy chạy ./deploy.sh hoặc "sudo systemctl restart alkana_cscc" để áp dụng.';

interface ResolvedSource {
  name: string;
  localPath: string;
  cleanup?: () => void;
  expectSha256?: string;
}

async function resolveSource(source: RestoreSource): Promise<{ name: string; load: () => Promise<ResolvedSource> }> {
  if (source.type === 'job') {
    const job = await prisma.backupJob.findUnique({ where: { id: source.id } });
    if (!job || !job.fileName || job.status !== 'SUCCESS') {
      throw new BackupConfigError('Không tìm thấy bản sao lưu hợp lệ để phục hồi.');
    }
    const file = resolveBackupFile(job.fileName);
    if (!fs.existsSync(file)) throw new BackupConfigError('File sao lưu không còn trên máy chủ.');
    return {
      name: job.fileName,
      load: async () => ({
        name: job.fileName as string,
        localPath: file,
        expectSha256: job.sha256 ?? undefined
      })
    };
  }
  if (source.type === 'drive') {
    const drive = await import('./gdrive.service');
    const meta = await drive.getFileMeta(source.fileId);
    return {
      name: meta.name,
      load: async () => {
        const tmp = path.join(getTempDir(), `drive-${Date.now()}.cscc-backup`);
        await drive.downloadToFile(source.fileId, tmp);
        return { name: meta.name, localPath: tmp, cleanup: () => removeQuiet(tmp) };
      }
    };
  }
  if (!fs.existsSync(source.path)) throw new BackupConfigError('File sao lưu không tồn tại.');
  return {
    name: path.basename(source.path),
    load: async () => ({ name: path.basename(source.path), localPath: source.path })
  };
}

function assertScope(scope: BackupKind, manifest: BackupManifest): void {
  const hasDb = Boolean(manifest.payloads['database.dump']);
  const hasSite = Boolean(manifest.payloads[WEBSITE_ARCHIVE_NAME]);
  if ((scope === 'DATABASE' || scope === 'FULL') && !hasDb) {
    throw new BackupConfigError('Bản sao lưu này không chứa Database.');
  }
  if ((scope === 'WEBSITE' || scope === 'FULL') && !hasSite) {
    throw new BackupConfigError('Bản sao lưu này không chứa Website.');
  }
}

async function verifyPayloads(dir: string, manifest: BackupManifest): Promise<void> {
  for (const [name, expected] of Object.entries(manifest.payloads)) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file) || (await sha256File(file)) !== expected) {
      throw new BackupDecryptError(`Checksum nội dung "${name}" không khớp: bản sao lưu bị hỏng.`);
    }
  }
}

async function applyWebsite(archive: string, root: string): Promise<void> {
  const staging = makeWorkDir('site');
  try {
    await extractWebsiteArchive(archive, staging);
    if (!fs.existsSync(path.join(staging, 'package.json'))) {
      throw new Error('Gói Website không hợp lệ (thiếu package.json).');
    }
    fs.cpSync(staging, root, { recursive: true, force: true });
  } finally {
    removeQuiet(staging);
  }
}

async function applyDatabase(dump: string, databaseUrl: string): Promise<void> {
  if (databaseUrl === defaultDatabaseUrl()) await prisma.$disconnect();
  await restoreDeps.pgRestore(parseDatabaseUrl(databaseUrl), dump);
}

export interface RestoreHandle {
  job: Awaited<ReturnType<typeof prisma.backupJob.create>>;
  done: Promise<Awaited<ReturnType<typeof prisma.backupJob.update>>>;
}

/**
 * Validates the request and grabs the global lock synchronously (so the API can answer 409/400 right
 * away), then runs the restore in the background. `handle.done` settles when it finishes.
 */
export async function startRestore(req: RestoreRequest): Promise<RestoreHandle> {
  ensureBackupDir();
  const resolved = await resolveSource(req.source);
  if (req.confirm !== resolved.name) {
    throw new BackupConfigError('Tên xác nhận không khớp với tên bản sao lưu.');
  }
  const release = acquireTaskLock(`restore ${req.scope}`);
  let job;
  try {
    job = await prisma.backupJob.create({
      data: {
        kind: req.scope,
        trigger: 'RESTORE',
        status: 'RUNNING',
        createdBy: req.user,
        driveStatus: 'NONE',
        manifest: { restoredFrom: resolved.name, steps: ['Đang kiểm tra bản sao lưu'] }
      }
    });
  } catch (err) {
    release();
    throw err;
  }
  const done = execute(req, resolved, job.id).finally(release);
  done.catch(() => undefined);
  return { job, done };
}

async function execute(req: RestoreRequest, resolved: { name: string; load: () => Promise<ResolvedSource> }, jobId: string) {
  const steps: string[] = [];
  const warnings: string[] = [];
  const note = async (s: string) => {
    steps.push(s);
    await prisma.backupJob
      .update({ where: { id: jobId }, data: { manifest: { restoredFrom: resolved.name, scope: req.scope, steps, warnings } } })
      .catch(() => undefined);
  };

  const databaseUrl = req.databaseUrl ?? defaultDatabaseUrl();
  const root = req.appRoot ?? getAppRoot();
  const touchesDb = req.scope === 'DATABASE' || req.scope === 'FULL';
  const touchesSite = req.scope === 'WEBSITE' || req.scope === 'FULL';

  let source: ResolvedSource | undefined;
  let workDir: string | undefined;
  let preWorkDir: string | undefined;
  let maintenance = false;
  let preFile: string | undefined;
  let dbApplied = false;
  let siteApplied = false;

  try {
    const passphrase = req.passphrase || (await getPassphrase());
    source = await resolved.load();
    if (source.expectSha256 && (await sha256File(source.localPath)) !== source.expectSha256) {
      throw new BackupDecryptError('Checksum file sao lưu không khớp với bản ghi: file bị hỏng hoặc bị sửa.');
    }

    await note('Đang giải mã và xác minh');
    workDir = makeWorkDir('restore');
    try {
      await unpackEncrypted(source.localPath, workDir, passphrase);
    } catch (err) {
      if (err instanceof BackupDecryptError) throw err;
      throw new BackupDecryptError();
    }
    const manifestPath = path.join(workDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new BackupDecryptError('Thiếu manifest.json trong bản sao lưu.');
    const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
    assertScope(req.scope, manifest);
    await verifyPayloads(workDir, manifest);

    await note('Đang tạo bản sao lưu an toàn trước khi phục hồi');
    const pre = await runBackup(req.scope, 'PRE_RESTORE', req.user, {
      alreadyLocked: true,
      uploadToDrive: false,
      databaseUrl,
      appRoot: root
    });
    preFile = resolveBackupFile(pre.fileName as string);

    const rollback = async () => {
      preWorkDir = makeWorkDir('prerestore');
      await unpackEncrypted(preFile as string, preWorkDir, await getPassphrase());
      if (dbApplied) await applyDatabase(path.join(preWorkDir, 'database.dump'), databaseUrl);
      if (siteApplied) await applyWebsite(path.join(preWorkDir, WEBSITE_ARCHIVE_NAME), root);
    };

    enableMaintenance(`restore ${req.scope}`);
    maintenance = true;

    try {
      if (touchesDb) {
        await note('Đang phục hồi Database');
        dbApplied = true;
        await applyDatabase(path.join(workDir, 'database.dump'), databaseUrl);
        const expected = manifest.database?.counts;
        if (expected) {
          const actual = await withDbClient(databaseUrl, (c) => countDatabaseRecords(c));
          if (!countsEqual(expected, actual)) {
            if (manifest.database?.approximate) {
              warnings.push('Số bản ghi lệch nhẹ so với manifest (bản sao lưu được tạo khi hệ thống đang ghi dữ liệu).');
            } else {
              throw new Error('Số bản ghi sau phục hồi không khớp với manifest.');
            }
          }
        }
      }
      if (touchesSite) {
        await note('Đang phục hồi Website');
        siteApplied = true;
        await applyWebsite(path.join(workDir, WEBSITE_ARCHIVE_NAME), root);
      }
    } catch (err) {
      await note('Phục hồi lỗi, đang quay lại dữ liệu trước đó');
      try {
        await rollback();
        warnings.push('Đã tự quay lại trạng thái trước khi phục hồi.');
      } catch (rbErr) {
        warnings.push(
          `Quay lại tự động thất bại (${rbErr instanceof Error ? rbErr.message : rbErr}). ` +
            `Bản an toàn: ${pre.fileName}.`
        );
      }
      throw err;
    }

    await note('Hoàn tất');
    return prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        manifest: {
          restoredFrom: resolved.name,
          scope: req.scope,
          safetyBackup: pre.fileName,
          steps,
          warnings,
          ...(touchesSite ? { instructions: RESTART_HINT } : {})
        }
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: message.slice(0, 2000),
        manifest: { restoredFrom: resolved.name, scope: req.scope, steps, warnings }
      }
    });
    throw err;
  } finally {
    if (maintenance) disableMaintenance();
    if (workDir) removeQuiet(workDir);
    if (preWorkDir) removeQuiet(preWorkDir);
    source?.cleanup?.();
  }
}

/**
 * Called on startup: a leftover maintenance flag means the process died mid-restore. Marks any
 * unfinished job FAILED so the UI can show it.
 */
export async function recoverInterruptedTasks(): Promise<number> {
  const stale = consumeStaleMaintenanceFlag();
  const result = await prisma.backupJob.updateMany({
    where: { status: 'RUNNING' },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      error: stale
        ? 'Máy chủ bị khởi động lại giữa lúc phục hồi. Hãy kiểm tra dữ liệu; bản sao lưu an toàn trước phục hồi vẫn còn trong danh sách.'
        : 'Tiến trình sao lưu bị gián đoạn do máy chủ khởi động lại.'
    }
  });
  return result.count;
}
