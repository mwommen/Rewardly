import {
  runMerchantIntelligenceValidation,
} from "../src/validation/merchantIntelligenceValidation";

describe("merchant intelligence validation framework", () => {
  test("curated scenarios, invariants, metamorphic checks, registry checks, and coverage pass", () => {
    const report = runMerchantIntelligenceValidation({ suite: "curated" });

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.registry.ok).toBe(true);
    expect(report.invariants.failed).toBe(0);
    expect(report.metamorphic.failed).toBe(0);
    expect(report.coverage.failures).toEqual([]);
  });

  test("generated scenarios are seeded and deterministic", () => {
    const first = runMerchantIntelligenceValidation({
      suite: "generated",
      seed: 20260724,
      count: 25,
    });
    const second = runMerchantIntelligenceValidation({
      suite: "generated",
      seed: 20260724,
      count: 25,
    });

    expect(first.ok).toBe(true);
    expect(second.results.map((result) => result.actual)).toEqual(
      first.results.map((result) => result.actual),
    );
  });

  test("zero generated scenarios and no-match filters fail", () => {
    expect(() =>
      runMerchantIntelligenceValidation({ suite: "generated", count: 0 }),
    ).toThrow(/count/i);
    expect(() =>
      runMerchantIntelligenceValidation({ scenario: "does-not-exist" }),
    ).toThrow(/No merchant intelligence scenarios/i);
  });
});
