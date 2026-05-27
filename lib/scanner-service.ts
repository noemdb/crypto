import { runScrape } from "./scrapers/run-scrape";
import { getAllFreshSnapshots } from "./db/queries/snapshots";
import { getOrCreateDefaultUserConfig } from "./db/queries/user-config";
import { insertOpportunity } from "./db/queries/opportunities";
import { dbSnapshotToSchema } from "./db/normalize";
import { evaluateAllPairs } from "./arbitrage-engine/pipeline";
import { sendTelegramAlert } from "./alerts/telegram";
import { runPriceMonitor } from "./price-monitor/price-monitor-service";
import { pruneOldPriceRecords } from "./db/queries/price-records";
import { collectBCVRate, persistBCVRate } from "./intelligence/bcv-collector";
import { collectBankingSignals, persistBankingSignals } from "./intelligence/banking-collector";
import { sendIntelligenceAlert } from "./alerts/telegram";

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

  const activeConfigs = [...SCRAPE_CONFIG];
  if (process.env.ENABLE_P2P_SCRAPING === "true") {
    activeConfigs.push({
      platform: "binance_p2p_ves",
      assets: ["USDT", "BTC", "ETH"],
    });
    // bybit_p2p se añadirá cuando esté estable
  }

  // 1. Scrape all configured pairs in parallel
  const scrapePromises: Promise<any>[] = [];
  for (const config of activeConfigs) {
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
  const evaluationTime = new Date().toISOString();
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
  
  // 4. Alerts
  let alertsSent = 0;
  
  if (userConfig.alertTelegram) {
    const executable = opportunities.filter(o => o.classification === "EXECUTABLE");
    const alertPromises = executable.map(opp => {
      alertsSent++;
      return sendTelegramAlert(opp, userConfig.alertTelegram!);
    });
    await Promise.allSettled(alertPromises);
  }

  const durationMs = Date.now() - start;
  console.info(
    `[scanner-service] Full scan completed in ${durationMs}ms. Opportunities: ${opportunities.length}, Alerts: ${alertsSent}`,
  );

  // 5. Price Monitor
  try {
    const priceResults = await runPriceMonitor(userConfig)
    const recorded = priceResults.filter(r => r.recorded).length
    const alerted  = priceResults.filter(r => r.alerted).length
    console.info(`[scanner] price monitor: ${recorded} registros guardados, ${alerted} alertas enviadas`)
  } catch (err) {
    console.error('[scanner] price monitor error:', err)
  }

  // Pruning diario en memoria (se resetea con cada deploy — aceptable para uso continuo)
  const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000
  const g = globalThis as any
  if (!g._lastPriceRecordPrune || Date.now() - g._lastPriceRecordPrune > PRUNE_INTERVAL_MS) {
    try {
      const pruned = await pruneOldPriceRecords()
      if (pruned > 0) console.info(`[scanner] price records pruned: ${pruned} registros eliminados (>90 días)`)
      g._lastPriceRecordPrune = Date.now()
    } catch (err) {
      console.error('[scanner] pruning error:', err)
    }
  }

  // 6. Intelligence Collectors (BCV cada 4 ciclos, Banking cada 2 ciclos)
  g._intelCycleCount = (g._intelCycleCount ?? 0) + 1
  try {
    await runIntelligenceCollectors(userConfig, g._intelCycleCount)
  } catch (err) {
    console.error('[scanner] intelligence collectors error:', err)
  }

  return {
    success: true,
    scrapedCount,
    evaluatedPairs: opportunities.length,
    alertsSent,
    durationMs,
  };
}

async function runIntelligenceCollectors(
  config: Awaited<ReturnType<typeof getOrCreateDefaultUserConfig>>,
  cycleCount: number,
): Promise<void> {
  if (!config.intelEnabled) return

  // BCV: cada 4 ciclos (~12 min si ciclo = 3 min)
  if (cycleCount % 4 === 0 || cycleCount === 1) {
    const bcvData = await collectBCVRate()
    if (bcvData) {
      const { saved, changed, changePct } = await persistBCVRate(bcvData)
      if (saved) {
        console.info(`[scanner] intel bcv: tasa guardada ${bcvData.rateUsd.toFixed(2)} VES`)
      }
      if (changed && config.bcvAlertOnChange && config.alertTelegram) {
        const threshold = config.bcvChangeThresholdPct ?? 0.5
        if (changePct !== null && Math.abs(changePct) >= threshold) {
          await sendIntelligenceAlert({
            chatId: config.alertTelegram,
            type: 'bcv_rate',
            summary: `BCV: 1 USD = ${bcvData.rateUsd.toFixed(2)} VES (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%)`,
            score: 1.0,
            confidence: 1.0, // Dato objetivo del BCV — certeza total
          })
        }
      }
    }
  }

  // Banking: cada 2 ciclos (~6 min)
  if (cycleCount % 2 === 0 || cycleCount === 1) {
    const bankSignals = await collectBankingSignals()
    if (bankSignals.length > 0) {
      await persistBankingSignals(bankSignals)
      console.info(`[scanner] intel banking: ${bankSignals.length} señal(es) detectada(s)`)

      if (config.bankingAlertEnabled && config.alertTelegram) {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        const unalertedSignals = await prisma.intelSignal.findMany({
          where: {
            sourceLayer: 'banking',
            alerted: false,
            score: { gte: 0.80 },          // Impacto > 80%
            confidence: { gte: 0.80 },     // Confianza > 80%
            detectedAt: { gte: twoHoursAgo }
          }
        });

        for (const signal of unalertedSignals) {
          await sendIntelligenceAlert({
            chatId: config.alertTelegram,
            type: 'banking',
            summary: signal.summary,
            score: signal.score,
            confidence: signal.confidence,
          });

          await prisma.intelSignal.update({
            where: { id: signal.id },
            data: { alerted: true }
          });
        }
      }
    }
  }
}
