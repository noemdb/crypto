import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export async function insertOpportunity(data: Prisma.OpportunityCreateInput) {
  return prisma.opportunity.create({ data })
}

export async function getOpportunities(opts: {
  classification?: string
  limit?: number
  cursor?: string
  since?: Date
}) {
  const { classification, limit = 20, cursor, since } = opts

  return prisma.opportunity.findMany({
    where: {
      ...(classification && classification !== 'ALL' ? { classification } : {}),
      ...(since ? { evaluatedAt: { gte: since } } : {}),
    },
    orderBy: { evaluatedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

export async function getOpportunityStats(opts: { days: number, minROI: number }) {
  const since = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)
  return prisma.opportunity.findMany({
    where: { 
      evaluatedAt: { gte: since }, 
      roiAdjusted: { gte: opts.minROI } 
    },
    select: {
      evaluatedAt: true,
      roiAdjusted: true,
      route: true,
      fillProbability: true,
    },
    orderBy: { evaluatedAt: "asc" },
  })
}
export async function getClassificationDistByPlatform(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = (await prisma.opportunity.groupBy({
    by: ["buyPlatform", "classification"],
    where: { evaluatedAt: { gte: since } },
    _count: { id: true },
  })) as any[];

  // Pivot: platform → { EXECUTABLE, MARGINAL, INVALID }
  const pivot: Record<
    string,
    { name: string; EXECUTABLE: number; MARGINAL: number; INVALID: number }
  > = {};

  for (const row of rows) {
    if (!pivot[row.buyPlatform]) {
      pivot[row.buyPlatform] = {
        name: row.buyPlatform,
        EXECUTABLE: 0,
        MARGINAL: 0,
        INVALID: 0,
      };
    }
    const classification = row.classification as
      | "EXECUTABLE"
      | "MARGINAL"
      | "INVALID";
    if (classification in pivot[row.buyPlatform]!) {
      pivot[row.buyPlatform]![classification] = row._count.id;
    }
  }

  return Object.values(pivot);
}
