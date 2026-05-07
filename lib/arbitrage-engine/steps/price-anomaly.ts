import type { PipelineStep, EvalContext } from "../types";
import { reject } from "../types";

/**
 * Detecta anomalías en los precios de snapshots individuales.
 * Debe ejecutarse ANTES de la normalización de moneda.
 */
export const detectPriceAnomalies: PipelineStep = (ctx: EvalContext) => {
  const { buySnapshot, sellSnapshot } = ctx.input;

  // 1. Validar Buy Snapshot
  const buyError = checkAnomaly(buySnapshot);
  if (buyError) return reject(ctx, `OUTLIER_DETECTED (BUY): ${buyError}`);

  // 2. Validar Sell Snapshot
  const sellError = checkAnomaly(sellSnapshot);
  if (sellError) return reject(ctx, `OUTLIER_DETECTED (SELL): ${sellError}`);

  return ctx;
};

function checkAnomaly(snapshot: any): string | null {
  const { price, baseCurrency, platform, metadata } = snapshot;

  // Validación Cruzada: ARS no puede ser < 10 (probablemente es USD mal etiquetado o error de parsing)
  if (baseCurrency === "ARS" && price < 10) {
    return `SUSPICIOUS_ARS_PRICE: ${price} (too low for ARS)`;
  }

  // Validación P2P vs Mediana de anuncios
  if (platform.includes("p2p")) {
    const ads = metadata?.topSellAds || metadata?.topBuyAds;
    if (ads && Array.isArray(ads) && ads.length >= 2) {
      const prices = ads.map((a: any) => parseFloat(a.price)).filter(p => !isNaN(p));
      if (prices.length >= 2) {
        // Usamos la mediana si es posible, o el promedio
        const sorted = [...prices].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const deviation = Math.abs(price - median) / median;

        // Umbral estricto del 15% solicitado por DE
        if (deviation > 0.15) {
          return `price=${price.toFixed(2)} median=${median.toFixed(2)} deviation=${(deviation * 100).toFixed(2)}%`;
        }
      }
    }
  }

  return null;
}
