import { reject, type EvalContext, type PipelineStep } from "../types";

/**
 * Valida que la oportunidad sea realista después de la normalización.
 */
export function validateRealism(ctx: EvalContext): EvalContext {
  if (!("buySnapshot" in ctx.input) || !("sellSnapshot" in ctx.input)) return ctx;
  const { buySnapshot, sellSnapshot } = ctx.input;

  // 1. VALIDACIÓN CRÍTICA: Compatibilidad de Moneda Base
  // Después de normalizeCurrency, ambos DEBERÍAN estar en USD.
  // Si no lo están, es que la normalización falló o la moneda no es soportada.
  if (buySnapshot.baseCurrency !== sellSnapshot.baseCurrency) {
    return reject(ctx, `INCOMPATIBLE_BASE_CURRENCY: ${buySnapshot.baseCurrency} vs ${sellSnapshot.baseCurrency}`);
  }

  // 2. ROI Sanity Cap
  // Si el ROI bruto es absurdamente alto (> 25%), probablemente es un error.
  // Bajamos el cap de 100% a 25% para ser más estrictos.
  const buyPrice = buySnapshot.price;
  const sellPrice = sellSnapshot.price;
  const roiGross = ((sellPrice - buyPrice) / buyPrice) * 100;
  
  if (roiGross > 25) {
    return reject(ctx, `ROI_OUTLIER_TOO_HIGH: ${roiGross.toFixed(2)}% is unrealistic`);
  }

  return ctx;
};
