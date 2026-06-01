import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from './lib/db/prisma';

async function main() {
  const data = await prisma.priceRecord.findMany({
    where: {
      platform: 'binance_p2p_ves',
      asset: 'USDT'
    },
    orderBy: { recordedAt: 'desc' },
    take: 10,
    select: {
      paymentMethod: true,
      priceMid: true,
      recordedAt: true
    }
  });

  console.log(data);
}

main().catch(console.error);
