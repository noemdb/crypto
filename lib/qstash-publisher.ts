import { Client } from "@upstash/qstash";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client({ token: process.env.QSTASH_TOKEN! });
  }
  return client;
}

type EnqueueScrapeJob = {
  platform: string;
  asset: string;
  requestId: string;
  delaySeconds?: number;
};

export async function enqueueScrapeJob(job: EnqueueScrapeJob): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/api/scrape/${job.platform}`;

  await getClient().publishJSON({
    url,
    body: { asset: job.asset, requestId: job.requestId },
    delay: job.delaySeconds ?? 0,
  });
}
