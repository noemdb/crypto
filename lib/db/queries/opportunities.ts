import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export async function insertOpportunity(data: Prisma.OpportunityCreateInput) {
  return prisma.opportunity.create({ data })
}

export async function getOpportunities(opts: {
  classification?: string | undefined
  asset?: string | undefined
  minROI?: number | undefined
  search?: string | undefined
  limit?: number | undefined
  cursor?: string | undefined
  since?: Date | undefined
  sortBy?: 'evaluatedAt' | 'roiAdjusted' | 'fillProbability' | undefined
  sortOrder?: 'asc' | 'desc' | undefined
}) {
  const { 
    classification, 
    asset, 
    minROI, 
    search, 
    limit = 20, 
    cursor, 
    since,
    sortBy = 'evaluatedAt',
    sortOrder = 'desc'
  } = opts

  return prisma.opportunity.findMany({
    where: {
      ...(classification && classification !== 'ALL' ? { classification } : {}),
      ...(asset && asset !== 'ALL' ? { asset } : {}),
      ...(minROI !== undefined ? { roiAdjusted: { gte: minROI } } : {}),
      ...(since ? { evaluatedAt: { gte: since } } : {}),
      ...(search ? {
        OR: [
          { route: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { buyPlatform: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { sellPlatform: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
        ]
      } : {}),
    },
    orderBy: { [sortBy]: sortOrder },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

export async function getOpportunityStats(opts: { since: Date, minROI: number }) {
  return prisma.opportunity.findMany({
    where: { 
      evaluatedAt: { gte: opts.since }, 
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
export async function getClassificationDistByPlatform(since: Date) {

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
