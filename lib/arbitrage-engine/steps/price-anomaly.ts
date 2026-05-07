import type { PipelineStep, EvalContext } from "../types";
import { reject } from "../types";

/**
 * Detecta anomalías en los precios de snapshots individuales.
 * Debe ejecutarse ANTES de la normalización de moneda.
 */
export const detectPriceAnomalies: PipelineStep = (ctx: EvalContext) => {
  const { buySnapshot, sellSnapshot } = ctx.input;

  // 1. Validar Buy Snapshot (si es P2P)
  if (buySnapshot.platform.includes("p2p")) {
    const error = checkP2POutlier(buySnapshot);
    if (error) return reject(ctx, `OUTLIER_BUY_P2P: ${error}`);
  }

  // 2. Validar Sell Snapshot (si es P2P)
  if (sellSnapshot.platform.includes("p2p")) {
    const error = checkP2POutlier(sellSnapshot);
    if (error) return reject(ctx, `OUTLIER_SELL_P2P: ${error}`);
  }

  return ctx;
};

function checkP2POutlier(snapshot: any): string | null {
  // Intentamos obtener los ads del metadata (guardados por el scraper)
  // Nota: El scraper guarda topBuyAds y topSellAds. 
  // Si estamos evaluando un precio de "Compra" (Ask), lo comparamos contra los otros "Sell Ads".
  const ads = snapshot.metadata?.topSellAds || snapshot.metadata?.topBuyAds;
  
  if (!ads || !Array.isArray(ads) || ads.length < 2) return null;

  const prices = ads.map((a: any) => parseFloat(a.price)).filter(p => !isNaN(p));
  if (prices.length < 2) return null;

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const deviation = Math.abs(snapshot.price - avg) / avg;

  // Si el precio desvía más del 10% del promedio de los top 5, es una anomalía
  // (Aumentamos a 10% porque P2P tiene más dispersión que Spot)
  if (deviation > 0.10) {
    return `Price ${snapshot.price.toFixed(2)} ${snapshot.baseCurrency} deviates ${(deviation * 100).toFixed(2)}% from platform average (${avg.toFixed(2)})`;
  }

  return null;
}
