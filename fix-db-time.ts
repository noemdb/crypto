import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './lib/db/prisma';

async function run() {
  console.log('Updating PriceRecord...');
  // Add 4 hours to all PriceRecord that were recorded before we pushed the fix
  const cutoff = new Date('2026-05-27T11:27:00.000Z');
  
  const res1 = await prisma.$executeRaw`
    UPDATE "PriceRecord"
    SET "recordedAt" = "recordedAt" + interval '4 hours'
    WHERE "recordedAt" < '2026-05-27T11:27:00.000Z';
  `;
  console.log(`Updated ${res1} PriceRecords`);

  const res2 = await prisma.$executeRaw`
    UPDATE "Opportunity"
    SET "evaluatedAt" = "evaluatedAt" + interval '4 hours'
    WHERE "evaluatedAt" < '2026-05-27T11:27:00.000Z';
  `;
  console.log(`Updated ${res2} Opportunities`);
}
run();
