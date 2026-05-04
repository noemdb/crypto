import { NextResponse } from "next/server";
import { getAllPlatformStatuses } from "@/lib/db/queries/platform-status";

export async function GET() {
  try {
    const statuses = await getAllPlatformStatuses();
    const allHealthy = statuses.every((s) => s.isHealthy);

    return NextResponse.json(
      {
        status: allHealthy ? "ok" : "degraded",
        platforms: statuses,
        timestamp: new Date().toISOString(),
      },
      { status: allHealthy ? 200 : 207 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
