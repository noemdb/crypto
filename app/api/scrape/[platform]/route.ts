import { NextRequest, NextResponse } from "next/server";
import { verifyQStashSignature } from "@/lib/qstash";
import { runScrape } from "@/lib/scrapers/run-scrape";
import { ScrapeRequestSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  // Verificar firma QStash
  const clonedReq = request.clone();
  const isValid = await verifyQStashSignature(clonedReq);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ScrapeRequestSchema.safeParse({ ...(body as object), platform });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { asset, requestId } = parsed.data;

  console.info(
    `[scrape] platform=${platform} asset=${asset} requestId=${requestId}`,
  );

  const result = await runScrape(parsed.data.platform, asset);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    snapshotId: result.snapshotId,
    price: 0, // el precio está en DB, no lo exponemos aquí
    latencyMs: result.latencyMs,
    scrapedAt: new Date().toISOString(),
  });
}
