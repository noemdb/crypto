import { createId } from "@paralleldrive/cuid2";
import type { EvalContext } from "../types";
import { reject } from "../types";

/**
 * Paso final del pipeline de arbitraje.
 * Clasifica la oportunidad como EXECUTABLE, MARGINAL o INVALID.
 */
export function classify(ctx: EvalContext): EvalContext {
  // ── Extraer parámetros con defaults seguros ────────────────────────────────
  const { minROI, minFillProbability } = ctx.input.userConfig;

  const roiGross        = ctx.output.roiGross        ?? 0;
  const feesImpact      = ctx.output.feesImpact      ?? 0;
  const slippageImpact  = ctx.output.slippageImpact  ?? 0;
  const networkImpact   = ctx.output.networkImpact   ?? 0;
  const roiAdjusted     = ctx.output.roiAdjusted     ?? (roiGross - feesImpact - slippageImpact - networkImpact);
  const fillProbability = ctx.output.fillProbability ?? 1.0;
  const liquidityRatio  = ctx.output.liquidityRatio  ?? 1.0;
  const latencyRiskMs   = ctx.output.latencyRiskMs   ?? 0;
  const snapshotAge     = ctx.output.snapshotAge     ?? { buyMs: 0, sellMs: 0 };

  let updatedCtx = ctx;

  // ── PASO 1: Bloqueos Duros (Hard Blocks) ───────────────────────────────────
  // Si ya fue rechazado por pasos previos (Freshness, Outliers, Realism), es INVALID
  let isInvalid = ctx.rejected;

  // Nuevos bloqueos duros detectados en classify
  if (roiAdjusted < 0) {
    updatedCtx = reject(updatedCtx, `ROI_NEGATIVE: ${roiAdjusted.toFixed(4)}%`);
    isInvalid = true;
  }

  if (fillProbability < 0.5) {
    updatedCtx = reject(updatedCtx, `LOW_FILL_PROBABILITY: ${fillProbability.toFixed(2)}`);
    isInvalid = true;
  }

  // Nota: INSUFFICIENT_LIQUIDITY ya no es un hard block por requerimiento del usuario.
  // Solo se muestra como advertencia en rejectionReasons (vía liquidity-eval.ts).

  // ── PASO 2: Clasificación final ──────────────────────────────────────────
  let classification: import("@/lib/schemas").Classification = "INVALID";

  if (isInvalid) {
    classification = "INVALID";
  } else {
    // Si no hay bloqueos duros, evaluamos umbrales de usuario
    if (roiAdjusted >= minROI && fillProbability >= minFillProbability) {
      classification = "EXECUTABLE";
    } else {
      classification = "MARGINAL";
    }
  }

  // ── PASO 3: Finalización del Output ────────────────────────────────────────
  const isTriangular = "snapshots" in ctx.input;
  
  const finalOutput: any = {
    ...updatedCtx.output,
    id: updatedCtx.output.id ?? createId(),
    route: updatedCtx.output.route ?? (isTriangular ? "triangular" : ""),
    capitalAmount: updatedCtx.input.capitalAmount,
    roiGross,
    feesImpact,
    slippageImpact,
    networkImpact,
    roiAdjusted,
    fillProbability,
    liquidityRatio,
    latencyRiskMs,
    classification,
    rejectionReasons: updatedCtx.rejectionReasons,
    evaluatedAt: new Date().toISOString(),
    snapshotAge,
  };

  // Rellenar campos obligatorios para el dashboard si no es triangular
  if (!isTriangular) {
    const buy = (updatedCtx.input as any).buySnapshot;
    const sell = (updatedCtx.input as any).sellSnapshot;
    finalOutput.route = finalOutput.route || `${buy.platform}→${sell.platform}`;
    finalOutput.buyPlatform = finalOutput.buyPlatform || buy.platform;
    finalOutput.sellPlatform = finalOutput.sellPlatform || sell.platform;
    finalOutput.asset = finalOutput.asset || buy.asset;
    finalOutput.buyPrice = finalOutput.buyPrice || buy.price;
    finalOutput.sellPrice = finalOutput.sellPrice || sell.price;
  }

  return {
    ...updatedCtx,
    output: finalOutput,
  };
}
