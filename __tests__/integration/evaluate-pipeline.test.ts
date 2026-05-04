import { describe, it, expect } from "vitest";
import { evaluateOpportunity } from "@/lib/arbitrage-engine/pipeline";
import type { OpportunityInput } from "@/lib/schemas";

describe("Pipeline integration", () => {
  it("produces EXECUTABLE for clear arbitrage opportunity", () => {
    const now = new Date().toISOString();

    const input: OpportunityInput = {
      buySnapshot: {
        id: "buy01",
        platform: "binance_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.0,
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      sellSnapshot: {
        id: "sell01",
        platform: "bybit_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.03, // 3% de spread bruto
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: {
        id: "cfg",
        userId: "usr",
        minROI: 1.5,
        capitalAmount: 1000,
        maxSlippage: 0.005,
        minFillProbability: 0.7,
        alertDedupeWindowMin: 30,
        enabledPlatforms: ["binance_spot", "bybit_spot"],
        monitoredAssets: ["USDT"],
        updatedAt: now,
      },
    };

    const result = evaluateOpportunity(input);

    expect(result.classification).toBe("EXECUTABLE");
    expect(result.roiAdjusted).toBeGreaterThan(0);
    expect(result.roiGross).toBeCloseTo(3.0, 1);
    // Invariante AC-02
    expect(
      Math.abs(
        result.roiAdjusted -
          (result.roiGross -
            result.feesImpact -
            result.slippageImpact -
            result.networkImpact),
      ),
    ).toBeLessThan(0.0001);
  });

  it("produces INVALID for negative-ROI pair", () => {
    const now = new Date().toISOString();

    const input: OpportunityInput = {
      buySnapshot: {
        id: "buy02",
        platform: "binance_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.03,
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      sellSnapshot: {
        id: "sell02",
        platform: "bybit_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.0, // vender más barato que comprar
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: {
        id: "cfg",
        userId: "usr",
        minROI: 1.5,
        capitalAmount: 1000,
        maxSlippage: 0.005,
        minFillProbability: 0.7,
        alertDedupeWindowMin: 30,
        enabledPlatforms: ["binance_spot", "bybit_spot"],
        monitoredAssets: ["USDT"],
        updatedAt: now,
      },
    };

    const result = evaluateOpportunity(input);
    expect(result.classification).toBe("INVALID");
    expect(
      result.rejectionReasons?.some((r) => r.includes("ROI_NEGATIVE")),
    ).toBe(true);
  });
});
