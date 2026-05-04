import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAlertDuplicate } from "@/lib/alerts/dedup";

// Mock del cliente Prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    alert: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("AC-03: Deduplicación de alertas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when recent alert exists within window", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.alert.findFirst).mockResolvedValueOnce({
      id: "cl1",
      opportunityId: "cl2",
      channel: "email",
      recipient: "test@test.com",
      sentAt: new Date(Date.now() - 15 * 60_000), // 15 min ago
      status: "sent",
    });

    const result = await isAlertDuplicate(
      "binance_spot→bybit_p2p",
      "test@test.com",
      30, // 30 min window
    );

    expect(result).toBe(true);
  });

  it("returns false when no recent alert exists", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.alert.findFirst).mockResolvedValueOnce(null);

    const result = await isAlertDuplicate(
      "binance_spot→bybit_p2p",
      "test@test.com",
      30,
    );

    expect(result).toBe(false);
  });
});
