import { describe, it, expect } from "vitest";
import { evaluateAllPairs } from "@/lib/arbitrage-engine/pipeline";
import type { MarketSnapshot, UserConfig } from "@/lib/schemas";

function makeFreshSnapshot(
  id: string,
  platform: MarketSnapshot["platform"],
  price: number,
): MarketSnapshot {
  return {
    id,
    platform,
    asset: "USDT",
    baseCurrency: "USD",
    price,
    availableLiquidity: 10_000,
    fee: 0.001,
    latencyMs: 200,
    scrapedAt: new Date().toISOString(),
    isStale: false,
  };
}

describe("AC-06: Latencia de evaluación", () => {
  it("evaluates all pairs under 2000ms for 12 snapshots (6 platforms x 2 assets)", () => {
    // Simular 6 plataformas × 2 assets = 12 snapshots
    const snapshots: MarketSnapshot[] = [
      makeFreshSnapshot("s01", "binance_spot", 1.0),
      makeFreshSnapshot("s02", "binance_spot", 1.001),
      makeFreshSnapshot("s03", "bybit_spot", 1.003),
      makeFreshSnapshot("s04", "bybit_spot", 1.002),
      makeFreshSnapshot("s05", "binance_p2p_ves", 1.01),
      makeFreshSnapshot("s06", "binance_p2p_ves", 1.011),
      makeFreshSnapshot("s07", "bybit_p2p_ves", 1.008),
      makeFreshSnapshot("s08", "bybit_p2p_ves", 1.007),
      makeFreshSnapshot("s09", "mexc_spot", 1.015),
      makeFreshSnapshot("s10", "okx_spot", 1.014),
      makeFreshSnapshot("s11", "airtm", 1.02),
      makeFreshSnapshot("s12", "kontigo", 1.019),
    ];

    const config: UserConfig = {
      id: "cfg",
      userId: "usr",
      minROI: 1.5,
      capitalAmount: 1000,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: [
        "binance_spot",
        "bybit_spot",
        "binance_p2p_ves",
        "bybit_p2p_ves",
        "mexc_spot",
        "okx_spot",
        "airtm",
        "kontigo",
      ],
      monitoredAssets: ["USDT"],
      updatedAt: new Date().toISOString(),
    };

    const start = Date.now();
    const results = evaluateAllPairs(snapshots, config, 1000);
    const duration = Date.now() - start;

    // El engine puro (sin IO) debe completar en << 2000ms
    expect(duration).toBeLessThan(500); // conservador: 500ms para el engine puro
    expect(results.length).toBeGreaterThan(0);
  });
});
