import './env';
import { createApp } from './app';
import { recoverInterruptedTasks } from './services/backup/restore.service';
import { startScheduler } from './services/backup/scheduler';
import { autoDetectAndSeedDriveCredentials } from './services/backup/settings.service';
import { dataStore } from './store/data-store';

const PORT = Number(process.env.PORT) || 4000;

async function bootstrap() {
  const counts = await dataStore.init();
  await autoDetectAndSeedDriveCredentials().catch((err) => {
    console.error('[CSCC Backend] Auto-detect Drive credentials error:', err instanceof Error ? err.message : err);
  });
  const interrupted = await recoverInterruptedTasks().catch((err) => {
    console.error('[CSCC Backend] Backup recovery check failed:', err instanceof Error ? err.message : err);
    return 0;
  });
  if (interrupted > 0) {
    console.warn(`[CSCC Backend] ${interrupted} backup/restore task(s) were interrupted and marked FAILED.`);
  }
  const app = createApp();
  startScheduler();
  app.listen(PORT, () => {
    console.log(
      `[CSCC Backend - PostgreSQL] Listening on http://localhost:${PORT} (Customers: ${counts.customers}, Quotations: ${counts.quotations}, Revisions: ${counts.revisions})`
    );
  });
}

bootstrap().catch((err) => {
  console.error('[CSCC Backend] Fatal startup error:', err);
  process.exit(1);
});
