import { SCRAPERS } from '@/lib/scrapers'
import type { Platform } from '@/lib/schemas'
import {
  insertPriceRecord,
  getLastPriceRecord,
} from '@/lib/db/queries/price-records'
import { shouldRecord, calculateChangePct } from './alert-threshold'
import { sendPriceAlert } from '@/lib/alerts/telegram'
import { markPlatformHealthy, markPlatformError } from '@/lib/db/queries/platform-status'
import type { UserConfig } from '@/lib/schemas'

export type PriceMonitorResult = {
  platform: string
  asset: string
  recorded: boolean
  alerted: boolean
  priceMin: number
  priceMax: number
  changePct: number
  reason?: string
}

export async function runPriceMonitor(
  config: UserConfig,
): Promise<PriceMonitorResult[]> {
  if (!config.monitorEnabled) return []

  const results: PriceMonitorResult[] = []

  const platforms = config.monitorPlatforms
  const assets = config.monitorAssets

  for (const platform of platforms) {
    // Type-safe: solo llamar scrapers registrados
    const scraper = SCRAPERS[platform as Platform]
    if (!scraper) {
      console.warn(`[price-monitor] No scraper found for platform: ${platform}`)
      continue
    }

    for (const asset of assets) {
      if (!scraper.supportedAssets.includes(asset as any)) continue

      try {
        // 1. Obtener precio actual del scraper existente
        const { snapshot } = await scraper.scrape(asset as any)

        const priceMin = snapshot.priceBid ?? snapshot.price
        const priceMax = snapshot.priceAsk ?? snapshot.price
        const priceMid = snapshot.price

        // 2. Comparar con último registro
        const last = await getLastPriceRecord(platform, asset)

        const changeThreshold = config.priceChangeThresholdPct ?? 1.0
        const alertThreshold = config.priceAlertThresholdPct ?? 2.0

        const shouldSave =
          !last ||
          shouldRecord(
            priceMin,
            priceMax,
            last.priceMin,
            last.priceMax,
            changeThreshold,
          )

        let recorded = false
        let alerted = false
        let changePct = 0

        if (last) {
          changePct = Math.max(
            Math.abs(calculateChangePct(priceMin, last.priceMin)),
            Math.abs(calculateChangePct(priceMax, last.priceMax)),
          )
        }

        // 3. Guardar si supera threshold de cambio
        if (shouldSave) {
          await insertPriceRecord({
            platform,
            asset,
            baseCurrency: snapshot.baseCurrency,
            priceMin,
            priceMax,
            priceMid,
          })
          recorded = true
          await markPlatformHealthy(platform)
        }

        // 4. Alertar si supera threshold de alerta Y hay Telegram configurado
        if (
          shouldSave &&
          changePct >= alertThreshold &&
          config.priceAlertEnabled &&
          config.alertTelegram
        ) {
          await sendPriceAlert({
            chatId: config.alertTelegram,
            platform,
            asset,
            priceMin,
            priceMax,
            changePct,
            direction: priceMin > (last?.priceMin ?? priceMin) ? 'up' : 'down',
          })
          alerted = true
        }

        results.push({
          platform,
          asset,
          recorded,
          alerted,
          priceMin,
          priceMax,
          changePct,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        await markPlatformError(platform, error)
        results.push({
          platform,
          asset,
          recorded: false,
          alerted: false,
          priceMin: 0,
          priceMax: 0,
          changePct: 0,
          reason: error,
        })
      }
    }
  }

  return results
}
