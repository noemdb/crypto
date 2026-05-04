import { prisma } from "../lib/db/prisma";

async function main() {
  const count = await prisma.marketSnapshot.count();
  console.log("MarketSnapshots count:", count);
  
  const opps = await prisma.opportunity.count();
  console.log("Opportunities count:", opps);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
