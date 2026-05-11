import { getScraper } from "./index";
import { insertSnapshot } from "@/lib/db/queries/snapshots";
import {
  markPlatformHealthy,
  markPlatformError,
} from "@/lib/db/queries/platform-status";
import type { Platform, Asset } from "@/lib/schemas";
import { Prisma } from "@prisma/client";

export type RunScrapeResult =
  | { success: true; snapshotId: string; latencyMs: number }
  | { success: false; error: string };

export async function runScrape(
  platform: Platform,
  asset: Asset,
): Promise<RunScrapeResult> {
  const scraper = getScraper(platform);

  if (!scraper) {
    return {
      success: false,
      error: `No scraper registered for platform: ${platform}`,
    };
  }

  if (!scraper.supportedAssets.includes(asset)) {
    return {
      success: false,
      error: `Platform ${platform} does not support asset ${asset}`,
    };
  }

  try {
    const { snapshot } = await scraper.scrape(asset);

    const record = await insertSnapshot({
      platform: snapshot.platform,
      asset: snapshot.asset,
      baseCurrency: snapshot.baseCurrency,
      price: snapshot.price,
      priceAsk: snapshot.priceAsk ?? null,
      priceBid: snapshot.priceBid ?? null,
      volume24h: snapshot.volume24h ?? null,
      availableLiquidity: snapshot.availableLiquidity,
      fee: snapshot.fee,
      latencyMs: snapshot.latencyMs,
      scrapedAt: new Date(snapshot.scrapedAt),
      metadata: snapshot.metadata
        ? (snapshot.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    });

    await markPlatformHealthy(platform);

    return {
      success: true,
      snapshotId: record.id,
      latencyMs: snapshot.latencyMs,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    await markPlatformError(platform, error);
    return { success: false, error };
  }
}
