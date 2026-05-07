import { classify } from "@/lib/arbitrage-engine/steps/classify";
import { createContext, reject } from "@/lib/arbitrage-engine/types";

describe("Classification Engine Unit Tests", () => {
  const mockInput = {
    buySnapshot: { platform: "binance_spot", asset: "USDT", price: 1.0, baseCurrency: "USD", availableLiquidity: 1000, latencyMs: 100, scrapedAt: new Date().toISOString() },
    sellSnapshot: { platform: "bybit_spot", asset: "USDT", price: 1.01, baseCurrency: "USD", availableLiquidity: 1000, latencyMs: 100, scrapedAt: new Date().toISOString() },
    capitalAmount: 1000,
    userConfig: { minROI: 0.5, minFillProbability: 0.8, alertDedupeWindowMin: 5 },
  } as any;

  test("should classify as INVALID if ROI exceeds sanity cap (150% > 25%)", () => {
    const ctx = createContext(mockInput);
    ctx.output.roiGross = 150; // 150% ROI
    
    const result = classify(ctx);
    expect(result.output.classification).toBe("INVALID");
    expect(result.rejectionReasons.some(r => r.includes("SUSPICIOUS_ROI_EXCEEDS_SANITY_CAP"))).toBe(true);
  });

  test("should classify as INVALID if context was already rejected", () => {
    let ctx = createContext(mockInput);
    ctx = reject(ctx, "PREVIOUS_ERROR");
    
    const result = classify(ctx);
    expect(result.output.classification).toBe("INVALID");
  });

  test("should classify as INVALID if liquidity is zero", () => {
    const ctx = createContext(mockInput);
    ctx.output.roiGross = 1.0;
    ctx.output.liquidityRatio = 0;
    
    const result = classify(ctx);
    expect(result.output.classification).toBe("INVALID");
    expect(result.rejectionReasons.some(r => r.includes("LIQUIDITY_RATIO_LOW"))).toBe(true);
  });

  test("should classify as EXECUTABLE for valid opportunity", () => {
    const ctx = createContext(mockInput);
    ctx.output.roiGross = 1.0; // 1% ROI
    ctx.output.feesImpact = 0.1;
    ctx.output.slippageImpact = 0;
    ctx.output.networkImpact = 0;
    ctx.output.fillProbability = 0.9;
    ctx.output.liquidityRatio = 1.5;
    
    const result = classify(ctx);
    expect(result.output.classification).toBe("EXECUTABLE");
  });
});
