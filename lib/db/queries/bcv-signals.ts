import { prisma } from '@/lib/db/prisma'

export async function getLatestBCVRate() {
  return prisma.bCVRate.findFirst({ orderBy: { collectedAt: 'desc' } })
}

export async function getBCVRateHistory(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return prisma.bCVRate.findMany({
    where: { collectedAt: { gte: since } },
    orderBy: { date: 'asc' },
  })
}

export async function getActiveIntelSignals() {
  const now = new Date()
  return prisma.intelSignal.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { score: 'desc' },
    take: 30,
  })
}

export async function getActiveBankingWindows() {
  return prisma.bankingWindow.findMany({
    where: { isActive: true },
    orderBy: { detectedAt: 'desc' },
  })
}
