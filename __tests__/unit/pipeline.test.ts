import { describe, it, expect } from "vitest";
import { evaluateOpportunity } from "@/lib/arbitrage-engine/pipeline";
import type { OpportunityInput } from "@/lib/schemas";

function makeSnapshot(
  overrides: Partial<import("@/lib/schemas").MarketSnapshot> = {},
): import("@/lib/schemas").MarketSnapshot {
  return {
    id: "cltest000000000000000000",
    platform: "binance_spot",
    asset: "USDT",
    baseCurrency: "USD",
    price: 1.0,
    availableLiquidity: 10_000,
    fee: 0.001,
    latencyMs: 500,
    scrapedAt: new Date().toISOString(),
    isStale: false,
    ...overrides,
  };
}

function makeConfig(): import("@/lib/schemas").UserConfig {
  return {
    id: "clconfig0000000000000000",
    userId: "cluser00000000000000000",
    minROI: 1.5,
    capitalAmount: 1000,
    maxSlippage: 0.005,
    minFillProbability: 0.7,
    enabledPlatforms: ["binance_spot", "bybit_spot"],
    monitoredAssets: ["USDT"],
    alertDedupeWindowMin: 30,
    updatedAt: new Date().toISOString(),
  };
}

// AC-01: Snapshot stale debe ser INVALID
describe("AC-01: Frescura de datos", () => {
  it("rejects stale binance_spot snapshot", () => {
    const staleTime = new Date(Date.now() - 35_000).toISOString(); // 35s ago > 30s TTL

    const input: OpportunityInput = {
      buySnapshot: makeSnapshot({ scrapedAt: staleTime }),
      sellSnapshot: makeSnapshot({ platform: "bybit_spot", price: 1.03 }),
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: makeConfig(),
    };

    const result = evaluateOpportunity(input);
    expect(result.classification).toBe("INVALID");
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.some((r) => r.includes("STALE_DATA"))).toBe(
      true,
    );
  });

  it("accepts fresh snapshot within TTL", () => {
    const input: OpportunityInput = {
      buySnapshot: makeSnapshot({ price: 1.0 }),
      sellSnapshot: makeSnapshot({ platform: "bybit_spot", price: 1.05 }),
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: makeConfig(),
    };

    const result = evaluateOpportunity(input);
    expect(result.classification).not.toBe("INVALID"); // puede ser EXECUTABLE o MARGINAL
  });
});
