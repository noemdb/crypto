import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './lib/db/prisma';
async function run() {
  const res = await prisma.$queryRaw`SELECT current_setting('TIMEZONE') as tz;`;
  console.log('Database timezone:', res);
}
run();
