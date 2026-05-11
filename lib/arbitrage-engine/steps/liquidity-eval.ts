import type { EvalContext } from "../types";

export function evaluateLiquidity(ctx: EvalContext): EvalContext {
  if (!("buySnapshot" in ctx.input)) return ctx;
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input;

  // Si el capital es 0, no podemos calcular ratio. Forzamos a 0.
  if (capitalAmount <= 0) {
    return {
      ...ctx,
      output: { ...ctx.output, liquidityRatio: 0 }
    };
  }

  const requiredQty = capitalAmount / buySnapshot.price;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  const liquidityRatio = minLiquidity / requiredQty;

  // Actualizar el output con el ratio siempre
  const updatedCtx: EvalContext = {
    ...ctx,
    output: {
      ...ctx.output,
      liquidityRatio,
    },
  };

  // Si la liquidez es insuficiente, añadimos el motivo pero NO rechazamos el contexto.
  // Esto permite que la oportunidad siga siendo EXECUTABLE (operación parcial).
  if (liquidityRatio < 1.0) {
    updatedCtx.rejectionReasons.push(
      `INSUFFICIENT_LIQUIDITY: available=${minLiquidity.toFixed(4)} required=${requiredQty.toFixed(4)}`
    );
  }

  return updatedCtx;
}
