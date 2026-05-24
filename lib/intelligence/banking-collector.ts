// lib/intelligence/banking-collector.ts
// Detecta ventanas de Intervención Digital en sitios bancarios.
// Usa proxyRequest — nunca fetch() directo.

import { proxyRequest } from '@/lib/proxy'
import { prisma } from '@/lib/db/prisma'
import { chromium } from 'playwright'
import { exec } from 'child_process'
import { promisify } from 'util'
import { BANKING_KEYWORDS } from './keywords'
import { SignalType } from './types'
import type { SignalTypeValue } from './types'
import { createId } from '@paralleldrive/cuid2'

const execAsync = promisify(exec)

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

// Banco de Venezuela expone sus tasas via JSON público
const BDV_API_URL = 'https://www.bancodevenezuela.com/files/tasas/tasas2.json'

type BdvApiResponse = {
  mesacambio?: { bdv?: { dolares?: string } }
  menudeo?:    { compra?: { dolares?: string } }
}

// Banco Provincial / BBVA — bloqueado por Akamai WAF
// Usamos DolarApi como fuente consolidada que incluye datos del sistema bancario
const PROVINCIAL_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'

type DolarApiResponse = {
  moneda: string
  fuente: string
  promedio: number | null
  fechaActualizacion: string
}

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

  // ── Banco de Venezuela (cURL nativo → JSON API) ──────────────────────
  try {
    const { stdout: bdvRaw } = await execAsync(
      `curl -s "${BDV_API_URL}"`,
      { timeout: 10000 }
    )
    const bdvData: BdvApiResponse = JSON.parse(bdvRaw)
    const rateStr = bdvData.menudeo?.compra?.dolares ?? bdvData.mesacambio?.bdv?.dolares
    const rate = rateStr ? parseFloat(rateStr.replace(',', '.')) : null

    if (rate && rate > 0) {
      console.info(`[banking-collector] BDV tasa menudeo: ${rate} VES/USD`)
      detected.push({
        bank: 'bdv',
        signalType: SignalType.BANK_WINDOW_OPEN,
        keywords: ['menudeo', 'mesa de cambio', 'bdv'],
        confidence: 0.90,
        weight: 0.90,
        score: 0.81,
        url: 'https://www.bancodevenezuela.com',
      })
    }
  } catch (err) {
    console.error('[banking-collector] BDV error:', err instanceof Error ? err.message : err)
  }

  // ── Banco Provincial / BBVA (vía DolarApi → tasa oficial BCV) ────────────
  // provincial.com está bloqueado por Akamai WAF; usamos la fuente pública
  // consolidada que refleja la tasa del sistema bancario venezolano.
  try {
    const { stdout: provRaw } = await execAsync(
      `curl -s "${PROVINCIAL_API_URL}"`,
      { timeout: 10000 }
    )
    const provData: DolarApiResponse = JSON.parse(provRaw)
    const rate = provData.promedio

    if (rate && rate > 0) {
      console.info(`[banking-collector] Provincial tasa oficial (DolarApi): ${rate} VES/USD`)
      detected.push({
        bank: 'provincial',
        signalType: SignalType.BANK_WINDOW_OPEN,
        keywords: ['tasa oficial', 'bcv', 'sistema bancario', 'provincial'],
        confidence: 0.85,
        weight: 0.85,
        score: 0.72,
        url: 'https://www.provincial.com',
      })
    }
  } catch (err) {
    console.error('[banking-collector] Provincial error:', err instanceof Error ? err.message : err)
  }

  // ── Otros bancos (HTML scraping) ─────────────────────────────────────────
  for (const source of BANKING_SOURCES) {
    try {
      let html = ''

      const result = await proxyRequest<string>({
        url: source.url,
        context: `banking_${source.bank}`,
        timeoutMs: 10000,
        retries: 1,
        responseType: 'text',
      })

      if (result.ok) {
        html = result.data
      } else {
        console.warn(`[banking-collector] ${source.bank} fetch failed: ${result.error}. Intentando con Playwright...`)
        
        // Estrategia Avanzada: Playwright Headless para saltar Cloudflare/403
        const browser = await chromium.launch({ headless: true })
        try {
          const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          })
          const page = await context.newPage()
          // Bloquear recursos pesados para mayor velocidad
          await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css}", route => route.abort());
          await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          html = await page.content()
          console.info(`[banking-collector] ${source.bank} Playwright exitoso`)
        } catch (pwError) {
          console.error(`[banking-collector] ${source.bank} Playwright falló:`, pwError instanceof Error ? pwError.message : pwError)
          continue
        } finally {
          await browser.close()
        }
      }

      if (html) {
        const signal = analyzePageContent(html, source.bank, source.url, source.weight)
        if (signal) detected.push(signal)
      }

    } catch (err) {
      console.error(`[banking-collector] ${source.bank} error:`, err)
    }
  }

  return detected
}

export function analyzePageContent(
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
    const windowType = s.signalType === SignalType.BANK_DIGITAL_ACTIVE
      ? 'digital'
      : s.signalType === SignalType.BANK_AUCTION ? 'auction' : 'menudeo'

    const existingWindow = await prisma.bankingWindow.findFirst({
      where: { bank: s.bank, windowType, isActive: true }
    })

    if (!existingWindow) {
      await prisma.bankingWindow.create({
        data: {
          bank: s.bank,
          windowType,
          keywords: s.keywords,
          sourceUrl: s.url,
        },
      })
    }
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
