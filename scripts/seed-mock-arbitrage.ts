import { prisma } from "../lib/db/prisma";

async function main() {
  console.log("Seeding mock EXECUTABLE data for charts...");
  
  const now = new Date();
  
  // Generar datos para los últimos 7 días
  for (let i = 0; i < 20; i++) {
    const date = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const roi = 1.5 + Math.random() * 2.5; // 1.5% a 4%
    
    await prisma.opportunity.create({
      data: {
        route: "binance_spot→bybit_spot",
        buyPlatform: "binance_spot",
        sellPlatform: "bybit_spot",
        asset: "BTC",
        buyPrice: 60000,
        sellPrice: 62000,
        capitalAmount: 1000,
        roiGross: 3.33,
        feesImpact: 0.2,
        slippageImpact: 0.1,
        networkImpact: 0,
        roiAdjusted: roi,
        fillProbability: 0.9,
        liquidityRatio: 1.0,
        latencyRiskMs: 150,
        snapshotAgeBuyMs: 100,
        snapshotAgeSellMs: 120,
        classification: "EXECUTABLE",
        rejectionReasons: [],
        evaluatedAt: date,
      }
    });
  }

  // También algunos Marginales e Inválidos para la distribución
  const platforms = ["binance_spot", "bybit_spot", "airtm", "kontigo"];
  for (const p of platforms) {
    for (let i = 0; i < 5; i++) {
      await prisma.opportunity.create({
        data: {
          route: `${p}→other`,
          buyPlatform: p,
          sellPlatform: "other",
          asset: "USDT",
          buyPrice: 1,
          sellPrice: 1.01,
          capitalAmount: 1000,
          roiGross: 1,
          feesImpact: 0.5,
          slippageImpact: 0.1,
          networkImpact: 0,
          roiAdjusted: 0.4,
          fillProbability: 0.8,
          liquidityRatio: 1.0,
          latencyRiskMs: 200,
          snapshotAgeBuyMs: 100,
          snapshotAgeSellMs: 120,
          classification: Math.random() > 0.5 ? "MARGINAL" : "INVALID",
          rejectionReasons: ["ROI_LOW"],
          evaluatedAt: now,
        }
      });
    }
  }

  console.log("✅ Mock data seeded!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
