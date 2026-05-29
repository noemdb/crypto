import { SCRAPERS } from '@/lib/scrapers'
import { scrapeBinanceP2PByPaymentMethod } from '@/lib/scrapers/binance-p2p'
import type { Platform } from '@/lib/schemas'
import {
  insertPriceRecord,
  getLastPriceRecord,
} from '@/lib/db/queries/price-records'
import { shouldRecord, calculateChangePct } from './alert-threshold'
import { sendPriceAlert } from '@/lib/alerts/telegram'
import { markPlatformHealthy, markPlatformError } from '@/lib/db/queries/platform-status'
import type { UserConfig } from '@/lib/schemas'

// Métodos de pago populares de Binance P2P Venezuela que se rastrean individualmente
export const POPULAR_PAYMENT_METHODS = [
  { id: 'PagoMovil',        label: 'Pago Movil' },
  { id: 'Banesco',          label: 'Banesco' },
  { id: 'BancoDeVenezuela', label: 'Banco de Venezuela' },
  { id: 'BANK',             label: 'Bank Transfer' },
  { id: 'Mercantil',        label: 'Mercantil' },
] as const

export type PaymentMethodId = typeof POPULAR_PAYMENT_METHODS[number]['id']

export type PriceMonitorResult = {
  platform: string
  asset: string
  paymentMethod: string | null
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

      // Función auxiliar para procesar un snapshot (general o por método de pago)
      async function processSnapshot(
        paymentMethod: string | null,
        getSnapshot: () => Promise<{ snapshot: import('@/lib/schemas').RawSnapshotInput }>
      ) {
        try {
          const { snapshot } = await getSnapshot()

          const priceMid = snapshot.price
          const priceMin = snapshot.priceBid ?? priceMid
          const priceMax = snapshot.priceAsk ?? priceMid

          const last = await getLastPriceRecord(platform, asset, paymentMethod)

          const changeThreshold = config.priceChangeThresholdPct ?? 0.1
          const alertThreshold = config.priceAlertThresholdPct ?? 2.0

          const maxSilenceMs = ((config.scanIntervalSeconds ?? 180) * 2) * 1000
          const lastAge = last
            ? Date.now() - new Date(last.recordedAt).getTime()
            : Infinity
          const forceByAge = lastAge >= maxSilenceMs

          const shouldSave =
            !last ||
            forceByAge ||
            shouldRecord(priceMin, priceMax, last.priceMin, last.priceMax, changeThreshold)

          let recorded = false
          let alerted = false
          let changePct = 0

          if (last) {
            changePct = Math.max(
              Math.abs(calculateChangePct(priceMin, last.priceMin)),
              Math.abs(calculateChangePct(priceMax, last.priceMax)),
            )
          }

          if (shouldSave) {
            await insertPriceRecord({
              platform,
              asset,
              baseCurrency: snapshot.baseCurrency,
              paymentMethod,
              priceMin,
              priceMax,
              priceMid,
            })
            recorded = true
            await markPlatformHealthy(platform)
          }

          if (
            shouldSave &&
            changePct >= alertThreshold &&
            config.priceAlertEnabled &&
            config.alertTelegram &&
            paymentMethod === null  // solo alertar para el precio general (sin filtro)
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

          results.push({ platform, asset, paymentMethod, recorded, alerted, priceMin, priceMax, changePct })
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error'
          if (paymentMethod === null) {
            await markPlatformError(platform, error)
          }
          results.push({
            platform, asset, paymentMethod,
            recorded: false, alerted: false,
            priceMin: 0, priceMax: 0, changePct: 0,
            reason: error,
          })
        }
      }

      // 1. Precio general (sin filtro de método de pago)
      await processSnapshot(null, () => scraper.scrape(asset as any))

      // 2. Precios por método de pago popular (solo para Binance P2P VES)
      if (platform === 'binance_p2p_ves') {
        for (const pm of POPULAR_PAYMENT_METHODS) {
          await processSnapshot(
            pm.id,
            () => scrapeBinanceP2PByPaymentMethod(asset as any, pm.id),
          )
        }
      }
    }
  }

  return results
}
