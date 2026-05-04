import { createId } from "@paralleldrive/cuid2";
import type { EvalContext } from "../types";
import { reject } from "../types";

export function classify(ctx: EvalContext): EvalContext {
  const { minROI, minFillProbability } = ctx.input.userConfig;
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

  // Invariante: roiAdjusted debe ser la resta exacta de sus componentes
  // Si difiere > 0.0001%, hay un bug en el pipeline
  const checksum = roiGross - feesImpact - slippageImpact - networkImpact;
  if (Math.abs(checksum - roiAdjusted) > 0.0001) {
    throw new Error(`ROI invariant violated: ${checksum} !== ${roiAdjusted}`);
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

  const classification = updatedCtx.rejected
    ? "INVALID"
    : roiAdjusted >= minROI && fillProbability >= minFillProbability
      ? "EXECUTABLE"
      : "MARGINAL";

  return {
    ...updatedCtx,
    output: {
      ...updatedCtx.output,
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
      rejectionReasons: updatedCtx.rejectionReasons,
      evaluatedAt: new Date().toISOString(),
      snapshotAge,
    },
  };
}
