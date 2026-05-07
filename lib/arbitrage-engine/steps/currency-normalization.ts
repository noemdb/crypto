import type { PipelineStep, EvalContext } from "../types";

/**
 * Normaliza los precios a una moneda base común (USD) si es posible.
 * Si un snapshot está en ARS y el otro en USD, busca una tasa de referencia
 * (Dólar Cripto) en los otros snapshots del mismo ciclo para realizar la conversión.
 */
export const normalizeCurrency: PipelineStep = (ctx: EvalContext) => {
  const { buySnapshot, sellSnapshot } = ctx.input;

  // 1. Si ya son iguales, no hay nada que hacer
  if (buySnapshot.baseCurrency === sellSnapshot.baseCurrency) {
    return ctx;
  }

  // 2. Determinar si podemos normalizar (necesitamos un USD y un ARS)
  const isBuyUSD = buySnapshot.baseCurrency === "USD";
  const isSellUSD = sellSnapshot.baseCurrency === "USD";
  const isBuyARS = buySnapshot.baseCurrency === "ARS";
  const isSellARS = sellSnapshot.baseCurrency === "ARS";
  const isBuyVES = buySnapshot.baseCurrency === "VES";
  const isSellVES = sellSnapshot.baseCurrency === "VES";

  if (!((isBuyUSD && (isSellARS || isSellVES)) || ((isBuyARS || isBuyVES) && isSellUSD))) {
    // Monedas no soportadas para normalización automática (ej: ARS vs VES no soportado aún)
    return ctx; 
  }

  // 3. Obtener tasas de conversión (Dólar Cripto)
  const usdArsRate = (ctx.input as any).usdArsRate || 1470;
  const usdVesRate = (ctx.input as any).usdVesRate || 36.5; // Fallback aproximado BCV/Paralelo

  // Normalizar ARS
  if (isBuyARS) {
    ctx.input.buySnapshot.price /= usdArsRate;
    ctx.input.buySnapshot.baseCurrency = "USD";
    ctx.rejectionReasons.push(`CURRENCY_NORMALIZED: Buy price converted from ARS to USD @ ${usdArsRate}`);
  }
  if (isSellARS) {
    ctx.input.sellSnapshot.price /= usdArsRate;
    ctx.input.sellSnapshot.baseCurrency = "USD";
    ctx.rejectionReasons.push(`CURRENCY_NORMALIZED: Sell price converted from ARS to USD @ ${usdArsRate}`);
  }

  // Normalizar VES
  if (isBuyVES) {
    ctx.input.buySnapshot.price /= usdVesRate;
    ctx.input.buySnapshot.baseCurrency = "USD";
    ctx.rejectionReasons.push(`CURRENCY_NORMALIZED: Buy price converted from VES to USD @ ${usdVesRate}`);
  }
  if (isSellVES) {
    ctx.input.sellSnapshot.price /= usdVesRate;
    ctx.input.sellSnapshot.baseCurrency = "USD";
    ctx.rejectionReasons.push(`CURRENCY_NORMALIZED: Sell price converted from VES to USD @ ${usdVesRate}`);
  }

  return ctx;
};
