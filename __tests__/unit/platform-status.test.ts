import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  markPlatformError,
  markPlatformHealthy,
} from "@/lib/db/queries/platform-status";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    platformStatus: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("AC-05: Platform Status Tracking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks platform unhealthy after 3 consecutive errors", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    // Simular que ya hay 2 errores consecutivos
    vi.mocked(prisma.platformStatus.findUnique).mockResolvedValue({
      id: "cl1",
      platform: "airtm",
      isHealthy: true,
      consecutiveErrors: 2,
      lastSuccessAt: null,
      lastErrorAt: null,
      errorMessage: null,
      updatedAt: new Date(),
    });

    await markPlatformError("airtm", "Connection refused");

    expect(prisma.platformStatus.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isHealthy: false,
          consecutiveErrors: 3,
        }),
      }),
    );
  });

  it("resets consecutive errors on healthy scrape", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    await markPlatformHealthy("binance_spot");

    expect(prisma.platformStatus.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isHealthy: true,
          consecutiveErrors: 0,
          errorMessage: null,
        }),
      }),
    );
  });
});
