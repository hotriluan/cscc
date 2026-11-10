import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface DbConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export function parseDatabaseUrl(url: string): DbConnection {
  const u = new URL(url);
  return {
    host: u.hostname || 'localhost',
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, ''))
  };
}

function candidateDirs(): string[] {
  const dirs: string[] = [];
  if (process.env.PG_BIN_DIR) dirs.push(process.env.PG_BIN_DIR);
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL';
    try {
      for (const v of fs.readdirSync(base).sort().reverse()) dirs.push(path.join(base, v, 'bin'));
    } catch {
      // not installed in the default location
    }
  }
  return dirs;
}

/** Resolves a PostgreSQL client binary: PG_BIN_DIR, then PATH, then known install folders. */
export function findPgBinary(name: 'pg_dump' | 'pg_restore'): string {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const dirs = process.env.PG_BIN_DIR ? [process.env.PG_BIN_DIR] : [];
  for (const dir of dirs) {
    const full = path.join(dir, exe);
    if (fs.existsSync(full)) return full;
  }
  if (spawnSync(exe, ['--version'], { stdio: 'ignore' }).status === 0) return exe;
  for (const dir of candidateDirs()) {
    const full = path.join(dir, exe);
    if (fs.existsSync(full)) return full;
  }
  throw new Error(
    `Không tìm thấy ${name}. Cài gói postgresql-client hoặc đặt PG_BIN_DIR trỏ tới thư mục chứa ${name}.`
  );
}

function scrub(text: string, password: string): string {
  const cleaned = password ? text.split(password).join('***') : text;
  return cleaned.trim().slice(-2000);
}

function run(bin: string, args: string[], conn: DbConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env: { ...process.env, PGPASSWORD: conn.password },
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-10000);
    });
    child.on('error', (err) => reject(new Error(scrub(err.message, conn.password))));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(bin)} lỗi (mã ${code}): ${scrub(stderr, conn.password)}`));
    });
  });
}

function connArgs(c: DbConnection): string[] {
  return ['-h', c.host, '-p', c.port, '-U', c.user, '-w'];
}

/** Custom-format dump, excluding the backup bookkeeping tables so restores never rewrite job history. */
export function pgDump(conn: DbConnection, outFile: string, excludeTables: string[]): Promise<void> {
  const args = [
    ...connArgs(conn),
    '-Fc',
    '-f',
    outFile,
    ...excludeTables.flatMap((t) => ['-T', `"${t}"`]),
    conn.database
  ];
  return run(findPgBinary('pg_dump'), args, conn);
}

export function pgRestore(conn: DbConnection, dumpFile: string): Promise<void> {
  const args = [
    ...connArgs(conn),
    '--clean',
    '--if-exists',
    '--single-transaction',
    '--no-owner',
    '-d',
    conn.database,
    dumpFile
  ];
  return run(findPgBinary('pg_restore'), args, conn);
}

