import { createContext, pipe, reject, type EvalContext } from "./types";
import { type TriangularOpportunityInput, type OpportunityOutput, OpportunityOutputSchema } from "@/lib/schemas";
import { TTL_MS } from "./steps/validate-freshness";
import { classify } from "./steps/classify";
import { createId } from "@paralleldrive/cuid2";

export function evaluateTriangularOpportunity(input: TriangularOpportunityInput): OpportunityOutput {
  const ctx = createContext(input);
  
  const result = triangularPipeline(ctx);
  const finalCtx = classify(result);

  const parsed = OpportunityOutputSchema.safeParse(finalCtx.output);
  if (!parsed.success) {
    throw new Error(`Triangular pipeline output invalid: ${parsed.error.message}`);
  }

  return parsed.data;
}

const triangularPipeline = pipe(
  validateTriangularFreshness,
  calculateTriangularROI,
  applyTriangularFees,
  applyTriangularSlippage,
  // Reuse existing steps that are compatible
);

function validateTriangularFreshness(ctx: EvalContext): EvalContext {
  if (!("snapshots" in ctx.input)) return ctx;
  const now = ctx.referenceTime;
  const snapshots = ctx.input.snapshots;
  
  const ages = snapshots.map(s => now - new Date(s.scrapedAt).getTime());
  const ttls = snapshots.map(s => TTL_MS[s.platform] || 60000);

  const isStale = ages.some((age, i) => age > ttls[i]!);
  
  const ctxWithAge = {
    ...ctx,
    output: {
      ...ctx.output,
      snapshotAge: {
        buyMs: ages[0]!,
        sellMs: ages[2]!,
        intermediateMs: ages[1]!,
      }
    }
  };

  if (isStale) {
    return reject(ctxWithAge, `STALE_DATA: ages=[${ages.join(",")}] ttls=[${ttls.join(",")}]`);
  }

  return ctxWithAge;
}

function calculateTriangularROI(ctx: EvalContext): EvalContext {
  if (!("snapshots" in ctx.input)) return ctx;
  const { snapshots, capitalAmount } = ctx.input;
  
  if (!snapshots[0] || !snapshots[1] || !snapshots[2]) {
    return reject(ctx, "MISSING_SNAPSHOTS_IN_TRIANGULAR_INPUT");
  }
  
  const getAssets = (s: any) => [s.asset, s.baseCurrency];
  const common = (a: string[], b: string[]) => a.filter(x => b.includes(x));
  
  const a0 = getAssets(snapshots[0]);
  const a1 = getAssets(snapshots[1]);
  const a2 = getAssets(snapshots[2]);
  
  const assetB = common(a0, a1)[0];
  const assetC = common(a1, a2)[0];
  const assetA = common(a2, a0)[0];

  if (!assetA || !assetB || !assetC) {
    return reject(ctx, "INVALID_TRIANGULAR_CYCLE_TOPOLOGY");
  }
  
  const path = [assetA, assetB, assetC];
  let amount = capitalAmount;
  const steps: any[] = [];
  
  for (let i = 0; i < 3; i++) {
    const s = snapshots[i]!;
    const from = path[i]!;
    const to = path[(i + 1) % 3]!;
    
    let action: "BUY" | "SELL";
    let price: number;
    
    if (s.asset === to && s.baseCurrency === from) {
      action = "BUY";
      price = s.price;
      amount = amount / price;
    } else {
      action = "SELL";
      price = s.price;
      amount = amount * price;
    }
    
    steps.push({
      platform: s.platform,
      pair: `${s.asset}/${s.baseCurrency}`,
      price,
      action
    });
  }

  const roiGross = ((amount - capitalAmount) / capitalAmount) * 100;

  return {
    ...ctx,
    output: {
      ...ctx.output,
      id: createId(),
      isTriangular: true,
      triangularSteps: steps,
      roiGross,
      asset: assetA,
      buyPlatform: snapshots[0].platform,
      sellPlatform: snapshots[0].platform, // Same exchange
      route: `${snapshots[0].platform}: ${path.join(" ➔ ")} ➔ ${path[0]}`,
      buyPrice: snapshots[0].price, // Placeholder
      sellPrice: snapshots[2].price, // Placeholder
      capitalAmount: capitalAmount,
    }
  };
}

function applyTriangularFees(ctx: EvalContext): EvalContext {
  if (!("snapshots" in ctx.input)) return ctx;
  const { snapshots } = ctx.input;
  const feesImpact = snapshots.reduce((acc, s) => acc + s.fee, 0) * 100;
  
  return {
    ...ctx,
    output: {
      ...ctx.output,
      feesImpact,
      roiAdjusted: (ctx.output.roiGross || 0) - feesImpact,
    }
  };
}

function applyTriangularSlippage(ctx: EvalContext): EvalContext {
  const { userConfig } = ctx.input;
  // Slippage is usually calculated per step. 
  // For 3 steps, we accumulate it.
  const slippagePerStep = userConfig.maxSlippage || 0.001;
  const slippageImpact = slippagePerStep * 3 * 100;

  return {
    ...ctx,
    output: {
      ...ctx.output,
      slippageImpact,
      roiAdjusted: (ctx.output.roiAdjusted || 0) - slippageImpact,
      networkImpact: 0, // No network costs in intra-exchange
      latencyRiskMs: 0, // Simplified
      fillProbability: 0.9, // Higher for intra-exchange
      liquidityRatio: 1, // Placeholder
    }
  };
}
