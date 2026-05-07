import type { PipelineStep, EvalContext } from "../types";

/**
 * Función pura para normalización de moneda.
 * @returns El precio normalizado a USD.
 */
export function calculateNormalizedPrice(
  price: number,
  currency: string,
  rates: { usdArs?: number; usdVes?: number }
): number {
  if (currency === "USD") return price;
  
  let rate = 1.0;
  if (currency === "ARS") rate = rates.usdArs || 1.0;
  if (currency === "VES") rate = rates.usdVes || 1.0;

  // Fallback de seguridad: Si la tasa es 0 o negativa, no normalizar para evitar división por cero
  if (rate <= 0) {
    console.warn(`[NORMALIZE] Invalid rate ${rate} for ${currency}. Skipping normalization.`);
    return price;
  }

  const normalized = price / rate;

  console.info(`[NORMALIZE] { raw: ${price}, currency: "${currency}", rate: ${rate}, normalized: ${normalized}, formula: "price / rate" }`);
  
  return normalized;
}

/**
 * Normaliza los precios a una moneda base común (USD) si es posible.
 */
export const normalizeCurrency: PipelineStep = (ctx: EvalContext) => {
  const { buySnapshot, sellSnapshot } = ctx.input;

  // 1. Si ya son iguales, no hay nada que hacer
  if (buySnapshot.baseCurrency === sellSnapshot.baseCurrency) {
    return ctx;
  }

  // 2. Obtener tasas de referencia (Dólar Cripto)
  const rates = {
    usdArs: (ctx.input as any).usdArsRate,
    usdVes: (ctx.input as any).usdVesRate,
  };

  const originalBuyCurrency = buySnapshot.baseCurrency;
  const originalSellCurrency = sellSnapshot.baseCurrency;

  // Aplicar normalización
  if (buySnapshot.baseCurrency !== "USD") {
    const oldPrice = buySnapshot.price;
    const currentRates = rates;
    const currency = buySnapshot.baseCurrency;
    
    buySnapshot.price = calculateNormalizedPrice(buySnapshot.price, currency, currentRates);
    if (buySnapshot.priceAsk) {
      buySnapshot.priceAsk = calculateNormalizedPrice(buySnapshot.priceAsk, currency, currentRates);
    }
    if (buySnapshot.priceBid) {
      buySnapshot.priceBid = calculateNormalizedPrice(buySnapshot.priceBid, currency, currentRates);
    }

    if (buySnapshot.price !== oldPrice) {
      buySnapshot.baseCurrency = "USD";
      ctx.rejectionReasons.push(`CURRENCY_NORMALIZED: Buy price converted from ${originalBuyCurrency} to USD`);
    }
  }

  if (sellSnapshot.baseCurrency !== "USD") {
    const oldPrice = sellSnapshot.price;
    const currentRates = rates;
    const currency = sellSnapshot.baseCurrency;

    sellSnapshot.price = calculateNormalizedPrice(sellSnapshot.price, currency, currentRates);
    if (sellSnapshot.priceAsk) {
      sellSnapshot.priceAsk = calculateNormalizedPrice(sellSnapshot.priceAsk, currency, currentRates);
    }
    if (sellSnapshot.priceBid) {
      sellSnapshot.priceBid = calculateNormalizedPrice(sellSnapshot.priceBid, currency, currentRates);
    }

    if (sellSnapshot.price !== oldPrice) {
      sellSnapshot.baseCurrency = "USD";
      ctx.rejectionReasons.push(`CURRENCY_NORMALIZED: Sell price converted from ${originalSellCurrency} to USD`);
    }
  }

  return ctx;
};
