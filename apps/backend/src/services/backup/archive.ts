import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createDecryptStream, createEncryptStream } from './encrypted-stream';

const WEBSITE_EXCLUDES = ['node_modules', 'dist', '.git', '.backups', '*.tsbuildinfo'];

function collectStderr(child: ReturnType<typeof spawn>): () => string {
  let stderr = '';
  child.stderr?.on('data', (d) => {
    stderr += d.toString();
    if (stderr.length > 10000) stderr = stderr.slice(-5000);
  });
  return () => stderr.trim();
}

function exited(child: ReturnType<typeof spawn>, label: string, stderr: () => string): Promise<void> {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} lỗi (mã ${code}): ${stderr()}`))
    );
  });
}

/** tar the contents of `cwd` -> AES-GCM encrypt -> `outFile`. Nothing is buffered in memory. */
export async function packEncrypted(
  cwd: string,
  outFile: string,
  passphrase: string
): Promise<void> {
  const child = spawn('tar', ['-cf', '-', '.'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const err = collectStderr(child);
  await Promise.all([
    pipeline(child.stdout!, createEncryptStream(passphrase), fs.createWriteStream(outFile, { mode: 0o600 })),
    exited(child, 'tar', err)
  ]);
}

/** Decrypt `inFile` and extract the tar stream into `destDir`. Throws when the GCM tag does not verify. */
export async function unpackEncrypted(
  inFile: string,
  destDir: string,
  passphrase: string
): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });
  const child = spawn('tar', ['-xf', '-', '-C', destDir], { stdio: ['pipe', 'ignore', 'pipe'] });
  const err = collectStderr(child);
  child.stdin!.on('error', () => undefined);
  const done = exited(child, 'tar', err);
  done.catch(() => undefined);
  try {
    await pipeline(fs.createReadStream(inFile), createDecryptStream(passphrase), child.stdin!);
  } catch (e) {
    child.kill();
    throw e;
  }
  try {
    await done;
  } catch {
    throw new Error('Giải nén bản sao lưu thất bại (file hỏng).');
  }
}

/** Compressed tar of the project tree for the "Website" scope (secrets in .env included on purpose). */
export async function createWebsiteArchive(
  root: string,
  outFile: string,
  extraExcludes: string[] = []
): Promise<void> {
  const excludes = [...WEBSITE_EXCLUDES, ...extraExcludes].flatMap((e) => ['--exclude', e]);
  const child = spawn('tar', ['-czf', outFile, ...excludes, '-C', root, '.'], {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  await exited(child, 'tar', collectStderr(child));
}

export async function extractWebsiteArchive(archive: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });
  const child = spawn('tar', ['-xzf', archive, '-C', destDir], { stdio: ['ignore', 'ignore', 'pipe'] });
  await exited(child, 'tar', collectStderr(child));
}

/** Rough byte size of a tree, skipping excluded names. Used for the free-space check. */
export function estimateTreeSize(root: string, skipNames: string[] = WEBSITE_EXCLUDES): number {
  let total = 0;
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skipNames.includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // ignore vanished files
        }
      }
    }
  };
  walk(root);
  return total;
}

/** Directory a tree-excluded relative path, when `dir` lives inside `root`. */
export function relativeExclude(root: string, dir: string): string[] {
  const rel = path.relative(root, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return [];
  return [`./${rel.split(path.sep).join('/')}`, rel.split(path.sep).join('/')];
}

export const WEBSITE_ARCHIVE_NAME = 'website.tar.gz';

