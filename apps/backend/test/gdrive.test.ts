import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from '../src/store/prisma';
import { sealSecret } from '../src/services/backup/crypto-box';
import * as gdrive from '../src/services/backup/gdrive.service';
import {
  DriveAuthError,
  pollDeviceToken,
  refreshAccessToken,
  requestDeviceCode
} from '../src/services/backup/gdrive-oauth';

interface MockSettingRow {
  id: number;
  dbScheduleEnabled: boolean;
  dbScheduleHour: number;
  dbScheduleMinute: number;
  dbRetention: number;
  fullScheduleEnabled: boolean;
  fullScheduleWeekday: number;
  fullScheduleHour: number;
  fullScheduleMinute: number;
  fullRetention: number;
  driveEnabled: boolean;
  driveFolderId: string | null;
  driveAccountEmail: string | null;
  driveNeedsReconnect: boolean;
  encryptedSecrets: string | null;
  passphraseHash: string | null;
  updatedAt: Date;
}

test('Admin Backup — Phase 4: Google Drive OAuth Device Flow & REST API', async (t) => {
  const masterKey = crypto.randomBytes(32);
  process.env.BACKUP_MASTER_KEY = masterKey.toString('base64');
  gdrive.driveRetry.baseDelayMs = 5;
  gdrive.devicePoll.minIntervalMs = 5;

  let settingState: MockSettingRow = {
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
    driveEnabled: true,
    driveFolderId: null,
    driveAccountEmail: null,
    driveNeedsReconnect: false,
    encryptedSecrets: sealSecret(
      JSON.stringify({
        driveClientId: 'client-id-123',
        driveClientSecret: 'client-secret-456',
        driveRefreshToken: 'refresh-tok-789'
      }),
      masterKey
    ),
    passphraseHash: null,
    updatedAt: new Date()
  };

  const origUpsert = prisma.backupSetting.upsert;
  const origUpdate = prisma.backupSetting.update;
  const origFetch = globalThis.fetch;

  (prisma.backupSetting as any).upsert = async () => ({ ...settingState });
  (prisma.backupSetting as any).update = async ({ data }: { data: Partial<MockSettingRow> }) => {
    settingState = { ...settingState, ...data, updatedAt: new Date() };
    return { ...settingState };
  };

  t.after(() => {
    (prisma.backupSetting as any).upsert = origUpsert;
    (prisma.backupSetting as any).update = origUpdate;
    globalThis.fetch = origFetch;
  });

  await t.test('1. OAuth Device Code request & polling states (pending, ok, denied)', async () => {
    let call = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/device/code')) {
        return new Response(
          JSON.stringify({
            device_code: 'dev-code-001',
            user_code: 'ABCD-EFGH',
            verification_url: 'https://www.google.com/device',
            expires_in: 1800,
            interval: 1
          }),
          { status: 200 }
        );
      }
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 400 });
      }
      if (call === 2) {
        return new Response(
          JSON.stringify({
            access_token: 'acc-tok-live',
            refresh_token: 'ref-tok-live',
            expires_in: 3600
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'access_denied' }), { status: 400 });
    }) as typeof fetch;

    const dc = await requestDeviceCode('client-id-123');
    assert.equal(dc.userCode, 'ABCD-EFGH');
    assert.equal(dc.deviceCode, 'dev-code-001');

    const p1 = await pollDeviceToken('client-id-123', 'secret', 'dev-code-001');
    assert.equal(p1.status, 'pending');

    const p2 = await pollDeviceToken('client-id-123', 'secret', 'dev-code-001');
    assert.equal(p2.status, 'ok');
    if (p2.status === 'ok') {
      assert.equal(p2.refreshToken, 'ref-tok-live');
      assert.equal(p2.accessToken, 'acc-tok-live');
    }

    const p3 = await pollDeviceToken('client-id-123', 'secret', 'dev-code-001');
    assert.equal(p3.status, 'denied');
  });

  await t.test('2. invalid_grant on token refresh marks driveNeedsReconnect=true', async () => {
    gdrive.resetDriveTokenCache();
    settingState.driveNeedsReconnect = false;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }),
        { status: 400 }
      )) as typeof fetch;

    await assert.rejects(
      () => gdrive.getAccessToken(),
      (err: unknown) => err instanceof DriveAuthError && err.code === 'invalid_grant'
    );
    assert.equal(settingState.driveNeedsReconnect, true);
  });

  await t.test('3. Resumable upload verifies size & MD5 checksum, lists and deletes remote file', async () => {
    gdrive.resetDriveTokenCache();
    settingState.driveNeedsReconnect = false;
    settingState.driveFolderId = null;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cscc-gdrive-test-'));
    const sampleFile = path.join(tmpDir, 'database-20261110-120000.cscc-backup');
    const payload = Buffer.from('CSCCBK1-encrypted-backup-payload-bytes-for-drive-upload-test');
    fs.writeFileSync(sampleFile, payload);
    const expectedMd5 = crypto.createHash('md5').update(payload).digest('hex');

    let deletedId: string | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid-access-token', expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (url.includes('/drive/v3/files?q=')) {
        if (url.includes('application%2Fvnd.google-apps.folder')) {
          return new Response(JSON.stringify({ files: [{ id: 'folder-cscc-01' }] }), {
            status: 200
          });
        }
        return new Response(
          JSON.stringify({
            files: [
              {
                id: 'drive-file-99',
                name: 'database-20261110-120000.cscc-backup',
                size: String(payload.length),
                createdTime: '2026-11-10T05:00:00Z',
                md5Checksum: expectedMd5
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.includes('/upload/drive/v3/files?uploadType=resumable')) {
        return new Response('', {
          status: 200,
          headers: { location: 'https://www.googleapis.com/upload/session/abc123' }
        });
      }
      if (url.includes('/upload/session/abc123') && init?.method === 'PUT') {
        return new Response(
          JSON.stringify({
            id: 'drive-file-99',
            name: 'database-20261110-120000.cscc-backup',
            size: String(payload.length),
            md5Checksum: expectedMd5,
            createdTime: '2026-11-10T05:00:00Z'
          }),
          { status: 200 }
        );
      }
      if (url.includes('/drive/v3/files/drive-file-99') && init?.method === 'DELETE') {
        deletedId = 'drive-file-99';
        return new Response(null, { status: 204 });
      }
      if (url.includes('oauth2.googleapis.com/revoke')) {
        return new Response('', { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const uploaded = await gdrive.uploadFile(sampleFile, 'database-20261110-120000.cscc-backup');
    assert.equal(uploaded.id, 'drive-file-99');
    assert.equal(uploaded.size, payload.length);
    assert.equal(uploaded.md5Checksum, expectedMd5);
    assert.equal(settingState.driveFolderId, 'folder-cscc-01');

    const listed = await gdrive.listFiles();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'drive-file-99');

    await gdrive.deleteFile('drive-file-99');
    assert.equal(deletedId, 'drive-file-99');

    await gdrive.disconnectDrive();
    assert.equal(settingState.driveEnabled, false);
    assert.equal(settingState.driveAccountEmail, null);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('4. parseDriveApiErrorMessage formats Google Cloud 403 accessNotConfigured and general errors', () => {
    const raw403 = JSON.stringify({
      error: {
        code: 403,
        message:
          'Google Drive API has not been used in project 127211862102 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=127211862102 then retry.',
        errors: [
          {
            message:
              'Google Drive API has not been used in project 127211862102 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=127211862102 then retry.',
            domain: 'usageLimits',
            reason: 'accessNotConfigured',
            extendedHelp:
              'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=127211862102'
          }
        ]
      }
    });

    const msg = gdrive.parseDriveApiErrorMessage(403, raw403);
    assert.match(msg, /Google Drive API chưa được bật trên Google Cloud Console/);
    assert.match(msg, /Project: 127211862102/);
    assert.match(msg, /https:\/\/console\.developers\.google\.com/);

    const raw404 = JSON.stringify({ error: { code: 404, message: 'File not found: abc' } });
    assert.equal(gdrive.parseDriveApiErrorMessage(404, raw404), 'Google Drive trả lỗi 404: File not found: abc');

    const html502 = '<html><body>502 Bad Gateway</body></html>';
    assert.equal(gdrive.parseDriveApiErrorMessage(502, html502), 'Google Drive trả lỗi 502: <html><body>502 Bad Gateway</body></html>');
  });
});
