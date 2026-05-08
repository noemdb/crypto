import { describe, it, expect } from 'vitest'
import { classify } from '@/lib/arbitrage-engine/steps/classify'
import { createContext } from '@/lib/arbitrage-engine/types'
import type { OpportunityInput } from '@/lib/schemas'

// ── Factory de contexto de prueba ─────────────────────────────────────────

function makeInput(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  const now = new Date().toISOString()
  return {
    buySnapshot: {
      id: 'buy01',
      platform: 'binance_p2p_ves' as any,
      asset: 'ETH',
      baseCurrency: 'USD',
      price: 1941.95,
      availableLiquidity: 0.1434,
      fee: 0.001,
      latencyMs: 200,
      scrapedAt: now,
      isStale: false,
    },
    sellSnapshot: {
      id: 'sell01',
      platform: 'binance_spot',
      asset: 'ETH',
      baseCurrency: 'USD',
      price: 2291.70,
      availableLiquidity: 999_999,
      fee: 0.001,
      latencyMs: 100,
      scrapedAt: now,
      isStale: false,
    },
    capitalAmount: 0.1545,
    networkCostUSD: 0,
    userConfig: {
      id: 'cfg01',
      userId: 'usr01',
      minROI: 1.5,
      capitalAmount: 0.1545,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ['binance_spot', 'binance_p2p_ves'],
      monitoredAssets: ['ETH'],
      scanIntervalSeconds: 180,
      updatedAt: now,
    },
    ...overrides,
  }
}

function makeCtxWithLiquidityRatio(
  liquidityRatio: number,
  roiAdjusted: number,
  fillProbability: number,
  inheritedReasons: string[] = [],
  rejected = false
) {
  const input = makeInput()
  const ctx = createContext(input)
  return {
    ...ctx,
    rejected: rejected, // Solo es rejected si se pasa explícitamente
    rejectionReasons: inheritedReasons,
    output: {
      ...ctx.output,
      liquidityRatio,
      roiAdjusted,
      roiGross: roiAdjusted + 0.2,
      feesImpact: 0.1,
      slippageImpact: 0.05,
      networkImpact: 0.05,
      fillProbability,
      latencyRiskMs: 200,
      snapshotAge: { buyMs: 1000, sellMs: 500 },
    },
  }
}

// ── Tests de la nueva lógica de ejecución parcial ──────────────────────────

describe('LOGIC FIX: INSUFFICIENT_LIQUIDITY permite EXECUTABLE (Operación Parcial)', () => {

  it('liquidityRatio=0.928, roi=17.91% → EXECUTABLE (con aviso)', () => {
    // Caso del bug original: ahora debe ser EXECUTABLE según el nuevo requerimiento
    const ctx = makeCtxWithLiquidityRatio(
      0.928, 
      17.91, 
      1.0, 
      ['INSUFFICIENT_LIQUIDITY: available=0.1434 required=0.1545'],
      false // No rechazado explícitamente por el pipeline
    )
    const result = classify(ctx)

    expect(result.output.classification).toBe('EXECUTABLE')
    expect(result.output.rejectionReasons).toContain('INSUFFICIENT_LIQUIDITY: available=0.1434 required=0.1545')
  })

  it('ROI negativo → INVALID incluso con liquidez ok', () => {
    const ctx = makeCtxWithLiquidityRatio(1.5, -0.5, 1.0)
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
  })

  it('OUTLIER_DETECTED heredado → INVALID (bloqueo duro)', () => {
    const ctx = makeCtxWithLiquidityRatio(
      1.5, 
      10.0, 
      1.0, 
      ['OUTLIER_DETECTED: price deviation > 15%'],
      true // Rechazado por el pipeline
    )
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
  })

  it('Fill probability < 0.5 → INVALID (bloqueo duro)', () => {
    const ctx = makeCtxWithLiquidityRatio(1.5, 10.0, 0.45)
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
  })

})
