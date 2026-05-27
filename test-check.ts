import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './lib/db/prisma';
async function run() {
  const records = await prisma.priceRecord.findMany({ orderBy: { recordedAt: 'desc' }, take: 5 });
  records.forEach(r => console.log(r.recordedAt.toISOString()));
}
run();
