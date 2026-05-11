import type { EvalContext } from "../types";

export function calculateGrossROI(ctx: EvalContext): EvalContext {
  if (!("buySnapshot" in ctx.input)) return ctx;
  const { buySnapshot, sellSnapshot } = ctx.input;
  const roiGross =
    ((sellSnapshot.price - buySnapshot.price) / buySnapshot.price) * 100;

  return { ...ctx, output: { ...ctx.output, roiGross } };
}
