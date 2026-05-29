import { prisma } from '@/lib/db/prisma'

// Insertar nuevo registro de precio
export async function insertPriceRecord(data: {
  platform: string
  asset: string
  baseCurrency: string
  paymentMethod?: string | null
  priceMin: number
  priceMax: number
  priceMid: number
}) {
  return prisma.priceRecord.create({ 
    data: {
      ...data,
      recordedAt: new Date().toISOString(),
    }
  })
}

// Obtener el último registro de una plataforma/asset (opcionalmente por método de pago)
export async function getLastPriceRecord(
  platform: string,
  asset: string,
  paymentMethod?: string | null,
) {
  return prisma.priceRecord.findFirst({
    where: {
      platform,
      asset,
      paymentMethod: paymentMethod !== undefined ? paymentMethod : null,
    },
    orderBy: { recordedAt: 'desc' },
  })
}

// Obtener registros dentro de una ventana de tiempo (para el gráfico)
export async function getPriceHistory(opts: {
  platform: string
  asset: string
  since: Date
  until?: Date
  paymentMethod?: string | null
}) {
  return prisma.priceRecord.findMany({
    where: {
      platform: opts.platform,
      asset: opts.asset,
      paymentMethod: opts.paymentMethod !== undefined ? opts.paymentMethod : null,
      recordedAt: {
        gte: opts.since,
        ...(opts.until ? { lte: opts.until } : {}),
      },
    },
    orderBy: { recordedAt: 'asc' },
    select: {
      recordedAt: true,
      priceMin: true,
      priceMax: true,
      priceMid: true,
    },
  })
}

// Obtener mínimo absoluto y máximo absoluto dentro de una ventana
export async function getPriceExtremes(opts: {
  platform: string
  asset: string
  since: Date
  paymentMethod?: string | null
}) {
  const where = {
    platform: opts.platform,
    asset: opts.asset,
    paymentMethod: opts.paymentMethod !== undefined ? opts.paymentMethod : null,
    recordedAt: { gte: opts.since },
  }

  const [minRow, maxRow, agg] = await Promise.all([
    prisma.priceRecord.findFirst({
      where,
      orderBy: { priceMin: 'asc' },
      select: { priceMin: true, recordedAt: true },
    }),
    prisma.priceRecord.findFirst({
      where,
      orderBy: { priceMax: 'desc' },
      select: { priceMax: true, recordedAt: true },
    }),
    prisma.priceRecord.aggregate({
      where,
      _avg: { priceMid: true },
      _count: { id: true },
    }),
  ])

  return {
    absoluteMin: minRow?.priceMin ?? null,
    absoluteMinTime: minRow?.recordedAt ?? null,
    absoluteMax: maxRow?.priceMax ?? null,
    absoluteMaxTime: maxRow?.recordedAt ?? null,
    average: agg._avg.priceMid,
    dataPoints: agg._count.id,
  }
}

// Retención: eliminar registros más viejos de 3 meses
export async function pruneOldPriceRecords() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const result = await prisma.priceRecord.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  })
  return result.count
}

