'use server'

import { getAuthenticatedUserId } from '@/lib/auth-helpers'
import { getPriceHistory, getPriceExtremes } from '@/lib/db/queries/price-records'
import { getOrCreateDefaultUserConfig } from '@/lib/db/queries/user-config'
import { prisma } from '@/lib/db/prisma'

import type { TimeRangeKey } from '@/lib/price-monitor/constants'
import { TIME_RANGES } from '@/lib/price-monitor/constants'

// ── getPriceChartData ─────────────────────────────────────────────────────────

export type PriceChartData = {
  points: Array<{
    time: string       // ISO string para el eje X
    priceMin: number
    priceMax: number
    priceMid: number
  }>
  extremes: {
    absoluteMin: number | null
    absoluteMax: number | null
    average: number | null
    dataPoints: number
  }
  platform: string
  asset: string
  baseCurrency: string
  rangeKey: TimeRangeKey
}

export async function getPriceChartData(
  platform: string,
  asset: string,
  rangeKey: TimeRangeKey,
  _cacheBuster?: string | null,
): Promise<PriceChartData | null> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null

  const hours = TIME_RANGES[rangeKey].hours
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const [history, extremes] = await Promise.all([
    getPriceHistory({ platform, asset, since }),
    getPriceExtremes({ platform, asset, since }),
  ])

  // Detectar baseCurrency del registro más reciente disponible
  const baseCurrencyRecord = await prisma.priceRecord.findFirst({
    where: { platform, asset },
    orderBy: { recordedAt: 'desc' },
    select: { baseCurrency: true },
  })

  return {
    points: history.map(r => ({
      time: r.recordedAt.toISOString(),
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      priceMid: r.priceMid,
    })),
    extremes,
    platform,
    asset,
    baseCurrency: baseCurrencyRecord?.baseCurrency ?? 'USD',
    rangeKey,
  }
}

// ── getMonitorSummary ─────────────────────────────────────────────────────────

export type MonitorSummary = {
  platform: string
  asset: string
  baseCurrency: string
  currentMin: number | null
  currentMax: number | null
  lastRecordedAt: string | null
  change24hPct: number | null
}

export async function getMonitorSummary(): Promise<MonitorSummary[]> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return []

  const config = await getOrCreateDefaultUserConfig(userId)
  const platforms = config.monitorPlatforms
  const assets    = config.monitorAssets
  const summary: MonitorSummary[] = []

  for (const platform of platforms) {
    for (const asset of assets) {
      const [latest, prev24h] = await Promise.all([
        prisma.priceRecord.findFirst({
          where: { platform, asset },
          orderBy: { recordedAt: 'desc' },
        }),
        prisma.priceRecord.findFirst({
          where: {
            platform,
            asset,
            recordedAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { recordedAt: 'desc' },
        }),
      ])

      let change24hPct: number | null = null
      if (latest && prev24h && prev24h.priceMid > 0) {
        change24hPct = ((latest.priceMid - prev24h.priceMid) / prev24h.priceMid) * 100
      }

      summary.push({
        platform,
        asset,
        baseCurrency: latest?.baseCurrency ?? 'USD',
        currentMin: latest?.priceMin ?? null,
        currentMax: latest?.priceMax ?? null,
        lastRecordedAt: latest?.recordedAt.toISOString() ?? null,
        change24hPct,
      })
    }
  }

  return summary
}

// ── updateMonitorConfig ───────────────────────────────────────────────────────

export type MonitorConfigUpdate = {
  monitorEnabled: boolean
  monitorPlatforms: string[]
  monitorAssets: string[]
  priceChangeThresholdPct: number
  priceAlertThresholdPct: number
  priceAlertEnabled: boolean
}

export async function updateMonitorConfig(
  input: MonitorConfigUpdate,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { success: false, error: 'No autenticado' }

  await prisma.userConfig.update({
    where: { userId },
    data: {
      monitorEnabled:          input.monitorEnabled,
      monitorPlatforms:        input.monitorPlatforms,
      monitorAssets:           input.monitorAssets,
      priceChangeThresholdPct: input.priceChangeThresholdPct,
      priceAlertThresholdPct:  input.priceAlertThresholdPct,
      priceAlertEnabled:       input.priceAlertEnabled,
    },
  })

  return { success: true }
}
