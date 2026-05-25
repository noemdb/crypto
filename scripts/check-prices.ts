import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "../lib/db/prisma";

async function main() {
  const records = await prisma.priceRecord.findMany({
    orderBy: { recordedAt: "desc" },
    take: 5,
  });

  console.log("Last 5 PriceRecord entries:");
  console.log(JSON.stringify(records, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
