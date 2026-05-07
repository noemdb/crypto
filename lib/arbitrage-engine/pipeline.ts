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
  const arsP2P = snapshots.filter(s => s.platform.includes("p2p") && s.asset === "USDT" && s.baseCurrency === "ARS");
  const vesP2P = snapshots.filter(s => s.platform.includes("p2p") && s.asset === "USDT" && s.baseCurrency === "VES");

  let usdArsRate = 1470; 
  let usdVesRate = 36.5;

  if (arsP2P.length > 0) {
    usdArsRate = arsP2P.reduce((acc, s) => acc + s.price, 0) / arsP2P.length;
    console.info(`[engine] Real-time USD/ARS rate: ${usdArsRate.toFixed(2)}`);
  }
  if (vesP2P.length > 0) {
    usdVesRate = vesP2P.reduce((acc, s) => acc + s.price, 0) / vesP2P.length;
    console.info(`[engine] Real-time USD/VES rate: ${usdVesRate.toFixed(2)}`);
  }

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
          buySnapshot: buy,
          sellSnapshot: sell,
          capitalAmount,
          networkCostUSD,
          userConfig,
          referenceTime,
          // Inyectamos las tasas calculadas
          ...({ usdArsRate, usdVesRate } as any) 
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

  return results;
}
