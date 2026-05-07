import { calculateNormalizedPrice } from "@/lib/arbitrage-engine/steps/currency-normalization";

describe("Currency Normalization Unit Tests", () => {
  const rates = {
    usdArs: 1467,
    usdVes: 50,
  };

  test("should normalize ARS correctly (1467 / 1467 = 1.0)", () => {
    const result = calculateNormalizedPrice(1467, "ARS", rates);
    expect(result).toBe(1.0);
  });

  test("should normalize VES correctly (50 / 50 = 1.0)", () => {
    const result = calculateNormalizedPrice(50, "VES", rates);
    expect(result).toBe(1.0);
  });

  test("should keep USD as is (1.0 = 1.0)", () => {
    const result = calculateNormalizedPrice(1.0, "USD", rates);
    expect(result).toBe(1.0);
  });

  test("should handle missing rates gracefully", () => {
    const result = calculateNormalizedPrice(1000, "ARS", {});
    expect(result).toBe(1000); // Should fallback to 1.0 rate
  });

  test("should handle zero rate gracefully", () => {
    const result = calculateNormalizedPrice(1000, "ARS", { usdArs: 0 });
    expect(result).toBe(1000); // Should fallback to 1.0 rate and not divide by zero
  });
});
