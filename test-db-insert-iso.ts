import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './lib/db/prisma';
async function run() {
  const d = new Date();
  console.log('Inserting Date:', d.toISOString());
  const inserted = await prisma.priceRecord.create({
    data: {
      platform: 'test',
      asset: 'TEST',
      baseCurrency: 'USD',
      priceMin: 1,
      priceMax: 1,
      priceMid: 1,
      recordedAt: d.toISOString(),
    }
  });
  console.log('Returned from insert:', inserted.recordedAt.toISOString());
  await prisma.priceRecord.deleteMany({ where: { platform: 'test' } });
}
run();
