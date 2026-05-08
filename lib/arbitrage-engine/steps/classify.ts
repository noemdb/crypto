import { createId } from "@paralleldrive/cuid2";
import type { EvalContext } from "../types";
import { reject } from "../types";

export function classify(ctx: EvalContext): EvalContext {
  const { minROI, minFillProbability } = ctx.input.userConfig;

  // 1. VALIDACIÓN TEMPRANA: Si ya fue rechazado por integridad, frescura o realismo, es INVALID
  if (ctx.rejected) {
    return finalizeClassification(ctx, "INVALID");
  }

  const roiGross = ctx.output.roiGross ?? 0;
  const feesImpact = ctx.output.feesImpact ?? 0;
  const slippageImpact = ctx.output.slippageImpact ?? 0;
  const networkImpact = ctx.output.networkImpact ?? 0;
  const roiAdjusted = roiGross - feesImpact - slippageImpact - networkImpact;
  const fillProbability = ctx.output.fillProbability ?? 1.0;
  const liquidityRatio = ctx.output.liquidityRatio ?? 0;

  // 2. ROI SANITY CAP (Defensa contra errores de normalización o outliers no detectados)
  const MAX_SANITY_ROI = parseFloat(process.env.MAX_SANITY_ROI ?? "25.0");
  if (roiAdjusted > MAX_SANITY_ROI) {
    return finalizeClassification(
      reject(ctx, `SUSPICIOUS_ROI_EXCEEDS_SANITY_CAP: ${roiAdjusted.toFixed(2)}% > ${MAX_SANITY_ROI}%`),
      "INVALID"
    );
  }

  let updatedCtx = ctx;

  if (roiAdjusted < 0) {
    updatedCtx = reject(updatedCtx, `ROI_NEGATIVE: ${roiAdjusted.toFixed(4)}%`);
  } else if (roiAdjusted < minROI) {
    updatedCtx = reject(
      updatedCtx,
      `ROI_BELOW_THRESHOLD: ${roiAdjusted.toFixed(2)}% < ${minROI}%`,
    );
  }
  if (fillProbability < 0.5) {
    updatedCtx = reject(
      updatedCtx,
      `LOW_FILL_PROBABILITY: ${fillProbability.toFixed(2)}`,
    );
  }
  if (
    liquidityRatio < 1.0 &&
    !updatedCtx.rejectionReasons.some((r) => r.startsWith("INSUFFICIENT"))
  ) {
    updatedCtx = reject(
      updatedCtx,
      `LIQUIDITY_RATIO_LOW: ${liquidityRatio.toFixed(2)}`,
    );
  }

  let classification: import("@/lib/schemas").Classification = "MARGINAL";

  if (updatedCtx.rejected) {
    classification = "INVALID";
  } else if (roiAdjusted >= minROI && fillProbability >= minFillProbability) {
    classification = "EXECUTABLE";
  }

  return finalizeClassification(updatedCtx, classification);
}

function finalizeClassification(
  ctx: EvalContext,
  classification: import("@/lib/schemas").Classification,
): EvalContext {
  const isTriangular = "snapshots" in ctx.input;
  const roiGross = ctx.output.roiGross ?? 0;
  const feesImpact = ctx.output.feesImpact ?? 0;
  const slippageImpact = ctx.output.slippageImpact ?? 0;
  const networkImpact = ctx.output.networkImpact ?? 0;
  const roiAdjusted = roiGross - feesImpact - slippageImpact - networkImpact;
  const fillProbability = ctx.output.fillProbability ?? 1.0;
  const liquidityRatio = ctx.output.liquidityRatio ?? 0;

  let latencyRiskMs = ctx.output.latencyRiskMs ?? 0;
  if (latencyRiskMs === 0) {
    if (isTriangular) {
      latencyRiskMs = Math.max(
        ...(ctx.input as any).snapshots.map((s: any) => s.latencyMs),
      );
    } else {
      latencyRiskMs = Math.max(
        (ctx.input as any).buySnapshot.latencyMs,
        (ctx.input as any).sellSnapshot.latencyMs,
      );
    }
  }

  const snapshotAge = ctx.output.snapshotAge ?? { buyMs: 0, sellMs: 0 };

  const finalOutput: any = {
    ...ctx.output,
    id: ctx.output.id ?? createId(),
    capitalAmount: ctx.input.capitalAmount,
    roiGross,
    feesImpact,
    slippageImpact,
    networkImpact,
    roiAdjusted,
    fillProbability,
    liquidityRatio,
    latencyRiskMs,
    classification,
    rejectionReasons: ctx.rejectionReasons,
    evaluatedAt: new Date().toISOString(),
    snapshotAge,
  };

  // Rellenar campos obligatorios si no están presentes (caso no triangular)
  if (!isTriangular) {
    const buy = (ctx.input as any).buySnapshot;
    const sell = (ctx.input as any).sellSnapshot;
    finalOutput.route = finalOutput.route ?? `${buy.platform}→${sell.platform}`;
    finalOutput.buyPlatform = finalOutput.buyPlatform ?? buy.platform;
    finalOutput.sellPlatform = finalOutput.sellPlatform ?? sell.platform;
    finalOutput.asset = finalOutput.asset ?? buy.asset;
    finalOutput.buyPrice = finalOutput.buyPrice ?? buy.price;
    finalOutput.sellPrice = finalOutput.sellPrice ?? sell.price;
  }

  return {
    ...ctx,
    output: finalOutput,
  };
}
