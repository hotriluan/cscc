import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../../store/prisma';
import {
  createWebsiteArchive,
  estimateTreeSize,
  packEncrypted,
  relativeExclude,
  WEBSITE_ARCHIVE_NAME
} from './archive';
import {
  ensureBackupDir,
  formatTimestamp,
  freeBytes,
  getAppRoot,
  hostName,
  makeWorkDir,
  removeQuiet
} from './backup-paths';
import {
  BACKUP_SYSTEM_MODELS,
  BackupKind,
  BackupManifest,
  BackupTrigger,
  countDatabaseRecords,
  countsEqual,
  MANIFEST_FORMAT,
  sha256File,
  summarizeCounts
} from './manifest';
import { parseDatabaseUrl, pgDump } from './pg-tools';
import { getPassphrase, getSettingRow } from './settings.service';
import { withTaskLock } from './task-lock';

export interface RunBackupOptions {
  /** Upload a copy to Google Drive after the local file is written (default: the saved Drive switch). */
  uploadToDrive?: boolean;
  /** Overrides (tests): passphrase, database and project root. */
  passphrase?: string;
  databaseUrl?: string;
  appRoot?: string;
  /** Skip lock acquisition when the caller already holds it (restore creating its PRE_RESTORE backup). */
  alreadyLocked?: boolean;
}

export function defaultDatabaseUrl(): string {
  return process.env.DATABASE_URL as string;
}

export function appVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(getAppRoot(), 'apps', 'backend', 'package.json'), 'utf8')
    ) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Runs `fn` with a Prisma client pointed at `url` (the shared client when `url` is the app database). */
export async function withDbClient<T>(
  url: string | undefined,
  fn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  if (!url || url === defaultDatabaseUrl()) return fn(prisma);
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await fn(client);
  } finally {
    await client.$disconnect();
  }
}

async function databaseSizeBytes(client: PrismaClient): Promise<number> {
  const rows = await client.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
  return Number(rows[0]?.size ?? 0);
}

/** Best-effort copy of deployment config so a lost server can be rebuilt (informational only). */
function collectSystemConfig(destDir: string): string[] {
  if (process.platform === 'win32') return [];
  const sources = ['/etc/systemd/system/alkana_cscc.service'];
  try {
    for (const f of fs.readdirSync('/etc/nginx/sites-enabled')) {
      sources.push(path.join('/etc/nginx/sites-enabled', f));
    }
  } catch {
    // nginx not readable
  }
  const copied: string[] = [];
  for (const src of sources) {
    try {
      fs.mkdirSync(destDir, { recursive: true });
      const target = path.join(destDir, src.replace(/^\//, '').replace(/\//g, '__'));
      fs.copyFileSync(src, target);
      copied.push(src);
    } catch {
      // unreadable: skipped on purpose
    }
  }
  return copied;
}

export async function takeDatabaseDump(
  stagingDir: string,
  databaseUrl: string
): Promise<NonNullable<BackupManifest['database']> & { file: string }> {
  const file = path.join(stagingDir, 'database.dump');
  const conn = parseDatabaseUrl(databaseUrl);
  return withDbClient(databaseUrl, async (client) => {
    // Row counts are taken around the dump; if writes landed in between, retry, and flag the
    // manifest as approximate when the data never settles.
    let before = await countDatabaseRecords(client);
    let approximate = true;
    for (let attempt = 0; attempt < 3 && approximate; attempt += 1) {
      await pgDump(conn, file, BACKUP_SYSTEM_MODELS);
      const after = await countDatabaseRecords(client);
      approximate = !countsEqual(before, after);
      before = after;
    }
    return { ...summarizeCounts(before, approximate), file };
  });
}

export async function runBackup(
  kind: BackupKind,
  trigger: BackupTrigger,
  createdBy: string,
  options: RunBackupOptions = {}
) {
  const exec = () => doBackup(kind, trigger, createdBy, options);
  return options.alreadyLocked ? exec() : withTaskLock(`backup ${kind}`, exec);
}

async function doBackup(
  kind: BackupKind,
  trigger: BackupTrigger,
  createdBy: string,
  options: RunBackupOptions
) {
  const dir = ensureBackupDir();
  const passphrase = options.passphrase ?? (await getPassphrase());
  const databaseUrl = options.databaseUrl ?? defaultDatabaseUrl();
  const root = options.appRoot ?? getAppRoot();
  const fileName = `${kind.toLowerCase()}-${formatTimestamp()}.cscc-backup`;
  const finalPath = path.join(dir, fileName);
  const partialPath = `${finalPath}.partial`;

  const job = await prisma.backupJob.create({
    data: { kind, trigger, status: 'RUNNING', fileName, createdBy, driveStatus: 'NONE' }
  });

  let workDir: string | undefined;
  try {
    const wantsDb = kind === 'DATABASE' || kind === 'FULL';
    const wantsSite = kind === 'WEBSITE' || kind === 'FULL';

    let needed = 50 * 1024 * 1024;
    if (wantsDb) needed += 2 * (await withDbClient(databaseUrl, databaseSizeBytes));
    if (wantsSite) needed += 2 * estimateTreeSize(root);
    const free = freeBytes(dir);
    if (free !== undefined && free < needed) {
      throw new Error(
        `Không đủ dung lượng trống để sao lưu (cần khoảng ${Math.ceil(needed / 1048576)} MB, còn ${Math.floor(free / 1048576)} MB).`
      );
    }

    workDir = makeWorkDir('backup');
    const manifest: BackupManifest = {
      format: MANIFEST_FORMAT,
      kind,
      createdAt: new Date().toISOString(),
      appVersion: appVersion(),
      hostName: hostName(),
      payloads: {}
    };

    if (wantsDb) {
      const dump = await takeDatabaseDump(workDir, databaseUrl);
      const { file, ...summary } = dump;
      manifest.database = summary;
      manifest.payloads['database.dump'] = await sha256File(file);
    }
    if (wantsSite) {
      const archive = path.join(workDir, WEBSITE_ARCHIVE_NAME);
      await createWebsiteArchive(root, archive, relativeExclude(root, dir));
      manifest.payloads[WEBSITE_ARCHIVE_NAME] = await sha256File(archive);
      manifest.website = {
        systemConfigFiles: collectSystemConfig(path.join(workDir, 'system-config'))
      };
    }
    fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    await packEncrypted(workDir, partialPath, passphrase);
    fs.renameSync(partialPath, finalPath);

    const sha256 = await sha256File(finalPath);
    const sizeBytes = fs.statSync(finalPath).size;
    fs.writeFileSync(
      `${finalPath}.json`,
      JSON.stringify({ fileName, kind, createdAt: manifest.createdAt, sizeBytes, sha256 }, null, 2)
    );

    const done = await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status: 'SUCCESS',
        sha256,
        sizeBytes: BigInt(sizeBytes),
        finishedAt: new Date(),
        manifest: manifest as unknown as object
      }
    });

    const settings = await getSettingRow();
    const wantsDrive = options.uploadToDrive ?? settings.driveEnabled;
    if (wantsDrive && trigger !== 'PRE_RESTORE') {
      const { uploadJobToDrive } = await import('./gdrive.service');
      await uploadJobToDrive(done.id);
    }
    if (trigger !== 'PRE_RESTORE') {
      const { applyRetention } = await import('./retention');
      await applyRetention().catch((e) =>
        console.error('[backup] retention failed:', e instanceof Error ? e.message : e)
      );
    }
    return prisma.backupJob.findUniqueOrThrow({ where: { id: job.id } });
  } catch (err) {
    removeQuiet(partialPath);
    removeQuiet(finalPath);
    removeQuiet(`${finalPath}.json`);
    const message = err instanceof Error ? err.message : String(err);
    await prisma.backupJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', error: message.slice(0, 2000), finishedAt: new Date() }
    });
    throw err;
  } finally {
    if (workDir) removeQuiet(workDir);
  }
}
