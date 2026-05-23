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
        responseType: 'text',
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
