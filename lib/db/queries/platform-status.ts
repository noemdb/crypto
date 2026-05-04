import { prisma } from '@/lib/db/prisma'

export async function markPlatformHealthy(platform: string) {
  return prisma.platformStatus.upsert({
    where: { platform },
    update: {
      isHealthy: true,
      lastSuccessAt: new Date(),
      consecutiveErrors: 0,
      errorMessage: null,
    },
    create: {
      platform,
      isHealthy: true,
      lastSuccessAt: new Date(),
      consecutiveErrors: 0,
    },
  })
}

export async function markPlatformError(platform: string, error: string) {
  const current = await prisma.platformStatus.findUnique({ where: { platform } })
  const consecutiveErrors = (current?.consecutiveErrors ?? 0) + 1

  return prisma.platformStatus.upsert({
    where: { platform },
    update: {
      isHealthy: consecutiveErrors < 3,
      lastErrorAt: new Date(),
      errorMessage: error,
      consecutiveErrors,
    },
    create: {
      platform,
      isHealthy: false,
      lastErrorAt: new Date(),
      errorMessage: error,
      consecutiveErrors: 1,
    },
  })
}

export async function getAllPlatformStatuses() {
  return prisma.platformStatus.findMany({ orderBy: { platform: 'asc' } })
}
