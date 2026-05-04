import type { MarketSnapshot } from "@/lib/schemas";
import type { MarketSnapshot as PrismaSnapshot } from "@prisma/client";

export function dbSnapshotToSchema(record: PrismaSnapshot): MarketSnapshot {
  return {
    id: record.id,
    platform: record.platform as MarketSnapshot["platform"],
    asset: record.asset as MarketSnapshot["asset"],
    baseCurrency: record.baseCurrency,
    price: record.price,
    priceAsk: record.priceAsk ?? undefined,
    priceBid: record.priceBid ?? undefined,
    volume24h: record.volume24h ?? undefined,
    availableLiquidity: record.availableLiquidity,
    fee: record.fee,
    latencyMs: record.latencyMs,
    scrapedAt: record.scrapedAt.toISOString(),
    isStale: false, // fresh por construcción (viene de getAllFreshSnapshots)
    metadata: record.metadata as Record<string, unknown> | undefined,
  };
}
