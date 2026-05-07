import type { PipelineStep, EvalContext } from "../types";
import { reject } from "../types";

/**
 * Detecta precios sospechosos o erróneos, especialmente en P2P.
 * Compara el precio del snapshot con la media de los mejores anuncios
 * para identificar anuncios "gancho" o errores de scraping.
 */
export const detectOutliers: PipelineStep = (ctx: EvalContext) => {
  const { buySnapshot, sellSnapshot } = ctx.input;

  // 1. VALIDACIÓN CRÍTICA: Compatibilidad de Moneda Base
  // No podemos comparar precios en USD con precios en ARS/VES directamente.
  if (buySnapshot.baseCurrency !== sellSnapshot.baseCurrency) {
    return reject(ctx, `INCOMPATIBLE_BASE_CURRENCY: ${buySnapshot.baseCurrency} vs ${sellSnapshot.baseCurrency}`);
  }

  // 2. ROI Sanity Cap
  // Si el ROI bruto es absurdamente alto (> 100%), probablemente es un error de parsing o datos basura.
  const buyPrice = buySnapshot.price;
  const sellPrice = sellSnapshot.price;
  const roiGross = ((sellPrice - buyPrice) / buyPrice) * 100;
  
  if (roiGross > 100) {
    return reject(ctx, `ROI_OUTLIER_TOO_HIGH: ${roiGross.toFixed(2)}% is unrealistic`);
  }

  // 3. Validar Buy Snapshot (si es P2P)
  if (buySnapshot.platform.includes("p2p")) {
    const buyOutlier = checkP2POutlier(buySnapshot, "buy");
    if (buyOutlier) return reject(ctx, `OUTLIER_BUY_P2P: ${buyOutlier}`);
  }

  // 4. Validar Sell Snapshot (si es P2P)
  if (sellSnapshot.platform.includes("p2p")) {
    const sellOutlier = checkP2POutlier(sellSnapshot, "sell");
    if (sellOutlier) return reject(ctx, `OUTLIER_SELL_P2P: ${sellOutlier}`);
  }

  return ctx;
};

function checkP2POutlier(snapshot: any, type: "buy" | "sell"): string | null {
  const ads = type === "buy" ? snapshot.metadata?.topSellAds : snapshot.metadata?.topBuyAds;
  if (!ads || !Array.isArray(ads) || ads.length < 3) return null;

  const currentPrice = type === "buy" ? snapshot.priceAsk : snapshot.priceBid;
  if (!currentPrice) return null;

  // Calcular precio promedio de los anuncios de referencia (excluyendo el primero si es necesario)
  const prices = ads.map((a: any) => parseFloat(a.price)).filter((p: number) => !isNaN(p));
  if (prices.length < 2) return null;

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  // Si el mejor precio es > 3% mejor que el promedio de los top 5, es sospechoso
  const deviation = Math.abs(currentPrice - avgPrice) / avgPrice;
  
  if (deviation > 0.03) {
    return `Price ${currentPrice} deviates ${(deviation * 100).toFixed(2)}% from top ads average (${avgPrice.toFixed(2)})`;
  }

  return null;
}
