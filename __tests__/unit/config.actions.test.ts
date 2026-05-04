import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateUserConfig } from "@/lib/actions/config.actions";

// Mock del helper de auth
vi.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user_test_id"),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userConfig: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("AC-08: Server Action validación Zod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects negative minROI without DB write", async () => {
    const result = await updateUserConfig({
      minROI: -5,
      capitalAmount: 500,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ["binance_spot"],
      monitoredAssets: ["USDT"],
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBeDefined();

    const { prisma } = await import("@/lib/db/prisma");
    expect(prisma.userConfig.upsert).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated call without DB write", async () => {
    const { getAuthenticatedUserId } = await import("@/lib/auth-helpers");
    vi.mocked(getAuthenticatedUserId).mockResolvedValueOnce(null);

    const result = await updateUserConfig({
      minROI: 1.5,
      capitalAmount: 500,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ["binance_spot"],
      monitoredAssets: ["USDT"],
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "No autenticado",
    );

    const { prisma } = await import("@/lib/db/prisma");
    expect(prisma.userConfig.upsert).not.toHaveBeenCalled();
  });

  it("saves valid config successfully", async () => {
    const result = await updateUserConfig({
      minROI: 1.5,
      capitalAmount: 500,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ["binance_spot", "bybit_spot"],
      monitoredAssets: ["USDT"],
    });

    expect(result.success).toBe(true);
  });
});
