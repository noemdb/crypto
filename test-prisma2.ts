import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from './lib/db/prisma';

async function main() {
  const data = await prisma.priceRecord.findMany({
    where: {
      platform: 'binance_p2p_ves',
      asset: 'USDT',
      paymentMethod: 'BancoDeVenezuela'
    },
    orderBy: { recordedAt: 'desc' },
    take: 5,
    select: {
      priceMin: true,
      priceMax: true,
      priceMid: true,
      recordedAt: true
    }
  });

  console.log(data);
}

main().catch(console.error);
