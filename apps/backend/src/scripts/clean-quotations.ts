import { prisma } from '../store/prisma';

async function main() {
  console.log('[CSCC DB CLI] Cleaning all quotation items from PostgreSQL database...');
  const countBefore = await prisma.quotationItem.count();
  console.log(`[CSCC DB CLI] Found ${countBefore} quotation items in database.`);

  const res = await prisma.quotationItem.deleteMany();
  console.log(`[CSCC DB CLI] Successfully deleted ${res.count} quotation items.`);

  const countAfter = await prisma.quotationItem.count();
  console.log(`[CSCC DB CLI] Current quotation items count: ${countAfter}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[CSCC DB CLI] Error cleaning quotations:', err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

