import type { EvalContext } from "../types";
import { reject } from "../types";

export function evaluateLiquidity(ctx: EvalContext): EvalContext {
  if (!("buySnapshot" in ctx.input)) return ctx;
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input;
  const requiredQty = capitalAmount / buySnapshot.price;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  let updatedCtx: EvalContext = {
    ...ctx,
    output: {
      ...ctx.output,
      liquidityRatio: minLiquidity / requiredQty,
    },
  };

  if (minLiquidity < requiredQty) {
    updatedCtx = reject(
      updatedCtx,
      `INSUFFICIENT_LIQUIDITY: available=${minLiquidity.toFixed(4)} required=${requiredQty.toFixed(4)}`,
    );
  }

  return updatedCtx;
}
