import { prisma } from '../store/prisma';

async function main() {
  console.log('[CSCC DB CLI] Cleaning all customers from PostgreSQL database...');
  const countBefore = await prisma.customer.count();
  console.log(`[CSCC DB CLI] Found ${countBefore} customers in database.`);

  const res = await prisma.customer.deleteMany();
  console.log(`[CSCC DB CLI] Successfully deleted ${res.count} customers.`);

  const countAfter = await prisma.customer.count();
  console.log(`[CSCC DB CLI] Current customers count: ${countAfter}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[CSCC DB CLI] Error cleaning customers:', err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

