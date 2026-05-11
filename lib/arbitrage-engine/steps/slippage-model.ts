import type { EvalContext } from "../types";
import { applyImpact } from "../types";

function calculateSpreadSlippage(ctx: EvalContext): number {
  if (!("buySnapshot" in ctx.input)) return 0;
  const { buySnapshot, sellSnapshot } = ctx.input;
  const buySpread =
    buySnapshot.priceAsk && buySnapshot.priceBid
      ? (buySnapshot.priceAsk - buySnapshot.priceBid) / buySnapshot.price
      : 0.001; // spread estimado por defecto: 0.1%
  const sellSpread =
    sellSnapshot.priceAsk && sellSnapshot.priceBid
      ? (sellSnapshot.priceAsk - sellSnapshot.priceBid) / sellSnapshot.price
      : 0.001;
  return (buySpread + sellSpread) * 100; // convertir a %
}

export function applySlippageModel(ctx: EvalContext): EvalContext {
  if (!("buySnapshot" in ctx.input)) return ctx;
  const { buySnapshot, sellSnapshot, capitalAmount } = ctx.input;
  const requiredQty = capitalAmount / buySnapshot.price;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  // Evitar división por cero. El ratio es: cuánto de lo disponible vamos a usar.
  const utilizationRatio = minLiquidity > 0 ? requiredQty / minLiquidity : 10;

  const baseSlippage = calculateSpreadSlippage(ctx);

  // Lineal hasta 30% utilización, exponencial después
  const liquidityPenalty =
    utilizationRatio <= 0.3
      ? utilizationRatio * 0.002 * 100
      : (0.0006 + Math.pow(utilizationRatio - 0.3, 1.5) * 0.05) * 100;

  const slippageImpact = Math.max(0, baseSlippage + liquidityPenalty);

  return {
    ...applyImpact(ctx, "slippageImpact", slippageImpact),
    output: {
      ...ctx.output,
      slippageImpact,
      liquidityRatio: minLiquidity > 0 ? minLiquidity / requiredQty : 0,
    },
  };
}
