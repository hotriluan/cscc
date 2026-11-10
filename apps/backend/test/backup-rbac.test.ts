import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { UserRole } from '@cscc/shared';
import { createApp } from '../src/app';
import { signJwtToken } from '../src/services/auth.service';
import {
  hashPassphrase,
  MasterKeyError,
  openSecret,
  sealSecret,
  verifyPassphraseHash
} from '../src/services/backup/crypto-box';
import { ensureBackupDir, getAppRoot } from '../src/services/backup/backup-paths';

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

test('Admin Backup — Phase 1: Foundation, Crypto-Box & Strict JWT RBAC', async (t) => {
  await t.test('1. crypto-box AES-256-GCM seal/open round-trip and wrong-key rejection', () => {
    const key1 = crypto.randomBytes(32);
    const key2 = crypto.randomBytes(32);
    const plain = JSON.stringify({
      driveClientId: '12345.apps.googleusercontent.com',
      driveClientSecret: 'GOCSPX-secret',
      passphrase: 'correct-horse-battery-staple'
    });

    const sealed1 = sealSecret(plain, key1);
    const sealed2 = sealSecret(plain, key1);
    assert.notEqual(sealed1, sealed2, 'Random IV must produce distinct ciphertexts');
    assert.ok(sealed1.startsWith('v1:'));

    const opened = openSecret(sealed1, key1);
    assert.equal(opened, plain);

    assert.throws(
      () => openSecret(sealed1, key2),
      /Không giải mã được/,
      'Wrong master key must fail GCM tag verification'
    );
    assert.throws(
      () => openSecret('v1:bad:format', key1),
      /không hợp lệ/,
      'Malformed payload must throw'
    );

    const prevKey = process.env.BACKUP_MASTER_KEY;
    delete process.env.BACKUP_MASTER_KEY;
    assert.throws(() => sealSecret('abc'), MasterKeyError);
    if (prevKey !== undefined) process.env.BACKUP_MASTER_KEY = prevKey;
  });

  await t.test('2. scrypt passphrase hash verification', () => {
    const hash = hashPassphrase('my-strong-passphrase-2026');
    assert.equal(verifyPassphraseHash('my-strong-passphrase-2026', hash), true);
    assert.equal(verifyPassphraseHash('wrong-passphrase-2026', hash), false);
    assert.equal(verifyPassphraseHash('anything', 'invalid-hash'), false);
  });

  await t.test('3. backup-paths rejects BACKUP_DIR inside frontend dist or project tree', () => {
    const prev = process.env.BACKUP_DIR;
    try {
      process.env.BACKUP_DIR = path.join(getAppRoot(), 'apps', 'frontend', 'dist', 'backups');
      assert.throws(() => ensureBackupDir(), /không được nằm trong thư mục web/);

      process.env.BACKUP_DIR = path.join(getAppRoot(), 'apps', 'backend', 'src');
      assert.throws(() => ensureBackupDir(), /ngoài thư mục mã nguồn/);

      const validTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cscc-bk-test-'));
      process.env.BACKUP_DIR = validTmp;
      const resolved = ensureBackupDir();
      assert.ok(fs.existsSync(resolved));
      fs.rmSync(validTmp, { recursive: true, force: true });
    } finally {
      if (prev === undefined) delete process.env.BACKUP_DIR;
      else process.env.BACKUP_DIR = prev;
    }
  });

  await t.test(
    '4. All /api/admin/backup/* routes reject non-ADMIN JWTs, unauthenticated requests, and x-user-role: ADMIN header spoofing with 403',
    async () => {
      const app = createApp();
      const routes: { method: string; path: string }[] = [
        { method: 'GET', path: '/api/admin/backup/jobs' },
        { method: 'POST', path: '/api/admin/backup/jobs' },
        { method: 'GET', path: '/api/admin/backup/jobs/job-1/download' },
        { method: 'DELETE', path: '/api/admin/backup/jobs/job-1' },
        { method: 'POST', path: '/api/admin/backup/jobs/job-1/restore' },
        { method: 'POST', path: '/api/admin/backup/upload' },
        { method: 'GET', path: '/api/admin/backup/settings' },
        { method: 'PUT', path: '/api/admin/backup/settings' },
        { method: 'PUT', path: '/api/admin/backup/settings/passphrase' },
        { method: 'GET', path: '/api/admin/backup/drive/status' },
        { method: 'PUT', path: '/api/admin/backup/drive/credentials' },
        { method: 'POST', path: '/api/admin/backup/drive/connect' },
        { method: 'POST', path: '/api/admin/backup/drive/check' },
        { method: 'DELETE', path: '/api/admin/backup/drive' },
        { method: 'GET', path: '/api/admin/backup/drive/files' },
        { method: 'POST', path: '/api/admin/backup/drive/restore' }
      ];

      for (const r of routes) {
        // 4.1 Unauthenticated (no token, no header) -> 403
        const noAuth = await dispatch(app, r.method, r.path);
        assert.equal(noAuth.status, 403, `${r.method} ${r.path} without JWT must be 403`);
        assert.equal(noAuth.body?.error, 'FORBIDDEN_ADMIN_ACCESS');

        // 4.2 Spoofed x-user-role: ADMIN without JWT -> 403
        const spoofedHeader = await dispatch(app, r.method, r.path, {
          'x-user-role': 'ADMIN'
        });
        assert.equal(
          spoofedHeader.status,
          403,
          `${r.method} ${r.path} with only x-user-role: ADMIN must be 403`
        );

        // 4.3 Valid JWT for TECHNICAL, SALES, PROJECT_LEADER -> 403
        for (const nonAdmin of ['TECHNICAL', 'SALES', 'PROJECT_LEADER'] as UserRole[]) {
          const token = signJwtToken({
            id: `u-${nonAdmin}`,
            email: `${nonAdmin.toLowerCase()}@alkana.vn`,
            fullName: nonAdmin,
            role: nonAdmin,
            salesmanName: null,
            createdAt: new Date().toISOString()
          });
          const res = await dispatch(app, r.method, r.path, {
            authorization: `Bearer ${token}`,
            'x-user-role': 'ADMIN'
          });
          assert.equal(
            res.status,
            403,
            `${r.method} ${r.path} with ${nonAdmin} JWT must be 403`
          );
        }
      }
    }
  );
});
