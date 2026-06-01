const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const countNull = await prisma.priceRecord.count({ where: { paymentMethod: null } });
  const countPM = await prisma.priceRecord.count({ where: { paymentMethod: { not: null } } });
  const groupPM = await prisma.priceRecord.groupBy({
    by: ['paymentMethod'],
    _count: { id: true }
  });
  console.log("Count null:", countNull);
  console.log("Count PM:", countPM);
  console.log("Group PM:", groupPM);
}
main().finally(() => prisma.$disconnect());
