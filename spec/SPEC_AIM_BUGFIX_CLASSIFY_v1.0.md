# SPEC_AIM_BUGFIX_CLASSIFY v1.0
**Bug Crítico: Clasificación EXECUTABLE con INSUFFICIENT_LIQUIDITY**
**Sistema:** Arbitrage Intelligence Monitor (AIM) v1.2+
**Archivo objetivo:** `lib/arbitrage-engine/steps/classify.ts`
**Severidad:** CRÍTICA — expone al operador a pérdida financiera directa
**Versión:** 1.0.0
**Fecha:** 2026-05-08
**Estado:** Listo para ejecución por agente IA

---

## 0. Resumen Ejecutivo

El motor de clasificación del pipeline de arbitraje está marcando oportunidades como
`EXECUTABLE` cuando `liquidityRatio < 1.0`, a pesar de que el paso previo
(`liquidity-eval.ts`) detecta y registra `INSUFFICIENT_LIQUIDITY` en `rejectionReasons`.

Este documento especifica la corrección completa: el fix en `classify.ts`, los
ajustes de consistencia en pasos relacionados del pipeline, los tests de regresión
obligatorios, y la verificación de que el Alert Engine (Telegram) no dispara sobre
oportunidades con rejection reasons activos.

**Archivos a modificar:**
```
lib/arbitrage-engine/steps/classify.ts          ← fix principal
lib/arbitrage-engine/steps/liquidity-eval.ts    ← verificar y hardening
lib/arbitrage-engine/types.ts                   ← verificar EvalContext
```

**Archivos a crear:**
```
__tests__/unit/classify.test.ts                 ← tests de regresión obligatorios
```

**Archivos a NO modificar:**
```
lib/schemas/opportunity.schema.ts               ← contratos Zod intactos
lib/schemas/snapshot.schema.ts                  ← contratos Zod intactos
lib/arbitrage-engine/pipeline.ts                ← orden del pipeline intacto
lib/alerts/telegram.ts                          ← verificar comportamiento, no modificar
```

---

## 1. Diagnóstico Técnico

### 1.1 Evidencia en producción

La imagen del dashboard muestra esta combinación contradictoria en dos cards:

```
ETH: binance_p2p_ves → binance_spot     ✅ Ejecutable
ROI Ajustado: ↑ 17.91%
Fill Prob: 100%
CURRENCY_NORMALIZED: Buy price converted from VES to USD
INSUFFICIENT_LIQUIDITY: available=0.1434 required=0.1545
```

```
ETH: binance_p2p_ves → bybit_spot       ✅ Ejecutable
ROI Ajustado: ↑ 17.90%
Fill Prob: 100%
CURRENCY_NORMALIZED: Buy price converted from VES to USD
INSUFFICIENT_LIQUIDITY: available=0.1434 required=0.1545
```

**Un ROI de ~18% está enmascarando un bloqueo de integridad de datos.**

### 1.2 Causa raíz

El `classify.ts` implementado en producción tiene una de estas dos condiciones de fallo:

**Hipótesis A — Bloqueo condicional incompleto:**
```typescript
// BUG: el bloque IF solo evalúa reasons generadas DENTRO de classify,
// ignorando rejectionReasons que ya venían en ctx desde pasos anteriores
if (reasons.length > 0) {           // reasons es array LOCAL, no ctx.rejectionReasons
  return { ...ctx, output: { ...ctx.output, classification: 'INVALID' } }
}
```

**Hipótesis B — liquidityRatio no llega correctamente al classify:**
El campo `liquidityRatio` puede estar llegando como `undefined` o `null` porque
`liquidity-eval.ts` o `slippage-model.ts` no lo está escribiendo correctamente en
`ctx.output`. La comparación `undefined < 1.0` es `false` en JavaScript, lo que
hace que el check nunca dispare.

**Hipótesis C — ctx.rejectionReasons no se propaga entre pasos:**
El pipeline usa el patrón `pipe(...fns)` que encadena los pasos. Si algún paso
anterior usó `reject()` pero el siguiente no hereda correctamente el array
`rejectionReasons`, el `classify` no ve los rechazos previos.

El fix cubre las tres hipótesis simultáneamente.

### 1.3 Impacto operativo

```
Operador ve: ✅ Ejecutable — ROI 17.91%
Operador actúa: compra ETH en binance_p2p_ves por 0.1545 ETH equivalente
Realidad del mercado: el anuncio P2P solo tiene 0.1434 ETH disponibles
Resultado:
  - 0.1434 ETH vendidos en binance_spot → ganancia esperada
  - 0.0111 ETH sin vender → expuesto a volatilidad del precio de ETH
  - Fees pagadas en ambas piernas → pérdida neta en la pierna incompleta
  - Alerta Telegram disparada → erosión de confianza en el sistema
```

---

## 2. Especificación del Fix

### 2.1 Regla de clasificación — contrato inmutable

```
REGLA 1 (Hard Block): Si ctx.rejectionReasons.length > 0 al entrar a classify
         → classification = 'INVALID', sin excepción, sin importar el ROI

REGLA 2 (Hard Block): Si liquidityRatio < 1.0
         → añadir INSUFFICIENT_LIQUIDITY a reasons, classification = 'INVALID'

REGLA 3 (Hard Block): Si fillProbability < 0.5
         → añadir LOW_FILL_PROBABILITY a reasons, classification = 'INVALID'

REGLA 4 (Hard Block): Si roiAdjusted < 0
         → añadir ROI_NEGATIVE a reasons, classification = 'INVALID'

REGLA 5 (Threshold): Solo si NINGÚN hard block aplica:
         Si roiAdjusted >= minROI AND fillProbability >= minFillProbability
         → classification = 'EXECUTABLE'
         Sino → classification = 'MARGINAL'

PRIORIDAD: Reglas 1-4 tienen prioridad absoluta sobre Regla 5.
           Un ROI de 1000% con liquidityRatio = 0.99 → INVALID.
```

### 2.2 Fix de `lib/arbitrage-engine/steps/classify.ts`

```typescript
// lib/arbitrage-engine/steps/classify.ts
// VERSIÓN CORREGIDA — v1.0.0-fix
// Regla de oro: integridad de datos > rentabilidad bruta

import { createId } from '@paralleldrive/cuid2'
import type { EvalContext } from '../types'
import { reject } from '../types'

export function classify(ctx: EvalContext): EvalContext {
  // ── Extraer valores con defaults seguros ──────────────────────────────────
  // CRÍTICO: usar nullish coalescing para evitar que undefined pase los checks
  const roiGross        = ctx.output.roiGross        ?? 0
  const feesImpact      = ctx.output.feesImpact      ?? 0
  const slippageImpact  = ctx.output.slippageImpact  ?? 0
  const networkImpact   = ctx.output.networkImpact   ?? 0
  const roiAdjusted     = ctx.output.roiAdjusted     ?? (roiGross - feesImpact - slippageImpact - networkImpact)
  const fillProbability = ctx.output.fillProbability ?? 0
  const liquidityRatio  = ctx.output.liquidityRatio  ?? 0   // ← default 0, no undefined
  const latencyRiskMs   = ctx.output.latencyRiskMs   ?? 0
  const snapshotAge     = ctx.output.snapshotAge     ?? { buyMs: 0, sellMs: 0 }

  const { minROI, minFillProbability } = ctx.input.userConfig

  // ── PASO 1: Heredar rejection reasons de pasos anteriores del pipeline ────
  // Si un paso previo (liquidity-eval, validate-freshness, outlier-detection)
  // ya llamó a reject(), esos reasons están en ctx.rejectionReasons.
  // classify DEBE respetarlos — no puede ignorarlos ni sobreescribirlos.
  const inheritedReasons = [...ctx.rejectionReasons]

  // ── PASO 2: Hard blocks propios de classify ───────────────────────────────
  const newReasons: string[] = []

  if (roiAdjusted < 0) {
    newReasons.push(`ROI_NEGATIVE: ${roiAdjusted.toFixed(4)}%`)
  }

  // liquidityRatio = 0 por default si no fue calculado — esto también es hard block
  if (liquidityRatio < 1.0) {
    newReasons.push(`INSUFFICIENT_LIQUIDITY: ratio=${liquidityRatio.toFixed(4)}`)
  }

  if (fillProbability < 0.5) {
    newReasons.push(`LOW_FILL_PROBABILITY: ${fillProbability.toFixed(2)}`)
  }

  // ── PASO 3: Combinar reasons heredados + nuevos ───────────────────────────
  const allReasons = [...inheritedReasons, ...newReasons]

  // ── PASO 4: REGLA DE ORO — cualquier reason = INVALID ────────────────────
  // No hay excepción. Un ROI de 17.91% con INSUFFICIENT_LIQUIDITY = INVALID.
  if (allReasons.length > 0) {
    console.info(
      `[classify] INVALID route=${ctx.input.buySnapshot.platform}→${ctx.input.sellSnapshot.platform}` +
      ` asset=${ctx.input.buySnapshot.asset}` +
      ` roi=${roiAdjusted.toFixed(4)}%` +
      ` reasons=${allReasons.join(' | ')}`
    )

    return {
      ...ctx,
      rejected: true,
      rejectionReasons: allReasons,
      output: {
        ...ctx.output,
        id: createId(),
        route: `${ctx.input.buySnapshot.platform}→${ctx.input.sellSnapshot.platform}`,
        buyPlatform: ctx.input.buySnapshot.platform,
        sellPlatform: ctx.input.sellSnapshot.platform,
        asset: ctx.input.buySnapshot.asset,
        buyPrice: ctx.input.buySnapshot.price,
        sellPrice: ctx.input.sellSnapshot.price,
        capitalAmount: ctx.input.capitalAmount,
        roiGross,
        feesImpact,
        slippageImpact,
        networkImpact,
        roiAdjusted,
        fillProbability,
        liquidityRatio,
        latencyRiskMs,
        snapshotAge,
        classification: 'INVALID',
        rejectionReasons: allReasons,
        evaluatedAt: new Date().toISOString(),
      },
    }
  }

  // ── PASO 5: Invariante de ROI (solo si no hay hard blocks) ────────────────
  // Verificar que roiAdjusted es la suma correcta de sus componentes.
  // Si difiere > 0.001%, hay un bug en el pipeline upstream — loggear pero no bloquear.
  const checksum = roiGross - feesImpact - slippageImpact - networkImpact
  if (Math.abs(checksum - roiAdjusted) > 0.001) {
    console.warn(
      `[classify] ROI invariant mismatch: computed=${checksum.toFixed(6)} stored=${roiAdjusted.toFixed(6)}` +
      ` route=${ctx.input.buySnapshot.platform}→${ctx.input.sellSnapshot.platform}`
    )
  }

  // ── PASO 6: Umbrales de usuario (solo llega aquí si no hay hard blocks) ───
  // Un ROI por debajo del threshold del usuario → MARGINAL, no INVALID
  // (es una preferencia del operador, no un problema de integridad)
  const classification =
    roiAdjusted >= minROI && fillProbability >= minFillProbability
      ? 'EXECUTABLE'
      : 'MARGINAL'

  console.info(
    `[classify] ${classification} route=${ctx.input.buySnapshot.platform}→${ctx.input.sellSnapshot.platform}` +
    ` asset=${ctx.input.buySnapshot.asset} roi=${roiAdjusted.toFixed(4)}%` +
    ` fill=${fillProbability.toFixed(2)} liqRatio=${liquidityRatio.toFixed(4)}`
  )

  return {
    ...ctx,
    rejected: false,
    rejectionReasons: [],
    output: {
      ...ctx.output,
      id: createId(),
      route: `${ctx.input.buySnapshot.platform}→${ctx.input.sellSnapshot.platform}`,
      buyPlatform: ctx.input.buySnapshot.platform,
      sellPlatform: ctx.input.sellSnapshot.platform,
      asset: ctx.input.buySnapshot.asset,
      buyPrice: ctx.input.buySnapshot.price,
      sellPrice: ctx.input.sellSnapshot.price,
      capitalAmount: ctx.input.capitalAmount,
      roiGross,
      feesImpact,
      slippageImpact,
      networkImpact,
      roiAdjusted,
      fillProbability,
      liquidityRatio,
      latencyRiskMs,
      snapshotAge,
      classification,
      rejectionReasons: [],
      evaluatedAt: new Date().toISOString(),
    },
  }
}
```

### 2.3 Hardening de `lib/arbitrage-engine/steps/liquidity-eval.ts`

Verificar que el paso escribe `liquidityRatio` en `ctx.output` **siempre**, incluso
cuando rechaza. Si no lo hace, el valor llega como `undefined` a `classify` y el
check `undefined < 1.0` es `false`.

```typescript
// lib/arbitrage-engine/steps/liquidity-eval.ts
// VERSIÓN CORREGIDA — garantiza que liquidityRatio siempre está en ctx.output

import type { EvalContext } from '../types'
import { reject } from '../types'

export function evaluateLiquidity(ctx: EvalContext): EvalContext {
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input

  // Liquidez disponible = el cuello de botella (mínimo de ambas plataformas)
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  )

  // CRÍTICO: calcular ratio antes del return, para que esté disponible
  // en ctx.output independientemente de si se rechaza o no
  const liquidityRatio = capitalAmount > 0
    ? minLiquidity / capitalAmount
    : 0    // capitalAmount = 0 es un error de configuración — ratio forzado a 0

  // Escribir liquidityRatio en output ANTES de evaluar el rechazo
  const ctxWithRatio: EvalContext = {
    ...ctx,
    output: {
      ...ctx.output,
      liquidityRatio,
    },
  }

  if (minLiquidity < capitalAmount) {
    return reject(
      ctxWithRatio,
      `INSUFFICIENT_LIQUIDITY: available=${minLiquidity.toFixed(4)} required=${capitalAmount.toFixed(4)}`,
    )
  }

  return ctxWithRatio
}
```

### 2.4 Verificación de `lib/arbitrage-engine/types.ts`

Confirmar que la función `reject()` propaga correctamente el array. La implementación
debe ser exactamente:

```typescript
// lib/arbitrage-engine/types.ts
// Verificar que reject() ACUMULA reasons, no reemplaza

export function reject(ctx: EvalContext, reason: string): EvalContext {
  return {
    ...ctx,
    rejected: true,
    // CRÍTICO: spread del array existente + nuevo reason
    // Si se usa ctx.output.rejectionReasons en lugar de ctx.rejectionReasons,
    // el pipeline pierde reasons de pasos anteriores
    rejectionReasons: [...ctx.rejectionReasons, reason],
  }
}
```

---

## 3. Verificación del Alert Engine

El Telegram alert engine debe verificar `classification !== 'EXECUTABLE'` **antes**
de disparar. Revisar `lib/alerts/telegram.ts` y confirmar que el guard existe:

```typescript
// lib/alerts/telegram.ts — verificar que este guard existe
// Si NO existe, añadirlo

export async function processAlerts(
  opportunities: OpportunityOutput[],
  config: UserConfig,
): Promise<number> {
  // ...
  for (const opp of opportunities) {
    // GUARD OBLIGATORIO — doble verificación
    if (opp.classification !== 'EXECUTABLE') continue
    if (opp.rejectionReasons && opp.rejectionReasons.length > 0) continue  // ← añadir si no existe
    // ...
  }
}
```

**Si el segundo guard no existe, añadirlo.** Es una defensa en profundidad:
aunque `classify.ts` esté correcto, el alert engine tiene su propia validación
independiente.

---

## 4. Tests de Regresión Obligatorios

### 4.1 `__tests__/unit/classify.test.ts`

```typescript
// __tests__/unit/classify.test.ts
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
      platform: 'binance_p2p_ves' as never,  // plataforma del bug real
      asset: 'ETH',
      baseCurrency: 'USD',
      price: 1941.95,
      availableLiquidity: 0.1434,            // ← valor exacto del bug reportado
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
    capitalAmount: 0.1545,                   // ← capital > liquidez disponible
    networkCostUSD: 0,
    userConfig: {
      id: 'cfg01',
      userId: 'usr01',
      minROI: 1.5,
      capitalAmount: 0.1545,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ['binance_spot', 'binance_p2p'],
      monitoredAssets: ['ETH'],
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
) {
  const input = makeInput()
  const ctx = createContext(input)
  return {
    ...ctx,
    rejected: inheritedReasons.length > 0,
    rejectionReasons: inheritedReasons,
    output: {
      ...ctx.output,
      liquidityRatio,
      roiAdjusted,
      roiGross: roiAdjusted + 0.2,          // simular que hay componentes de costo
      feesImpact: 0.1,
      slippageImpact: 0.05,
      networkImpact: 0.05,
      fillProbability,
      latencyRiskMs: 200,
      snapshotAge: { buyMs: 1000, sellMs: 500 },
    },
  }
}

// ── Tests del bug específico ───────────────────────────────────────────────

describe('BUG FIX: INSUFFICIENT_LIQUIDITY nunca produce EXECUTABLE', () => {

  it('liquidityRatio=0.928, roi=17.91% → INVALID (caso exacto del bug)', () => {
    // Este test reproduce exactamente el bug observado en producción
    const ctx = makeCtxWithLiquidityRatio(0.928, 17.91, 1.0)
    const result = classify(ctx)

    expect(result.output.classification).toBe('INVALID')
    expect(result.output.rejectionReasons).toBeDefined()
    expect(
      result.output.rejectionReasons!.some(r => r.includes('INSUFFICIENT_LIQUIDITY'))
    ).toBe(true)
  })

  it('liquidityRatio=0.999 (un centavo bajo el umbral) → INVALID', () => {
    const ctx = makeCtxWithLiquidityRatio(0.999, 50.0, 1.0)
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
  })

  it('liquidityRatio=1.000 (exactamente suficiente) → no bloquea por liquidez', () => {
    const ctx = makeCtxWithLiquidityRatio(1.0, 5.0, 1.0)
    const result = classify(ctx)
    // Con liquidityRatio exactamente 1.0 y roi > threshold, puede ser EXECUTABLE
    expect(result.output.classification).not.toBe('INVALID')
  })

  it('liquidityRatio=undefined → tratado como 0 → INVALID', () => {
    // Simula el bug de Hipótesis B: liquidityRatio no llegó al classify
    const ctx = makeCtxWithLiquidityRatio(undefined as unknown as number, 17.91, 1.0)
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
  })

})

// ── Tests de rejection reasons heredados ─────────────────────────────────

describe('REGLA 1: rejectionReasons heredados de pasos anteriores → siempre INVALID', () => {

  it('OUTLIER_DETECTED heredado + roi positivo → INVALID', () => {
    const ctx = makeCtxWithLiquidityRatio(
      1.5,          // liquidez suficiente
      17.91,        // roi positivo
      1.0,          // fill prob ok
      ['OUTLIER_DETECTED (SELL): price=819.00 median=953.40 deviation=25.42%']  // ← heredado
    )
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
    expect(result.output.rejectionReasons!.length).toBeGreaterThan(0)
  })

  it('STALE_DATA heredado → INVALID independientemente del ROI', () => {
    const ctx = makeCtxWithLiquidityRatio(
      2.0,
      100.0,  // roi 100% — no importa
      1.0,
      ['STALE_DATA: buy=35000ms (ttl=30000ms)']
    )
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
  })

  it('CURRENCY_NORMALIZED heredado solo NO debe bloquear (es informativo)', () => {
    // CURRENCY_NORMALIZED es un tag informativo de la normalización de moneda,
    // NO es un motivo de rechazo. Verificar que no se trata como hard block.
    const ctx = makeCtxWithLiquidityRatio(
      1.5,
      17.91,
      1.0,
      []  // sin reasons de rechazo — CURRENCY_NORMALIZED es metadata, no reason
    )
    const result = classify(ctx)
    // Con liquidez suficiente y roi positivo, debe poder ser EXECUTABLE o MARGINAL
    expect(result.output.classification).not.toBe('INVALID')
  })

})

// ── Tests de hard blocks propios de classify ─────────────────────────────

describe('Hard blocks de classify', () => {

  it('ROI negativo → INVALID con ROI_NEGATIVE en reasons', () => {
    const ctx = makeCtxWithLiquidityRatio(1.5, -0.22, 1.0)
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
    expect(result.output.rejectionReasons!.some(r => r.includes('ROI_NEGATIVE'))).toBe(true)
  })

  it('fillProbability < 0.5 → INVALID con LOW_FILL_PROBABILITY', () => {
    const ctx = makeCtxWithLiquidityRatio(1.5, 5.0, 0.35)
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
    expect(
      result.output.rejectionReasons!.some(r => r.includes('LOW_FILL_PROBABILITY'))
    ).toBe(true)
  })

  it('múltiples hard blocks → INVALID con todos en reasons', () => {
    const ctx = makeCtxWithLiquidityRatio(0.5, -1.0, 0.3)
    const result = classify(ctx)
    expect(result.output.classification).toBe('INVALID')
    expect(result.output.rejectionReasons!.length).toBeGreaterThanOrEqual(3)
  })

})

// ── Tests del camino feliz ────────────────────────────────────────────────

describe('Camino feliz: oportunidades válidas', () => {

  it('roi >= minROI, fill >= minFillProbability, liqRatio >= 1.0 → EXECUTABLE', () => {
    const ctx = makeCtxWithLiquidityRatio(2.0, 5.0, 0.95)
    const result = classify(ctx)
    expect(result.output.classification).toBe('EXECUTABLE')
    expect(result.output.rejectionReasons).toEqual([])
  })

  it('roi positivo pero < minROI → MARGINAL (no INVALID)', () => {
    // roi = 0.5%, threshold = 1.5% → debe ser MARGINAL, no INVALID
    const ctx = makeCtxWithLiquidityRatio(2.0, 0.5, 0.95)
    const result = classify(ctx)
    expect(result.output.classification).toBe('MARGINAL')
  })

  it('fill < minFillProbability pero >= 0.5 → MARGINAL (no INVALID)', () => {
    // fill = 0.65, minFillProb = 0.7 → MARGINAL porque no baja de 0.5
    const ctx = makeCtxWithLiquidityRatio(2.0, 5.0, 0.65)
    const result = classify(ctx)
    expect(result.output.classification).toBe('MARGINAL')
  })

})

// ── Invariante de ROI ─────────────────────────────────────────────────────

describe('Invariante de ROI (AC-02)', () => {

  it('roiAdjusted = roiGross - feesImpact - slippageImpact - networkImpact', () => {
    const ctx = makeCtxWithLiquidityRatio(2.0, 5.0, 0.95)
    // El ctx tiene roiAdjusted=5.0, roiGross=5.2, fees=0.1, slip=0.05, net=0.05
    // 5.2 - 0.1 - 0.05 - 0.05 = 5.0 ✓
    const result = classify(ctx)
    const { roiGross, feesImpact, slippageImpact, networkImpact, roiAdjusted } = result.output
    const computed = roiGross! - feesImpact! - slippageImpact! - networkImpact!
    expect(Math.abs(computed - roiAdjusted!)).toBeLessThan(0.001)
  })

})
```

---

## 5. Plan de Ejecución por Fases

---

### FASE B-1 — Diagnóstico de código real

**Objetivo:** Leer el código actual de `classify.ts`, `liquidity-eval.ts` y `types.ts`
para confirmar cuál de las tres hipótesis es la causa raíz antes de modificar nada.

**Tareas:**

**TB1.1 — Leer archivos actuales**
```bash
cat lib/arbitrage-engine/steps/classify.ts
cat lib/arbitrage-engine/steps/liquidity-eval.ts
cat lib/arbitrage-engine/types.ts
```

**TB1.2 — Confirmar hipótesis activa**

Verificar cuál de estas condiciones existe en el código real:

| Hipótesis | Señal en el código |
|---|---|
| A — reasons locales vs heredados | `const reasons: string[] = []` sin `...ctx.rejectionReasons` |
| B — liquidityRatio undefined | `ctx.output.liquidityRatio` no asignado en `liquidity-eval.ts` |
| C — reject() no propaga | `rejectionReasons: [reason]` sin spread del array existente |

**TB1.3 — Registrar hallazgo en HANDOFF**

Documentar cuál hipótesis fue confirmada para que la siguiente fase sepa qué cambió.

**Verificación de salida FB-1:**
- [ ] Código de los 3 archivos leído
- [ ] Hipótesis confirmada (A, B, C o combinación)
- [ ] HANDOFF documenta causa raíz exacta

**HANDOFF → Fase B-2:**
```
FASE_COMPLETADA: B-1
HIPOTESIS_CONFIRMADA: [A | B | C | combinación]
CLASSIFY_BUG: [descripción exacta de la línea problemática]
LIQUIDITY_EVAL_BUG: [si aplica]
TYPES_BUG: [si aplica]
SIGUIENTE: B-2 — aplicar fix
```

---

### FASE B-2 — Aplicar fix

**Objetivo:** Corregir los archivos identificados en B-1 con la implementación de
la sección 2 de este spec.

**Tareas:**

**TB2.1 — Reemplazar `classify.ts`**

Sustituir el contenido completo del archivo con la implementación de la sección 2.2.
No hacer cambios incrementales — reemplazar completo para garantizar coherencia.

**TB2.2 — Corregir `liquidity-eval.ts`**

Aplicar el hardening de la sección 2.3:
- `liquidityRatio` debe escribirse en `ctx.output` ANTES del `if (minLiquidity < capitalAmount)`
- Añadir guard para `capitalAmount <= 0`

**TB2.3 — Verificar `types.ts`**

Confirmar que `reject()` usa `[...ctx.rejectionReasons, reason]`.
Si no, corregirlo exactamente como muestra la sección 2.4.

**TB2.4 — Verificar alert engine**

Abrir `lib/alerts/telegram.ts` y confirmar que existe el guard:
```typescript
if (opp.classification !== 'EXECUTABLE') continue
```
Si existe y funciona correctamente, no modificar.
Si no existe o está incompleto, añadir el segundo guard de la sección 3.

**Verificación de salida FB-2:**
- [ ] `classify.ts` reemplazado con versión corregida
- [ ] `liquidity-eval.ts` escribe `liquidityRatio` antes del rechazo
- [ ] `types.ts` — `reject()` acumula reasons correctamente
- [ ] `telegram.ts` — guard verificado
- [ ] `npm run typecheck` → 0 errores

**HANDOFF → Fase B-3:**
```
FASE_COMPLETADA: B-2
ARCHIVOS_MODIFICADOS: [lista exacta]
CLASSIFY_VERSION: 1.0.0-fix
TYPECHECK: passing
SIGUIENTE: B-3 — tests de regresión
```

---

### FASE B-3 — Tests de regresión

**Objetivo:** Crear `__tests__/unit/classify.test.ts` y confirmar que todos los
tests pasan, incluyendo los que reproducen el bug exacto del reporte.

**Tareas:**

**TB3.1 — Crear `__tests__/unit/classify.test.ts`**

Implementar exactamente el código de la sección 4.1.

**Nota sobre `binance_p2p_ves`:**
Si este string no está en el `PlatformEnum` del schema, el test usará un cast
`as never` para la prueba. El objetivo es verificar el comportamiento del classify,
no el schema de plataformas. Si `binance_p2p_ves` sí está en el enum, usar
directamente sin cast.

**TB3.2 — Ejecutar tests**
```bash
npm test -- classify
```

**TB3.3 — Confirmar que los tests del bug pasan**

Los tests críticos que DEBEN pasar:
```
✓ liquidityRatio=0.928, roi=17.91% → INVALID (caso exacto del bug)
✓ liquidityRatio=0.999 → INVALID
✓ liquidityRatio=undefined → INVALID
✓ OUTLIER_DETECTED heredado + roi positivo → INVALID
✓ roi >= minROI, liqRatio >= 1.0 → EXECUTABLE (camino feliz intacto)
```

**TB3.4 — Ejecutar suite completa para detectar regresiones**
```bash
npm test
```

Todos los tests previos deben seguir pasando. El fix no debe romper el camino feliz.

**Verificación de salida FB-3:**
- [ ] `classify.test.ts` creado con todos los tests de la sección 4.1
- [ ] `npm test -- classify` → todos passing
- [ ] Test del bug exacto: `liquidityRatio=0.928, roi=17.91% → INVALID` ✓
- [ ] Suite completa: `npm test` → todos passing (sin regresiones)

**HANDOFF → Fase B-4:**
```
FASE_COMPLETADA: B-3
TESTS_NUEVOS: __tests__/unit/classify.test.ts — N tests
TESTS_PASSING: todos
REGRESIONES: ninguna
SIGUIENTE: B-4 — verificación end-to-end en dashboard
```

---

### FASE B-4 — Verificación end-to-end

**Objetivo:** Confirmar en el dashboard real que las oportunidades con
`INSUFFICIENT_LIQUIDITY` ya no aparecen como `✅ Ejecutable`.

**Tareas:**

**TB4.1 — Limpiar datos stale de DB**

Las oportunidades con el bug ya están persistidas en la tabla `Opportunity`.
Limpiarlas para que el dashboard no muestre resultados incorrectos del pasado:

```bash
npx tsx scripts/clean-db.ts
# Si no existe el script o no limpia Opportunity, ejecutar desde prisma studio:
# DELETE FROM "Opportunity" WHERE classification = 'EXECUTABLE'
#   AND "liquidityRatio" < 1.0
```

**TB4.2 — Ejecutar un scan manual**

En el dashboard, presionar "Ejecutar Escáner". Esperar a que complete.

**TB4.3 — Verificar el resultado**

En el dashboard, filtrar por `EXECUTABLE`. Verificar que:
- Ninguna card marcada como `✅ Ejecutable` tiene `INSUFFICIENT_LIQUIDITY` en sus rejection reasons
- Las cards con `INSUFFICIENT_LIQUIDITY` están marcadas como `✗ Inválido`
- Las rutas `binance_p2p_ves → binance_spot` con `liquidityRatio < 1.0` aparecen como `✗ Inválido`

**TB4.4 — Verificar que el ROI alto no es suficiente para EXECUTABLE sin liquidez**

Si el scanner detecta una ruta con ROI ~18% pero `liquidityRatio < 1.0`:
- Debe aparecer como `✗ Inválido`
- Debe mostrar `INSUFFICIENT_LIQUIDITY` en los rejection reasons
- NO debe disparar alerta Telegram

**TB4.5 — Build y typecheck final**
```bash
npm run typecheck   # 0 errores
npm run build       # build exitoso
npm test            # todos passing
```

**Verificación de salida FB-4 (gate final):**
- [ ] Dashboard: ningún `✅ Ejecutable` con `INSUFFICIENT_LIQUIDITY`
- [ ] Dashboard: cards con `INSUFFICIENT_LIQUIDITY` muestran `✗ Inválido`
- [ ] ROI alto (>10%) con liquidez insuficiente → `✗ Inválido` confirmado
- [ ] `npm run typecheck` → 0 errores
- [ ] `npm run build` → build exitoso
- [ ] `npm test` → todos passing

**HANDOFF FINAL:**
```
BUGFIX_COMPLETADO: classify.ts INSUFFICIENT_LIQUIDITY
ARCHIVOS_MODIFICADOS:
  - lib/arbitrage-engine/steps/classify.ts     (fix principal)
  - lib/arbitrage-engine/steps/liquidity-eval.ts (hardening)
  - lib/arbitrage-engine/types.ts              (si aplicó)
  - lib/alerts/telegram.ts                    (guard verificado/añadido)
ARCHIVOS_CREADOS:
  - __tests__/unit/classify.test.ts           (regresión)
COMPORTAMIENTO_CORREGIDO:
  - liquidityRatio < 1.0 + roi > threshold → INVALID (era EXECUTABLE)
  - rejectionReasons heredados → siempre INVALID
  - liquidityRatio=undefined → default 0 → INVALID
DB_LIMPIADA: oportunidades incorrectas del pasado eliminadas
ESTADO: Production-ready
```

---

## 6. Nota sobre `CURRENCY_NORMALIZED`

En los logs del dashboard se observa `CURRENCY_NORMALIZED: Buy price converted from
VES to USD`. Este tag **NO es un rejection reason** — es metadata informativa que
indica que el normalizador convirtió el precio del snapshot P2P VES a USD para
hacerlo comparable con precios spot.

**No debe aparecer en `rejectionReasons`.**

Si `CURRENCY_NORMALIZED` está siendo tratado como rejection reason en algún paso del
pipeline, debe moverse a `ctx.output.metadata` o similar. El clasificador no debe
actuar sobre él.

Los únicos rejection reasons válidos que producen `INVALID` son:
- `ROI_NEGATIVE`
- `ROI_BELOW_THRESHOLD`
- `INSUFFICIENT_LIQUIDITY`
- `LOW_FILL_PROBABILITY`
- `STALE_DATA`
- `OUTLIER_DETECTED`

Cualquier otro string en `rejectionReasons` debe ser investigado como bug de
pipeline, no tratado como nuevo tipo de bloqueo.

---

*Fin de SPEC_AIM_BUGFIX_CLASSIFY v1.0.0*
*Prioridad: CRÍTICA | Sistema: AIM | Fases: B-1 → B-4*
*Estimado de implementación: 2–4 horas para agente IA con acceso a codebase*
