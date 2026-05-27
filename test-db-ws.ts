import { config } from 'dotenv';
config({ path: '.env' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });
  
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
      recordedAt: d,
    }
  });
  console.log('Returned from insert:', inserted.recordedAt.toISOString());
  await prisma.priceRecord.deleteMany({ where: { platform: 'test' } });
}
run();
