import { runBackup } from './backup.service';
import { BackupKind } from './manifest';
import { getSettingRow, getPassphrase } from './settings.service';
import { BackupBusyError } from './task-lock';

const TICK_MS = 30_000;
let timer: NodeJS.Timeout | null = null;
const fired = new Set<string>();

function minuteKey(kind: string, now: Date): string {
  return `${kind}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
}

/** Starts any backup whose configured time matches `now` (once per minute per kind). */
export async function runDueBackups(now: Date = new Date()): Promise<BackupKind[]> {
  const s = await getSettingRow();
  const due: BackupKind[] = [];
  if (s.dbScheduleEnabled && now.getHours() === s.dbScheduleHour && now.getMinutes() === s.dbScheduleMinute) {
    due.push('DATABASE');
  }
  if (
    s.fullScheduleEnabled &&
    now.getDay() === s.fullScheduleWeekday &&
    now.getHours() === s.fullScheduleHour &&
    now.getMinutes() === s.fullScheduleMinute
  ) {
    due.push('FULL');
  }
  const started: BackupKind[] = [];
  for (const kind of due) {
    const key = minuteKey(kind, now);
    if (fired.has(key)) continue;
    fired.add(key);
    if (fired.size > 50) fired.delete(fired.values().next().value as string);
    try {
      await getPassphrase();
      await runBackup(kind, 'SCHEDULE', 'system');
      started.push(kind);
    } catch (err) {
      if (err instanceof BackupBusyError) {
        console.warn(`[backup] scheduled ${kind} skipped: ${err.message}`);
      } else {
        console.error(`[backup] scheduled ${kind} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }
  return started;
}

/** The schedule is re-read from settings on every tick, so edits apply without a restart. */
export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    runDueBackups().catch((e) => console.error('[backup] scheduler error:', e instanceof Error ? e.message : e));
  }, TICK_MS);
  timer.unref();
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

