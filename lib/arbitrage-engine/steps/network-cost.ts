import type { EvalContext } from "../types";
import { applyImpact } from "../types";

export function applyNetworkCost(ctx: EvalContext): EvalContext {
  const { networkCostUSD, capitalAmount } = ctx.input;
  const networkImpact = (networkCostUSD / capitalAmount) * 100;
  return applyImpact(ctx, "networkImpact", networkImpact);
}
