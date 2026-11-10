import fs from 'fs';
import { prisma } from '../../store/prisma';
import { resolveBackupFile } from './backup-paths';
import { deleteFile } from './gdrive.service';
import { BackupConfigError, getSettingRow } from './settings.service';

const PRE_RESTORE_KEEP = 5;
const FAILED_JOB_KEEP_DAYS = 30;

/**
 * Removes a backup: the Drive copy first (a failed Drive delete keeps the job so it can be retried),
 * then the local file + sidecar, then the row. When Drive is not connected any more the remote
 * copy cannot be reached and is left in place.
 */
export async function deleteBackupJob(id: string): Promise<void> {
  const job = await prisma.backupJob.findUniqueOrThrow({ where: { id } });
  if (job.driveFileId) {
    try {
      await deleteFile(job.driveFileId);
    } catch (err) {
      if (!(err instanceof BackupConfigError)) throw err;
    }
  }
  if (job.fileName) {
    const file = resolveBackupFile(job.fileName);
    fs.rmSync(file, { force: true });
    fs.rmSync(`${file}.json`, { force: true });
  }
  await prisma.backupJob.delete({ where: { id } });
}

async function pruneKind(kind: string, trigger: string, keep: number): Promise<number> {
  const jobs = await prisma.backupJob.findMany({
    where: { kind, trigger, status: 'SUCCESS' },
    orderBy: { startedAt: 'desc' },
    select: { id: true }
  });
  let removed = 0;
  for (const j of jobs.slice(keep)) {
    try {
      await deleteBackupJob(j.id);
      removed += 1;
    } catch (err) {
      console.error(`[backup] retention could not remove ${j.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return removed;
}

/** Keeps the newest N scheduled backups per kind (locally and on Drive); manual/uploaded files are never auto-deleted. */
export async function applyRetention(): Promise<{ removed: number }> {
  const s = await getSettingRow();
  let removed = 0;
  removed += await pruneKind('DATABASE', 'SCHEDULE', s.dbRetention);
  removed += await pruneKind('FULL', 'SCHEDULE', s.fullRetention);
  for (const kind of ['DATABASE', 'WEBSITE', 'FULL']) {
    removed += await pruneKind(kind, 'PRE_RESTORE', PRE_RESTORE_KEEP);
  }
  await prisma.backupJob.deleteMany({
    where: {
      status: 'FAILED',
      startedAt: { lt: new Date(Date.now() - FAILED_JOB_KEEP_DAYS * 86400_000) }
    }
  });
  return { removed };
}

