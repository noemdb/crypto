import type { EvalContext } from "../types";

export function applyLatencyPenalty(ctx: EvalContext): EvalContext {
  const { buySnapshot, sellSnapshot } = ctx.input;
  const latencyRiskMs = Math.max(buySnapshot.latencyMs, sellSnapshot.latencyMs);
  return { ...ctx, output: { ...ctx.output, latencyRiskMs } };
}
