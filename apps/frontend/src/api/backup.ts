import { getStoredAuthToken } from './client';

export type BackupKind = 'DATABASE' | 'WEBSITE' | 'FULL';
export type BackupTrigger = 'MANUAL' | 'SCHEDULE' | 'PRE_RESTORE' | 'UPLOAD' | 'RESTORE';
export type BackupStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';
export type DriveCopyStatus = 'NONE' | 'PENDING' | 'OK' | 'FAILED';

export interface BackupJobManifest {
  format?: number;
  kind?: BackupKind;
  createdAt?: string;
  appVersion?: string;
  hostName?: string;
  database?: {
    tables: number;
    records: number;
    counts: Record<string, number>;
    approximate: boolean;
  };
  website?: { systemConfigFiles: string[] };
  restoredFrom?: string;
  scope?: BackupKind;
  safetyBackup?: string;
  steps?: string[];
  warnings?: string[];
  instructions?: string;
}

export interface BackupJob {
  id: string;
  kind: BackupKind;
  trigger: BackupTrigger;
  status: BackupStatus;
  fileName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  driveFileId: string | null;
  driveStatus: DriveCopyStatus;
  error: string | null;
  createdBy: string;
  startedAt: string;
  finishedAt: string | null;
  manifest: BackupJobManifest | null;
}

export interface BackupSettings {
  masterKeyConfigured: boolean;
  passphraseSet: boolean;
  schedule: {
    db: {
      enabled: boolean;
      hour: number;
      minute: number;
      retention: number;
    };
    full: {
      enabled: boolean;
      weekday: number;
      hour: number;
      minute: number;
      retention: number;
    };
  };
  drive: {
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    accountEmail: string | null;
    folderId: string | null;
    needsReconnect: boolean;
  };
}

export interface DriveConnectState {
  status: 'idle' | 'pending' | 'ok' | 'denied' | 'expired' | 'error';
  userCode?: string;
  verificationUrl?: string;
  expiresAt?: string;
  message?: string;
}

export interface DriveFileEntry {
  id: string;
  name: string;
  size: number;
  createdTime?: string;
  md5Checksum?: string;
}

const BASE = '/api/admin/backup';

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body && typeof options.body === 'string'
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...((options.headers as Record<string, string>) || {})
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const backupApi = {
  getJobs: () =>
    adminRequest<{ jobs: BackupJob[]; activeTask: string | null; maintenance: boolean }>('/jobs'),

  startBackup: (kind: BackupKind, uploadToDrive?: boolean) =>
    adminRequest<{ accepted: boolean }>('/jobs', {
      method: 'POST',
      body: JSON.stringify({ kind, uploadToDrive })
    }),

  downloadJob: async (jobId: string, fileName: string) => {
    const token = getStoredAuthToken();
    const res = await fetch(`${BASE}/jobs/${encodeURIComponent(jobId)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  deleteJob: (jobId: string) =>
    adminRequest<{ deleted: boolean }>(`/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE'
    }),

  retryDriveUpload: (jobId: string) =>
    adminRequest<{ job: BackupJob }>(`/jobs/${encodeURIComponent(jobId)}/drive-retry`, {
      method: 'POST'
    }),

  uploadBackupFile: async (file: File): Promise<BackupJob> => {
    const token = getStoredAuthToken();
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-file-name': file.name,
        'Content-Type': 'application/octet-stream'
      },
      body: file
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { job: BackupJob };
    return data.job;
  },

  restoreFromJob: (
    jobId: string,
    payload: { scope: BackupKind; confirm: string; passphrase?: string }
  ) =>
    adminRequest<{ accepted: boolean; jobId: string }>(
      `/jobs/${encodeURIComponent(jobId)}/restore`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    ),

  restoreFromDrive: (payload: {
    fileId: string;
    scope: BackupKind;
    confirm: string;
    passphrase?: string;
  }) =>
    adminRequest<{ accepted: boolean; jobId: string }>('/drive/restore', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getSettings: () => adminRequest<BackupSettings>('/settings'),

  updateSettings: (patch: {
    schedule?: {
      db?: { enabled?: boolean; hour?: number; minute?: number; retention?: number };
      full?: {
        enabled?: boolean;
        weekday?: number;
        hour?: number;
        minute?: number;
        retention?: number;
      };
    };
    driveEnabled?: boolean;
  }) =>
    adminRequest<BackupSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(patch)
    }),

  setPassphrase: (passphrase: string, confirmSaved: boolean) =>
    adminRequest<BackupSettings>('/settings/passphrase', {
      method: 'PUT',
      body: JSON.stringify({ passphrase, confirmSaved })
    }),

  getDriveStatus: () =>
    adminRequest<{ drive: BackupSettings['drive']; connect: DriveConnectState }>('/drive/status'),

  saveDriveCredentials: (clientId: string, clientSecret: string) =>
    adminRequest<{ drive: BackupSettings['drive'] }>('/drive/credentials', {
      method: 'PUT',
      body: JSON.stringify({ clientId, clientSecret })
    }),

  startDriveConnect: () =>
    adminRequest<{ connect: DriveConnectState }>('/drive/connect', {
      method: 'POST'
    }),

  checkDriveConnection: () =>
    adminRequest<{ ok: boolean; email: string | null }>('/drive/check', {
      method: 'POST'
    }),

  disconnectDrive: () =>
    adminRequest<{ drive: BackupSettings['drive'] }>('/drive', {
      method: 'DELETE'
    }),

  listDriveFiles: () => adminRequest<{ files: DriveFileEntry[] }>('/drive/files')
};

