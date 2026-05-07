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
  classification: import("@/lib/schemas").Classification
): EvalContext {
  const roiGross = ctx.output.roiGross ?? 0;
  const feesImpact = ctx.output.feesImpact ?? 0;
  const slippageImpact = ctx.output.slippageImpact ?? 0;
  const networkImpact = ctx.output.networkImpact ?? 0;
  const roiAdjusted = roiGross - feesImpact - slippageImpact - networkImpact;
  const fillProbability = ctx.output.fillProbability ?? 1.0;
  const liquidityRatio = ctx.output.liquidityRatio ?? 0;
  const latencyRiskMs =
    ctx.output.latencyRiskMs ??
    Math.max(ctx.input.buySnapshot.latencyMs, ctx.input.sellSnapshot.latencyMs);
  const snapshotAge = ctx.output.snapshotAge ?? { buyMs: 0, sellMs: 0 };

  return {
    ...ctx,
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
      classification,
      rejectionReasons: ctx.rejectionReasons,
      evaluatedAt: new Date().toISOString(),
      snapshotAge,
    },
  };
}
