import { runScrape } from "../lib/scrapers/run-scrape";
import { prisma } from "../lib/db/prisma";
import { getAllFreshSnapshots } from "../lib/db/queries/snapshots";
import { getOrCreateDefaultUserConfig } from "../lib/db/queries/user-config";
import { insertOpportunity } from "../lib/db/queries/opportunities";
import { dbSnapshotToSchema } from "../lib/db/normalize";
import { evaluateAllPairs } from "../lib/arbitrage-engine/pipeline";

async function main() {
  console.log("--- Starting Manual Scrape ---");
  const platforms = ["binance_spot", "bybit_spot"] as const;
  const assets = ["USDT", "USDC", "BTC", "ETH"] as const;

  for (const platform of platforms) {
    for (const asset of assets) {
      console.log(`Scraping ${platform} for ${asset}...`);
      const result = await runScrape(platform, asset);
      if (result.success) {
        console.log(`✅ Success: ${platform} ${asset} (Snapshot: ${result.snapshotId})`);
      } else {
        console.error(`❌ Failed: ${platform} ${asset} - ${result.error}`);
      }
    }
  }

  console.log("\n--- Starting Evaluation ---");
  const dbSnapshots = await getAllFreshSnapshots();
  const snapshots = dbSnapshots.map(dbSnapshotToSchema);
  console.log(`Found ${snapshots.length} fresh snapshots.`);

  if (snapshots.length < 2) {
    console.log("Insufficient snapshots for evaluation.");
    return;
  }

  const firstUser = await prisma.user.findFirst();
  if (!firstUser) {
    console.error("No users in system.");
    return;
  }

  const userConfig = await getOrCreateDefaultUserConfig(firstUser.id);
  console.log(`Using config for user: ${firstUser.email}`);

  const opportunities = evaluateAllPairs(
    snapshots,
    userConfig,
    userConfig.capitalAmount,
  );

  console.log(`Evaluated ${opportunities.length} possible pairs.`);

  let persisted = 0;
  for (const opp of opportunities) {
    await insertOpportunity({
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
      evaluatedAt: new Date(opp.evaluatedAt),
    });
    persisted++;
  }

  console.log(`\n✅ Done! Persisted ${persisted} opportunities.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
