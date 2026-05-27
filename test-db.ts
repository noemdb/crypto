import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './lib/db/prisma';
async function run() {
  const latest = await prisma.priceRecord.findFirst({ orderBy: { recordedAt: 'desc' }});
  console.log('DB recordedAt:', latest?.recordedAt.toISOString());
  console.log('Is it UTC?', latest?.recordedAt.toUTCString());
}
run();
