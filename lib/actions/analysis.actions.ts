// lib/actions/analysis.actions.ts
'use server'

import { getAuthenticatedUserId } from '@/lib/auth-helpers'
import { getOpportunities } from '@/lib/db/queries/opportunities'
import { generateArbitrageAnalysis } from '@/lib/nvidia'
import type { OpportunityOutput } from '@/lib/schemas'

// ── Helpers de serialización ──────────────────────────────────────────────

function getTopRoutes(opps: OpportunityOutput[]) {
  const counts: Record<string, number> = {}
  for (const o of opps) {
    counts[o.route] = (counts[o.route] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([route, count]) => ({ route, count }))
}

function getTimeRange(opps: OpportunityOutput[]): string {
  if (opps.length === 0) return 'sin datos'
  const times = opps.map(o => new Date(o.evaluatedAt).getTime())
  const newest = Math.min(...times)
  const oldest = Math.max(...times)
  const newestMin = Math.round((Date.now() - newest) / 60_000)
  const oldestMin = Math.round((Date.now() - oldest) / 60_000)
  return `hace ${newestMin}min → hace ${oldestMin}min`
}

function buildDataPayload(opportunities: OpportunityOutput[], count: number): string {
  const stats = {
    total: opportunities.length,
    executable: opportunities.filter(o => o.classification === 'EXECUTABLE').length,
    marginal: opportunities.filter(o => o.classification === 'MARGINAL').length,
    invalid: opportunities.filter(o => o.classification === 'INVALID').length,
    maxROI: Math.max(...opportunities.map(o => o.roiAdjusted)).toFixed(4),
    minROI: Math.min(...opportunities.map(o => o.roiAdjusted)).toFixed(4),
    avgROI: (opportunities.reduce((s, o) => s + o.roiAdjusted, 0) / (opportunities.length || 1)).toFixed(4),
    topRoutes: getTopRoutes(opportunities),   // top 3 rutas por frecuencia
    timeRange: getTimeRange(opportunities),    // "hace Xmin → hace Ymin"
  }

  const executableDetails = opportunities
    .filter(o => o.classification === 'EXECUTABLE' || o.classification === 'MARGINAL')
    .slice(0, 5)                               // máximo 5 para no inflar el prompt
    .map(o => `  - ${o.route} | ROI: ${o.roiAdjusted.toFixed(3)}% | Fill: ${(o.fillProbability * 100).toFixed(0)}%`)
    .join('\n')

  return `
ANÁLISIS DE ${count} OPORTUNIDADES RECIENTES
=============================================
Período: ${stats.timeRange}

ESTADÍSTICAS GENERALES:
- Total evaluadas: ${stats.total}
- Ejecutables: ${stats.executable}
- Marginales: ${stats.marginal}  
- Inválidas: ${stats.invalid} (${stats.total > 0 ? ((stats.invalid / stats.total) * 100).toFixed(1) : 0}%)

ROI AJUSTADO:
- Máximo: ${stats.maxROI}%
- Mínimo: ${stats.minROI}%
- Promedio: ${stats.avgROI}%

RUTAS MÁS FRECUENTES:
${stats.topRoutes.map(r => `  - ${r.route}: ${r.count} veces`).join('\n')}

OPORTUNIDADES NO-INVÁLIDAS (hasta 5):
${executableDetails || '  (ninguna)'}
`.trim()
}

// ── Tipos de resultado ────────────────────────────────────────────────────

export type AnalysisResult =
  | { ok: true; content: string; tokensUsed: number; opportunitiesAnalyzed: number }
  | { ok: false; error: string }

export type AnalysisKPIs = {
  executable: number
  maxROI: number
  invalidRate: number
  total: number
}

// ── Server Actions ────────────────────────────────────────────────────────

/**
 * Calcula los KPIs de las últimas N oportunidades sin llamar al LLM.
 * Se usa para actualizar los indicadores cuando el operador cambia el selector.
 */
export async function getAnalysisKPIs(count: number): Promise<AnalysisKPIs> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { executable: 0, maxROI: 0, invalidRate: 0, total: 0 }

  const rows = await getOpportunities({ limit: count })
  const finalRows = rows.slice(0, count)

  const total = finalRows.length
  if (total === 0) return { executable: 0, maxROI: 0, invalidRate: 0, total: 0 }

  const executable = finalRows.filter(r => r.classification === 'EXECUTABLE').length
  const invalid = finalRows.filter(r => r.classification === 'INVALID').length
  const maxROI = finalRows.length > 0 ? Math.max(...finalRows.map(r => r.roiAdjusted)) : 0

  return {
    executable,
    maxROI,
    invalidRate: (invalid / total) * 100,
    total,
  }
}

/**
 * Genera el análisis LLM de las últimas N oportunidades.
 * Retorna string Markdown o error. No persiste nada.
 */
export async function generateAnalysis(count: number): Promise<AnalysisResult> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { ok: false, error: 'No autenticado' }

  // Validar rango permitido
  const safeCount = Math.min(Math.max(count, 10), 50)

  // Leer oportunidades de DB
  const allRows = await getOpportunities({ limit: safeCount })
  const rows = allRows.slice(0, safeCount)

  if (rows.length === 0) {
    return { ok: false, error: 'No hay oportunidades registradas. Ejecuta un scan primero.' }
  }

  // Normalizar a OpportunityOutput (rows viene de Prisma con tipos Date)
  const opportunities: OpportunityOutput[] = rows.map(r => ({
    id: r.id,
    route: r.route,
    buyPlatform: r.buyPlatform,
    sellPlatform: r.sellPlatform,
    asset: r.asset,
    buyPrice: r.buyPrice,
    sellPrice: r.sellPrice,
    capitalAmount: r.capitalAmount,
    roiGross: r.roiGross,
    feesImpact: r.feesImpact,
    slippageImpact: r.slippageImpact,
    networkImpact: r.networkImpact,
    roiAdjusted: r.roiAdjusted,
    fillProbability: r.fillProbability,
    liquidityRatio: r.liquidityRatio,
    latencyRiskMs: r.latencyRiskMs,
    classification: r.classification as OpportunityOutput['classification'],
    rejectionReasons: r.rejectionReasons || [],
    evaluatedAt: r.evaluatedAt.toISOString(),
    snapshotAge: {
      buyMs: r.snapshotAgeBuyMs,
      sellMs: r.snapshotAgeSellMs,
    },
  }))

  // Construir payload de datos para el prompt
  const dataPayload = buildDataPayload(opportunities, safeCount)

  // Llamar al LLM
  const llmResult = await generateArbitrageAnalysis(dataPayload)

  if (!llmResult.ok) {
    return { ok: false, error: llmResult.error }
  }

  return {
    ok: true,
    content: llmResult.content,
    tokensUsed: llmResult.tokensUsed,
    opportunitiesAnalyzed: rows.length,
  }
}
