import { z } from "zod";

export const PlatformEnum = z.enum([
  "binance_spot",
  "binance_p2p",
  "binance_p2p_ves",
  "binance_p2p_ars",
  "bybit_spot",
  "bybit_p2p",
  "bybit_p2p_ves",
  "airtm",
  "kontigo",
]);

export const AssetEnum = z.enum(["USDT", "USDC", "BTC", "ETH"]);

export type Platform = z.infer<typeof PlatformEnum>;
export type Asset = z.infer<typeof AssetEnum>;

export const MarketSnapshotSchema = z.object({
  id: z.string().cuid2(),
  platform: PlatformEnum,
  asset: AssetEnum,
  baseCurrency: z.string().length(3),
  price: z.number().positive().finite(),
  priceAsk: z.number().positive().finite().optional(),
  priceBid: z.number().positive().finite().optional(),
  volume24h: z.number().nonnegative().optional(),
  availableLiquidity: z.number().nonnegative(),
  fee: z.number().min(0).max(0.1),
  latencyMs: z.number().nonnegative().int(),
  scrapedAt: z.string().datetime(),
  isStale: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export const RawSnapshotInputSchema = MarketSnapshotSchema.omit({
  id: true,
  isStale: true,
});

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;
export type RawSnapshotInput = z.infer<typeof RawSnapshotInputSchema>;
