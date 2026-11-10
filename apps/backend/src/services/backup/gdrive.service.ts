import crypto from 'crypto';
import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { prisma } from '../../store/prisma';
import {
  DriveAuthError,
  pollDeviceToken,
  refreshAccessToken,
  requestDeviceCode,
  revokeToken
} from './gdrive-oauth';
import { resolveBackupFile } from './backup-paths';
import {
  autoDetectAndSeedDriveCredentials,
  BackupConfigError,
  getSettingRow,
  readSecrets,
  updateSecrets
} from './settings.service';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'CSCC Backups';
const MAX_ATTEMPTS = 3;

/** Backoff between automatic retries; tests shorten it. */
export const driveRetry = { baseDelayMs: 1500 };

export class DriveApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'DriveApiError';
  }
}

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  createdTime?: string;
  md5Checksum?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export function resetDriveTokenCache(): void {
  cachedToken = null;
}

async function loadCredentials() {
  await autoDetectAndSeedDriveCredentials();
  const secrets = readSecrets(await getSettingRow());
  if (!secrets.driveClientId || !secrets.driveClientSecret) {
    throw new BackupConfigError('Chưa cấu hình Client ID / Client Secret của Google Drive.');
  }
  return {
    clientId: secrets.driveClientId,
    clientSecret: secrets.driveClientSecret,
    refreshToken: secrets.driveRefreshToken
  };
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const { clientId, clientSecret, refreshToken } = await loadCredentials();
  if (!refreshToken) throw new BackupConfigError('Google Drive chưa được kết nối.');
  try {
    const t = await refreshAccessToken(clientId, clientSecret, refreshToken);
    cachedToken = { token: t.accessToken, expiresAt: Date.now() + t.expiresIn * 1000 };
    return t.accessToken;
  } catch (err) {
    cachedToken = null;
    if (err instanceof DriveAuthError && err.code === 'invalid_grant') {
      await prisma.backupSetting.update({ where: { id: 1 }, data: { driveNeedsReconnect: true } });
    }
    throw err;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Authenticated request with up to 3 attempts (network errors, 429, 5xx) and one 401 token refresh. */
async function driveRequest(
  makeRequest: (token: string) => Promise<Response>,
  okStatuses: number[] = []
): Promise<Response> {
  let lastError: Error = new Error('Drive request failed');
  let refreshedOn401 = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const token = await getAccessToken();
      const res = await makeRequest(token);
      if (res.ok || okStatuses.includes(res.status)) return res;
      if (res.status === 401 && !refreshedOn401) {
        refreshedOn401 = true;
        cachedToken = null;
        attempt -= 1;
        continue;
      }
      const body = (await res.text()).slice(0, 500);
      lastError = new DriveApiError(`Google Drive trả lỗi ${res.status}: ${body}`, res.status);
      if (res.status !== 429 && res.status < 500) throw lastError;
    } catch (err) {
      if (err instanceof DriveAuthError || err instanceof BackupConfigError) throw err;
      if (err instanceof DriveApiError && err.status !== 429 && err.status < 500) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < MAX_ATTEMPTS) await sleep(driveRetry.baseDelayMs * 2 ** (attempt - 1));
  }
  throw lastError;
}

async function jsonRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await driveRequest((token) =>
    fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } })
  );
  return (await res.json()) as T;
}

export async function getAccountEmail(): Promise<string | null> {
  const about = await jsonRequest<{ user?: { emailAddress?: string } }>(
    `${API}/about?fields=user(emailAddress)`
  );
  return about.user?.emailAddress ?? null;
}

export async function ensureFolder(): Promise<string> {
  const row = await getSettingRow();
  if (row.driveFolderId) {
    const res = await driveRequest(
      (token) =>
        fetch(`${API}/files/${encodeURIComponent(row.driveFolderId as string)}?fields=id,trashed`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
      [404]
    );
    if (res.ok) {
      const f = (await res.json()) as { id: string; trashed?: boolean };
      if (!f.trashed) return f.id;
    }
  }
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const found = await jsonRequest<{ files?: { id: string }[] }>(`${API}/files?q=${q}&fields=files(id)`);
  let id = found.files?.[0]?.id;
  if (!id) {
    const created = await jsonRequest<{ id: string }>(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    });
    id = created.id;
  }
  await prisma.backupSetting.update({ where: { id: 1 }, data: { driveFolderId: id } });
  return id;
}

function md5File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('md5');
    fs.createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

/** Resumable, streamed upload; verifies size and md5 reported by Drive. */
export async function uploadFile(localPath: string, name: string): Promise<DriveFile> {
  const folderId = await ensureFolder();
  const size = fs.statSync(localPath).size;
  const md5 = await md5File(localPath);
  let lastError: Error = new Error('Upload failed');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const init = await driveRequest((token) =>
        fetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id,name,size,md5Checksum,createdTime`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'application/octet-stream',
            'X-Upload-Content-Length': String(size)
          },
          body: JSON.stringify({ name, parents: [folderId] })
        })
      );
      const session = init.headers.get('location');
      if (!session) throw new Error('Google Drive không trả về địa chỉ upload.');

      const res = await fetch(session, {
        method: 'PUT',
        headers: { 'Content-Length': String(size), 'Content-Type': 'application/octet-stream' },
        body: Readable.toWeb(fs.createReadStream(localPath)) as unknown as BodyInit,
        // @ts-expect-error Node's fetch requires duplex for streamed bodies
        duplex: 'half'
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 500);
        throw new DriveApiError(`Upload lên Google Drive lỗi ${res.status}: ${body}`, res.status);
      }
      const file = (await res.json()) as {
        id: string;
        name: string;
        size?: string;
        md5Checksum?: string;
        createdTime?: string;
      };
      if (Number(file.size) !== size || (file.md5Checksum && file.md5Checksum !== md5)) {
        await deleteFile(file.id).catch(() => undefined);
        throw new Error('Bản trên Google Drive không khớp checksum/dung lượng với file gốc.');
      }
      return { id: file.id, name: file.name, size, createdTime: file.createdTime, md5Checksum: file.md5Checksum };
    } catch (err) {
      if (err instanceof DriveAuthError || err instanceof BackupConfigError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_ATTEMPTS) await sleep(driveRetry.baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

export async function listFiles(): Promise<DriveFile[]> {
  const folderId = await ensureFolder();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const page = await jsonRequest<{
      files?: { id: string; name: string; size?: string; createdTime?: string; md5Checksum?: string }[];
      nextPageToken?: string;
    }>(
      `${API}/files?q=${q}&orderBy=createdTime desc&pageSize=100&fields=nextPageToken,files(id,name,size,createdTime,md5Checksum)` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    );
    for (const f of page.files ?? []) {
      out.push({ id: f.id, name: f.name, size: Number(f.size ?? 0), createdTime: f.createdTime, md5Checksum: f.md5Checksum });
    }
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

export async function getFileMeta(fileId: string): Promise<DriveFile> {
  const f = await jsonRequest<{ id: string; name: string; size?: string; md5Checksum?: string }>(
    `${API}/files/${encodeURIComponent(fileId)}?fields=id,name,size,md5Checksum`
  );
  return { id: f.id, name: f.name, size: Number(f.size ?? 0), md5Checksum: f.md5Checksum };
}

export async function downloadToFile(fileId: string, dest: string): Promise<void> {
  const res = await driveRequest((token) =>
    fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  );
  if (!res.body) throw new Error('Google Drive không trả dữ liệu tải về.');
  await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(dest, { mode: 0o600 }));
}

export async function deleteFile(fileId: string): Promise<void> {
  await driveRequest(
    (token) =>
      fetch(`${API}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }),
    [404]
  );
}

/** Uploads the local file of a finished job; the local backup is never affected by failures. */
export async function uploadJobToDrive(jobId: string): Promise<void> {
  const job = await prisma.backupJob.findUniqueOrThrow({ where: { id: jobId } });
  if (!job.fileName) return;
  await prisma.backupJob.update({ where: { id: jobId }, data: { driveStatus: 'PENDING' } });
  try {
    const file = await uploadFile(resolveBackupFile(job.fileName), job.fileName);
    await prisma.backupJob.update({
      where: { id: jobId },
      data: { driveStatus: 'OK', driveFileId: file.id, error: null }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[backup] Drive upload failed:', message);
    await prisma.backupJob.update({
      where: { id: jobId },
      data: { driveStatus: 'FAILED', error: `Google Drive: ${message}`.slice(0, 2000) }
    });
  }
}

// ---------------------------------------------------------------------------
// Connection lifecycle (device flow)
// ---------------------------------------------------------------------------

export interface ConnectState {
  status: 'idle' | 'pending' | 'ok' | 'denied' | 'expired' | 'error';
  userCode?: string;
  verificationUrl?: string;
  expiresAt?: string;
  message?: string;
}

let connectState: ConnectState = { status: 'idle' };
let pollTimer: NodeJS.Timeout | null = null;

export function getConnectState(): ConnectState {
  return connectState;
}

export const devicePoll = { minIntervalMs: 0 };

export async function saveClientCredentials(clientId: string, clientSecret: string): Promise<void> {
  const id = clientId.trim();
  const secret = clientSecret.trim();
  if (!id || !secret) throw new BackupConfigError('Cần nhập đủ Client ID và Client Secret.');
  const secrets = readSecrets(await getSettingRow());
  const changed = secrets.driveClientId !== id;
  await updateSecrets(
    { driveClientId: id, driveClientSecret: secret, ...(changed ? { driveRefreshToken: undefined } : {}) },
    changed
      ? { driveAccountEmail: null, driveFolderId: null, driveNeedsReconnect: false }
      : {}
  );
  resetDriveTokenCache();
}

export async function startConnect(): Promise<ConnectState> {
  const { clientId, clientSecret } = await loadCredentials();
  if (pollTimer) clearTimeout(pollTimer);
  const device = await requestDeviceCode(clientId);
  const expiresAtMs = Date.now() + device.expiresIn * 1000;
  connectState = {
    status: 'pending',
    userCode: device.userCode,
    verificationUrl: device.verificationUrl,
    expiresAt: new Date(expiresAtMs).toISOString()
  };

  let interval = device.interval;
  const tick = async (): Promise<void> => {
    if (Date.now() > expiresAtMs) {
      connectState = { status: 'expired', message: 'Mã thiết bị đã hết hạn. Vui lòng thử kết nối lại.' };
      return;
    }
    try {
      const r = await pollDeviceToken(clientId, clientSecret, device.deviceCode);
      if (r.status === 'pending') {
        if (r.slowDown) interval += 5;
        pollTimer = setTimeout(tick, Math.max(interval * 1000, devicePoll.minIntervalMs));
        return;
      }
      if (r.status === 'denied') {
        connectState = { status: 'denied', message: 'Bạn đã từ chối cấp quyền trên Google.' };
        return;
      }
      if (r.status === 'expired') {
        connectState = { status: 'expired', message: 'Mã thiết bị đã hết hạn. Vui lòng thử kết nối lại.' };
        return;
      }
      await updateSecrets({ driveRefreshToken: r.refreshToken });
      cachedToken = { token: r.accessToken, expiresAt: Date.now() + r.expiresIn * 1000 };
      await prisma.backupSetting.update({ where: { id: 1 }, data: { driveNeedsReconnect: false } });
      const email = await getAccountEmail().catch(() => null);
      await ensureFolder();
      await prisma.backupSetting.update({ where: { id: 1 }, data: { driveAccountEmail: email } });
      connectState = { status: 'ok' };
    } catch (err) {
      connectState = { status: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  };
  pollTimer = setTimeout(tick, Math.max(interval * 1000, devicePoll.minIntervalMs));
  return connectState;
}

export async function checkConnection(): Promise<{ ok: boolean; email: string | null }> {
  const email = await getAccountEmail();
  await ensureFolder();
  await prisma.backupSetting.update({
    where: { id: 1 },
    data: { driveAccountEmail: email, driveNeedsReconnect: false }
  });
  return { ok: true, email };
}

export async function disconnectDrive(): Promise<void> {
  if (pollTimer) clearTimeout(pollTimer);
  connectState = { status: 'idle' };
  const secrets = readSecrets(await getSettingRow());
  if (secrets.driveRefreshToken) await revokeToken(secrets.driveRefreshToken);
  await updateSecrets(
    {
      driveClientId: undefined,
      driveClientSecret: undefined,
      driveRefreshToken: undefined
    },
    { driveEnabled: false, driveAccountEmail: null, driveFolderId: null, driveNeedsReconnect: false }
  );
  resetDriveTokenCache();
}

