import type { EvalContext } from "../types";
import { applyImpact } from "../types";

function calculateSpreadSlippage(ctx: EvalContext): number {
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
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  // Evitar división por cero
  const utilizationRatio = minLiquidity > 0 ? capitalAmount / minLiquidity : 10;

  const baseSlippage = calculateSpreadSlippage(ctx);

  // Lineal hasta 30% utilización, exponencial después
  const liquidityPenalty =
    utilizationRatio <= 0.3
      ? utilizationRatio * 0.002 * 100
      : (0.0006 + Math.pow(utilizationRatio - 0.3, 1.5) * 0.05) * 100;

  const slippageImpact = baseSlippage + liquidityPenalty;

  return {
    ...applyImpact(ctx, "slippageImpact", slippageImpact),
    output: {
      ...ctx.output,
      slippageImpact,
      liquidityRatio: minLiquidity > 0 ? minLiquidity / capitalAmount : 0,
    },
  };
}
