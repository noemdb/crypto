import { NextRequest, NextResponse } from "next/server";
import { enqueueScrapeJob } from "@/lib/qstash-publisher";
import { createId } from "@paralleldrive/cuid2";

// Bypass Auth.js middleware para machine-to-machine
export const runtime = "nodejs";

const SCRAPE_SCHEDULE: Array<{
  platform: string;
  assets: string[];
  delaySeconds: number;
}> = [
  {
    platform: "binance_spot",
    assets: ["USDT", "USDC", "BTC", "ETH"],
    delaySeconds: 0,
  },
  {
    platform: "bybit_spot",
    assets: ["USDT", "USDC", "BTC", "ETH"],
    delaySeconds: 0,
  },
  // Fase 2:
  // { platform: 'binance_p2p', assets: ['USDT'], delaySeconds: 30 },
  // { platform: 'bybit_p2p',   assets: ['USDT'], delaySeconds: 60 },
  // { platform: 'airtm',       assets: ['USDT'], delaySeconds: 60 },
  // { platform: 'kontigo',     assets: ['USDT'], delaySeconds: 90 },
];

export async function POST(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchId = createId();
  let enqueuedJobs = 0;

  for (const schedule of SCRAPE_SCHEDULE) {
    for (const asset of schedule.assets) {
      await enqueueScrapeJob({
        platform: schedule.platform,
        asset,
        requestId: `${batchId}_${schedule.platform}_${asset}`,
        delaySeconds: schedule.delaySeconds,
      });
      enqueuedJobs++;
    }
  }

  console.info(
    `[cron] trigger batchId=${batchId} enqueuedJobs=${enqueuedJobs}`,
  );

  return NextResponse.json({
    enqueuedJobs,
    scheduledAt: new Date().toISOString(),
    batchId,
  });
}
