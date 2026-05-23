'use server'

import { getAuthenticatedUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/db/prisma'
import { calculateOpportunityContext } from '@/lib/intelligence/signal-engine'
import type { OpportunityContext, BCVRateData } from '@/lib/intelligence/types'

// ── Datos para el dashboard ────────────────────────────────────────────────────

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
