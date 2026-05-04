import type { EvalContext } from "../types";

export function scoreFillProbability(ctx: EvalContext): EvalContext {
  const { sellSnapshot, capitalAmount } = ctx.input;

  // Spot exchanges: fill garantizado
  if (!sellSnapshot.platform.includes("p2p")) {
    return { ...ctx, output: { ...ctx.output, fillProbability: 1.0 } };
  }

  const { availableLiquidity, volume24h, latencyMs } = sellSnapshot;

  const liquidityScore = Math.min(availableLiquidity / capitalAmount, 1.0);
  const volumeScore =
    volume24h != null ? Math.min(volume24h / (capitalAmount * 5), 1.0) : 0.5;
  const latencyScore =
    latencyMs < 2000 ? 1.0 : Math.max(0, 1 - (latencyMs - 2000) / 10_000);

  const fillProbability =
    liquidityScore * 0.5 + volumeScore * 0.3 + latencyScore * 0.2;

  return { ...ctx, output: { ...ctx.output, fillProbability } };
}
