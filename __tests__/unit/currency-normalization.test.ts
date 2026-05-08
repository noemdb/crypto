import { describe, test, expect } from "vitest";
import { calculateNormalizedPrice } from "@/lib/arbitrage-engine/steps/currency-normalization";

describe("Currency Normalization Unit Tests", () => {
  const rates = {
    usdVes: 50,
  };

  test("should normalize VES correctly (50 / 50 = 1.0)", () => {
    const result = calculateNormalizedPrice(50, "VES", rates);
    expect(result).toBe(1.0);
  });

  test("should keep USD as is (1.0 = 1.0)", () => {
    const result = calculateNormalizedPrice(1.0, "USD", rates);
    expect(result).toBe(1.0);
  });

  test("should handle missing rates gracefully", () => {
    const result = calculateNormalizedPrice(1000, "VES", {});
    expect(result).toBe(1000); // Should fallback to 1.0 rate
  });

  test("should handle zero rate gracefully", () => {
    const result = calculateNormalizedPrice(1000, "VES", { usdVes: 0 });
    expect(result).toBe(1000); // Should fallback to 1.0 rate and not divide by zero
  });
});
