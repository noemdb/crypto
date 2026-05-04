import { z } from "zod";
import { PlatformEnum, AssetEnum } from "./snapshot.schema";

export const ScrapeRequestSchema = z.object({
  platform: PlatformEnum,
  asset: AssetEnum,
  requestId: z.string().min(1),
});

export const ScrapeResponseSchema = z.object({
  snapshotId: z.string().cuid2(),
  price: z.number().positive(),
  latencyMs: z.number().int().nonnegative(),
  scrapedAt: z.string().datetime(),
});

export type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;
export type ScrapeResponse = z.infer<typeof ScrapeResponseSchema>;
