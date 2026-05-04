import { PrismaClient } from '@prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('[db] DATABASE_URL is not set')

  // PrismaNeonHttp types require 2 args but JS only needs the connection string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new (PrismaNeonHttp as any)(url)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends(withAccelerate())
}

// Lazy getter — evaluated on first access, not at module parse time
function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma: ReturnType<typeof createPrismaClient> = new Proxy(
  {} as ReturnType<typeof createPrismaClient>,
  {
    get(_target, prop) {
      return getPrisma()[prop]
    },
  },
)
