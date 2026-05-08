import { createContext, pipe, type EvalContext } from "./types";
import type { OpportunityInput, OpportunityOutput } from "@/lib/schemas";
import { OpportunityOutputSchema } from "@/lib/schemas";
import { validateSnapshotFreshness } from "./steps/validate-freshness";
import { detectPriceAnomalies } from "./steps/price-anomaly";
import { normalizeCurrency } from "./steps/currency-normalization";
import { validateRealism } from "./steps/validate-realism";
import { calculateGrossROI } from "./steps/calculate-roi";
import { applyFeeImpact } from "./steps/apply-fees";
import { applySlippageModel } from "./steps/slippage-model";
import { applyNetworkCost } from "./steps/network-cost";
import { evaluateLiquidity } from "./steps/liquidity-eval";
import { scoreFillProbability } from "./steps/fill-probability";
import { applyLatencyPenalty } from "./steps/latency-penalty";
import { classify } from "./steps/classify";

const evaluationPipeline = pipe(
  validateSnapshotFreshness,
  detectPriceAnomalies,
  normalizeCurrency,
  validateRealism,
  calculateGrossROI,
  applyFeeImpact,
  applySlippageModel,
  applyNetworkCost,
  evaluateLiquidity,
  scoreFillProbability,
  applyLatencyPenalty,
);

export function evaluateOpportunity(
  input: OpportunityInput,
): OpportunityOutput {
  const ctx = createContext(input);
  let result = evaluationPipeline(ctx);
  result = classify(result);

  // Validar output con Zod antes de retornar
  const parsed = OpportunityOutputSchema.safeParse(result.output);
  if (!parsed.success) {
    throw new Error(`Pipeline output invalid: ${parsed.error.message}`);
  }

  return parsed.data;
}

import { detectTriangularCycles } from "./detector";
import { evaluateTriangularOpportunity } from "./triangular-pipeline";

// Evaluar todos los pares posibles de un conjunto de snapshots
export function evaluateAllPairs(
  snapshots: import("@/lib/schemas").MarketSnapshot[],
  userConfig: import("@/lib/schemas").UserConfig,
  capitalAmount: number,
  networkCostUSD = 0,
  referenceTime?: number,
): OpportunityOutput[] {
  const results: OpportunityOutput[] = [];

  // 1. Calcular tasas de referencia en tiempo real (Dólar Cripto)
  const vesP2P = snapshots.filter(s => s.platform.includes("p2p") && s.asset === "USDT" && s.baseCurrency === "VES");

  // Fallback histórico en caso de fallo de red en scrapers P2P
  let usdVesRate = 39.5;

  if (vesP2P.length > 0) {
    usdVesRate = vesP2P.reduce((acc, s) => acc + s.price, 0) / vesP2P.length;
    console.info(`[engine] Real-time USD/VES rate: ${usdVesRate.toFixed(2)} (from ${vesP2P.length} ads)`);
  } else {
    console.warn(`[engine] No VES P2P ads found. Using fallback rate: ${usdVesRate}`);
  }

  // 2. Evaluar Arbitraje Espacial (2 puntos)
  for (let i = 0; i < snapshots.length; i++) {
    for (let j = 0; j < snapshots.length; j++) {
      if (i === j) continue;
      const buy = snapshots[i];
      const sell = snapshots[j];
      if (!buy || !sell) continue;
      // Solo evaluar pares del mismo asset
      if (buy.asset !== sell.asset) continue;

      try {
        const output = evaluateOpportunity({
          buySnapshot: { ...buy, metadata: buy.metadata ? { ...buy.metadata } : undefined },
          sellSnapshot: { ...sell, metadata: sell.metadata ? { ...sell.metadata } : undefined },
          capitalAmount,
          networkCostUSD,
          userConfig,
          referenceTime,
          ...({ usdVesRate } as any) 
        });
        results.push(output);
      } catch (err) {
        console.error(
          `[engine] pair ${buy.platform}→${sell.platform} error:`,
          err,
        );
      }
    }
  }

  // 3. Evaluar Arbitraje Triangular (3 nodos)
  try {
    const cycles = detectTriangularCycles(snapshots);
    console.info(`[engine] Detected ${cycles.length} triangular cycles`);
    
    for (const cycle of cycles) {
      try {
        const output = evaluateTriangularOpportunity({
          exchange: cycle.exchange,
          snapshots: cycle.snapshots,
          capitalAmount,
          userConfig,
          referenceTime,
        });
        results.push(output);
      } catch (err) {
        console.error(`[engine] triangular cycle error on ${cycle.exchange}:`, err);
      }
    }
  } catch (err) {
    console.error(`[engine] triangular detection error:`, err);
  }

  return results;
}
