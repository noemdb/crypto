import type { Platform } from "@/lib/schemas";
import { reject, type EvalContext } from "../types";

export const TTL_MS: Record<Platform, number> = {
  binance_spot: 30_000,
  bybit_spot: 30_000,
  binance_p2p: 120_000,
  bybit_p2p: 120_000,
  airtm: 180_000,
  kontigo: 180_000,
};

export function validateSnapshotFreshness(ctx: EvalContext): EvalContext {
  const now = ctx.referenceTime;
  const buyAge = now - new Date(ctx.input.buySnapshot.scrapedAt).getTime();
  const sellAge = now - new Date(ctx.input.sellSnapshot.scrapedAt).getTime();
  const buyTTL = TTL_MS[ctx.input.buySnapshot.platform];
  const sellTTL = TTL_MS[ctx.input.sellSnapshot.platform];

  const ctxWithAge = {
    ...ctx,
    output: {
      ...ctx.output,
      snapshotAge: { buyMs: buyAge, sellMs: sellAge },
    },
  };

  if (buyAge > buyTTL || sellAge > sellTTL) {
    return reject(
      ctxWithAge,
      `STALE_DATA: buy=${buyAge}ms (ttl=${buyTTL}ms) sell=${sellAge}ms (ttl=${sellTTL}ms)`,
    );
  }

  return ctxWithAge;
}
