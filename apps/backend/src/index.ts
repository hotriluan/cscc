import { createApp } from './app';
import { dataStore } from './store/data-store';

const PORT = Number(process.env.PORT) || 4000;

async function bootstrap() {
  const counts = await dataStore.init();
  const app = createApp();
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
