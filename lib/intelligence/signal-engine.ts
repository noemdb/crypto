// lib/intelligence/signal-engine.ts
// Calcula el Opportunity Score de contexto combinando señales activas
// con los datos P2P ya presentes en la DB del AIM.

import { prisma } from '@/lib/db/prisma'
import { SignalType } from './types'
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
