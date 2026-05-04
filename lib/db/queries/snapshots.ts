import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export async function getRecentSnapshots(
  platform: string,
  asset: string,
  withinMs: number,
) {
  const since = new Date(Date.now() - withinMs)
  return prisma.marketSnapshot.findMany({
    where: { platform, asset, scrapedAt: { gte: since } },
    orderBy: { scrapedAt: 'desc' },
    take: 1,
  })
}

export async function insertSnapshot(data: Prisma.MarketSnapshotCreateInput) {
  return prisma.marketSnapshot.create({ data })
}

export async function getAllFreshSnapshots() {
  // El TTL máximo es 180s (kontigo/airtm). Pedimos snapshots de los últimos 200s
  // El engine filtrará por TTL específico de cada plataforma
  const since = new Date(Date.now() - 200_000);

  const records = await prisma.marketSnapshot.findMany({
    where: { scrapedAt: { gte: since } },
    orderBy: { scrapedAt: "desc" },
    // Tomar solo el snapshot más reciente por (platform, asset)
    distinct: ["platform", "asset"],
  });

  return records;
}
