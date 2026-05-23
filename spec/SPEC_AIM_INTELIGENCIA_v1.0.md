# SPEC_AIM_INTELIGENCIA v1.0
**Módulo: Inteligencia Cambiaria Venezuela**
**Sistema padre:** Arbitrage Intelligence Monitor (AIM) — en producción
**Clasificación:** Feature Spec — Production Grade
**Versión:** 1.0.0
**Fecha:** 2026-05-23
**Estado:** Listo para ejecución por agente IA (vibe coding)

---

## 0. Control de Cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0.0 | 2026-05-23 | Spec inicial — inteligencia cambiaria como feature del AIM existente |

---

## 1. Resumen del Feature

Nueva sección `/dashboard/inteligencia` dentro del AIM que monitorea el
**contexto macroeconómico venezolano** relevante para el arbitraje: tasa BCV,
detección de ventanas bancarias, señales de intervención cambiaria, y
correlación con los precios P2P ya monitoreados por el sistema.

**Por qué esto es valioso para el operador del AIM:**
El spread VES del monitor P2P no ocurre en el vacío. Una oportunidad de arbitraje
del 7% en ETH/VES se vuelve más o menos ejecutable dependiendo de si el BCV
intervino hoy, si Bancamiga tiene Intervención Digital activa, o si la tasa
oficial subió. Esta feature pone ese contexto junto a las oportunidades del motor.

---

## 2. Contexto del Proyecto AIM

### Stack existente que se reutiliza íntegramente

```
lib/proxy.ts                   ← TODAS las llamadas HTTP externas pasan aquí
lib/scrapers/                  ← patrón de scrapers existente
lib/scanner-service.ts         ← ciclo de scan, añadir collectors aquí
lib/alerts/telegram.ts         ← sendPriceAlert() ya existe, añadir función
lib/db/prisma.ts               ← cliente Prisma singleton
lib/auth-helpers.ts            ← requireAuth(), sin middleware.ts
lib/actions/                   ← patrón Server Actions establecido
components/dashboard/          ← componentes Recharts + shadcn
```

### Archivos a crear (todos nuevos)

```
prisma/migrations/             ← migration automática
lib/db/queries/bcv-signals.ts
lib/intelligence/
  bcv-collector.ts
  banking-collector.ts
  signal-engine.ts
  keywords.ts
lib/actions/intelligence.actions.ts
components/dashboard/intelligence/
  bcv-rate-card.tsx
  signal-feed.tsx
  context-panel.tsx
  spread-correlation-chart.tsx
  intelligence-panel.tsx
app/(dashboard)/dashboard/inteligencia/page.tsx
```

### Archivos a modificar

```
prisma/schema.prisma             ← nuevos modelos
lib/scanner-service.ts           ← invocar collectors de inteligencia
lib/alerts/telegram.ts           ← añadir sendIntelligenceAlert()
components/dashboard/sidebar.tsx ← añadir link "Inteligencia"
```

---

## 3. Fuentes de Datos

### Capa 1 — BCV Oficial (peso: 1.0)

**Endpoint primario (API pública no oficial, estable):**
```
GET https://bcv-api.rafnixg.dev/rates/
→ { usd: "63.45", eur: "68.12", date: "2026-05-23" }

GET https://bcv-api.rafnixg.dev/rates/{YYYY-MM-DD}
→ tasa de una fecha específica

GET https://bcv-api.rafnixg.dev/rates/history?start_date=X&end_date=Y
→ array de tasas históricas
```

**Fallback (scraping directo si la API falla):**
```
https://www.bcv.org.ve
```

**Frecuencia de colección:** cada 30 minutos. La tasa se publica ~3PM hora Venezuela.

### Capa 2 — Bancamiga (peso: 0.85)

**Fuente:** `https://www.bancamiga.com`
**Método:** scraping HTML via `proxy.ts` + análisis de keywords

**Keywords críticos que indican ventana activa:**
```typescript
// lib/intelligence/keywords.ts
export const BANKING_KEYWORDS = {
  HIGH_SIGNAL: [
    "intervención digital",
    "intervencion digital",
    "subasta privada",
    "ordenes de divisas",
    "órdenes de divisas",
  ],
  MEDIUM_SIGNAL: [
    "menudeo",
    "venta de divisas",
    "jornada cambiaria",
    "operaciones cambiarias",
    "mesa de cambio",
    "divisas disponibles",
  ],
  INFORMATIONAL: [
    "compra y venta de divisas",
    "disponible esta semana",
    "tipo de cambio oficial",
  ],
} as const
```

**Frecuencia de colección:** cada 15 minutos.

### Capa 3 — Prensa Económica (peso: 0.60)

**Fuente:** `https://www.bancaynegocios.com/tag/intervencion-cambiaria/`
**Método:** scraping HTML del tag de intervención

**Keywords relevantes:** "intervención", "BCV", "menudeo", "liquidez", "bancos"

**Frecuencia:** cada 60 minutos.

### Capa 4 — P2P interno (peso: 0.75)

Los datos P2P ya existen en la tabla `PriceRecord` y `Opportunity` del AIM.
No requiere nuevo collector — se leen directamente de la DB para calcular el
**premium P2P sobre la tasa BCV**.

---

## 4. Modelo de Datos

### 4.1 Nuevos modelos en `prisma/schema.prisma`

```prisma
// ─── Inteligencia Cambiaria ────────────────────────────────────────────────

model BCVRate {
  id          String   @id @default(cuid())
  rateUsd     Float                          // tasa oficial USD/VES
  rateEur     Float?                         // tasa oficial EUR/VES
  date        String   @unique               // YYYY-MM-DD
  changePct   Float?                         // vs. día anterior
  publishedAt DateTime
  collectedAt DateTime @default(now())
  sourceUrl   String

  @@index([date])
  @@index([collectedAt])
}

model IntelSignal {
  id           String   @id @default(cuid())
  source       String                        // bcv | bancamiga | banca_negocios
  sourceLayer  String                        // official | banking | news
  signalType   String                        // ver SignalType enum
  summary      String                        // texto legible
  confidence   Float                         // 0.0 – 1.0
  weight       Float                         // peso de la fuente
  score        Float    @default(0)          // confidence × weight
  metadata     Json?                         // datos crudos relevantes
  detectedAt   DateTime @default(now())
  expiresAt    DateTime?                     // TTL de la señal
  confirmedBy  String[] @default([])         // IDs de señales que confirman
  alerted      Boolean  @default(false)      // ya se envió alerta Telegram

  @@index([signalType, detectedAt])
  @@index([score, detectedAt])
  @@index([expiresAt])
}

model BankingWindow {
  id            String    @id @default(cuid())
  bank          String                        // bancamiga | banesco | bnc
  windowType    String                        // digital | auction | menudeo
  isActive      Boolean   @default(true)
  detectedAt    DateTime  @default(now())
  closedAt      DateTime?
  keywords      String[]                      // keywords que activaron
  sourceUrl     String
  signalId      String?                       // referencia a IntelSignal

  @@index([bank, isActive])
  @@index([detectedAt])
}
```

### 4.2 Nuevos campos en `UserConfig`

```prisma
model UserConfig {
  // ... campos existentes ...

  // ── Inteligencia Cambiaria ─────────────────────────────────────────────
  intelEnabled          Boolean  @default(true)
  bcvAlertOnChange      Boolean  @default(true)   // alertar si BCV cambia
  bcvChangeThresholdPct Float    @default(0.5)    // % de cambio para alertar
  bankingAlertEnabled   Boolean  @default(true)   // alertar ventanas bancarias
  intelAlertMinScore    Float    @default(0.70)   // score mínimo para alertar
}
```

---

## 5. Tipos y Contratos (TypeScript)

```typescript
// lib/intelligence/types.ts

export const SignalType = {
  BCV_RATE_UPDATE:     'bcv_rate_update',
  BCV_RATE_SPIKE:      'bcv_rate_spike',       // cambio > threshold
  BANK_WINDOW_OPEN:    'bank_window_open',
  BANK_DIGITAL_ACTIVE: 'bank_digital_active',
  BANK_AUCTION:        'bank_auction',
  NEWS_INTERVENTION:   'news_intervention',
  NEWS_LIQUIDITY:      'news_liquidity',
  P2P_PREMIUM_HIGH:    'p2p_premium_high',     // P2P muy sobre BCV
  P2P_PREMIUM_LOW:     'p2p_premium_low',      // P2P cerca de BCV
} as const

export type SignalTypeValue = typeof SignalType[keyof typeof SignalType]

// Pesos por capa de fuente
export const SOURCE_WEIGHTS: Record<string, number> = {
  official: 1.00,
  banking:  0.85,
  news:     0.60,
  p2p:      0.75,
}

// TTL en minutos por tipo de señal
export const SIGNAL_TTL_MINUTES: Record<SignalTypeValue, number> = {
  bcv_rate_update:     1440,  // 24h
  bcv_rate_spike:      240,   // 4h
  bank_window_open:    120,   // 2h
  bank_digital_active: 120,   // 2h
  bank_auction:        180,   // 3h
  news_intervention:   360,   // 6h
  news_liquidity:      240,   // 4h
  p2p_premium_high:    30,    // 30min — P2P es volátil
  p2p_premium_low:     30,
}

export type BCVRateData = {
  rateUsd: number
  rateEur: number | null
  date: string
  changePct: number | null
  publishedAt: string
}

export type IntelSignalData = {
  id: string
  source: string
  sourceLayer: string
  signalType: SignalTypeValue
  summary: string
  confidence: number
  weight: number
  score: number
  metadata: Record<string, unknown> | null
  detectedAt: string
  expiresAt: string | null
  confirmedBy: string[]
}

export type OpportunityContext = {
  bcvRate: number | null
  p2pMid: number | null
  premiumPct: number | null            // (p2p - bcv) / bcv * 100
  activeSignals: IntelSignalData[]
  opportunityScore: number             // 0.0 – 1.0
  riskScore: number
  netScore: number
  explanation: string
}
```

---

## 6. Collectors

### 6.1 `lib/intelligence/bcv-collector.ts`

```typescript
// lib/intelligence/bcv-collector.ts
// Colecta la tasa BCV oficial usando API pública + fallback scraping.
// NUNCA llama fetch() directamente — usa proxyRequest desde lib/proxy.ts

import { proxyRequest } from '@/lib/proxy'
import { prisma } from '@/lib/db/prisma'
import type { BCVRateData } from './types'

const BCV_API_URL = 'https://bcv-api.rafnixg.dev/rates/'
const BCV_FALLBACK_URL = 'https://www.bcv.org.ve'

type BcvApiResponse = {
  usd: string | number
  eur?: string | number
  date?: string
}

export async function collectBCVRate(): Promise<BCVRateData | null> {
  // Estrategia 1: API pública (más estable)
  const apiResult = await proxyRequest<BcvApiResponse>({
    url: BCV_API_URL,
    context: 'bcv_rate_api',
    timeoutMs: 8000,
    retries: 2,
  })

  if (apiResult.ok) {
    const data = apiResult.data
    const rateUsd = parseFloat(String(data.usd))
    const rateEur = data.eur ? parseFloat(String(data.eur)) : null
    const date = data.date ?? new Date().toISOString().slice(0, 10)

    if (!isNaN(rateUsd) && rateUsd > 0) {
      return { rateUsd, rateEur, date, changePct: null, publishedAt: new Date().toISOString() }
    }
  }

  console.warn('[bcv-collector] API falló, intentando scraping directo')

  // Estrategia 2: Scraping directo del BCV (fallback)
  const scrapeResult = await proxyRequest<string>({
    url: BCV_FALLBACK_URL,
    context: 'bcv_rate_scrape',
    timeoutMs: 12000,
    retries: 1,
  })

  if (!scrapeResult.ok) {
    console.error('[bcv-collector] Ambas estrategias fallaron:', scrapeResult.error)
    return null
  }

  return parseBCVHtml(scrapeResult.data)
}

function parseBCVHtml(html: string): BCVRateData | null {
  // El BCV publica la tasa en un elemento específico del HTML
  // Este selector puede cambiar si el BCV rediseña su sitio
  const patterns = [
    /<strong>\s*([\d,]+(?:\.\d+)?)\s*<\/strong>/,
    /id="dolar"[^>]*>[\s\S]*?<strong>([\d,]+)<\/strong>/,
    /Tipo de Cambio[^<]*<[^>]+>\s*([\d,]+)/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const raw = match[1].replace('.', '').replace(',', '.')
      const rate = parseFloat(raw)
      if (!isNaN(rate) && rate > 0) {
        return {
          rateUsd: rate,
          rateEur: null,
          date: new Date().toISOString().slice(0, 10),
          changePct: null,
          publishedAt: new Date().toISOString(),
        }
      }
    }
  }

  console.error('[bcv-collector] No se pudo parsear la tasa del HTML del BCV')
  return null
}

export async function persistBCVRate(data: BCVRateData): Promise<{
  saved: boolean
  changed: boolean
  changePct: number | null
}> {
  // Buscar tasa del día anterior para calcular changePct
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const prevRate = await prisma.bCVRate.findFirst({
    where: { date: yesterdayStr },
    select: { rateUsd: true },
  })

  const changePct = prevRate
    ? ((data.rateUsd - prevRate.rateUsd) / prevRate.rateUsd) * 100
    : null

  // Upsert por fecha — un registro por día
  const existing = await prisma.bCVRate.findUnique({ where: { date: data.date } })

  if (existing && Math.abs(existing.rateUsd - data.rateUsd) < 0.0001) {
    // Sin cambio — no actualizar
    return { saved: false, changed: false, changePct }
  }

  await prisma.bCVRate.upsert({
    where: { date: data.date },
    update: {
      rateUsd: data.rateUsd,
      rateEur: data.rateEur ?? undefined,
      changePct,
      collectedAt: new Date(),
    },
    create: {
      rateUsd: data.rateUsd,
      rateEur: data.rateEur ?? undefined,
      date: data.date,
      changePct,
      publishedAt: new Date(data.publishedAt),
      sourceUrl: BCV_API_URL,
    },
  })

  return { saved: true, changed: true, changePct }
}
```

### 6.2 `lib/intelligence/banking-collector.ts`

```typescript
// lib/intelligence/banking-collector.ts
// Detecta ventanas de Intervención Digital en sitios bancarios.
// Usa proxyRequest — nunca fetch() directo.

import { proxyRequest } from '@/lib/proxy'
import { prisma } from '@/lib/db/prisma'
import { BANKING_KEYWORDS } from './keywords'
import { SignalType } from './types'
import type { SignalTypeValue } from './types'
import { createId } from '@paralleldrive/cuid2'

const BANKING_SOURCES = [
  {
    bank: 'bancamiga',
    url: 'https://www.bancamiga.com',
    layer: 'banking',
    weight: 0.85,
  },
  {
    bank: 'banesco',
    url: 'https://www.banesco.com/informacion-de-interes/sistema-mercado-cambiario/',
    layer: 'banking',
    weight: 0.80,
  },
] as const

export type BankingSignalDetected = {
  bank: string
  signalType: SignalTypeValue
  keywords: string[]
  confidence: number
  weight: number
  score: number
  url: string
}

export async function collectBankingSignals(): Promise<BankingSignalDetected[]> {
  const detected: BankingSignalDetected[] = []

  for (const source of BANKING_SOURCES) {
    try {
      const result = await proxyRequest<string>({
        url: source.url,
        context: `banking_${source.bank}`,
        timeoutMs: 10000,
        retries: 1,
      })

      if (!result.ok) {
        console.warn(`[banking-collector] ${source.bank} fetch failed: ${result.error}`)
        continue
      }

      const signal = analyzePageContent(result.data, source.bank, source.url, source.weight)
      if (signal) detected.push(signal)

    } catch (err) {
      console.error(`[banking-collector] ${source.bank} error:`, err)
    }
  }

  return detected
}

function analyzePageContent(
  html: string,
  bank: string,
  url: string,
  sourceWeight: number,
): BankingSignalDetected | null {
  const text = html.toLowerCase()

  // Buscar keywords por prioridad
  const highMatches = BANKING_KEYWORDS.HIGH_SIGNAL.filter(kw => text.includes(kw))
  const medMatches  = BANKING_KEYWORDS.MEDIUM_SIGNAL.filter(kw => text.includes(kw))

  if (highMatches.length === 0 && medMatches.length === 0) return null

  const allMatches = [...highMatches, ...medMatches]

  // Determinar tipo de señal
  let signalType: SignalTypeValue = SignalType.BANK_WINDOW_OPEN
  if (highMatches.includes('intervención digital') || highMatches.includes('intervencion digital')) {
    signalType = SignalType.BANK_DIGITAL_ACTIVE
  } else if (highMatches.includes('subasta privada')) {
    signalType = SignalType.BANK_AUCTION
  }

  // Calcular confianza basada en cantidad y tipo de keywords
  const confidence = highMatches.length > 0
    ? Math.min(0.95, 0.70 + highMatches.length * 0.10)
    : Math.min(0.75, 0.50 + medMatches.length * 0.08)

  const score = sourceWeight * confidence

  return { bank, signalType, keywords: allMatches, confidence, weight: sourceWeight, score, url }
}

export async function persistBankingSignals(
  signals: BankingSignalDetected[],
): Promise<void> {
  for (const s of signals) {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // TTL 2h

    // Verificar si ya existe una señal activa idéntica para este banco
    const existingActive = await prisma.intelSignal.findFirst({
      where: {
        source: s.bank,
        signalType: s.signalType,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingActive) continue // ya registrada y activa

    await prisma.intelSignal.create({
      data: {
        id: createId(),
        source: s.bank,
        sourceLayer: 'banking',
        signalType: s.signalType,
        summary: buildBankingSummary(s),
        confidence: s.confidence,
        weight: s.weight,
        score: s.score,
        metadata: { keywords: s.keywords, url: s.url },
        expiresAt,
      },
    })

    // Registrar ventana bancaria activa
    await prisma.bankingWindow.create({
      data: {
        bank: s.bank,
        windowType: s.signalType === SignalType.BANK_DIGITAL_ACTIVE
          ? 'digital'
          : s.signalType === SignalType.BANK_AUCTION ? 'auction' : 'menudeo',
        keywords: s.keywords,
        sourceUrl: s.url,
      },
    })
  }
}

function buildBankingSummary(s: BankingSignalDetected): string {
  const bank = s.bank.charAt(0).toUpperCase() + s.bank.slice(1)
  if (s.signalType === SignalType.BANK_DIGITAL_ACTIVE) {
    return `${bank} — Intervención Digital activa`
  }
  if (s.signalType === SignalType.BANK_AUCTION) {
    return `${bank} — Subasta privada detectada`
  }
  return `${bank} — Ventana cambiaria activa`
}
```

### 6.3 `lib/intelligence/signal-engine.ts`

```typescript
// lib/intelligence/signal-engine.ts
// Calcula el Opportunity Score de contexto combinando señales activas
// con los datos P2P ya presentes en la DB del AIM.

import { prisma } from '@/lib/db/prisma'
import { SIGNAL_TTL_MINUTES, SignalType } from './types'
import type { OpportunityContext } from './types'

export async function calculateOpportunityContext(): Promise<OpportunityContext> {
  // 1. Señales activas (no expiradas)
  const now = new Date()
  const activeSignals = await prisma.intelSignal.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: { score: 'desc' },
    take: 20,
  })

  // 2. Tasa BCV más reciente
  const latestBCV = await prisma.bCVRate.findFirst({
    orderBy: { collectedAt: 'desc' },
  })

  // 3. Precio P2P VES más reciente (de PriceRecord del monitor)
  const latestP2P = await prisma.priceRecord.findFirst({
    where: {
      platform: { in: ['binance_p2p_ves', 'binance_p2p'] },
      asset: 'USDT',
    },
    orderBy: { recordedAt: 'desc' },
  })

  // 4. Calcular premium P2P sobre BCV
  let premiumPct: number | null = null
  if (latestBCV && latestP2P) {
    const p2pMid = latestP2P.priceMid
    const bcvRate = latestBCV.rateUsd
    if (bcvRate > 0) {
      premiumPct = ((p2pMid - bcvRate) / bcvRate) * 100
    }
  }

  // 5. Calcular scores
  const { opportunityScore, riskScore, explanation } = computeScores(
    activeSignals,
    premiumPct,
  )

  return {
    bcvRate: latestBCV?.rateUsd ?? null,
    p2pMid: latestP2P?.priceMid ?? null,
    premiumPct,
    activeSignals: activeSignals.map(s => ({
      id: s.id,
      source: s.source,
      sourceLayer: s.sourceLayer,
      signalType: s.signalType as import('./types').SignalTypeValue,
      summary: s.summary,
      confidence: s.confidence,
      weight: s.weight,
      score: s.score,
      metadata: s.metadata as Record<string, unknown> | null,
      detectedAt: s.detectedAt.toISOString(),
      expiresAt: s.expiresAt?.toISOString() ?? null,
      confirmedBy: s.confirmedBy,
    })),
    opportunityScore,
    riskScore,
    netScore: opportunityScore - riskScore,
    explanation,
  }
}

function computeScores(
  signals: import('@prisma/client').IntelSignal[],
  premiumPct: number | null,
): { opportunityScore: number; riskScore: number; explanation: string } {
  const parts: string[] = []
  let baseScore = 0

  // Contribución de señales activas
  const signalContrib = signals.reduce((sum, s) => sum + s.score, 0)
  baseScore += Math.min(0.50, signalContrib * 0.10)

  // Boost por ventana bancaria activa (la señal más operativamente relevante)
  const hasBankWindow = signals.some(s =>
    [SignalType.BANK_DIGITAL_ACTIVE, SignalType.BANK_AUCTION, SignalType.BANK_WINDOW_OPEN]
      .includes(s.signalType as never)
  )
  if (hasBankWindow) {
    baseScore += 0.25
    parts.push('Ventana bancaria activa')
  }

  // Score por premium P2P (el indicador operativo central)
  let premiumScore = 0
  if (premiumPct !== null) {
    if (premiumPct > 15) {
      premiumScore = 0.90
      parts.push(`Premium P2P muy alto: ${premiumPct.toFixed(1)}%`)
    } else if (premiumPct > 8) {
      premiumScore = 0.65
      parts.push(`Premium P2P alto: ${premiumPct.toFixed(1)}%`)
    } else if (premiumPct > 3) {
      premiumScore = 0.40
      parts.push(`Premium P2P moderado: ${premiumPct.toFixed(1)}%`)
    } else if (premiumPct > 0) {
      premiumScore = 0.15
    }
  }

  const opportunityScore = Math.min(1.0, baseScore * 0.5 + premiumScore * 0.5)

  // Risk score
  let riskScore = 0.10 // base
  const unconfirmed = signals.filter(s => s.confirmedBy.length === 0).length
  if (signals.length > 0 && unconfirmed === signals.length) riskScore += 0.15
  if (premiumPct !== null && premiumPct > 20) riskScore += 0.20 // spread extremo = riesgo
  if (signals.length === 0) riskScore += 0.20 // sin señales = operar a ciegas

  if (signals.length > 0) {
    parts.push(`${signals.length} señal(es) activa(s)`)
  }

  return {
    opportunityScore: parseFloat(opportunityScore.toFixed(4)),
    riskScore: parseFloat(Math.min(1.0, riskScore).toFixed(4)),
    explanation: parts.length > 0 ? parts.join(' · ') : 'Sin señales activas',
  }
}
```

---

## 7. Integración en el Scanner

```typescript
// En lib/scanner-service.ts — añadir al ciclo de scan existente

import { collectBCVRate, persistBCVRate } from '@/lib/intelligence/bcv-collector'
import { collectBankingSignals, persistBankingSignals } from '@/lib/intelligence/banking-collector'
import { getOrCreateDefaultUserConfig } from '@/lib/db/queries/user-config'
import { sendIntelligenceAlert } from '@/lib/alerts/telegram'

// Dentro del ciclo de scan, al FINAL (después de oportunidades y price monitor):
// Frecuencia de los collectors de inteligencia:
// - BCV: cada ~4 ciclos (si el scanner corre cada 3min → cada 12min)
// - Banking: cada ~2 ciclos (cada 6min)
// Usar un contador de ciclos para no correr en cada iteración

let intelCycleCount = 0

async function runIntelligenceCollectors(config: UserConfig): Promise<void> {
  if (!config.intelEnabled) return
  intelCycleCount++

  // BCV: cada 4 ciclos (~12 min si ciclo = 3min)
  if (intelCycleCount % 4 === 0) {
    const bcvData = await collectBCVRate()
    if (bcvData) {
      const { saved, changed, changePct } = await persistBCVRate(bcvData)
      if (saved && changed && config.bcvAlertOnChange) {
        const threshold = config.bcvChangeThresholdPct ?? 0.5
        if (changePct !== null && Math.abs(changePct) >= threshold) {
          await sendIntelligenceAlert({
            chatId: config.alertTelegram!,
            type: 'bcv_rate',
            summary: `BCV: 1 USD = ${bcvData.rateUsd.toFixed(2)} VES (${changePct > 0 ? '+' : ''}${changePct!.toFixed(2)}%)`,
            score: 1.0,
          })
        }
      }
    }
  }

  // Banking: cada 2 ciclos (~6 min)
  if (intelCycleCount % 2 === 0) {
    const bankSignals = await collectBankingSignals()
    if (bankSignals.length > 0) {
      await persistBankingSignals(bankSignals)

      if (config.bankingAlertEnabled && config.alertTelegram) {
        for (const signal of bankSignals) {
          if (signal.score >= (config.intelAlertMinScore ?? 0.70)) {
            await sendIntelligenceAlert({
              chatId: config.alertTelegram,
              type: 'banking',
              summary: `${signal.bank.toUpperCase()} — ${signal.keywords[0]}`,
              score: signal.score,
            })
          }
        }
      }
    }
  }
}
```

---

## 8. Extensión de Alertas Telegram

```typescript
// Añadir al final de lib/alerts/telegram.ts

export type IntelAlertPayload = {
  chatId: string
  type: 'bcv_rate' | 'banking' | 'signal' | 'opportunity'
  summary: string
  score: number
  metadata?: Record<string, unknown>
}

export async function sendIntelligenceAlert(payload: IntelAlertPayload): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken || !payload.chatId) return

  const EMOJIS: Record<string, string> = {
    bcv_rate: '🏦',
    banking:  '✅',
    signal:   '📡',
    opportunity: '⚡',
  }

  const emoji = EMOJIS[payload.type] ?? 'ℹ️'
  const scoreBar = '█'.repeat(Math.round(payload.score * 10)) + '░'.repeat(10 - Math.round(payload.score * 10))

  const message = [
    `${emoji} *AIM · Inteligencia Cambiaria*`,
    ``,
    `*Señal:* ${payload.summary}`,
    `*Score:* \`${scoreBar}\` ${(payload.score * 100).toFixed(0)}%`,
    ``,
    `_${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })} VET_`,
  ].join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: payload.chatId, text: message, parse_mode: 'Markdown' }),
    })
  } catch (err) {
    console.error('[telegram] intelligence alert failed:', err)
  }
}
```

---

## 9. Server Actions

```typescript
// lib/actions/intelligence.actions.ts
'use server'

import { getAuthenticatedUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/db/prisma'
import { calculateOpportunityContext } from '@/lib/intelligence/signal-engine'
import type { OpportunityContext, BCVRateData } from '@/lib/intelligence/types'

// ── Datos para el dashboard ───────────────────────────────────────────────

export async function getIntelligenceDashboard(): Promise<{
  context: OpportunityContext
  bcvHistory: BCVRateData[]
  bankingWindows: {
    bank: string
    windowType: string
    isActive: boolean
    detectedAt: string
    keywords: string[]
  }[]
} | null> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null

  const [context, bcvHistory, bankingWindows] = await Promise.all([
    calculateOpportunityContext(),
    getBCVHistory(30),       // últimos 30 días
    getActiveBankingWindows(),
  ])

  return { context, bcvHistory, bankingWindows }
}

async function getBCVHistory(days: number): Promise<BCVRateData[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rows = await prisma.bCVRate.findMany({
    where: { collectedAt: { gte: since } },
    orderBy: { date: 'asc' },
    select: { rateUsd: true, rateEur: true, date: true, changePct: true, publishedAt: true },
  })
  return rows.map(r => ({
    rateUsd: r.rateUsd,
    rateEur: r.rateEur ?? null,
    date: r.date,
    changePct: r.changePct ?? null,
    publishedAt: r.publishedAt.toISOString(),
  }))
}

async function getActiveBankingWindows() {
  const windows = await prisma.bankingWindow.findMany({
    where: { isActive: true },
    orderBy: { detectedAt: 'desc' },
    take: 10,
  })
  return windows.map(w => ({
    bank: w.bank,
    windowType: w.windowType,
    isActive: w.isActive,
    detectedAt: w.detectedAt.toISOString(),
    keywords: w.keywords,
  }))
}

// Obtener señales activas para el feed
export async function getActiveSignals() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return []

  const now = new Date()
  return prisma.intelSignal.findMany({
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { detectedAt: 'desc' },
    take: 50,
  })
}

// Obtener historial de señales (incluyendo expiradas)
export async function getSignalHistory(hours = 48) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return []

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  return prisma.intelSignal.findMany({
    where: { detectedAt: { gte: since } },
    orderBy: { detectedAt: 'desc' },
    take: 100,
  })
}

// Actualizar config de inteligencia
export async function updateIntelConfig(input: {
  intelEnabled: boolean
  bcvAlertOnChange: boolean
  bcvChangeThresholdPct: number
  bankingAlertEnabled: boolean
  intelAlertMinScore: number
}): Promise<{ success: boolean; error?: string }> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { success: false, error: 'No autenticado' }

  await prisma.userConfig.update({
    where: { userId },
    data: input,
  })

  return { success: true }
}
```

---

## 10. Componentes UI

### 10.1 `components/dashboard/intelligence/bcv-rate-card.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { OpportunityContext } from '@/lib/intelligence/types'

type Props = {
  bcvRate: number | null
  p2pMid: number | null
  premiumPct: number | null
  changePct?: number | null
}

export function BCVRateCard({ bcvRate, p2pMid, premiumPct, changePct }: Props) {
  const premiumColor =
    premiumPct === null ? '' :
    premiumPct > 8 ? 'text-green-500' :
    premiumPct > 3 ? 'text-yellow-500' : 'text-muted-foreground'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Tasa BCV */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Tasa BCV Oficial
          </p>
          <p className="text-2xl font-bold font-mono">
            {bcvRate ? `${bcvRate.toFixed(2)} VES` : '—'}
          </p>
          {changePct !== null && changePct !== undefined && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${changePct > 0 ? 'text-red-400' : changePct < 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
              {changePct > 0 ? <TrendingUp className="w-3 h-3" /> :
               changePct < 0 ? <TrendingDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}% vs ayer
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">1 USD = X VES</p>
        </CardContent>
      </Card>

      {/* Precio P2P */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            P2P Binance VES
          </p>
          <p className="text-2xl font-bold font-mono">
            {p2pMid ? `${p2pMid.toFixed(2)} VES` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Precio medio USDT/VES
          </p>
        </CardContent>
      </Card>

      {/* Premium P2P sobre BCV */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Premium P2P / BCV
          </p>
          <p className={`text-2xl font-bold font-mono ${premiumColor}`}>
            {premiumPct !== null ? `+${premiumPct.toFixed(2)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            {premiumPct !== null && premiumPct > 8
              ? 'Spread alto — ventana potencial'
              : 'Diferencia P2P vs oficial'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 10.2 `components/dashboard/intelligence/signal-feed.tsx`

```tsx
import { Badge } from '@/components/ui/badge'
import type { IntelSignalData } from '@/lib/intelligence/types'

const SIGNAL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  bcv_rate_update:     { label: 'BCV Rate',          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    emoji: '🏦' },
  bcv_rate_spike:      { label: 'BCV Spike',          color: 'bg-red-500/15 text-red-400 border-red-500/30',       emoji: '🚨' },
  bank_window_open:    { label: 'Ventana Bancaria',   color: 'bg-green-500/15 text-green-400 border-green-500/30', emoji: '🟢' },
  bank_digital_active: { label: 'Intervención Dig.',  color: 'bg-green-500/15 text-green-400 border-green-500/30', emoji: '✅' },
  bank_auction:        { label: 'Subasta Privada',    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', emoji: '🔔' },
  news_intervention:   { label: 'Prensa — Interv.',   color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', emoji: '📰' },
  p2p_premium_high:    { label: 'P2P Premium Alto',   color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', emoji: '📈' },
}

function SignalRow({ signal }: { signal: IntelSignalData }) {
  const config = SIGNAL_LABELS[signal.signalType] ?? { label: signal.signalType, color: '', emoji: 'ℹ️' }
  const ageMin = Math.round((Date.now() - new Date(signal.detectedAt).getTime()) / 60_000)
  const ageLabel = ageMin < 60 ? `hace ${ageMin}min` : `hace ${Math.round(ageMin / 60)}h`
  const scoreBar = '█'.repeat(Math.round(signal.score * 10))
  const isEmpty  = '░'.repeat(10 - Math.round(signal.score * 10))

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <span className="text-base mt-0.5">{config.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
            {config.label}
          </Badge>
          {signal.confirmedBy.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/20">
              ✓ Confirmada
            </Badge>
          )}
        </div>
        <p className="text-sm mt-1 font-medium">{signal.summary}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-mono text-muted-foreground">
            {scoreBar}{isEmpty} {(signal.score * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-muted-foreground">{ageLabel}</span>
        </div>
      </div>
    </div>
  )
}

export function SignalFeed({ signals }: { signals: IntelSignalData[] }) {
  if (signals.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Sin señales activas. El sistema está monitoreando.
      </div>
    )
  }

  return (
    <div className="divide-y">
      {signals.map(s => <SignalRow key={s.id} signal={s} />)}
    </div>
  )
}
```

### 10.3 `components/dashboard/intelligence/context-panel.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OpportunityContext } from '@/lib/intelligence/types'

function ScoreGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100)
  const bar  = '█'.repeat(Math.round(value * 20))
  const empty = '░'.repeat(20 - Math.round(value * 20))

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${color}`}>{pct}%</span>
      </div>
      <p className={`font-mono text-xs ${color}`}>{bar}{empty}</p>
    </div>
  )
}

export function ContextPanel({ context }: { context: OpportunityContext }) {
  const netColor =
    context.netScore > 0.3 ? 'text-green-500' :
    context.netScore > 0   ? 'text-yellow-500' : 'text-red-400'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Contexto de Mercado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreGauge value={context.opportunityScore} label="Oportunidad"  color="text-green-500" />
        <ScoreGauge value={context.riskScore}        label="Riesgo"       color="text-red-400"   />

        <div className="border-t pt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground font-medium">Score Neto</span>
            <span className={`text-lg font-bold ${netColor}`}>
              {context.netScore > 0 ? '+' : ''}{(context.netScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {context.explanation && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2 leading-relaxed">
            {context.explanation}
          </p>
        )}

        {context.activeSignals.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {context.activeSignals.length} señal(es) activa(s)
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### 10.4 `components/dashboard/intelligence/spread-correlation-chart.tsx`

```tsx
'use client'

import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { BCVRateData } from '@/lib/intelligence/types'

const CHART_CONFIG = {
  rateUsd:    { label: 'Tasa BCV (VES)',     color: 'var(--color-brand-primary)' },
  changePct:  { label: 'Variación diaria %', color: 'var(--color-warning)' },
}

export function SpreadCorrelationChart({ history }: { history: BCVRateData[] }) {
  const data = history.map(r => ({
    date: r.date.slice(5),           // MM-DD
    rateUsd: r.rateUsd,
    changePct: r.changePct,
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Sin historial de tasa BCV. Se comenzará a registrar en los próximos scans.
      </div>
    )
  }

  return (
    <ChartContainer config={CHART_CONFIG} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="rate"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
            width={45}
          />
          <YAxis
            yAxisId="change"
            orientation="right"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}%`}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 11,
            }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="rateUsd"
            name="Tasa BCV"
            stroke="var(--color-brand-primary)"
            strokeWidth={2}
            dot={false}
          />
          <Bar
            yAxisId="change"
            dataKey="changePct"
            name="Variación %"
            fill="var(--color-warning)"
            opacity={0.6}
            radius={[2, 2, 0, 0]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
```

### 10.5 `components/dashboard/intelligence/intelligence-panel.tsx`

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BCVRateCard } from './bcv-rate-card'
import { SignalFeed } from './signal-feed'
import { ContextPanel } from './context-panel'
import { SpreadCorrelationChart } from './spread-correlation-chart'
import { getSignalHistory } from '@/lib/actions/intelligence.actions'
import { RefreshCw } from 'lucide-react'
import type { OpportunityContext, BCVRateData, IntelSignalData } from '@/lib/intelligence/types'

type BankingWindowData = {
  bank: string
  windowType: string
  isActive: boolean
  detectedAt: string
  keywords: string[]
}

type Props = {
  context: OpportunityContext
  bcvHistory: BCVRateData[]
  bankingWindows: BankingWindowData[]
}

export function IntelligencePanel({ context, bcvHistory, bankingWindows }: Props) {
  const [signals, setSignals] = useState<IntelSignalData[]>(
    context.activeSignals
  )
  const [isPending, startTransition] = useTransition()

  const latestBCV = bcvHistory[bcvHistory.length - 1]
  const prevBCV   = bcvHistory[bcvHistory.length - 2]
  const changePct = latestBCV && prevBCV
    ? ((latestBCV.rateUsd - prevBCV.rateUsd) / prevBCV.rateUsd) * 100
    : null

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getSignalHistory(48)
      setSignals(fresh.map(s => ({
        id: s.id,
        source: s.source,
        sourceLayer: s.sourceLayer,
        signalType: s.signalType as IntelSignalData['signalType'],
        summary: s.summary,
        confidence: s.confidence,
        weight: s.weight,
        score: s.score,
        metadata: s.metadata as Record<string, unknown> | null,
        detectedAt: s.detectedAt.toISOString(),
        expiresAt: s.expiresAt?.toISOString() ?? null,
        confirmedBy: s.confirmedBy,
      })))
    })
  }

  return (
    <div className="space-y-6">
      {/* Tasas + Premium */}
      <BCVRateCard
        bcvRate={context.bcvRate}
        p2pMid={context.p2pMid}
        premiumPct={context.premiumPct}
        changePct={changePct}
      />

      {/* Context Score + Signal Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ContextPanel context={context} />

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Feed de Señales</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isPending}
                  className="h-7 px-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <SignalFeed signals={signals} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ventanas bancarias activas */}
      {bankingWindows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">✅ Ventanas Bancarias Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bankingWindows.map((w, i) => (
                <div key={i} className="rounded-lg border bg-green-500/5 border-green-500/20 p-3">
                  <p className="font-semibold text-sm text-green-400 capitalize">{w.bank}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{w.windowType}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {w.keywords.slice(0, 2).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico histórico BCV */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Historial Tasa BCV — últimos 30 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SpreadCorrelationChart history={bcvHistory} />
        </CardContent>
      </Card>
    </div>
  )
}
```

### 10.6 `app/(dashboard)/dashboard/inteligencia/page.tsx`

```tsx
import { requireAuth } from '@/lib/auth-helpers'
import { getIntelligenceDashboard } from '@/lib/actions/intelligence.actions'
import { IntelligencePanel } from '@/components/dashboard/intelligence/intelligence-panel'
import { Radar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function InteligenciaPage() {
  await requireAuth()

  const data = await getIntelligenceDashboard()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radar className="w-6 h-6 text-brand-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Inteligencia Cambiaria</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Contexto BCV · Ventanas bancarias · Señales del mercado venezolano
          </p>
        </div>
      </div>

      {data ? (
        <IntelligencePanel
          context={data.context}
          bcvHistory={data.bcvHistory}
          bankingWindows={data.bankingWindows}
        />
      ) : (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Error cargando datos. Verifica la autenticación.
        </div>
      )}
    </div>
  )
}
```

### 10.7 Actualizar sidebar

```typescript
// En components/dashboard/sidebar.tsx — añadir al array NAV_ITEMS

import { Radar } from 'lucide-react'  // añadir al import existente

const NAV_ITEMS = [
  { href: '/dashboard',                  label: 'Monitor',         icon: Activity },
  { href: '/dashboard/opportunities',    label: 'Historial',       icon: BarChart3 },
  { href: '/dashboard/monitor',          label: 'Monitor P2P',     icon: BarChart2 },
  { href: '/dashboard/inteligencia',     label: 'Inteligencia',    icon: Radar },    // ← nuevo
  { href: '/dashboard/analysis',         label: 'Análisis IA',     icon: Brain },
  { href: '/dashboard/config',           label: 'Configuración',   icon: Settings },
]
```

---

## 11. Variables de Entorno

No se añaden variables nuevas. El feature reutiliza:
- `TELEGRAM_BOT_TOKEN` — ya existe
- `DATABASE_URL` — ya existe

No se requiere API key para la BCV API pública (`bcv-api.rafnixg.dev`).

---

## 12. Acceptance Criteria

### AC-IC01: Tasa BCV capturada cada ciclo
**Dado** que el scanner corre,
**Cuando** han pasado ~4 ciclos,
**Entonces** hay al menos 1 registro en `BCVRate` con `date = hoy` y `rateUsd > 0`.
**Verificación:** `SELECT * FROM "BCVRate" ORDER BY "collectedAt" DESC LIMIT 1`.

### AC-IC02: Sin registros duplicados BCV
**Dado** que la tasa del día ya está registrada,
**Cuando** el collector corre de nuevo con la misma tasa,
**Entonces** el count de `BCVRate` para esa fecha no aumenta.
**Verificación:** Dos colecciones consecutivas → mismo count por `date`.

### AC-IC03: Ventana bancaria detectada
**Dado** que Bancamiga publica un post con la keyword "intervención digital",
**Entonces** se crea un `IntelSignal` con `signalType = 'bank_digital_active'` y `confidence >= 0.90`.
**Verificación:** Test con HTML mock de Bancamiga.

### AC-IC04: Señales expiran por TTL
**Dado** una señal `bank_digital_active` con `expiresAt = hace 3 horas`,
**Cuando** se consulta `getActiveSignals()`,
**Entonces** esa señal NO aparece en el resultado.
**Verificación:** Test unitario con fecha mock.

### AC-IC05: Premium P2P calculado correctamente
**Dado** `BCVRate.rateUsd = 60.00` y `PriceRecord.priceMid = 66.00`,
**Cuando** se calcula el contexto,
**Entonces** `premiumPct = 10.0` exacto.
**Verificación:** Unit test en `signal-engine.test.ts`.

### AC-IC06: Alerta Telegram por ventana bancaria
**Dado** `bankingAlertEnabled = true` y `alertTelegram` configurado,
**Cuando** se detecta `bank_digital_active` con score >= threshold,
**Entonces** se envía mensaje Telegram con el emoji ✅ y el resumen.
**Verificación:** Mock de Telegram + verificar payload.

### AC-IC07: Alerta BCV por cambio > threshold
**Dado** `bcvAlertOnChange = true` y `bcvChangeThresholdPct = 0.5`,
**Cuando** la tasa cambia un 0.8% respecto al día anterior,
**Entonces** se envía alerta Telegram con el nuevo valor.
**Verificación:** Test con tasas mock.

### AC-IC08: Dashboard carga con datos reales
**Dado** sesión activa y al menos 1 ciclo de scan completado,
**Cuando** el operador accede a `/dashboard/inteligencia`,
**Entonces** la página carga con BCVRateCard mostrando datos reales.
**Verificación:** Visual + `npm run build` sin errores.

### AC-IC09: Protección de ruta
**Dado** usuario no autenticado,
**Cuando** accede a `/dashboard/inteligencia`,
**Entonces** redirect a `/login`.
**Verificación:** Navegación sin sesión.

### AC-IC10: Sin escritura en DB fuera del scanner
**Dado** que el operador solo navega el dashboard,
**Cuando** se inspeccionan los logs del servidor,
**Entonces** no hay INSERTs en `IntelSignal` ni `BCVRate` — solo los del scanner.
**Verificación:** Logs + count de registros antes/después de navegación.

---

## 13. Plan de Ejecución por Fases

---

### FASE IC-1 — Base de Datos

**Objetivo:** Schema, migration, queries. Sin lógica de negocio.

**Tareas:**

**TIC1.1 — Actualizar `prisma/schema.prisma`**
Añadir exactamente los modelos de la sección 4.1 y los campos de `UserConfig` de la sección 4.2.

**TIC1.2 — Crear migration**
```bash
npx prisma migrate dev --name add_intelligence_models
npx prisma generate
```

**TIC1.3 — Crear `lib/db/queries/bcv-signals.ts`**
```typescript
// lib/db/queries/bcv-signals.ts
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
```

**TIC1.4 — Actualizar `lib/db/queries/user-config.ts`**
Añadir defaults de los nuevos campos en `getOrCreateDefaultUserConfig`:
```typescript
// En el objeto create:
intelEnabled: true,
bcvAlertOnChange: true,
bcvChangeThresholdPct: 0.5,
bankingAlertEnabled: true,
intelAlertMinScore: 0.70,
```

**Verificación de salida FIC-1:**
- [ ] `npx prisma validate` → sin errores
- [ ] `npx prisma studio` → tablas `BCVRate`, `IntelSignal`, `BankingWindow` visibles
- [ ] `UserConfig` tiene los 5 campos nuevos
- [ ] `npm run typecheck` → 0 errores

**HANDOFF FIC-1:**
```
FASE_COMPLETADA: IC-1
MIGRATION: add_intelligence_models aplicada
MODELOS_NUEVOS: BCVRate, IntelSignal, BankingWindow
USERCONFIG_NUEVOS: intelEnabled, bcvAlertOnChange, bcvChangeThresholdPct, bankingAlertEnabled, intelAlertMinScore
QUERIES: lib/db/queries/bcv-signals.ts — 4 funciones
SIGUIENTE: IC-2 — Collectors y Signal Engine
```

---

### FASE IC-2 — Collectors y Signal Engine

**Objetivo:** Crear los 2 collectors y el signal engine. Integrar en el scanner.
Verificar que los datos aparecen en DB después del primer ciclo.

**Tareas:**

**TIC2.1 — Crear `lib/intelligence/keywords.ts`**
Implementar el objeto `BANKING_KEYWORDS` de la sección 3.

**TIC2.2 — Crear `lib/intelligence/types.ts`**
Implementar todos los tipos de la sección 5.

**TIC2.3 — Crear `lib/intelligence/bcv-collector.ts`**
Implementar exactamente la sección 6.1.
Verificar manualmente:
```bash
npx tsx -e "
import { collectBCVRate } from './lib/intelligence/bcv-collector'
const data = await collectBCVRate()
console.log(data)
"
```
Debe retornar `{ rateUsd: número_real, date: 'YYYY-MM-DD', ... }`.

**TIC2.4 — Crear `lib/intelligence/banking-collector.ts`**
Implementar exactamente la sección 6.2.

**TIC2.5 — Crear `lib/intelligence/signal-engine.ts`**
Implementar exactamente la sección 6.3.

**TIC2.6 — Extender `lib/alerts/telegram.ts`**
Añadir `sendIntelligenceAlert()` de la sección 8.

**TIC2.7 — Integrar en `lib/scanner-service.ts`**
Añadir `runIntelligenceCollectors()` de la sección 7 al ciclo existente.

**TIC2.8 — Verificar con scan manual**
Ejecutar un scan desde el dashboard y verificar en DB:
```bash
# En Prisma Studio o Neon console:
SELECT * FROM "BCVRate" ORDER BY "collectedAt" DESC LIMIT 3;
SELECT * FROM "IntelSignal" ORDER BY "detectedAt" DESC LIMIT 5;
```

**Verificación de salida FIC-2:**
- [ ] `collectBCVRate()` retorna tasa real del BCV
- [ ] Un scan manual → al menos 1 `BCVRate` en DB
- [ ] `npm run typecheck` → 0 errores
- [ ] Logs del scanner: `[scanner] intel bcv: tasa guardada`

**HANDOFF FIC-2:**
```
FASE_COMPLETADA: IC-2
COLLECTORS: bcv-collector.ts, banking-collector.ts
SIGNAL_ENGINE: signal-engine.ts — calculateOpportunityContext()
TYPES: lib/intelligence/types.ts, lib/intelligence/keywords.ts
TELEGRAM: sendIntelligenceAlert() añadida
SCANNER: runIntelligenceCollectors() integrado
DB_POPULATED: BCVRate con datos reales
SIGUIENTE: IC-3 — Server Actions y UI
```

---

### FASE IC-3 — Server Actions y UI

**Objetivo:** Actions, todos los componentes, página, sidebar. El feature completo visible.

**Tareas:**

**TIC3.1 — Crear `lib/actions/intelligence.actions.ts`**
Implementar exactamente la sección 9.

**TIC3.2 — Crear directorio de componentes**
```bash
mkdir -p components/dashboard/intelligence
```

**TIC3.3 — Crear componentes en orden**
1. `components/dashboard/intelligence/bcv-rate-card.tsx` (sección 10.1)
2. `components/dashboard/intelligence/signal-feed.tsx` (sección 10.2)
3. `components/dashboard/intelligence/context-panel.tsx` (sección 10.3)
4. `components/dashboard/intelligence/spread-correlation-chart.tsx` (sección 10.4)
5. `components/dashboard/intelligence/intelligence-panel.tsx` (sección 10.5)

**TIC3.4 — Crear `app/(dashboard)/dashboard/inteligencia/page.tsx`**
Implementar exactamente la sección 10.6.

**TIC3.5 — Actualizar sidebar**
Añadir el link "Inteligencia" con `Radar` icon según la sección 10.7.

**TIC3.6 — Build y typecheck**
```bash
npm run typecheck   # 0 errores
npm run build       # exitoso
```

**Verificación de salida FIC-3:**
- [ ] `/dashboard/inteligencia` carga sin errores
- [ ] BCVRateCard muestra tasa real (si hay datos en DB) o `—`
- [ ] SignalFeed muestra señales o mensaje de estado vacío
- [ ] ContextPanel muestra score
- [ ] Gráfico BCV renderiza (o estado vacío si no hay historial)
- [ ] Sidebar muestra "Inteligencia" entre Monitor P2P y Análisis IA
- [ ] `npm run build` → exitoso

**HANDOFF FIC-3:**
```
FASE_COMPLETADA: IC-3
PAGE: app/(dashboard)/dashboard/inteligencia/page.tsx
COMPONENTS: 5 componentes en components/dashboard/intelligence/
SIDEBAR: actualizado con link "Inteligencia"
BUILD: passing
SIGUIENTE: IC-4 — Verificación end-to-end y ACs
```

---

### FASE IC-4 — Verificación End-to-End

**Objetivo:** Verificar todos los ACs en condiciones reales.

**Tareas:**

**TIC4.1 — AC-IC01 y AC-IC02: BCV sin duplicados**
1. Ejecutar 2 scans consecutivos
2. Verificar en DB: `SELECT COUNT(*) FROM "BCVRate" WHERE date = CURRENT_DATE`
3. Debe ser 1 (no 2)

**TIC4.2 — AC-IC03: Test de banking collector con HTML mock**
```typescript
// Crear test temporal:
import { analyzePageContent } from '@/lib/intelligence/banking-collector'

const mockHtml = `<html><body>
  <article>Bancamiga activa su Intervención Digital esta semana</article>
</body></html>`

// Verificar que retorna signal con confidence >= 0.90
```

**TIC4.3 — AC-IC05: Premium P2P**
```typescript
// En una ruta de test o consola:
const context = await calculateOpportunityContext()
// Con BCVRate=60 y PriceRecord.priceMid=66:
// context.premiumPct debe ser 10.0
```

**TIC4.4 — AC-IC06 y AC-IC07: Alertas Telegram**
1. Bajar `intelAlertMinScore` a 0.1 en `/dashboard/config` temporalmente
2. Ejecutar scan → verificar mensaje Telegram recibido
3. Restaurar threshold

**TIC4.5 — AC-IC08: Visual**
1. Ejecutar 2–3 scans para tener datos
2. Navegar a `/dashboard/inteligencia`
3. Verificar que BCVRateCard muestra tasa real

**TIC4.6 — AC-IC09: Protección de ruta**
1. Cerrar sesión → navegar a `/dashboard/inteligencia` → redirect a `/login`

**TIC4.7 — Build final**
```bash
npm run typecheck   # 0 errores
npm run build       # exitoso
npm test            # tests existentes siguen passing
```

**Verificación de salida FIC-4 (gate final):**
- [ ] AC-IC01 ✅ Tasa BCV en DB
- [ ] AC-IC02 ✅ Sin duplicados
- [ ] AC-IC03 ✅ Ventana bancaria detectada con HTML mock
- [ ] AC-IC04 ✅ Señales expiradas no aparecen
- [ ] AC-IC05 ✅ Premium calculado correctamente
- [ ] AC-IC06 ✅ Alerta Telegram ventana bancaria
- [ ] AC-IC07 ✅ Alerta Telegram cambio BCV
- [ ] AC-IC08 ✅ Dashboard con datos reales
- [ ] AC-IC09 ✅ Ruta protegida
- [ ] AC-IC10 ✅ Sin escritura fuera del scanner
- [ ] `npm run build` ✅ exitoso
- [ ] `npm test` ✅ sin regresiones

**HANDOFF FINAL:**
```
FEATURE_COMPLETADO: Inteligencia Cambiaria Venezuela
RUTA: /dashboard/inteligencia
ARCHIVOS_NUEVOS:
  - prisma/migrations/*/                     (migration DB)
  - lib/db/queries/bcv-signals.ts
  - lib/intelligence/types.ts
  - lib/intelligence/keywords.ts
  - lib/intelligence/bcv-collector.ts
  - lib/intelligence/banking-collector.ts
  - lib/intelligence/signal-engine.ts
  - lib/actions/intelligence.actions.ts
  - components/dashboard/intelligence/bcv-rate-card.tsx
  - components/dashboard/intelligence/signal-feed.tsx
  - components/dashboard/intelligence/context-panel.tsx
  - components/dashboard/intelligence/spread-correlation-chart.tsx
  - components/dashboard/intelligence/intelligence-panel.tsx
  - app/(dashboard)/dashboard/inteligencia/page.tsx
ARCHIVOS_MODIFICADOS:
  - prisma/schema.prisma            (BCVRate, IntelSignal, BankingWindow, UserConfig)
  - lib/db/queries/user-config.ts   (defaults nuevos campos)
  - lib/scanner-service.ts          (runIntelligenceCollectors integrado)
  - lib/alerts/telegram.ts          (sendIntelligenceAlert añadida)
  - components/dashboard/sidebar.tsx (link "Inteligencia")
ENV_VARS_NUEVAS: ninguna
NO_BREAKING_CHANGES: true
ESTADO: Production-ready
```

---

## 14. Decisiones de Diseño

**DD-01: Collectors integrados en el scanner existente, no proceso separado**
El scanner-service ya tiene el ciclo de vida, el manejo de errores y la integración
con el dashboard. Añadir un nuevo proceso Python sería over-engineering para lo que
es una feature del AIM. Los collectors de inteligencia corren cada N ciclos del
scanner existente — no cada ciclo para no sobrecargar.

**DD-02: `proxy.ts` obligatorio para todas las llamadas HTTP**
Consistente con el patrón de todo el proyecto. BCV API y Bancamiga pasan por
`proxyRequest` — un solo punto para timeout, retry, logging y rotación de UA futura.

**DD-03: TTL por tipo de señal (signal decay)**
Una ventana de Intervención Digital dura 2 horas realmente. Sin TTL, el feed
mostraría señales de ayer como si fueran actuales. El TTL codificado en
`SIGNAL_TTL_MINUTES` es la única forma de garantizar que el contexto es fresco.

**DD-04: Premium P2P calculado desde datos existentes en DB**
El AIM ya tiene `PriceRecord` con precios P2P VES y `BCVRate` con la tasa oficial.
El premium es simplemente `(p2pMid - bcvRate) / bcvRate * 100`. No requiere
nueva fuente de datos — es correlación de lo que ya existe.

**DD-05: BCV API pública como primera estrategia**
`bcv-api.rafnixg.dev` expone endpoints REST para tasas actuales e históricas del BCV en formato JSON. Es más estable que scraping directo porque tiene cache propio y absorbe los cambios de HTML del BCV. El scraping directo queda como fallback.

---

*Fin de SPEC_AIM_INTELIGENCIA v1.0.0*
*Feature: Inteligencia Cambiaria Venezuela | Sistema: AIM | Fases: IC-1 → IC-4*
*Ruta: /dashboard/inteligencia | Tablas nuevas: BCVRate, IntelSignal, BankingWindow*
