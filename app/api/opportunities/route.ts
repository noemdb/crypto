import { NextRequest, NextResponse } from "next/server";
import { getOpportunities } from "@/lib/db/queries/opportunities";


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classification = searchParams.get("classification") ?? "ALL";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const cursor = searchParams.get("cursor") ?? undefined;
  const since = searchParams.get("since")
    ? new Date(searchParams.get("since")!)
    : undefined;

  const opts: Parameters<typeof getOpportunities>[0] = { limit };
  if (classification !== "ALL") opts.classification = classification;
  if (cursor) opts.cursor = cursor;
  if (since) opts.since = since;

  const rows = await getOpportunities(opts);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

  return NextResponse.json({
    data,
    meta: { total: data.length, hasMore, nextCursor },
  });
}
