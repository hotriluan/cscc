/** Global one-at-a-time guard shared by backup, restore and Drive transfers. */

export class BackupBusyError extends Error {
  constructor(public readonly activeTask: string) {
    super(`Đang có tác vụ sao lưu/phục hồi khác chạy (${activeTask}). Vui lòng thử lại sau.`);
    this.name = 'BackupBusyError';
  }
}

let active: string | null = null;

export function activeTask(): string | null {
  return active;
}

export async function withTaskLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (active) throw new BackupBusyError(active);
  active = label;
  try {
    return await fn();
  } finally {
    active = null;
  }
}

/** Acquire without running a callback; caller must call the returned release function. */
export function acquireTaskLock(label: string): () => void {
  if (active) throw new BackupBusyError(active);
  active = label;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      active = null;
    }
  };
}

