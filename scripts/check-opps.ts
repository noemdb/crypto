import { prisma } from "../lib/db/prisma";

async function main() {
  const opps = await prisma.opportunity.findMany({
    select: {
      route: true,
      classification: true,
      roiAdjusted: true,
      evaluatedAt: true
    },
    orderBy: { evaluatedAt: "desc" },
    take: 10
  });
  console.log("Latest Opportunities:", JSON.stringify(opps, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
