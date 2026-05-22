import { prisma } from "@/lib/db/prisma";
import type { UserConfig } from "@/lib/schemas";

export async function getUserConfig(
  userId: string,
): Promise<UserConfig | null> {
  const config = await prisma.userConfig.findUnique({
    where: { userId },
  });

  if (!config) return null;

  return {
    id: config.id,
    userId: config.userId,
    minROI: config.minROI,
    capitalAmount: config.capitalAmount,
    maxSlippage: config.maxSlippage,
    minFillProbability: config.minFillProbability,
    alertEmail: config.alertEmail ?? undefined,
    alertTelegram: config.alertTelegram ?? undefined,
    alertDedupeWindowMin: config.alertDedupeWindowMin,
    scanIntervalSeconds: config.scanIntervalSeconds,
    opportunitiesLimit: config.opportunitiesLimit,
    enabledPlatforms: config.enabledPlatforms as UserConfig["enabledPlatforms"],
    monitoredAssets: config.monitoredAssets as UserConfig["monitoredAssets"],
    updatedAt: config.updatedAt.toISOString(),
    // ── Monitor de Precio P2P ──────────────────────────────────────────────
    monitorEnabled:          config.monitorEnabled,
    monitorPlatforms:        config.monitorPlatforms,
    monitorAssets:           config.monitorAssets,
    priceChangeThresholdPct: config.priceChangeThresholdPct,
    priceAlertThresholdPct:  config.priceAlertThresholdPct,
    priceAlertEnabled:       config.priceAlertEnabled,
  };
}

export async function getOrCreateDefaultUserConfig(
  userId: string,
): Promise<UserConfig> {
  const existing = await getUserConfig(userId);
  if (existing) return existing;

  const created = await prisma.userConfig.create({
    data: {
      userId,
      enabledPlatforms: ["binance_spot", "bybit_spot"],
      monitoredAssets: ["USDT"],
      scanIntervalSeconds: 180,
      opportunitiesLimit: 50,
      // Monitor defaults
      monitorEnabled:          true,
      monitorPlatforms:        ["binance_p2p_ves"],
      monitorAssets:           ["USDT"],
      priceChangeThresholdPct: 1.0,
      priceAlertThresholdPct:  2.0,
      priceAlertEnabled:       true,
    },
  });

  return {
    id: created.id,
    userId: created.userId,
    minROI: created.minROI,
    capitalAmount: created.capitalAmount,
    maxSlippage: created.maxSlippage,
    minFillProbability: created.minFillProbability,
    alertEmail: created.alertEmail ?? undefined,
    alertTelegram: created.alertTelegram ?? undefined,
    alertDedupeWindowMin: created.alertDedupeWindowMin,
    scanIntervalSeconds: created.scanIntervalSeconds,
    opportunitiesLimit: created.opportunitiesLimit,
    enabledPlatforms:
      created.enabledPlatforms as UserConfig["enabledPlatforms"],
    monitoredAssets: created.monitoredAssets as UserConfig["monitoredAssets"],
    updatedAt: created.updatedAt.toISOString(),
    // ── Monitor de Precio P2P ──────────────────────────────────────────────
    monitorEnabled:          created.monitorEnabled,
    monitorPlatforms:        created.monitorPlatforms,
    monitorAssets:           created.monitorAssets,
    priceChangeThresholdPct: created.priceChangeThresholdPct,
    priceAlertThresholdPct:  created.priceAlertThresholdPct,
    priceAlertEnabled:       created.priceAlertEnabled,
  };
}
