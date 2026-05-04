import type { EvalContext } from "../types";
import { applyImpact } from "../types";

export function applyFeeImpact(ctx: EvalContext): EvalContext {
  const { buySnapshot, sellSnapshot } = ctx.input;
  // Fees de compra y venta como % del capital
  const feesImpact = (buySnapshot.fee + sellSnapshot.fee) * 100;
  return applyImpact(ctx, "feesImpact", feesImpact);
}
