import {
  buildIssuerHealthReport,
  buildIssuerRegistryReport,
  createIssuerAdapter,
  detectIssuerSourceChange,
  getIssuer,
  listIssuerAdapters,
  listIssuerProducts,
  listIssuers,
  mapBenefitName,
  runIssuerAdapterTest,
  setIssuerEnabled,
  validateProductCatalog,
} from "../src/services/issuerIntelligenceService";

describe("issuerIntelligenceService", () => {
  test("canonical issuer registry supports registration metadata and aliases", () => {
    const amex = getIssuer("amex");
    const chase = getIssuer("jp morgan chase");

    expect(amex).toEqual(
      expect.objectContaining({
        issuerId: "american-express",
        displayName: "American Express",
        parserVersion: "amex-pilot-v1",
        reviewStatus: "pilot",
      }),
    );
    expect(chase).toEqual(expect.objectContaining({ issuerId: "chase" }));
    expect(listIssuers().length).toBeGreaterThanOrEqual(8);
  });

  test("issuer adapters load through one contract without recommendation-engine logic", () => {
    const adapter = createIssuerAdapter("american-express");
    const sources = adapter.discoverSources();
    const run = runIssuerAdapterTest("american-express");

    expect(sources.length).toBeGreaterThan(0);
    expect(run.extraction.normalizedBenefits.length).toBeGreaterThan(0);
    expect(run.validation.valid).toBe(true);
    expect(run.confidence.confidence).toBeGreaterThanOrEqual(0.8);
    expect(listIssuerAdapters().map((item) => item.issuerId)).toContain("capital-one");
  });

  test("benefit mapping normalizes issuer wording into canonical benefits", () => {
    expect(mapBenefitName("Monthly Dining Benefit")).toEqual(
      expect.objectContaining({
        canonicalName: "Dining Credit",
        strategy: "exact",
      }),
    );
    expect(mapBenefitName("Restaurant Credit")).toEqual(
      expect.objectContaining({
        canonicalName: "Dining Credit",
        benefitType: "dining_benefit",
      }),
    );
    expect(mapBenefitName("Priority Pass airport lounge access")).toEqual(
      expect.objectContaining({
        canonicalName: "Lounge Access",
        strategy: "synonym",
      }),
    );
  });

  test("parser failures and broken source structure force review-required health", () => {
    const adapter = createIssuerAdapter("chase");
    const issuer = getIssuer("chase");
    if (!issuer) throw new Error("expected chase issuer");
    const source = adapter.discoverSources()[0];
    const extraction = adapter.extractBenefits({
      issuer,
      source,
      fixturePayload: { brokenHtml: true },
      observedAt: "2026-07-22T00:00:00.000Z",
    });
    const validation = adapter.validateBenefits(extraction.normalizedBenefits);
    const health = buildIssuerHealthReport("chase", {
      extractionSucceeded: false,
      validationSucceeded: validation.valid,
      parserErrors: extraction.warnings,
      confidence: extraction.parserConfidence,
    });

    expect(extraction.missingFields).toContain("benefits");
    expect(health).toEqual(
      expect.objectContaining({
        status: "review_required",
        parserHealth: "failed",
      }),
    );
  });

  test("source change detection catches missing expected sections and checksum drift", () => {
    const run = runIssuerAdapterTest("american-express");
    const result = detectIssuerSourceChange({
      issuerId: "american-express",
      source: run.source,
      payloadText: "<html><main>new marketing page without expected structure</main></html>",
      previousChecksum: "checksum_previous",
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.changes).toEqual(
      expect.arrayContaining(["checksum_changed", "expected_sections_missing"]),
    );
  });

  test("product catalog validates multiple issuers and sandbox cards", () => {
    const validation = validateProductCatalog();
    const products = listIssuerProducts();

    expect(validation).toEqual(
      expect.objectContaining({
        valid: true,
        productCount: expect.any(Number),
      }),
    );
    expect(products.map((product) => product.productId)).toEqual(
      expect.arrayContaining([
        "amex-platinum",
        "chase-sapphire-preferred",
        "capital-one-venture-x",
        "citi-strata-premier",
        "discover-it",
        "bilt-mastercard",
      ]),
    );
  });

  test("registry health and statistics expose issuer readiness", () => {
    const report = buildIssuerRegistryReport();
    const disabled = setIssuerEnabled("citi", false);

    expect(report.statistics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issuerId: "american-express",
          productCount: expect.any(Number),
          capabilityCount: expect.any(Number),
        }),
      ]),
    );
    expect(disabled.reviewStatus).toBe("disabled");
  });

  test("multi-issuer compatibility runs adapters for every issuer without live integrations", () => {
    const results = listIssuers().map((issuer) => runIssuerAdapterTest(issuer.issuerId));

    expect(results.every((result) => result.validation.valid)).toBe(true);
    expect(results.map((result) => result.issuer.issuerId)).toEqual(
      expect.arrayContaining(["american-express", "chase", "capital-one", "citi", "discover", "bilt"]),
    );
  });
});
