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
    enabledPlatforms: config.enabledPlatforms as UserConfig["enabledPlatforms"],
    monitoredAssets: config.monitoredAssets as UserConfig["monitoredAssets"],
    updatedAt: config.updatedAt.toISOString(),
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
    enabledPlatforms:
      created.enabledPlatforms as UserConfig["enabledPlatforms"],
    monitoredAssets: created.monitoredAssets as UserConfig["monitoredAssets"],
    updatedAt: created.updatedAt.toISOString(),
  };
}
