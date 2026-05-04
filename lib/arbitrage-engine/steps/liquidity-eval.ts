import type { EvalContext } from "../types";
import { reject } from "../types";

export function evaluateLiquidity(ctx: EvalContext): EvalContext {
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  if (minLiquidity < capitalAmount) {
    return reject(
      ctx,
      `INSUFFICIENT_LIQUIDITY: available=${minLiquidity} required=${capitalAmount}`,
    );
  }

  return ctx;
}
