import React from 'react';
import {
  backupApi,
  BackupJob,
  BackupKind,
  BackupSettings,
  DriveConnectState,
  DriveFileEntry
} from '../../api/backup';
import {
  Database,
  Globe,
  HardDrive,
  Cloud,
  Download,
  Trash2,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Calendar,
  ShieldAlert,
  ExternalLink,
  Copy,
  X,
  Info,
  Play,
  Lock
} from 'lucide-react';

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return iso;
  }
}

function kindLabel(kind: BackupKind): string {
  switch (kind) {
    case 'DATABASE':
      return 'Database (PostgreSQL)';
    case 'WEBSITE':
      return 'Website (Mã nguồn + .env)';
    case 'FULL':
      return 'Toàn bộ (Database + Website)';
    default:
      return kind;
  }
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case 'MANUAL':
      return 'Thủ công';
    case 'SCHEDULE':
      return 'Tự động theo lịch';
    case 'PRE_RESTORE':
      return 'An toàn trước phục hồi';
    case 'UPLOAD':
      return 'Tải lên từ máy';
    case 'RESTORE':
      return 'Phục hồi hệ thống';
    default:
      return trigger;
  }
}

const WEEKDAY_NAMES: { value: number; label: string }[] = [
  { value: 0, label: 'Chủ nhật' },
  { value: 1, label: 'Thứ hai' },
  { value: 2, label: 'Thứ ba' },
  { value: 3, label: 'Thứ tư' },
  { value: 4, label: 'Thứ năm' },
  { value: 5, label: 'Thứ sáu' },
  { value: 6, label: 'Thứ bảy' }
];

interface RestoreDialogTarget {
  mode: 'job' | 'drive';
  id: string;
  fileName: string;
  availableKind: BackupKind;
}

function detectKindFromFileName(name: string): BackupKind {
  const prefix = name.toLowerCase().split('-')[0];
  if (prefix === 'database') return 'DATABASE';
  if (prefix === 'website') return 'WEBSITE';
  return 'FULL';
}

function allowedScopesFor(kind: BackupKind): BackupKind[] {
  if (kind === 'FULL') return ['FULL', 'DATABASE', 'WEBSITE'];
  if (kind === 'DATABASE') return ['DATABASE'];
  return ['WEBSITE'];
}

function renderErrorWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline font-bold text-blue-700 hover:text-blue-900 break-all inline-block mx-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function AdminBackupView() {
  const [settings, setSettings] = React.useState<BackupSettings | null>(null);
  const [jobs, setJobs] = React.useState<BackupJob[]>([]);
  const [activeTask, setActiveTask] = React.useState<string | null>(null);
  const [maintenance, setMaintenance] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  // Schedule form state
  const [dbEnabled, setDbEnabled] = React.useState<boolean>(true);
  const [dbHour, setDbHour] = React.useState<number>(2);
  const [dbMinute, setDbMinute] = React.useState<number>(0);
  const [dbRetention, setDbRetention] = React.useState<number>(14);

  const [fullEnabled, setFullEnabled] = React.useState<boolean>(true);
  const [fullWeekday, setFullWeekday] = React.useState<number>(0);
  const [fullHour, setFullHour] = React.useState<number>(3);
  const [fullMinute, setFullMinute] = React.useState<number>(0);
  const [fullRetention, setFullRetention] = React.useState<number>(4);
  const [savingSchedule, setSavingSchedule] = React.useState<boolean>(false);

  // Passphrase state
  const [passphraseInput, setPassphraseInput] = React.useState<string>('');
  const [passphraseConfirm, setPassphraseConfirm] = React.useState<string>('');
  const [confirmSavedOffline, setConfirmSavedOffline] = React.useState<boolean>(false);
  const [savingPassphrase, setSavingPassphrase] = React.useState<boolean>(false);
  const [showPassphraseForm, setShowPassphraseForm] = React.useState<boolean>(false);

  // Google Drive state
  const [clientIdInput, setClientIdInput] = React.useState<string>('');
  const [clientSecretInput, setClientSecretInput] = React.useState<string>('');
  const [savingCredentials, setSavingCredentials] = React.useState<boolean>(false);
  const [connectState, setConnectState] = React.useState<DriveConnectState>({ status: 'idle' });
  const [driveFiles, setDriveFiles] = React.useState<DriveFileEntry[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = React.useState<boolean>(false);
  const [showDriveGuide, setShowDriveGuide] = React.useState<boolean>(false);
  const [checkingDrive, setCheckingDrive] = React.useState<boolean>(false);

  // Upload state
  const [uploadingFile, setUploadingFile] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Restore dialog state
  const [restoreTarget, setRestoreTarget] = React.useState<RestoreDialogTarget | null>(null);
  const [restoreScope, setRestoreScope] = React.useState<BackupKind>('DATABASE');
  const [restoreConfirmName, setRestoreConfirmName] = React.useState<string>('');
  const [restoreCustomPassphrase, setRestoreCustomPassphrase] = React.useState<string>('');
  const [restoreRunningJobId, setRestoreRunningJobId] = React.useState<string | null>(null);
  const [submittingRestore, setSubmittingRestore] = React.useState<boolean>(false);

  const showToast = React.useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 5000);
  }, []);

  const syncScheduleForm = React.useCallback((s: BackupSettings) => {
    setDbEnabled(s.schedule.db.enabled);
    setDbHour(s.schedule.db.hour);
    setDbMinute(s.schedule.db.minute);
    setDbRetention(s.schedule.db.retention);
    setFullEnabled(s.schedule.full.enabled);
    setFullWeekday(s.schedule.full.weekday);
    setFullHour(s.schedule.full.hour);
    setFullMinute(s.schedule.full.minute);
    setFullRetention(s.schedule.full.retention);
  }, []);

  const loadAll = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [jobsRes, settingsRes, driveStatusRes] = await Promise.all([
          backupApi.getJobs(),
          backupApi.getSettings(),
          backupApi.getDriveStatus()
        ]);
        setJobs(jobsRes.jobs);
        setActiveTask(jobsRes.activeTask);
        setMaintenance(jobsRes.maintenance);
        setSettings(settingsRes);
        setConnectState(driveStatusRes.connect);
        if (!silent) {
          syncScheduleForm(settingsRes);
        }
        setErrorMsg(null);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [syncScheduleForm]
  );

  React.useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  // Poll when a backup/restore task or device flow is active
  const hasRunningJob = React.useMemo(
    () =>
      Boolean(activeTask) ||
      maintenance ||
      jobs.some((j) => j.status === 'RUNNING' || j.driveStatus === 'PENDING') ||
      connectState.status === 'pending',
    [activeTask, maintenance, jobs, connectState.status]
  );

  React.useEffect(() => {
    if (!hasRunningJob) return;
    const t = setInterval(() => {
      void loadAll(true);
    }, 2000);
    return () => clearInterval(t);
  }, [hasRunningJob, loadAll]);

  const handleToggleDriveCopy = async (nextEnabled: boolean) => {
    try {
      const updated = await backupApi.updateSettings({ driveEnabled: nextEnabled });
      setSettings(updated);
      showToast(
        nextEnabled
          ? 'Đã bật tự động lưu thêm 1 bản lên Google Drive.'
          : 'Đã tắt tự động lưu lên Google Drive.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStartBackup = async (kind: BackupKind) => {
    try {
      setErrorMsg(null);
      await backupApi.startBackup(kind, settings?.drive.enabled);
      showToast(`Đã bắt đầu sao lưu ${kindLabel(kind)}...`);
      await loadAll(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    setErrorMsg(null);
    try {
      const updated = await backupApi.updateSettings({
        schedule: {
          db: {
            enabled: dbEnabled,
            hour: Number(dbHour),
            minute: Number(dbMinute),
            retention: Number(dbRetention)
          },
          full: {
            enabled: fullEnabled,
            weekday: Number(fullWeekday),
            hour: Number(fullHour),
            minute: Number(fullMinute),
            retention: Number(fullRetention)
          }
        }
      });
      setSettings(updated);
      syncScheduleForm(updated);
      showToast('Đã lưu cấu hình lịch sao lưu tự động & chính sách lưu giữ.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSavePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphraseInput.length < 12) {
      setErrorMsg('Mật khẩu mã hóa phải có tối thiểu 12 ký tự.');
      return;
    }
    if (passphraseInput !== passphraseConfirm) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!confirmSavedOffline) {
      setErrorMsg('Vui lòng đánh dấu xác nhận bạn đã lưu mật khẩu ở nơi an toàn ngoài máy chủ.');
      return;
    }
    setSavingPassphrase(true);
    setErrorMsg(null);
    try {
      const updated = await backupApi.setPassphrase(passphraseInput, true);
      setSettings(updated);
      setPassphraseInput('');
      setPassphraseConfirm('');
      setConfirmSavedOffline(false);
      setShowPassphraseForm(false);
      showToast('Đã thiết lập mật khẩu mã hóa AES-256-GCM thành công.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPassphrase(false);
    }
  };

  const handleSaveDriveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCredentials(true);
    setErrorMsg(null);
    try {
      await backupApi.saveDriveCredentials(clientIdInput, clientSecretInput);
      setClientIdInput('');
      setClientSecretInput('');
      await loadAll(true);
      showToast('Đã lưu Client ID & Client Secret (mã hóa bằng khóa chủ).');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleStartDriveConnect = async () => {
    setErrorMsg(null);
    try {
      const res = await backupApi.startDriveConnect();
      setConnectState(res.connect);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCheckDrive = async () => {
    setCheckingDrive(true);
    setErrorMsg(null);
    try {
      const res = await backupApi.checkDriveConnection();
      showToast(`Kết nối Google Drive hoạt động tốt (${res.email || 'Đã xác thực'}).`);
      await loadAll(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (
      !window.confirm(
        'Ngắt kết nối Google Drive và xóa thông tin xác thực trên máy chủ? Các bản sao lưu đã tải lên Drive vẫn được giữ nguyên trên Drive của bạn.'
      )
    ) {
      return;
    }
    setErrorMsg(null);
    try {
      await backupApi.disconnectDrive();
      setDriveFiles([]);
      await loadAll(true);
      showToast('Đã ngắt kết nối Google Drive.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLoadDriveFiles = async () => {
    setLoadingDriveFiles(true);
    setErrorMsg(null);
    try {
      const res = await backupApi.listDriveFiles();
      setDriveFiles(res.files);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFile(true);
    setErrorMsg(null);
    try {
      const job = await backupApi.uploadBackupFile(file);
      showToast(`Đã tải lên bản sao lưu "${job.fileName}" thành công.`);
      await loadAll(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteJob = async (job: BackupJob) => {
    if (
      !window.confirm(
        `Xóa bản sao lưu "${job.fileName || job.id}"?${
          job.driveFileId ? ' Bản sao trên Google Drive cũng sẽ bị xóa.' : ''
        }`
      )
    ) {
      return;
    }
    setErrorMsg(null);
    try {
      await backupApi.deleteJob(job.id);
      showToast('Đã xóa bản sao lưu.');
      await loadAll(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRetryDrive = async (job: BackupJob) => {
    setErrorMsg(null);
    try {
      await backupApi.retryDriveUpload(job.id);
      showToast('Đã tải bản sao lưu lên Google Drive.');
      await loadAll(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      await loadAll(true);
    }
  };

  const openRestoreModal = (target: RestoreDialogTarget) => {
    const scopes = allowedScopesFor(target.availableKind);
    setRestoreTarget(target);
    setRestoreScope(scopes[0]);
    setRestoreConfirmName('');
    setRestoreCustomPassphrase('');
    setRestoreRunningJobId(null);
  };

  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreTarget) return;
    if (restoreConfirmName.trim() !== restoreTarget.fileName) {
      setErrorMsg('Tên file xác nhận chưa khớp chính xác.');
      return;
    }
    setSubmittingRestore(true);
    setErrorMsg(null);
    try {
      const pass = restoreCustomPassphrase.trim() || undefined;
      const res =
        restoreTarget.mode === 'job'
          ? await backupApi.restoreFromJob(restoreTarget.id, {
              scope: restoreScope,
              confirm: restoreConfirmName.trim(),
              passphrase: pass
            })
          : await backupApi.restoreFromDrive({
              fileId: restoreTarget.id,
              scope: restoreScope,
              confirm: restoreConfirmName.trim(),
              passphrase: pass
            });
      setRestoreRunningJobId(res.jobId);
      await loadAll(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingRestore(false);
    }
  };

  const activeRestoreJob = React.useMemo(
    () => (restoreRunningJobId ? jobs.find((j) => j.id === restoreRunningJobId) || null : null),
    [jobs, restoreRunningJobId]
  );

  if (loading && !settings) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
        Đang tải thông tin Sao lưu & Phục hồi hệ thống...
      </div>
    );
  }

  const canRunBackup = Boolean(
    settings?.masterKeyConfigured && settings?.passphraseSet && !activeTask && !maintenance
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-extrabold text-slate-900">
                Sao lưu & Phục hồi Hệ thống (Chỉ dành cho ADMIN)
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Sao lưu thủ công hoặc tự động theo lịch toàn bộ Database PostgreSQL và mã nguồn Website.
              Mọi bản sao lưu được mã hóa chuẩn <strong>AES-256-GCM</strong> trước khi lưu xuống đĩa
              hoặc đồng bộ lên Google Drive.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTask && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 border border-amber-300">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-700" />
                Đang chạy: {activeTask}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadAll(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {!settings?.masterKeyConfigured && (
          <div className="mt-4 rounded-lg border-2 border-red-300 bg-red-50 p-3.5 text-xs text-red-900">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <div className="font-extrabold">
                  Chưa cấu hình khóa chủ BACKUP_MASTER_KEY trên máy chủ!
                </div>
                <p className="mt-1">
                  Quản trị viên hệ thống cần đặt biến môi trường{' '}
                  <code className="rounded bg-red-100 px-1 py-0.5 font-mono">
                    BACKUP_MASTER_KEY
                  </code>{' '}
                  (32 byte base64, tạo bằng lệnh{' '}
                  <code className="rounded bg-red-100 px-1 py-0.5 font-mono">
                    openssl rand -base64 32
                  </code>
                  ) trong file <code className="font-mono">apps/backend/.env</code> rồi khởi động
                  lại dịch vụ để bật tính năng mã hóa mật khẩu và kết nối Google Drive.
                </p>
              </div>
            </div>
          </div>
        )}

        {settings?.masterKeyConfigured && !settings?.passphraseSet && (
          <div className="mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
            <div className="flex items-start gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <div className="font-extrabold">
                  Bước 1 bắt buộc: Vui lòng thiết lập Mật khẩu mã hóa sao lưu bên dưới
                </div>
                <p className="mt-0.5">
                  Bạn cần đặt mật khẩu mã hóa (tối thiểu 12 ký tự) trước khi tạo bản sao lưu đầu
                  tiên.
                </p>
              </div>
            </div>
          </div>
        )}

        {maintenance && (
          <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-3.5 text-xs font-bold text-amber-950">
            ⚠️ Hệ thống đang trong chế độ Bảo trì để phục hồi dữ liệu. Mọi thao tác của người dùng
            khác tạm thời nhận thông báo chờ (503) cho đến khi hoàn tất.
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-600 hover:text-red-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {toastMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* Section 1: Quick Backup Actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
              1. Hành động nhanh — Sao lưu ngay
            </h2>
            <p className="text-xs text-slate-500">
              Chọn phạm vi cần sao lưu. File tạo ra có định dạng{' '}
              <code className="font-mono">.cscc-backup</code> kèm manifest & SHA-256 checksum.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings?.drive.enabled)}
              disabled={!settings?.drive.connected}
              onChange={(e) => void handleToggleDriveCopy(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <Cloud className="h-4 w-4 text-blue-600" />
            <span>Lưu thêm 1 bản lên Google Drive</span>
            {!settings?.drive.connected && (
              <span className="text-[11px] font-normal text-slate-500">(Chưa kết nối Drive)</span>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1: Database */}
          <div className="flex flex-col justify-between rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-950">
                <Database className="h-4 w-4 text-blue-600" />
                <span>Sao lưu Database</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Toàn bộ dữ liệu PostgreSQL (<code className="font-mono">pg_dump -Fc</code>): tài
                khoản người dùng, khách hàng, báo giá, hồ sơ dự án, qui trình sơn & lịch sử phê
                duyệt.
              </p>
            </div>
            <button
              type="button"
              disabled={!canRunBackup}
              onClick={() => void handleStartBackup('DATABASE')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Sao lưu Database ngay
            </button>
          </div>

          {/* Card 2: Website */}
          <div className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-sm font-extrabold text-emerald-950">
                <Globe className="h-4 w-4 text-emerald-600" />
                <span>Sao lưu Website</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mã nguồn dự án, cấu hình môi trường <code className="font-mono">.env</code> và{' '}
                <code className="font-mono">deploy.sh</code> (tự động loại trừ{' '}
                <code className="font-mono">node_modules</code>, <code className="font-mono">dist</code>
                , <code className="font-mono">.git</code>).
              </p>
            </div>
            <button
              type="button"
              disabled={!canRunBackup}
              onClick={() => void handleStartBackup('WEBSITE')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Sao lưu Website ngay
            </button>
          </div>

          {/* Card 3: Full */}
          <div className="flex flex-col justify-between rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-sm font-extrabold text-indigo-950">
                <HardDrive className="h-4 w-4 text-indigo-600" />
                <span>Sao lưu Toàn bộ (Full)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Đóng gói cả Database và Website trong một file duy nhất. Khuyên dùng trước khi nâng
                cấp lớn hoặc để chuyển toàn bộ hệ thống sang máy chủ mới.
              </p>
            </div>
            <button
              type="button"
              disabled={!canRunBackup}
              onClick={() => void handleStartBackup('FULL')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Sao lưu Toàn bộ ngay
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Encryption Passphrase & Schedule side-by-side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Passphrase Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                2. Mật khẩu mã hóa bản sao lưu (AES-256-GCM)
              </h2>
            </div>
            {settings?.passphraseSet ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3 w-3" /> Đã thiết lập
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                Chưa đặt mật khẩu
              </span>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-1">
            <div className="font-bold">⚠️ Lưu ý quan trọng (Không có chức năng khôi phục mật khẩu):</div>
            <p>
              Mọi file sao lưu trên đĩa và trên Google Drive đều được khóa bằng mật khẩu này. Bạn{' '}
              <strong>bắt buộc phải ghi chép hoặc lưu mật khẩu vào trình quản lý mật khẩu bên ngoài máy chủ</strong>.
              Nếu máy chủ hỏng và bạn quên mật khẩu, dữ liệu trong bản sao lưu sẽ không thể giải mã.
            </p>
          </div>

          {settings?.passphraseSet && !showPassphraseForm ? (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-600">
                Đổi mật khẩu mới chỉ áp dụng cho các bản sao lưu tạo từ thời điểm đổi trở đi.
              </span>
              <button
                type="button"
                onClick={() => setShowPassphraseForm(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shrink-0"
              >
                Đổi mật khẩu mã hóa
              </button>
            </div>
          ) : (
            <form onSubmit={handleSavePassphrase} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu mã hóa (tối thiểu 12 ký tự)
                </label>
                <input
                  type="password"
                  value={passphraseInput}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  placeholder="Nhập mật khẩu ít nhất 12 ký tự..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  required
                  minLength={12}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nhập lại mật khẩu xác nhận
                </label>
                <input
                  type="password"
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                  placeholder="Nhập lại đúng mật khẩu ở trên..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  required
                  minLength={12}
                />
              </div>
              <label className="flex items-start gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmSavedOffline}
                  onChange={(e) => setConfirmSavedOffline(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>
                  Tôi xác nhận đã lưu mật khẩu này ở nơi an toàn bên ngoài máy chủ và hiểu rằng mất
                  mật khẩu sẽ không thể phục hồi bản sao lưu.
                </span>
              </label>
              {!settings?.masterKeyConfigured && (
                <div className="rounded bg-amber-50 border border-amber-300 p-2 text-xs text-amber-900 font-semibold">
                  ⚠️ Cần cấu hình BACKUP_MASTER_KEY trong file .env của backend để kích hoạt lưu mật khẩu.
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingPassphrase || !settings?.masterKeyConfigured}
                  title={
                    !settings?.masterKeyConfigured
                      ? 'Cần cấu hình BACKUP_MASTER_KEY trong file .env trước khi lưu'
                      : undefined
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingPassphrase ? 'Đang lưu...' : 'Lưu mật khẩu mã hóa'}
                </button>
                {settings?.passphraseSet && (
                  <button
                    type="button"
                    onClick={() => setShowPassphraseForm(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Automatic Schedule Card */}
        <form
          onSubmit={handleSaveSchedule}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                3. Lịch sao lưu tự động & Chính sách lưu giữ
              </h2>
            </div>
            <button
              type="submit"
              disabled={savingSchedule}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingSchedule ? 'Đang lưu...' : 'Lưu lịch tự động'}
            </button>
          </div>

          {/* Daily DB schedule */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-extrabold text-slate-800">
                Sao lưu Database hằng ngày
              </span>
              <input
                type="checkbox"
                checked={dbEnabled}
                onChange={(e) => setDbEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Giờ (0–23)
                </label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={dbHour}
                  onChange={(e) => setDbHour(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Phút (0–59)
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={dbMinute}
                  onChange={(e) => setDbMinute(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Số bản giữ lại
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={dbRetention}
                  onChange={(e) => setDbRetention(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Weekly Full schedule */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-extrabold text-slate-800">
                Sao lưu Toàn bộ (Full) hằng tuần
              </span>
              <input
                type="checkbox"
                checked={fullEnabled}
                onChange={(e) => setFullEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
            </label>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Ngày trong tuần
                </label>
                <select
                  value={fullWeekday}
                  onChange={(e) => setFullWeekday(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  {WEEKDAY_NAMES.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Giờ (0–23)
                </label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={fullHour}
                  onChange={(e) => setFullHour(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Phút (0–59)
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={fullMinute}
                  onChange={(e) => setFullMinute(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Số bản giữ lại
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={fullRetention}
                  onChange={(e) => setFullRetention(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Khi vượt quá số bản giữ lại, các bản sao lưu theo lịch cũ nhất sẽ tự động được dọn dẹp
            cả trên máy chủ và trên Google Drive. Các bản sao lưu thủ công được giữ nguyên cho tới
            khi bạn tự xóa.
          </p>
        </form>
      </div>

      {/* Section 3: Google Drive Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                4. Kết nối Google Drive (Lưu bản sao dự phòng ngoài máy chủ)
              </h2>
              <p className="text-xs text-slate-500">
                Sử dụng phạm vi an toàn <code className="font-mono">drive.file</code> — ứng dụng
                chỉ truy cập thư mục <strong>"CSCC Backups"</strong> do chính hệ thống tạo ra.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {settings?.drive.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Đã kết nối: {settings.drive.accountEmail || 'Google Drive'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Chưa kết nối
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowDriveGuide((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100"
            >
              <Info className="h-3.5 w-3.5" />
              {showDriveGuide ? 'Ẩn hướng dẫn 4 bước' : 'Hướng dẫn tạo OAuth Client (4 bước)'}
            </button>
          </div>
        </div>

        {settings?.drive.needsReconnect && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-950 font-semibold">
            ⚠️ Phiên kết nối Google Drive đã hết hạn hoặc bị thu hồi (invalid_grant). Vui lòng bấm{' '}
            <strong>"Kết nối bằng mã thiết bị"</strong> bên dưới để cấp quyền lại, và đảm bảo ứng
            dụng OAuth trên Google Cloud đã được chuyển sang trạng thái{' '}
            <strong>"In production" (Publish app)</strong> để token không bị hết hạn sau 7 ngày.
          </div>
        )}

        {showDriveGuide && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-slate-800 space-y-2">
            <div className="font-extrabold text-blue-950">
              Hướng dẫn tạo thông tin kết nối Google Cloud (Làm 1 lần ~10 phút, miễn phí):
            </div>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                Đăng nhập{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-700 underline"
                >
                  Google Cloud Console
                </a>{' '}
                bằng tài khoản Gmail muốn dùng để chứa bản sao lưu, tạo Project mới (ví dụ{' '}
                <strong>"CSCC Backup"</strong>) và bật <strong>Google Drive API</strong> trong mục{' '}
                <em>APIs & Services → Library</em>.
              </li>
              <li>
                Vào <em>APIs & Services → OAuth consent screen</em>: chọn <strong>External</strong>,
                điền tên ứng dụng, lưu lại, sau đó bấm <strong>Publish App</strong> để chuyển sang{' '}
                <strong>"In production"</strong> (phạm vi <code className="font-mono">drive.file</code>{' '}
                không nhạy cảm nên không cần Google xét duyệt; nếu để ở chế độ "Testing" thì token
                sẽ tự hết hạn sau 7 ngày).
              </li>
              <li>
                Vào <em>APIs & Services → Credentials → Create Credentials → OAuth client ID</em>:
                chọn loại <strong>TVs and Limited Input devices</strong>, rồi sao chép{' '}
                <strong>Client ID</strong> và <strong>Client Secret</strong>.
              </li>
              <li>
                Dán hai giá trị vào khung bên dưới, bấm <strong>Lưu cấu hình</strong>, sau đó bấm{' '}
                <strong>Kết nối bằng mã thiết bị</strong>, mở đường link của Google và nhập mã hiển
                thị trên màn hình. (Khi Google hiện thông báo "Ứng dụng chưa được Google xác minh",
                bấm <em>Nâng cao / Advanced → Tiếp tục</em> là bình thường đối với ứng dụng nội bộ
                của chính bạn).
              </li>
            </ol>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Step A: Client Credentials */}
          <form
            onSubmit={handleSaveDriveCredentials}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">
                Bước A: Cấu hình OAuth Client ID & Secret
              </span>
              {settings?.drive.configured && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Đã lưu (được mã hóa)
                </span>
              )}
            </div>
            {!settings?.masterKeyConfigured && (
              <div className="rounded bg-amber-50 border border-amber-300 p-2.5 text-xs text-amber-900 font-semibold space-y-1">
                <div>⚠️ Chưa cấu hình BACKUP_MASTER_KEY trong file .env của backend.</div>
                <div className="text-[11px] font-normal text-amber-800">
                  Vui lòng thêm biến môi trường <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">BACKUP_MASTER_KEY</code> vào file <code className="font-mono">apps/backend/.env</code> để server có thể mã hóa an toàn Client ID & Secret trước khi lưu.
                </div>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Client ID</label>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder={
                  settings?.drive.configured
                    ? 'Đã lưu — nhập mới nếu muốn thay đổi...'
                    : 'xxxx.apps.googleusercontent.com'
                }
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                value={clientSecretInput}
                onChange={(e) => setClientSecretInput(e.target.value)}
                placeholder={
                  settings?.drive.configured
                    ? 'Đã lưu — nhập mới nếu muốn thay đổi...'
                    : 'GOCSPX-...'
                }
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingCredentials || !settings?.masterKeyConfigured}
              title={
                !settings?.masterKeyConfigured
                  ? 'Cần cấu hình BACKUP_MASTER_KEY trong file .env trước khi lưu'
                  : undefined
              }
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {savingCredentials ? 'Đang lưu...' : 'Lưu Client ID & Secret'}
            </button>
          </form>

          {/* Step B: Device Flow & Actions */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-800">
                Bước B: Xác thực bằng Mã thiết bị (OAuth Device Flow)
              </div>

              {connectState.status === 'pending' && connectState.userCode && (
                <div className="rounded-lg border-2 border-blue-400 bg-white p-3 space-y-2">
                  <div className="text-xs text-slate-700">
                    1. Mở trang xác thực của Google và nhập mã dưới đây:
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded bg-slate-900 px-3 py-2 text-white">
                    <span className="font-mono text-base font-extrabold tracking-widest">
                      {connectState.userCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(connectState.userCode || '');
                        showToast('Đã sao chép mã thiết bị.');
                      }}
                      className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-[11px] font-bold hover:bg-slate-600"
                    >
                      <Copy className="h-3 w-3" /> Sao chép
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <a
                      href={connectState.verificationUrl || 'https://www.google.com/device'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Mở {connectState.verificationUrl || 'google.com/device'}
                    </a>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Đang chờ bạn xác nhận...
                    </span>
                  </div>
                </div>
              )}

              {(connectState.status === 'denied' ||
                connectState.status === 'expired' ||
                connectState.status === 'error') &&
                connectState.message && (
                  <div className="rounded border border-red-300 bg-red-50 p-2.5 text-xs text-red-800 font-semibold">
                    {renderErrorWithLinks(connectState.message)}
                  </div>
                )}

              {settings?.drive.connected && (
                <div className="text-xs text-slate-700 space-y-1">
                  <div>
                    Tài khoản đang liên kết:{' '}
                    <strong className="text-slate-900">
                      {settings.drive.accountEmail || 'Đã xác thực'}
                    </strong>
                  </div>
                  {settings.drive.folderId && (
                    <div className="text-[11px] text-slate-500">
                      Thư mục đích: <strong>CSCC Backups</strong> (ID: {settings.drive.folderId})
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                disabled={!settings?.drive.configured}
                onClick={() => void handleStartDriveConnect()}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {settings?.drive.connected
                  ? 'Kết nối lại bằng mã thiết bị'
                  : 'Kết nối bằng mã thiết bị'}
              </button>

              {settings?.drive.connected && (
                <>
                  <button
                    type="button"
                    disabled={checkingDrive}
                    onClick={() => void handleCheckDrive()}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {checkingDrive ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                  </button>
                  <button
                    type="button"
                    disabled={loadingDriveFiles}
                    onClick={() => void handleLoadDriveFiles()}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100"
                  >
                    {loadingDriveFiles ? 'Đang tải...' : 'Xem các bản trên Drive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisconnectDrive()}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    Ngắt kết nối
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Remote files on Drive (for restoring directly from Drive even on a fresh server) */}
        {driveFiles.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-slate-800">
                Các bản sao lưu hiện có trong thư mục "CSCC Backups" trên Google Drive (
                {driveFiles.length})
              </div>
              <button
                type="button"
                onClick={() => setDriveFiles([])}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Đóng danh sách
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                    <th className="py-1.5 pr-3">Tên file trên Drive</th>
                    <th className="py-1.5 pr-3">Thời gian tạo</th>
                    <th className="py-1.5 pr-3">Dung lượng</th>
                    <th className="py-1.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {driveFiles.map((df) => (
                    <tr key={df.id}>
                      <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                        {df.name}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {formatDateTime(df.createdTime)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{formatBytes(df.size)}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          disabled={Boolean(activeTask)}
                          onClick={() =>
                            openRestoreModal({
                              mode: 'drive',
                              id: df.id,
                              fileName: df.name,
                              availableKind: detectKindFromFileName(df.name)
                            })
                          }
                          className="inline-flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" /> Phục hồi từ Drive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Backup Jobs Table & Upload */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
              5. Danh sách bản sao lưu & Nhật ký thực hiện ({jobs.length})
            </h2>
            <p className="text-xs text-slate-500">
              Tải về máy cá nhân, tải lên bản sao lưu có sẵn, hoặc phục hồi hệ thống về một thời
              điểm bất kỳ.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".cscc-backup"
              onChange={(e) => void handleUploadFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingFile || Boolean(activeTask)}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingFile ? 'Đang tải lên...' : 'Tải lên bản sao lưu (.cscc-backup)'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                <th className="py-2 pr-3">Phạm vi / Tên file</th>
                <th className="py-2 pr-3">Nguồn tạo</th>
                <th className="py-2 pr-3">Thời gian</th>
                <th className="py-2 pr-3">Dung lượng</th>
                <th className="py-2 pr-3">Người thực hiện</th>
                <th className="py-2 pr-3">Trạng thái cục bộ</th>
                <th className="py-2 pr-3">Google Drive</th>
                <th className="py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Chưa có bản sao lưu nào. Hãy bấm "Sao lưu ngay" ở mục 1 để tạo bản sao lưu đầu
                    tiên.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const isRestoreRecord = job.trigger === 'RESTORE';
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 pr-3">
                        <div className="font-bold text-slate-900">{kindLabel(job.kind)}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {job.fileName ||
                            (job.manifest?.restoredFrom
                              ? `← ${job.manifest.restoredFrom}`
                              : job.id.slice(0, 8))}
                        </div>
                        {job.manifest?.database && (
                          <div className="text-[10px] text-slate-500">
                            DB: {job.manifest.database.tables} bảng •{' '}
                            {job.manifest.database.records} bản ghi
                          </div>
                        )}
                        {job.manifest?.instructions && (
                          <div className="mt-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] font-semibold text-amber-900">
                            {job.manifest.instructions}
                          </div>
                        )}
                        {job.error && (
                          <div className="mt-1 text-[11px] font-semibold text-red-600">
                            Lỗi: {renderErrorWithLinks(job.error)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-700">
                        {triggerLabel(job.trigger)}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {formatDateTime(job.startedAt)}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{formatBytes(job.sizeBytes)}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{job.createdBy}</td>
                      <td className="py-2.5 pr-3">
                        {job.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Thành công
                          </span>
                        ) : job.status === 'RUNNING' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Đang xử lý
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                            <AlertTriangle className="h-3 w-3" /> Thất bại
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {job.driveStatus === 'OK' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                            <Cloud className="h-3 w-3" /> Đã lên Drive
                          </span>
                        ) : job.driveStatus === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Đang tải lên
                          </span>
                        ) : job.driveStatus === 'FAILED' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                              Lỗi Drive
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleRetryDrive(job)}
                              className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 hover:bg-blue-100"
                            >
                              Thử lại
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">Chỉ lưu cục bộ</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {job.status === 'SUCCESS' && job.fileName && !isRestoreRecord && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void backupApi
                                    .downloadJob(job.id, job.fileName as string)
                                    .catch((err) =>
                                      setErrorMsg(
                                        err instanceof Error ? err.message : String(err)
                                      )
                                    )
                                }
                                title="Tải bản sao lưu về máy"
                                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                              >
                                <Download className="h-3 w-3" /> Tải về
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(activeTask)}
                                onClick={() =>
                                  openRestoreModal({
                                    mode: 'job',
                                    id: job.id,
                                    fileName: job.fileName as string,
                                    availableKind: job.kind
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                              >
                                <RotateCcw className="h-3 w-3" /> Phục hồi
                              </button>
                            </>
                          )}
                          {job.status !== 'RUNNING' && (
                            <button
                              type="button"
                              disabled={Boolean(activeTask)}
                              onClick={() => void handleDeleteJob(job)}
                              title="Xóa bản ghi"
                              className="inline-flex items-center rounded border border-red-200 bg-red-50 p-1 text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation & Progress Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <h3 className="text-base font-extrabold">
                  Xác nhận Phục hồi Hệ thống
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!activeRestoreJob ? (
              <form onSubmit={handleConfirmRestore} className="space-y-4 text-xs">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 space-y-1">
                  <div className="font-extrabold">Cơ chế an toàn tự động:</div>
                  <p>
                    Trước khi ghi đè, hệ thống sẽ tự động tạo một{' '}
                    <strong>bản sao lưu an toàn (PRE_RESTORE)</strong> và bật chế độ bảo trì. Nếu
                    quá trình phục hồi gặp bất kỳ lỗi nào, dữ liệu hiện tại sẽ được tự động hoàn
                    nguyên.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bản sao lưu nguồn:
                  </label>
                  <div className="rounded border border-slate-200 bg-slate-100 px-3 py-2 font-mono font-bold text-slate-900 break-all">
                    {restoreTarget.fileName}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chọn phạm vi muốn phục hồi:
                  </label>
                  <select
                    value={restoreScope}
                    onChange={(e) => setRestoreScope(e.target.value as BackupKind)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  >
                    {allowedScopesFor(restoreTarget.availableKind).map((sc) => (
                      <option key={sc} value={sc}>
                        {kindLabel(sc)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mật khẩu giải mã (để trống nếu dùng mật khẩu hiện tại của máy chủ):
                  </label>
                  <input
                    type="password"
                    value={restoreCustomPassphrase}
                    onChange={(e) => setRestoreCustomPassphrase(e.target.value)}
                    placeholder="Chỉ cần nhập nếu bản sao lưu này dùng mật khẩu cũ hoặc từ máy chủ khác..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-red-700 mb-1">
                    Nhập chính xác tên file ở trên để xác nhận phục hồi:
                  </label>
                  <input
                    type="text"
                    value={restoreConfirmName}
                    onChange={(e) => setRestoreConfirmName(e.target.value)}
                    placeholder={restoreTarget.fileName}
                    className="w-full rounded-lg border border-red-300 px-3 py-2 font-mono text-xs focus:border-red-600 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRestoreTarget(null)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submittingRestore || restoreConfirmName.trim() !== restoreTarget.fileName
                    }
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {submittingRestore ? 'Đang khởi chạy...' : 'Bắt đầu Phục hồi'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  {activeRestoreJob.status === 'RUNNING' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Đang thực hiện phục hồi dữ liệu...</span>
                    </>
                  ) : activeRestoreJob.status === 'SUCCESS' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-800">Phục hồi hoàn tất thành công!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-red-700">Phục hồi thất bại</span>
                    </>
                  )}
                </div>

                {activeRestoreJob.manifest?.steps && (
                  <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-700">
                    {activeRestoreJob.manifest.steps.map((s, idx) => (
                      <li key={idx}>• {s}</li>
                    ))}
                  </ul>
                )}

                {activeRestoreJob.manifest?.warnings &&
                  activeRestoreJob.manifest.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 space-y-1">
                      {activeRestoreJob.manifest.warnings.map((w, idx) => (
                        <div key={idx}>⚠️ {w}</div>
                      ))}
                    </div>
                  )}

                {activeRestoreJob.manifest?.instructions && (
                  <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 font-bold text-blue-950">
                    📌 Hướng dẫn tiếp theo: {activeRestoreJob.manifest.instructions}
                  </div>
                )}

                {activeRestoreJob.error && (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-3 font-bold text-red-800">
                    Chi tiết lỗi: {renderErrorWithLinks(activeRestoreJob.error)}
                  </div>
                )}

                {activeRestoreJob.status !== 'RUNNING' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setRestoreTarget(null)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      Đóng
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

