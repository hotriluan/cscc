import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../store/prisma';
import { requireAdminJwt } from '../middleware/auth-rbac.middleware';
import { runBackup } from '../services/backup/backup.service';
import {
  backupFileNamePattern,
  ensureBackupDir,
  formatTimestamp,
  getTempDir,
  removeQuiet,
  resolveBackupFile
} from '../services/backup/backup-paths';
import { hasBackupMagic, MAGIC } from '../services/backup/encrypted-stream';
import { MasterKeyError } from '../services/backup/crypto-box';
import { DriveAuthError } from '../services/backup/gdrive-oauth';
import * as drive from '../services/backup/gdrive.service';
import { isMaintenanceActive } from '../services/backup/maintenance';
import { BackupKind, sha256File } from '../services/backup/manifest';
import { deleteBackupJob } from '../services/backup/retention';
import { startRestore } from '../services/backup/restore.service';
import {
  applySettingsPatch,
  BackupConfigError,
  getPassphrase,
  getSettingRow,
  publicSettings,
  setPassphrase,
  SettingsPatch
} from '../services/backup/settings.service';
import { activeTask, BackupBusyError } from '../services/backup/task-lock';

const KINDS: BackupKind[] = ['DATABASE', 'WEBSITE', 'FULL'];

type JobRow = Awaited<ReturnType<typeof prisma.backupJob.findFirstOrThrow>>;

function serializeJob(j: JobRow) {
  return {
    id: j.id,
    kind: j.kind,
    trigger: j.trigger,
    status: j.status,
    fileName: j.fileName,
    sizeBytes: j.sizeBytes === null ? null : Number(j.sizeBytes),
    sha256: j.sha256,
    driveFileId: j.driveFileId,
    driveStatus: j.driveStatus,
    error: j.error,
    createdBy: j.createdBy,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    manifest: j.manifest
  };
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof BackupBusyError) {
    res.status(409).json({ error: 'BACKUP_BUSY', message: err.message });
  } else if (err instanceof BackupConfigError || err instanceof MasterKeyError) {
    res.status(400).json({ error: 'BACKUP_CONFIG', message: err.message });
  } else if (err instanceof DriveAuthError) {
    res.status(502).json({ error: 'DRIVE_AUTH', message: err.message });
  } else {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'BACKUP_FAILED', message });
  }
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => {
    fn(req, res).catch((err) => handleError(res, err));
  };

function assertIdle(): void {
  const busy = activeTask();
  if (busy) throw new BackupBusyError(busy);
}

function parseScope(value: unknown): BackupKind {
  if (!KINDS.includes(value as BackupKind)) throw new BackupConfigError('Phạm vi phục hồi không hợp lệ.');
  return value as BackupKind;
}

function actor(req: Request): string {
  return req.authUser?.email ?? 'unknown';
}

export function createBackupRouter(): Router {
  const router = Router();
  router.use(requireAdminJwt);

  router.get(
    '/jobs',
    wrap(async (_req, res) => {
      const jobs = await prisma.backupJob.findMany({ orderBy: { startedAt: 'desc' }, take: 200 });
      res.json({
        jobs: jobs.map(serializeJob),
        activeTask: activeTask(),
        maintenance: isMaintenanceActive()
      });
    })
  );

  router.post(
    '/jobs',
    wrap(async (req, res) => {
      const kind = parseScope(req.body?.kind);
      assertIdle();
      await getPassphrase();
      const uploadToDrive = req.body?.uploadToDrive === undefined ? undefined : Boolean(req.body.uploadToDrive);
      runBackup(kind, 'MANUAL', actor(req), { uploadToDrive }).catch((err) =>
        console.error('[backup] manual backup failed:', err instanceof Error ? err.message : err)
      );
      res.status(202).json({ accepted: true });
    })
  );

  router.get(
    '/jobs/:id/download',
    wrap(async (req, res) => {
      const job = await prisma.backupJob.findUnique({ where: { id: String(req.params.id) } });
      if (!job?.fileName || job.status !== 'SUCCESS') {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy bản sao lưu.' });
        return;
      }
      const file = resolveBackupFile(job.fileName);
      if (!fs.existsSync(file)) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'File sao lưu không còn trên máy chủ.' });
        return;
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', String(fs.statSync(file).size));
      res.setHeader('Content-Disposition', `attachment; filename="${job.fileName}"`);
      fs.createReadStream(file).pipe(res);
    })
  );

  router.delete(
    '/jobs/:id',
    wrap(async (req, res) => {
      assertIdle();
      const job = await prisma.backupJob.findUnique({ where: { id: String(req.params.id) } });
      if (!job) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy bản ghi.' });
        return;
      }
      if (job.status === 'RUNNING') throw new BackupBusyError('đang chạy');
      await deleteBackupJob(job.id);
      res.json({ deleted: true });
    })
  );

  router.post(
    '/jobs/:id/drive-retry',
    wrap(async (req, res) => {
      assertIdle();
      const job = await prisma.backupJob.findUnique({ where: { id: String(req.params.id) } });
      if (!job || job.status !== 'SUCCESS' || !job.fileName) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy bản sao lưu.' });
        return;
      }
      await drive.uploadJobToDrive(job.id);
      const updated = await prisma.backupJob.findUniqueOrThrow({ where: { id: job.id } });
      res.json({ job: serializeJob(updated) });
    })
  );

  router.post(
    '/upload',
    wrap(async (req, res) => {
      assertIdle();
      ensureBackupDir();
      const original = String(req.headers['x-file-name'] ?? '');
      if (!backupFileNamePattern().test(original)) {
        res.status(400).json({
          error: 'BAD_FILE_NAME',
          message: 'Tên file phải có dạng <database|website|full>-yyyymmdd-HHMMSS.cscc-backup.'
        });
        return;
      }
      const maxBytes = (Number(process.env.BACKUP_MAX_UPLOAD_MB) || 2048) * 1024 * 1024;
      const tmp = path.join(getTempDir(), `upload-${Date.now()}.part`);
      let received = 0;
      const out = fs.createWriteStream(tmp, { mode: 0o600 });
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            reject(new BackupConfigError('File tải lên vượt quá dung lượng cho phép.'));
            req.destroy();
          }
        });
        req.on('error', reject);
        req.on('aborted', () => reject(new Error('Tải lên bị huỷ.')));
        out.on('error', reject);
        out.on('finish', resolve);
        req.pipe(out);
      }).catch((err) => {
        out.destroy();
        removeQuiet(tmp);
        throw err;
      });

      const head = Buffer.alloc(MAGIC.length);
      const fd = fs.openSync(tmp, 'r');
      fs.readSync(fd, head, 0, head.length, 0);
      fs.closeSync(fd);
      if (!hasBackupMagic(head)) {
        removeQuiet(tmp);
        res.status(400).json({ error: 'NOT_A_BACKUP', message: 'File không phải bản sao lưu CSCC hợp lệ.' });
        return;
      }

      const kind = original.split('-')[0].toUpperCase() as BackupKind;
      let finalName = original;
      if (fs.existsSync(path.join(ensureBackupDir(), finalName))) {
        finalName = `${kind.toLowerCase()}-${formatTimestamp()}.cscc-backup`;
      }
      const finalPath = resolveBackupFile(finalName);
      fs.renameSync(tmp, finalPath);
      const sha256 = await sha256File(finalPath);
      const sizeBytes = fs.statSync(finalPath).size;
      fs.writeFileSync(
        `${finalPath}.json`,
        JSON.stringify({ fileName: finalName, kind, uploadedBy: actor(req), sizeBytes, sha256 }, null, 2)
      );
      const job = await prisma.backupJob.create({
        data: {
          kind,
          trigger: 'UPLOAD',
          status: 'SUCCESS',
          fileName: finalName,
          sizeBytes: BigInt(sizeBytes),
          sha256,
          createdBy: actor(req),
          finishedAt: new Date()
        }
      });
      res.status(201).json({ job: serializeJob(job) });
    })
  );

  router.post(
    '/jobs/:id/restore',
    wrap(async (req, res) => {
      const handle = await startRestore({
        source: { type: 'job', id: String(req.params.id) },
        scope: parseScope(req.body?.scope),
        user: actor(req),
        confirm: String(req.body?.confirm ?? ''),
        passphrase: req.body?.passphrase ? String(req.body.passphrase) : undefined
      });
      handle.done.catch((err) => console.error('[backup] restore failed:', err instanceof Error ? err.message : err));
      res.status(202).json({ accepted: true, jobId: handle.job.id });
    })
  );

  router.post(
    '/drive/restore',
    wrap(async (req, res) => {
      const handle = await startRestore({
        source: { type: 'drive', fileId: String(req.body?.fileId ?? '') },
        scope: parseScope(req.body?.scope),
        user: actor(req),
        confirm: String(req.body?.confirm ?? ''),
        passphrase: req.body?.passphrase ? String(req.body.passphrase) : undefined
      });
      handle.done.catch((err) => console.error('[backup] restore failed:', err instanceof Error ? err.message : err));
      res.status(202).json({ accepted: true, jobId: handle.job.id });
    })
  );

  router.get(
    '/settings',
    wrap(async (_req, res) => {
      res.json(await publicSettings());
    })
  );

  router.put(
    '/settings',
    wrap(async (req, res) => {
      await applySettingsPatch((req.body ?? {}) as SettingsPatch);
      res.json(await publicSettings());
    })
  );

  router.put(
    '/settings/passphrase',
    wrap(async (req, res) => {
      if (req.body?.confirmSaved !== true) {
        throw new BackupConfigError('Bạn cần xác nhận đã lưu mật khẩu ở nơi an toàn bên ngoài máy chủ.');
      }
      await setPassphrase(String(req.body?.passphrase ?? ''));
      res.json(await publicSettings());
    })
  );

  router.get(
    '/drive/status',
    wrap(async (_req, res) => {
      const s = await publicSettings();
      res.json({ drive: s.drive, connect: drive.getConnectState() });
    })
  );

  router.put(
    '/drive/credentials',
    wrap(async (req, res) => {
      await drive.saveClientCredentials(String(req.body?.clientId ?? ''), String(req.body?.clientSecret ?? ''));
      res.json({ drive: (await publicSettings()).drive });
    })
  );

  router.post(
    '/drive/connect',
    wrap(async (_req, res) => {
      res.json({ connect: await drive.startConnect() });
    })
  );

  router.post(
    '/drive/check',
    wrap(async (_req, res) => {
      res.json(await drive.checkConnection());
    })
  );

  router.delete(
    '/drive',
    wrap(async (_req, res) => {
      await drive.disconnectDrive();
      res.json({ drive: (await publicSettings()).drive });
    })
  );

  router.get(
    '/drive/files',
    wrap(async (_req, res) => {
      await getSettingRow();
      res.json({ files: await drive.listFiles() });
    })
  );

  return router;
}
