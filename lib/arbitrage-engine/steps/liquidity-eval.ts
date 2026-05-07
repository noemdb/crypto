import type { EvalContext } from "../types";
import { reject } from "../types";

export function evaluateLiquidity(ctx: EvalContext): EvalContext {
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  let updatedCtx = {
    ...ctx,
    output: {
      ...ctx.output,
      liquidityRatio: minLiquidity / capitalAmount,
    },
  };

  if (minLiquidity < capitalAmount) {
    updatedCtx = reject(
      updatedCtx,
      `INSUFFICIENT_LIQUIDITY: available=${minLiquidity} required=${capitalAmount}`,
    );
  }

  return updatedCtx;
}
