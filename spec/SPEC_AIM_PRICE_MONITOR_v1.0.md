# SPEC_AIM_PRICE_MONITOR v1.0
**Módulo: Monitor de Precio P2P en Tiempo Real**
**Sistema padre:** Arbitrage Intelligence Monitor (AIM)
**Clasificación:** Feature Spec — Production Grade
**Versión:** 1.0.0
**Fecha:** 2026-05-08
**Estado:** Listo para ejecución por agente IA (vibe coding)

---

## 0. Control de Cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0.0 | 2026-05-08 | Spec inicial — monitor de precio P2P con histórico, gráfico acotado por fecha, alertas Telegram |

---

## 1. Resumen del Feature

Nueva sección dentro del dashboard existente en
`app/(dashboard)/dashboard/monitor/` que permite al operador monitorear el
**precio de mercado P2P** de las criptomonedas seleccionadas en su `UserConfig`,
visualizando el **mínimo y máximo** histórico acotado por ventanas de tiempo
configurable, con alertas Telegram cuando el precio cambia más de un umbral
definido por el usuario.

**Objetivo central:** el operador sabe en todo momento cuál es el precio más bajo
y más alto de cada cripto en P2P, a lo largo del tiempo, sin tener que abrir
ninguna plataforma externa.

---

## 2. Contexto del Proyecto

### Stack existente relevante

```
Next.js 15.5.15 · App Router · TypeScript strict · Tailwind 4 · shadcn/ui
lib/proxy.ts              → todas las llamadas HTTP externas
lib/scrapers/             → binance-spot.ts, bybit-spot.ts, binance-p2p.ts (ARS/VES)
lib/alerts/telegram.ts    → alertas Telegram existentes, reutilizar
lib/auth-helpers.ts       → requireAuth(), sin middleware.ts
lib/scanner-service.ts    → worker de scan activo, reutilizar como base
lib/store/dashboard.store.ts → Zustand, añadir slice
prisma/schema.prisma      → añadir modelo PriceRecord
lib/db/queries/           → añadir price-records.ts
components/dashboard/     → añadir monitor/ subfolder
```

### Plataformas de precio P2P disponibles

| Plataforma | Tipo | Monedas base | Implementación |
|---|---|---|---|
| `binance_p2p` | P2P API pública | ARS | Ya existe en scrapers |
| `binance_p2p_ves` | P2P API pública | VES | Ya existe en scrapers |
| `binance_spot` | Spot API pública | USD | Ya existe en scrapers |
| `bybit_spot` | Spot API pública | USD | Ya existe en scrapers |

El worker de precio usa los **scrapers existentes** — no crea nuevas llamadas de
red desde cero.

### Archivos a crear (todos nuevos)

```
prisma/migrations/YYYYMMDD_add_price_records/    ← migration automática
lib/db/queries/price-records.ts
lib/price-monitor/
  price-monitor-service.ts
  alert-threshold.ts
components/dashboard/monitor/
  price-chart.tsx
  price-stats-card.tsx
  time-range-selector.tsx
  platform-selector.tsx
  monitor-panel.tsx
app/(dashboard)/dashboard/monitor/page.tsx
```

### Archivos a modificar

```
prisma/schema.prisma             ← añadir modelo PriceRecord + campos a UserConfig
lib/db/queries/user-config.ts    ← incluir nuevos campos en getOrCreate
lib/scanner-service.ts           ← invocar price monitor en cada ciclo
lib/store/dashboard.store.ts     ← añadir slice de monitor
components/dashboard/sidebar.tsx ← añadir link "Monitor P2P"
```

---

## 3. Modelo de Datos

### 3.1 Nuevo modelo `PriceRecord` en `prisma/schema.prisma`

```prisma
model PriceRecord {
  id           String   @id @default(cuid())
  platform     String   // binance_p2p | binance_p2p_ves | binance_spot | bybit_spot
  asset        String   // USDT | USDC | BTC | ETH
  baseCurrency String   // ARS | VES | USD
  priceMin     Float    // precio mínimo del anuncio más barato (P2P) o bid (spot)
  priceMax     Float    // precio máximo del anuncio más caro (P2P) o ask (spot)
  priceMid     Float    // precio medio (avg de los top anuncios o mid spot)
  recordedAt   DateTime @default(now())

  @@index([platform, asset, recordedAt])
  @@index([recordedAt])
}
```

### 3.2 Nuevos campos en `UserConfig` (añadir al modelo existente)

```prisma
model UserConfig {
  // ... campos existentes ...

  // ── Monitor de Precio P2P ──────────────────────────────────────────────
  monitorEnabled          Boolean  @default(true)
  monitorPlatforms        String[] @default(["binance_p2p_ves"])
  monitorAssets           String[] @default(["USDT"])
  priceChangeThresholdPct Float    @default(1.0)  // % de cambio para grabar nuevo registro
  priceAlertThresholdPct  Float    @default(2.0)  // % de cambio para enviar alerta Telegram
  priceAlertEnabled       Boolean  @default(true)
}
```

**Lógica de `priceChangeThresholdPct`:**
Solo se guarda un nuevo `PriceRecord` si el precio cambió más de este porcentaje
respecto al último registro de esa misma plataforma/asset. Evita llenar la DB con
registros idénticos en cada scan.

**Lógica de `priceAlertThresholdPct`:**
Solo se envía alerta Telegram si el nuevo precio mínimo o máximo cambia más de
este porcentaje respecto al último valor alertado.

### 3.3 Migration

```bash
npx prisma migrate dev --name add_price_records_and_monitor_config
```

---

## 4. Servicios de Backend

### 4.1 `lib/db/queries/price-records.ts`

```typescript
import { prisma } from '@/lib/db/prisma'

// Insertar nuevo registro de precio
export async function insertPriceRecord(data: {
  platform: string
  asset: string
  baseCurrency: string
  priceMin: number
  priceMax: number
  priceMid: number
}) {
  return prisma.priceRecord.create({ data })
}

// Obtener el último registro de una plataforma/asset
export async function getLastPriceRecord(platform: string, asset: string) {
  return prisma.priceRecord.findFirst({
    where: { platform, asset },
    orderBy: { recordedAt: 'desc' },
  })
}

// Obtener registros dentro de una ventana de tiempo
// Para el gráfico — retorna todos los puntos en el rango
export async function getPriceHistory(opts: {
  platform: string
  asset: string
  since: Date
  until?: Date
}) {
  return prisma.priceRecord.findMany({
    where: {
      platform: opts.platform,
      asset: opts.asset,
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
}) {
  const result = await prisma.priceRecord.aggregate({
    where: {
      platform: opts.platform,
      asset: opts.asset,
      recordedAt: { gte: opts.since },
    },
    _min: { priceMin: true, recordedAt: true },
    _max: { priceMax: true, recordedAt: true },
    _avg: { priceMid: true },
    _count: { id: true },
  })

  return {
    absoluteMin: result._min.priceMin,
    absoluteMax: result._max.priceMax,
    average: result._avg.priceMid,
    dataPoints: result._count.id,
  }
}

// Retención: eliminar registros más viejos de 3 meses (ejecutar periódicamente)
export async function pruneOldPriceRecords() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const result = await prisma.priceRecord.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  })
  return result.count
}
```

### 4.2 `lib/price-monitor/alert-threshold.ts`

```typescript
// Calcula si el cambio de precio supera el threshold configurado
// Retorna true si se debe grabar/alertar, false si no

export function exceedsThreshold(
  current: number,
  previous: number,
  thresholdPct: number,
): boolean {
  if (previous === 0) return true
  const changePct = Math.abs((current - previous) / previous) * 100
  return changePct >= thresholdPct
}

export function calculateChangePct(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

// Determina si el precio se movió lo suficiente para registrar
// Compara tanto el min como el max — si cualquiera de los dos cambió, registrar
export function shouldRecord(
  newMin: number,
  newMax: number,
  lastMin: number,
  lastMax: number,
  thresholdPct: number,
): boolean {
  return (
    exceedsThreshold(newMin, lastMin, thresholdPct) ||
    exceedsThreshold(newMax, lastMax, thresholdPct)
  )
}
```

### 4.3 `lib/price-monitor/price-monitor-service.ts`

```typescript
import { getScraper } from '@/lib/scrapers'
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

  const platforms = config.monitorPlatforms as string[]
  const assets = config.monitorAssets as string[]

  for (const platform of platforms) {
    const scraper = getScraper(platform as never)
    if (!scraper) continue

    for (const asset of assets) {
      if (!scraper.supportedAssets.includes(asset as never)) continue

      try {
        // 1. Obtener precio actual del scraper existente
        const { snapshot } = await scraper.scrape(asset as never)

        const priceMin = snapshot.priceBid ?? snapshot.price
        const priceMax = snapshot.priceAsk ?? snapshot.price
        const priceMid = snapshot.price

        // 2. Comparar con último registro
        const last = await getLastPriceRecord(platform, asset)

        const changeThreshold = config.priceChangeThresholdPct ?? 1.0
        const alertThreshold = config.priceAlertThresholdPct ?? 2.0

        const shouldSave = !last || shouldRecord(
          priceMin, priceMax,
          last.priceMin, last.priceMax,
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
```

### 4.4 Extensión de `lib/alerts/telegram.ts`

Añadir la función `sendPriceAlert` al archivo existente:

```typescript
// Añadir a lib/alerts/telegram.ts — no reemplazar el archivo completo

export type PriceAlertPayload = {
  chatId: string
  platform: string
  asset: string
  priceMin: number
  priceMax: number
  changePct: number
  direction: 'up' | 'down'
}

export async function sendPriceAlert(payload: PriceAlertPayload): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping price alert')
    return
  }

  const arrow = payload.direction === 'up' ? '📈' : '📉'
  const sign = payload.direction === 'up' ? '+' : ''

  const message = [
    `${arrow} *AIM · Alerta de Precio P2P*`,
    ``,
    `*Activo:* ${payload.asset} en \`${payload.platform}\``,
    `*Cambio:* ${sign}${payload.changePct.toFixed(2)}%`,
    ``,
    `*Mínimo actual:* $${payload.priceMin.toFixed(4)}`,
    `*Máximo actual:* $${payload.priceMax.toFixed(4)}`,
    ``,
    `_${new Date().toLocaleString('es-VE')}_`,
  ].join('\n')

  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: payload.chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    )
    console.info(
      `[telegram] price alert sent platform=${payload.platform} asset=${payload.asset} change=${payload.changePct.toFixed(2)}%`
    )
  } catch (err) {
    console.error('[telegram] price alert failed:', err)
  }
}
```

### 4.5 Integración en `lib/scanner-service.ts`

Añadir llamada al price monitor dentro del ciclo de scan existente:

```typescript
// En lib/scanner-service.ts — añadir al ciclo principal de scan
// Localizar donde se ejecuta el scan y añadir DESPUÉS del scan de oportunidades:

import { runPriceMonitor } from '@/lib/price-monitor/price-monitor-service'
import { getOrCreateDefaultUserConfig } from '@/lib/db/queries/user-config'

// Dentro del ciclo de scan, DESPUÉS de runScrape y evaluate:
const firstUser = await prisma.user.findFirst()
if (firstUser) {
  const config = await getOrCreateDefaultUserConfig(firstUser.id)
  const priceResults = await runPriceMonitor(config)
  console.info(
    `[scanner] price monitor: ${priceResults.filter(r => r.recorded).length} registros guardados,` +
    ` ${priceResults.filter(r => r.alerted).length} alertas enviadas`
  )
}
```

---

## 5. Server Actions

### 5.1 `lib/actions/monitor.actions.ts`

```typescript
'use server'

import { getAuthenticatedUserId } from '@/lib/auth-helpers'
import { getPriceHistory, getPriceExtremes } from '@/lib/db/queries/price-records'
import { getOrCreateDefaultUserConfig } from '@/lib/db/queries/user-config'
import { prisma } from '@/lib/db/prisma'

// Ventanas de tiempo disponibles
export const TIME_RANGES = {
  '24h':  { label: '24 horas', hours: 24 },
  '3d':   { label: '3 días',   hours: 72 },
  '7d':   { label: '7 días',   hours: 168 },
  '1m':   { label: '1 mes',    hours: 720 },
  '3m':   { label: '3 meses',  hours: 2160 },
} as const

export type TimeRangeKey = keyof typeof TIME_RANGES

// Datos para el gráfico de una plataforma/asset específica
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
): Promise<PriceChartData | null> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null

  const hours = TIME_RANGES[rangeKey].hours
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const [history, extremes] = await Promise.all([
    getPriceHistory({ platform, asset, since }),
    getPriceExtremes({ platform, asset, since }),
  ])

  // Detectar baseCurrency del primer registro disponible
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

// Datos resumen de todas las combinaciones monitoreadas por el usuario
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
  const platforms = config.monitorPlatforms as string[]
  const assets = config.monitorAssets as string[]
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

// Actualizar configuración del monitor
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
      monitorEnabled: input.monitorEnabled,
      monitorPlatforms: input.monitorPlatforms,
      monitorAssets: input.monitorAssets,
      priceChangeThresholdPct: input.priceChangeThresholdPct,
      priceAlertThresholdPct: input.priceAlertThresholdPct,
      priceAlertEnabled: input.priceAlertEnabled,
    },
  })

  return { success: true }
}
```

---

## 6. Componentes UI

### 6.1 `components/dashboard/monitor/time-range-selector.tsx`

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TimeRangeKey } from '@/lib/actions/monitor.actions'
import { TIME_RANGES } from '@/lib/actions/monitor.actions'

type Props = {
  value: TimeRangeKey
  onChange: (key: TimeRangeKey) => void
}

export function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 flex-wrap">
      {(Object.keys(TIME_RANGES) as TimeRangeKey[]).map((key) => (
        <Button
          key={key}
          size="sm"
          variant={value === key ? 'default' : 'outline'}
          className={cn('h-7 px-2.5 text-xs', value === key && 'shadow-sm')}
          onClick={() => onChange(key)}
        >
          {TIME_RANGES[key].label}
        </Button>
      ))}
    </div>
  )
}
```

### 6.2 `components/dashboard/monitor/platform-selector.tsx`

```tsx
'use client'

import { cn } from '@/lib/utils'

const PLATFORM_LABELS: Record<string, string> = {
  binance_p2p:     'Binance P2P (ARS)',
  binance_p2p_ves: 'Binance P2P (VES)',
  binance_spot:    'Binance Spot',
  bybit_spot:      'Bybit Spot',
}

type Props = {
  platforms: string[]
  selected: string
  onSelect: (platform: string) => void
}

export function PlatformSelector({ platforms, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {platforms.map((p) => (
        <button
          key={p}
          onClick={() => onSelect(p)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border transition-colors',
            selected === p
              ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary font-medium'
              : 'border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/40',
          )}
        >
          {PLATFORM_LABELS[p] ?? p}
        </button>
      ))}
    </div>
  )
}
```

### 6.3 `components/dashboard/monitor/price-stats-card.tsx`

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { MonitorSummary } from '@/lib/actions/monitor.actions'

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return '—'
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }
  return `$${price.toFixed(4)}`
}

function ChangeIndicator({ changePct }: { changePct: number | null }) {
  if (changePct === null) return <span className="text-xs text-muted-foreground">—</span>
  const abs = Math.abs(changePct)
  if (abs < 0.01) return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="w-3 h-3" /> {abs.toFixed(2)}%
    </span>
  )
  const isUp = changePct > 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-400'}`}>
      {isUp
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />
      }
      {isUp ? '+' : ''}{changePct.toFixed(2)}%
    </span>
  )
}

const PLATFORM_LABELS: Record<string, string> = {
  binance_p2p:     'Binance P2P · ARS',
  binance_p2p_ves: 'Binance P2P · VES',
  binance_spot:    'Binance Spot',
  bybit_spot:      'Bybit Spot',
}

export function PriceStatsCard({ summary }: { summary: MonitorSummary }) {
  const age = summary.lastRecordedAt
    ? Math.round((Date.now() - new Date(summary.lastRecordedAt).getTime()) / 60_000)
    : null

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono font-semibold text-sm">{summary.asset}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {PLATFORM_LABELS[summary.platform] ?? summary.platform}
            </p>
          </div>
          <ChangeIndicator changePct={summary.change24hPct} />
        </div>

        {/* Min/Max */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-red-500/5 border border-red-500/15 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Mínimo</p>
            <p className="text-sm font-bold text-red-400">
              {formatPrice(summary.currentMin, summary.baseCurrency)}
            </p>
          </div>
          <div className="rounded-md bg-green-500/5 border border-green-500/15 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Máximo</p>
            <p className="text-sm font-bold text-green-500">
              {formatPrice(summary.currentMax, summary.baseCurrency)}
            </p>
          </div>
        </div>

        {/* Age */}
        {age !== null && (
          <p className="text-[10px] text-muted-foreground text-right">
            Actualizado hace {age < 60 ? `${age}min` : `${Math.round(age / 60)}h`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### 6.4 `components/dashboard/monitor/price-chart.tsx`

```tsx
'use client'

import { useState, useTransition } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { TimeRangeSelector } from './time-range-selector'
import { getPriceChartData } from '@/lib/actions/monitor.actions'
import type { PriceChartData, TimeRangeKey } from '@/lib/actions/monitor.actions'
import { Loader2 } from 'lucide-react'

const CHART_CONFIG = {
  priceMin: { label: 'Precio Mínimo', color: 'var(--color-destructive)' },
  priceMax: { label: 'Precio Máximo', color: 'var(--color-success)' },
  priceMid: { label: 'Precio Medio',  color: 'var(--color-brand-primary)' },
}

function formatAxisTime(isoString: string, rangeKey: TimeRangeKey): string {
  const d = new Date(isoString)
  if (rangeKey === '24h') {
    return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  }
  if (rangeKey === '3d' || rangeKey === '7d') {
    return d.toLocaleDateString('es-VE', { weekday: 'short', hour: '2-digit' })
  }
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
}

function formatPrice(value: number, currency: string): string {
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(value)
  }
  return `$${value.toFixed(2)}`
}

type Props = {
  initialData: PriceChartData | null
  platform: string
  asset: string
}

export function PriceChart({ initialData, platform, asset }: Props) {
  const [data, setData] = useState<PriceChartData | null>(initialData)
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>('24h')
  const [isPending, startTransition] = useTransition()

  function handleRangeChange(newRange: TimeRangeKey) {
    setRangeKey(newRange)
    startTransition(async () => {
      const newData = await getPriceChartData(platform, asset, newRange)
      setData(newData)
    })
  }

  const currency = data?.baseCurrency ?? 'USD'
  const points = data?.points ?? []
  const extremes = data?.extremes

  const chartData = points.map(p => ({
    time: formatAxisTime(p.time, rangeKey),
    timeRaw: p.time,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    priceMid: p.priceMid,
  }))

  return (
    <div className="space-y-4">
      {/* Header con stats extremos */}
      {extremes && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Mínimo del período
            </p>
            <p className="text-lg font-bold text-red-400 mt-0.5">
              {extremes.absoluteMin !== null
                ? formatPrice(extremes.absoluteMin, currency)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Promedio
            </p>
            <p className="text-lg font-bold mt-0.5">
              {extremes.average !== null
                ? formatPrice(extremes.average, currency)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Máximo del período
            </p>
            <p className="text-lg font-bold text-green-500 mt-0.5">
              {extremes.absoluteMax !== null
                ? formatPrice(extremes.absoluteMax, currency)
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Selector de rango */}
      <div className="flex items-center justify-between">
        <TimeRangeSelector value={rangeKey} onChange={handleRangeChange} />
        {isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Gráfico */}
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Sin datos en este período. Ejecuta un scan para comenzar a registrar precios.
        </div>
      ) : (
        <ChartContainer config={CHART_CONFIG} className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <defs>
                <linearGradient id="gradMin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradMax" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatPrice(v as number, currency)}
                width={currency === 'VES' ? 70 : 55}
              />
              <Tooltip
                formatter={(value: number) => [formatPrice(value, currency), '']}
                labelFormatter={(label) => `Hora: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="priceMax"
                name="Máximo"
                stroke="var(--color-success)"
                strokeWidth={1.5}
                fill="url(#gradMax)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="priceMid"
                name="Medio"
                stroke="var(--color-brand-primary)"
                strokeWidth={1.5}
                fill="none"
                dot={false}
                strokeDasharray="4 2"
              />
              <Area
                type="monotone"
                dataKey="priceMin"
                name="Mínimo"
                stroke="var(--color-destructive)"
                strokeWidth={1.5}
                fill="url(#gradMin)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}

      <p className="text-[10px] text-muted-foreground text-right">
        {extremes?.dataPoints ?? 0} puntos de datos · {data?.platform} · {data?.asset}
      </p>
    </div>
  )
}
```

### 6.5 `components/dashboard/monitor/monitor-panel.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PriceChart } from './price-chart'
import { PriceStatsCard } from './price-stats-card'
import { PlatformSelector } from './platform-selector'
import type { MonitorSummary, PriceChartData } from '@/lib/actions/monitor.actions'

type Props = {
  summary: MonitorSummary[]
  initialChartData: PriceChartData | null
}

export function MonitorPanel({ summary, initialChartData }: Props) {
  // Selección activa para el gráfico
  const firstEntry = summary[0]
  const [selectedPlatform, setSelectedPlatform] = useState(
    firstEntry?.platform ?? 'binance_p2p_ves'
  )
  const [selectedAsset] = useState(firstEntry?.asset ?? 'USDT')

  const availablePlatforms = [...new Set(summary.map(s => s.platform))]

  return (
    <div className="space-y-6">
      {/* Stats cards — una por cada combinación plataforma/asset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.map(s => (
          <button
            key={`${s.platform}-${s.asset}`}
            onClick={() => setSelectedPlatform(s.platform)}
            className="text-left focus:outline-none"
          >
            <PriceStatsCard summary={s} />
          </button>
        ))}
        {summary.length === 0 && (
          <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
            No hay plataformas configuradas para monitoreo.
            Configúralas en{' '}
            <a href="/dashboard/config" className="underline">Configuración</a>.
          </div>
        )}
      </div>

      {/* Gráfico detallado */}
      {summary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-medium">
                Histórico de Precio — {selectedAsset}
              </CardTitle>
              <PlatformSelector
                platforms={availablePlatforms}
                selected={selectedPlatform}
                onSelect={setSelectedPlatform}
              />
            </div>
          </CardHeader>
          <CardContent>
            <PriceChart
              initialData={initialChartData}
              platform={selectedPlatform}
              asset={selectedAsset}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### 6.6 `app/(dashboard)/dashboard/monitor/page.tsx`

```tsx
import { requireAuth } from '@/lib/auth-helpers'
import { getMonitorSummary, getPriceChartData } from '@/lib/actions/monitor.actions'
import { getOrCreateDefaultUserConfig } from '@/lib/db/queries/user-config'
import { MonitorPanel } from '@/components/dashboard/monitor/monitor-panel'
import { BarChart2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MonitorPage() {
  const session = await requireAuth()

  const [summary, config] = await Promise.all([
    getMonitorSummary(),
    getOrCreateDefaultUserConfig(session.user.id),
  ])

  // Cargar datos del gráfico inicial para la primera plataforma configurada
  const firstPlatform = (config.monitorPlatforms as string[])[0]
  const firstAsset = (config.monitorAssets as string[])[0]

  const initialChartData =
    firstPlatform && firstAsset
      ? await getPriceChartData(firstPlatform, firstAsset, '24h')
      : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-brand-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Monitor P2P</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Precio mínimo y máximo de tus activos monitoreados
          </p>
        </div>
      </div>

      <MonitorPanel
        summary={summary}
        initialChartData={initialChartData}
      />
    </div>
  )
}
```

### 6.7 Modificación `components/dashboard/sidebar.tsx`

```typescript
// Añadir al array NAV_ITEMS en components/dashboard/sidebar.tsx

import { BarChart2 } from 'lucide-react'  // añadir al import existente

const NAV_ITEMS = [
  { href: '/dashboard',                    label: 'Monitor',       icon: Activity },
  { href: '/dashboard/opportunities',      label: 'Historial',     icon: BarChart3 },
  { href: '/dashboard/monitor',            label: 'Monitor P2P',   icon: BarChart2 },  // ← nuevo
  { href: '/dashboard/analysis',           label: 'Análisis IA',   icon: Brain },
  { href: '/dashboard/config',             label: 'Configuración', icon: Settings },
]
```

---

## 7. Configuración en `/dashboard/config`

Añadir sección de configuración del monitor en el formulario existente.
Localizar `components/config/threshold-form.tsx` y añadir los campos nuevos:

```tsx
// Añadir dentro del <Form> existente en threshold-form.tsx
// DESPUÉS de los campos actuales, ANTES del botón de submit

{/* ── Monitor P2P ──────────────────────────────────────────────────── */}
<div className="border-t pt-6 space-y-4">
  <h3 className="text-sm font-medium">Monitor de Precio P2P</h3>

  <FormField
    control={form.control}
    name="priceChangeThresholdPct"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Umbral de cambio para registrar (%)</FormLabel>
        <FormControl>
          <Input
            type="number" step="0.1" min="0.1" max="50"
            {...field}
            onChange={(e) => field.onChange(parseFloat(e.target.value))}
          />
        </FormControl>
        <FormDescription>
          Solo se guarda un nuevo punto de precio si el cambio supera este %.
          Default: 1%. Valores bajos generan más datos; altos, menos ruido.
        </FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name="priceAlertThresholdPct"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Umbral de alerta Telegram (%)</FormLabel>
        <FormControl>
          <Input
            type="number" step="0.5" min="0.5" max="100"
            {...field}
            onChange={(e) => field.onChange(parseFloat(e.target.value))}
          />
        </FormControl>
        <FormDescription>
          Se envía alerta Telegram cuando el precio cambia más de este %.
          Default: 2%. Requiere Chat ID configurado en el campo Telegram.
        </FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name="priceAlertEnabled"
    render={({ field }) => (
      <FormItem className="flex items-center gap-3">
        <FormControl>
          <input
            type="checkbox"
            checked={field.value}
            onChange={field.onChange}
            className="w-4 h-4"
          />
        </FormControl>
        <div>
          <FormLabel className="cursor-pointer">Alertas de precio activas</FormLabel>
          <FormDescription>
            Activa/desactiva las alertas Telegram de cambio de precio.
          </FormDescription>
        </div>
      </FormItem>
    )}
  />
</div>
```

Actualizar también `UserConfigFormSchema` en `lib/schemas/user-config.schema.ts`:

```typescript
// Añadir a UserConfigFormSchema.omit({...}) los nuevos campos:
export const UserConfigFormSchema = z.object({
  // ... campos existentes ...
  priceChangeThresholdPct: z.number().min(0.1).max(50).default(1.0),
  priceAlertThresholdPct:  z.number().min(0.5).max(100).default(2.0),
  priceAlertEnabled:       z.boolean().default(true),
  monitorEnabled:          z.boolean().default(true),
  monitorPlatforms:        z.array(z.string()).min(1),
  monitorAssets:           z.array(z.string()).min(1),
})
```

---

## 8. Variables de Entorno

No se añaden variables nuevas. El feature reutiliza:
- `TELEGRAM_BOT_TOKEN` — ya existe en el proyecto
- `DATABASE_URL` — ya existe

---

## 9. Acceptance Criteria

### AC-PM01: Registro de precios en cada scan
**Dado** que el scanner corre y `monitorEnabled = true`,
**Cuando** el precio cambia más de `priceChangeThresholdPct`%,
**Entonces** se inserta un nuevo `PriceRecord` en DB con `priceMin`, `priceMax` y `priceMid`.
**Verificación:** `SELECT * FROM "PriceRecord" ORDER BY "recordedAt" DESC LIMIT 5` después de un scan.

### AC-PM02: Sin registros duplicados
**Dado** que el precio NO cambió más del threshold,
**Cuando** el scanner corre,
**Entonces** NO se inserta un nuevo `PriceRecord` para esa plataforma/asset.
**Verificación:** Dos scans consecutivos sin movimiento → mismo count en DB.

### AC-PM03: Gráfico muestra mínimo y máximo
**Dado** que hay datos en DB para una plataforma/asset,
**Cuando** el operador accede a `/dashboard/monitor`,
**Entonces** el gráfico muestra las tres líneas (min, mid, max) con el rango seleccionado.
**Verificación:** Visual.

### AC-PM04: Cambio de ventana temporal actualiza gráfico
**Dado** el gráfico en vista "24h",
**Cuando** el operador selecciona "7 días",
**Entonces** el gráfico se recarga con los datos del rango de 7 días sin recargar la página.
**Verificación:** Visual + Network tab (Server Action call).

### AC-PM05: Alerta Telegram por cambio de precio
**Dado** `priceAlertEnabled = true` y `alertTelegram` configurado,
**Cuando** el precio cambia más de `priceAlertThresholdPct`%,
**Entonces** el bot envía mensaje Telegram con el formato especificado.
**Verificación:** Mensaje recibido en Telegram con emoji, plataforma, asset y % de cambio.

### AC-PM06: Sin alerta si cambio < threshold
**Dado** el precio cambia 1.5% y `priceAlertThresholdPct = 2.0`,
**Cuando** el scanner procesa el cambio,
**Entonces** NO se envía alerta Telegram.
**Verificación:** Logs del scanner + Telegram sin mensaje nuevo.

### AC-PM07: Protección de ruta
**Dado** un usuario no autenticado,
**Cuando** accede a `/dashboard/monitor`,
**Entonces** es redirigido a `/login`.
**Verificación:** Navegación sin sesión.

### AC-PM08: Extremos correctos por período
**Dado** datos históricos de 7 días,
**Cuando** el operador selecciona "7 días",
**Entonces** los indicadores "Mínimo del período" y "Máximo del período" muestran
el valor más bajo y más alto absoluto de todos los `PriceRecord` en ese rango.
**Verificación:** Comparar con `SELECT MIN("priceMin"), MAX("priceMax") FROM "PriceRecord" WHERE "recordedAt" > NOW() - INTERVAL '7 days'`.

---

## 10. Plan de Ejecución por Fases

---

### FASE PM-1 — Base de datos y queries

**Objetivo:** Schema, migration y queries de DB. Sin UI, sin lógica de negocio.

**Tareas:**

**TPM1.1 — Actualizar `prisma/schema.prisma`**
- Añadir modelo `PriceRecord` exactamente como la sección 3.1
- Añadir campos de monitor en `UserConfig` exactamente como la sección 3.2

**TPM1.2 — Ejecutar migration**
```bash
npx prisma migrate dev --name add_price_records_and_monitor_config
npx prisma generate
```

**TPM1.3 — Crear `lib/db/queries/price-records.ts`**
Implementar las 5 funciones de la sección 4.1 exactamente.

**TPM1.4 — Verificar migration**
```bash
npx prisma studio
# Verificar que la tabla PriceRecord existe
# Verificar que UserConfig tiene los nuevos campos
```

**Verificación de salida FPM-1:**
- [ ] `npx prisma validate` → sin errores
- [ ] `npx prisma studio` → tabla `PriceRecord` visible
- [ ] `UserConfig` tiene `monitorEnabled`, `priceChangeThresholdPct`, etc.
- [ ] `npm run typecheck` → 0 errores

**HANDOFF FPM-1:**
```
FASE_COMPLETADA: PM-1
MIGRATION: add_price_records_and_monitor_config aplicada
QUERIES: lib/db/queries/price-records.ts — 5 funciones
SIGUIENTE: PM-2 — servicios de backend
```

---

### FASE PM-2 — Servicios de backend

**Objetivo:** Lógica de threshold, service de monitor, extensión de Telegram y
integración en el scanner.

**Tareas:**

**TPM2.1 — Crear `lib/price-monitor/alert-threshold.ts`**
Implementar las 3 funciones de la sección 4.2.

**TPM2.2 — Crear `lib/price-monitor/price-monitor-service.ts`**
Implementar `runPriceMonitor()` de la sección 4.3.

**TPM2.3 — Añadir `sendPriceAlert` a `lib/alerts/telegram.ts`**
Añadir la función de la sección 4.4 al final del archivo existente.
**No reemplazar el archivo** — añadir la función nueva.

**TPM2.4 — Integrar en `lib/scanner-service.ts`**
Localizar el ciclo principal de scan y añadir la llamada a `runPriceMonitor()`
de la sección 4.5, después del scan de oportunidades.

**TPM2.5 — Verificar ejecución manual**
```bash
# Ejecutar un scan desde el dashboard y verificar en los logs:
# [scanner] price monitor: N registros guardados, M alertas enviadas
# Verificar en Neon console que hay registros en PriceRecord
```

**Verificación de salida FPM-2:**
- [ ] Un scan manual crea al menos 1 `PriceRecord` en DB
- [ ] Logs muestran `[scanner] price monitor: ...`
- [ ] `npm run typecheck` → 0 errores
- [ ] Si `TELEGRAM_BOT_TOKEN` configurado y cambio > threshold → mensaje recibido

**HANDOFF FPM-2:**
```
FASE_COMPLETADA: PM-2
SERVICES: lib/price-monitor/price-monitor-service.ts, lib/price-monitor/alert-threshold.ts
TELEGRAM: sendPriceAlert añadida a lib/alerts/telegram.ts
SCANNER: runPriceMonitor integrado en scanner-service.ts
DB_RECORDS: PriceRecord poblándose en cada scan
SIGUIENTE: PM-3 — Server Actions
```

---

### FASE PM-3 — Server Actions

**Objetivo:** Las actions que conectan la UI con la DB. Sin UI todavía.

**Tareas:**

**TPM3.1 — Crear `lib/actions/monitor.actions.ts`**
Implementar las 3 actions de la sección 5.1:
- `getPriceChartData(platform, asset, rangeKey)`
- `getMonitorSummary()`
- `updateMonitorConfig(input)`

**TPM3.2 — Actualizar `lib/schemas/user-config.schema.ts`**
Añadir los nuevos campos al schema Zod de la sección 7.

**TPM3.3 — Actualizar `lib/db/queries/user-config.ts`**
Asegurarse de que `getOrCreateDefaultUserConfig` incluye los nuevos campos
con sus valores por defecto en el `create`.

**TPM3.4 — Verificar actions**
```typescript
// Verificar manualmente desde una ruta temporal o test:
const summary = await getMonitorSummary()
console.log(summary)
// Debe retornar array con las plataformas configuradas por defecto
```

**Verificación de salida FPM-3:**
- [ ] `getMonitorSummary()` retorna array (vacío o con datos)
- [ ] `getPriceChartData('binance_p2p_ves', 'USDT', '24h')` retorna objeto o null
- [ ] `updateMonitorConfig({...})` → `{ success: true }`
- [ ] `npm run typecheck` → 0 errores

**HANDOFF FPM-3:**
```
FASE_COMPLETADA: PM-3
ACTIONS: lib/actions/monitor.actions.ts — 3 actions
SCHEMAS: user-config.schema.ts actualizado con campos del monitor
SIGUIENTE: PM-4 — componentes UI y página
```

---

### FASE PM-4 — UI: componentes y página

**Objetivo:** Todos los componentes de UI y la página RSC del monitor.

**Tareas:**

**TPM4.1 — Crear directorio de componentes**
```bash
mkdir -p components/dashboard/monitor
```

**TPM4.2 — Crear componentes en orden de dependencia**

1. `components/dashboard/monitor/time-range-selector.tsx` (sección 6.1) — sin dependencias
2. `components/dashboard/monitor/platform-selector.tsx` (sección 6.2) — sin dependencias
3. `components/dashboard/monitor/price-stats-card.tsx` (sección 6.3) — sin dependencias
4. `components/dashboard/monitor/price-chart.tsx` (sección 6.4) — depende de time-range-selector
5. `components/dashboard/monitor/monitor-panel.tsx` (sección 6.5) — depende de todos los anteriores

**TPM4.3 — Crear `app/(dashboard)/dashboard/monitor/page.tsx`**
Implementar la sección 6.6.

**TPM4.4 — Actualizar sidebar**
Añadir el link "Monitor P2P" según la sección 6.7.

**TPM4.5 — Actualizar threshold-form**
Añadir los campos del monitor en `components/config/threshold-form.tsx`
según la sección 7.

**Verificación de salida FPM-4:**
- [ ] `GET /dashboard/monitor` con sesión → página carga sin errores
- [ ] Cards de stats visibles si hay datos en DB (o estado vacío si no hay)
- [ ] Gráfico renderiza (o mensaje "Sin datos" si DB está vacía)
- [ ] Botones de rango temporal clicables
- [ ] Selector de plataforma funciona
- [ ] Link "Monitor P2P" visible en sidebar
- [ ] `npm run typecheck` → 0 errores
- [ ] `npm run build` → build exitoso

**HANDOFF FPM-4:**
```
FASE_COMPLETADA: PM-4
PAGE: app/(dashboard)/dashboard/monitor/page.tsx
COMPONENTS: 5 componentes en components/dashboard/monitor/
SIDEBAR: actualizado con link Monitor P2P
CONFIG_FORM: campos de monitor añadidos
SIGUIENTE: PM-5 — verificación end-to-end y ACs
```

---

### FASE PM-5 — Verificación end-to-end

**Objetivo:** Verificar todos los ACs del feature.

**Tareas:**

**TPM5.1 — AC-PM01: Verificar registro de precios**
1. Ejecutar scan desde dashboard
2. Abrir Prisma Studio o Neon console
3. Verificar registros en `PriceRecord`

**TPM5.2 — AC-PM02: Verificar sin duplicados**
1. Ejecutar dos scans consecutivos con mercado estable
2. Verificar que el count de `PriceRecord` no aumenta el doble

**TPM5.3 — AC-PM03 y AC-PM04: Verificar gráfico**
1. Navegar a `/dashboard/monitor`
2. Verificar que el gráfico muestra datos
3. Cambiar ventana temporal → verificar que el gráfico se actualiza

**TPM5.4 — AC-PM05 y AC-PM06: Verificar alertas Telegram**
1. Bajar `priceAlertThresholdPct` a 0.1% temporalmente en config
2. Ejecutar scan → verificar mensaje Telegram recibido
3. Restaurar threshold a 2.0%

**TPM5.5 — AC-PM07: Verificar protección de ruta**
1. Cerrar sesión
2. Navegar a `/dashboard/monitor` → verificar redirect a `/login`

**TPM5.6 — AC-PM08: Verificar extremos del período**
```sql
-- Ejecutar en Neon console y comparar con lo que muestra la UI
SELECT MIN("priceMin"), MAX("priceMax"), AVG("priceMid")
FROM "PriceRecord"
WHERE "platform" = 'binance_p2p_ves'
  AND "asset" = 'USDT'
  AND "recordedAt" > NOW() - INTERVAL '7 days';
```

**TPM5.7 — Build final**
```bash
npm run typecheck   # 0 errores
npm run build       # exitoso
npm test            # tests existentes siguen passing
```

**Verificación de salida FPM-5 (gate final):**
- [ ] AC-PM01 ✅ Registro en DB verificado
- [ ] AC-PM02 ✅ Sin duplicados innecesarios
- [ ] AC-PM03 ✅ Gráfico con min/max visible
- [ ] AC-PM04 ✅ Cambio de ventana funciona
- [ ] AC-PM05 ✅ Alerta Telegram recibida
- [ ] AC-PM06 ✅ Sin alerta por debajo del threshold
- [ ] AC-PM07 ✅ Ruta protegida
- [ ] AC-PM08 ✅ Extremos del período correctos
- [ ] `npm run build` ✅ exitoso
- [ ] `npm test` ✅ sin regresiones

**HANDOFF FINAL:**
```
FEATURE_COMPLETADO: Monitor de Precio P2P
RUTA: /dashboard/monitor
ARCHIVOS_NUEVOS:
  - prisma/migrations/*/         (migration DB)
  - lib/db/queries/price-records.ts
  - lib/price-monitor/price-monitor-service.ts
  - lib/price-monitor/alert-threshold.ts
  - lib/actions/monitor.actions.ts
  - components/dashboard/monitor/time-range-selector.tsx
  - components/dashboard/monitor/platform-selector.tsx
  - components/dashboard/monitor/price-stats-card.tsx
  - components/dashboard/monitor/price-chart.tsx
  - components/dashboard/monitor/monitor-panel.tsx
  - app/(dashboard)/dashboard/monitor/page.tsx
ARCHIVOS_MODIFICADOS:
  - prisma/schema.prisma          (PriceRecord + campos UserConfig)
  - lib/db/queries/user-config.ts (nuevos campos en getOrCreate)
  - lib/scanner-service.ts        (runPriceMonitor integrado)
  - lib/alerts/telegram.ts        (sendPriceAlert añadida)
  - lib/schemas/user-config.schema.ts (nuevos campos Zod)
  - components/dashboard/sidebar.tsx  (link Monitor P2P)
  - components/config/threshold-form.tsx (campos monitor)
ENV_VARS_NUEVAS: ninguna — reutiliza TELEGRAM_BOT_TOKEN
NO_BREAKING_CHANGES: true
ESTADO: Production-ready
```

---

## 11. Decisiones de Diseño

**DD-01: PriceRecord separado de MarketSnapshot**
`MarketSnapshot` existe para el motor de arbitraje — tiene TTL, se usa para evaluar
pares y se llena en cada scan independientemente de cambios. `PriceRecord` existe
para el historial del monitor — solo se inserta cuando el precio cambia lo
suficiente. Son tablas con propósitos distintos que no deben mezclarse.

**DD-02: Threshold de cambio para inserción**
Sin este mecanismo, a 180s de intervalo y 3 meses de retención, la tabla
acumularía ~50,000 registros por plataforma/asset. Con threshold de 1%, solo
se guarda cuando hay movimiento real — estimado de 200–500 registros/día en
mercados activos.

**DD-03: Retención de 3 meses con pruning**
La función `pruneOldPriceRecords()` debe llamarse periódicamente (ej. una vez al
día desde el scanner-service). 3 meses de historial es suficiente para cualquier
análisis de tendencia relevante para arbitraje.

**DD-04: Server Action para cambio de rango (no SWR)**
El cambio de ventana temporal es poco frecuente y los datos son lecturas puras de
DB. Una Server Action es suficiente — no requiere SWR ni polling. El
`useTransition` de React maneja el estado de carga sin boilerplate adicional.

**DD-05: Gráfico de área con tres líneas (min, mid, max)**
El área entre min y max visualiza el spread P2P — la distancia entre las dos
líneas es el rango de negociación disponible en ese momento. Cuanto más ancha el
área, más spread hay entre compradores y vendedores en el P2P.

---

*Fin de SPEC_AIM_PRICE_MONITOR v1.0.0*
*Feature: Monitor P2P | Sistema: AIM | Fases: PM-1 → PM-5*
*Ruta: /dashboard/monitor | Tabla nueva: PriceRecord*
