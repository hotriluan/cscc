import { dataStore } from '../store/data-store';

async function run() {
  const mode = (process.argv[2] || 'seed').toLowerCase();
  const forceReset = mode === 'reset' || process.argv.includes('--reset');

  console.log(
    `[CSCC DB CLI] Running mode="${forceReset ? 'reset' : 'seed'}" on PostgreSQL...`
  );

  const counts = await dataStore.init(forceReset);
  console.log('[CSCC DB CLI] Completed successfully:', counts);
  await dataStore.disconnect();
}

run().catch(async (err) => {
  console.error('[CSCC DB CLI] Error:', err);
  await dataStore.disconnect().catch(() => undefined);
  process.exit(1);
});

