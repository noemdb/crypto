import { runScrape } from "./scrapers/run-scrape";
import { getAllFreshSnapshots } from "./db/queries/snapshots";
import { getOrCreateDefaultUserConfig } from "./db/queries/user-config";
import { insertOpportunity } from "./db/queries/opportunities";
import { dbSnapshotToSchema } from "./db/normalize";
import { evaluateAllPairs } from "./arbitrage-engine/pipeline";

import { prisma } from "./db/prisma";
import type { Platform, Asset } from "./schemas";

const SCRAPE_CONFIG: Array<{
  platform: Platform;
  assets: Asset[];
}> = [
  {
    platform: "binance_spot",
    assets: ["USDT", "USDC", "BTC", "ETH"],
  },
  {
    platform: "bybit_spot",
    assets: ["USDT", "USDC", "BTC", "ETH"],
  },
];

export async function triggerFullScan() {
  const start = Date.now();
  let scrapedCount = 0;
  let errorCount = 0;

  console.info("[scanner-service] Starting full manual scan...");

  // 1. Scrape all configured pairs in parallel
  const scrapePromises: Promise<any>[] = [];
  for (const config of SCRAPE_CONFIG) {
    for (const asset of config.assets) {
      scrapePromises.push(runScrape(config.platform, asset));
    }
  }

  const scrapeResults = await Promise.allSettled(scrapePromises);
  scrapeResults.forEach((res) => {
    if (res.status === "fulfilled" && res.value.success) {
      scrapedCount++;
    } else {
      errorCount++;
    }
  });

  console.info(
    `[scanner-service] Scraping finished. Success: ${scrapedCount}, Errors: ${errorCount}`,
  );

  // 2. Evaluate opportunities
  const dbSnapshots = await getAllFreshSnapshots();
  const snapshots = dbSnapshots.map(dbSnapshotToSchema);

  if (snapshots.length < 2) {
    return {
      success: true,
      scrapedCount,
      evaluatedPairs: 0,
      message: "Insufficient snapshots for evaluation",
      durationMs: Date.now() - start,
    };
  }
  
  // Obtener tiempo actual de la base de datos para sincronizar cálculos de "edad"
  const [{ dbNow }] = await prisma.$queryRaw<[{ dbNow: Date }]>`SELECT NOW() as "dbNow"`;
  const referenceTime = dbNow.getTime();

  const firstUser = await prisma.user.findFirst();
  if (!firstUser) {
    throw new Error("No users in system");
  }

  const userConfig = await getOrCreateDefaultUserConfig(firstUser.id);

  const opportunities = evaluateAllPairs(
    snapshots,
    userConfig,
    userConfig.capitalAmount,
    0, // networkCostUSD
    referenceTime,
  );

  // 3. Persist
  const evaluationTime = new Date();
  const persistPromises = opportunities.map((opp) =>
    insertOpportunity({
      route: opp.route,
      buyPlatform: opp.buyPlatform,
      sellPlatform: opp.sellPlatform,
      asset: opp.asset,
      buyPrice: opp.buyPrice,
      sellPrice: opp.sellPrice,
      capitalAmount: opp.capitalAmount,
      roiGross: opp.roiGross,
      feesImpact: opp.feesImpact,
      slippageImpact: opp.slippageImpact,
      networkImpact: opp.networkImpact,
      roiAdjusted: opp.roiAdjusted,
      fillProbability: opp.fillProbability,
      liquidityRatio: opp.liquidityRatio,
      latencyRiskMs: opp.latencyRiskMs,
      snapshotAgeBuyMs: opp.snapshotAge.buyMs,
      snapshotAgeSellMs: opp.snapshotAge.sellMs,
      classification: opp.classification,
      rejectionReasons: opp.rejectionReasons ?? [],
      evaluatedAt: evaluationTime,
    }),
  );

  await Promise.allSettled(persistPromises);

  let alertsSent = 0;

  const durationMs = Date.now() - start;
  console.info(
    `[scanner-service] Full scan completed in ${durationMs}ms. Opportunities: ${opportunities.length}, Alerts: ${alertsSent}`,
  );

  return {
    success: true,
    scrapedCount,
    evaluatedPairs: opportunities.length,
    alertsSent,
    durationMs,
  };
}
