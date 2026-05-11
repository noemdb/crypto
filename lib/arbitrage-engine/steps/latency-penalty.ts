import type { EvalContext } from "../types";

export function applyLatencyPenalty(ctx: EvalContext): EvalContext {
  if (!("buySnapshot" in ctx.input)) return ctx;
  const { buySnapshot, sellSnapshot } = ctx.input;
  const latencyRiskMs = Math.max(buySnapshot.latencyMs, sellSnapshot.latencyMs);
  return { ...ctx, output: { ...ctx.output, latencyRiskMs } };
}
