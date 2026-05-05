import { prisma } from "../lib/db/prisma";

async function main() {
  const statuses = await prisma.platformStatus.findMany();
  console.log(JSON.stringify(statuses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
