import { prisma } from "../lib/db/prisma";

async function main() {
  console.log("Cleaning all opportunities and snapshots...");
  await prisma.opportunity.deleteMany();
  await prisma.marketSnapshot.deleteMany();
  console.log("✅ Database cleaned!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
