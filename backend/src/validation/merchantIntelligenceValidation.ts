import {
  evaluateMerchantIntelligence,
  listMerchantIntelligence,
  validateMerchantRegistryQuality,
  type MerchantIntelligenceResult,
  type MerchantEvidenceType,
  type MerchantIntelligenceInput,
  type MerchantResolutionStatus,
} from "../services/merchantIntelligenceService";

export type MerchantIntelligenceScenario = {
  scenarioId: string;
  description: string;
  tags: string[];
  input: MerchantIntelligenceInput;
  expected: {
    merchantId?: string;
    merchantFamilyId?: string;
    category: string;
    purchaseChannel?: string;
    commerceModel?: string;
    marketplace?: boolean;
    checkoutProvider?: string;
    resolutionStatus: MerchantResolutionStatus;
    minimumConfidence?: number;
    maximumConfidence?: number;
    requiredEvidenceTypes?: MerchantEvidenceType[];
    expectedWarnings?: string[];
  };
};

export type MerchantValidationOptions = {
  suite?:
    | "curated"
    | "generated"
    | "invariants"
    | "metamorphic"
    | "registry"
    | "coverage"
    | "parity"
    | "privacy"
    | "performance"
    | "full";
  scenario?: string;
  tag?: string;
  seed?: number;
  count?: number;
  failFast?: boolean;
};

export function runMerchantIntelligenceValidation(
  options: MerchantValidationOptions = {},
) {
  const startedAt = Date.now();
  const suite = options.suite || "curated";
  const seed = options.seed ?? 20260724;
  const count = options.count ?? 1000;
  if ((suite === "generated" || suite === "full" || suite === "performance") && count <= 0) {
    throw new Error("--count must be greater than 0 for generated scenarios");
  }
  const curated = curatedMerchantScenarios();
  const generated =
    suite === "generated" || suite === "full" || suite === "performance"
      ? generatedMerchantScenarios(seed, count)
      : [];
  let scenarios =
    suite === "generated" || suite === "performance"
      ? generated
      : suite === "curated" ||
          suite === "invariants" ||
          suite === "metamorphic" ||
          suite === "registry" ||
          suite === "coverage" ||
          suite === "parity" ||
          suite === "privacy"
        ? curated
        : [...curated, ...generated];
  if (options.scenario) {
    scenarios = scenarios.filter((scenario) => scenario.scenarioId === options.scenario);
  }
  if (options.tag) {
    scenarios = scenarios.filter((scenario) => scenario.tags.includes(options.tag || ""));
  }
  if (!scenarios.length) {
    throw new Error("No merchant intelligence scenarios matched the requested filters");
  }

  const results: Array<ReturnType<typeof runScenario>> = [];
  for (const scenario of scenarios) {
    const scenarioResult = runScenario(scenario);
    results.push(scenarioResult);
    if (options.failFast && !scenarioResult.passed) break;
  }
  const registry = validateMerchantRegistryQuality();
  const invariants = runMerchantInvariants([...curated, ...generated.slice(0, Math.min(250, generated.length))]);
  const metamorphic = runMerchantMetamorphic(seed, curated, generated);
  const coverage =
    suite === "generated" || suite === "performance"
      ? buildGeneratedCoverage(results)
      : buildMerchantCoverage(results, invariants, metamorphic, registry);
  const parity = runMerchantParityValidation(curated);
  const privacy = runMerchantPrivacyValidation();
  const performance = runMerchantPerformanceValidation(seed, count);
  const failed = results.filter((result) => !result.passed);
  const enforce = {
    scenarios: !["invariants", "metamorphic", "registry", "coverage", "parity", "privacy", "performance"].includes(suite),
    registry: ["registry", "coverage", "full"].includes(suite),
    invariants: ["invariants", "coverage", "full"].includes(suite),
    metamorphic: ["metamorphic", "coverage", "full"].includes(suite),
    coverage: ["coverage", "full"].includes(suite),
    parity: ["parity", "full"].includes(suite),
    privacy: ["privacy", "full"].includes(suite),
    performance: ["performance", "full"].includes(suite),
  };
  const ok =
    (!enforce.scenarios || failed.length === 0) &&
    (!enforce.registry || registry.ok) &&
    (!enforce.invariants || invariants.failed === 0) &&
    (!enforce.metamorphic || metamorphic.failed === 0) &&
    (!enforce.coverage || coverage.failures.length === 0) &&
    (!enforce.parity || parity.failed === 0) &&
    (!enforce.privacy || privacy.failed === 0) &&
    (!enforce.performance || performance.failed === 0);

  return {
    ok,
    suite,
    seed,
    requestedGeneratedCount: suite === "curated" ? 0 : count,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
    generatedFamilies: summarizeGeneratedFamilies(generated),
    registry,
    invariants,
    metamorphic,
    coverage,
    parity,
    privacy,
    performance,
    durationMs: Date.now() - startedAt,
  };
}

function runScenario(scenario: MerchantIntelligenceScenario) {
  const result = evaluateMerchantIntelligence(scenario.input);
  const failures = assertionsForScenario(scenario, result);
  return {
      scenarioId: scenario.scenarioId,
      description: scenario.description,
      tags: scenario.tags,
      passed: failures.length === 0,
      failures,
      actual: {
        merchantId: result.identity?.merchantId || null,
        merchantFamilyId: result.identity?.merchantFamilyId || null,
        category: result.classification.primaryCategory,
        purchaseChannel: result.context.purchaseChannel,
        commerceModel: result.context.commerceModel,
        marketplace: result.context.marketplace.isMarketplace,
        checkoutProvider: result.context.checkoutProvider,
        resolutionStatus: result.resolutionStatus,
        confidence: result.confidence.score,
        confidenceBand: result.confidence.band,
        evidenceTypes: result.evidence.map((item) => item.type),
        warnings: result.trace.warnings,
      },
      expected: scenario.expected,
    };
}

export function curatedMerchantScenarios(): MerchantIntelligenceScenario[] {
  const now = "2026-07-24T00:00:00.000Z";
  const coreScenarios = [
    scenario("amazon-domain", "Amazon exact domain resolves high confidence", ["domain", "supported"], {
      url: "https://www.amazon.com/checkout/p/abc/spc",
      hostname: "www.amazon.com",
      detectedMerchantLabel: "Amazon",
      checkoutStage: "review",
      transactionDate: now,
    }, "amazon", "online_shopping", "resolved", 0.85),
    scenario("deceptive-amazon-domain", "Deceptive suffix does not resolve to Amazon", ["domain", "security"], {
      url: "https://amazon.com.attacker.example/checkout",
      hostname: "amazon.com.attacker.example",
      detectedMerchantLabel: "",
      transactionDate: now,
    }, undefined, "unknown", "unknown", 0, 0.59),
    scenario("whole-foods-family", "Whole Foods preserves brand identity and Amazon family", ["family", "grocery"], {
      url: "https://www.wholefoodsmarket.com/",
      hostname: "wholefoodsmarket.com",
      detectedMerchantLabel: "WHOLEFDS",
      transactionDate: now,
    }, "whole-foods", "groceries", "resolved", 0.85, undefined, "amazon"),
    scenario("apple-punctuation-alias", "Apple billing descriptor resolves through punctuation normalization", ["alias"], {
      url: "https://www.apple.com/shop/bag",
      hostname: "www.apple.com",
      detectedMerchantLabel: "APPLE.COM/BILL",
      transactionDate: now,
    }, "apple", "online_shopping", "resolved", 0.85),
    scenario("pineapple-substring", "Substring false positives do not match Apple", ["alias", "security"], {
      url: "https://pineapple.example/checkout",
      hostname: "pineapple.example",
      detectedMerchantLabel: "Pineapple gifts",
      transactionDate: now,
    }, undefined, "unknown", "unknown", 0, 0.59),
    scenario("uber-eats-distinct", "Uber Eats remains distinct from Uber rideshare", ["family", "dining"], {
      url: "https://www.ubereats.com/checkout",
      hostname: "ubereats.com",
      detectedMerchantLabel: "UBER EATS",
      transactionDate: now,
    }, "uber-eats", "dining", "resolved", 0.85, undefined, "uber"),
    scenario("stripe-provider-not-merchant", "Checkout provider is not treated as merchant", ["provider", "privacy"], {
      url: "https://checkout.stripe.com/c/pay/session",
      hostname: "checkout.stripe.com",
      checkoutProviderSignals: ["Stripe Checkout"],
      detectedMerchantLabel: "",
      transactionDate: now,
    }, undefined, "unknown", "unknown", 0, 0.59),
    scenario("conflicting-evidence-ambiguous", "Conflicting strong evidence lowers certainty", ["ambiguity"], {
      url: "https://www.target.com/checkout",
      hostname: "www.target.com",
      detectedMerchantLabel: "Walmart checkout",
      transactionDate: now,
    }, undefined, "unknown", "ambiguous", 0.5, 0.84),
    scenario("target-domain", "Target exact domain resolves when evidence is consistent", ["supported", "retail"], {
      url: "https://www.target.com/checkout",
      hostname: "www.target.com",
      detectedMerchantLabel: "Target",
      checkoutStage: "payment",
      transactionDate: now,
    }, "target", "departmentstores", "resolved", 0.85),
    scenario("lululemon-domain", "Lululemon remains supported", ["supported", "apparel"], {
      url: "https://shop.lululemon.com/shop/mybag",
      hostname: "shop.lululemon.com",
      detectedMerchantLabel: "lululemon",
      checkoutStage: "payment",
      transactionDate: now,
    }, "lululemon", "apparel", "resolved", 0.85),
    scenario("walmart-domain", "Walmart remains supported", ["supported", "retail"], {
      url: "https://www.walmart.com/checkout",
      hostname: "www.walmart.com",
      detectedMerchantLabel: "Walmart",
      checkoutStage: "payment",
      transactionDate: now,
    }, "walmart", "departmentstores", "resolved", 0.85),
    scenario("best-buy-domain", "Best Buy remains supported", ["supported", "electronics"], {
      url: "https://www.bestbuy.com/checkout/r/payment",
      hostname: "www.bestbuy.com",
      detectedMerchantLabel: "Best Buy",
      checkoutStage: "payment",
      transactionDate: now,
    }, "best-buy", "online_shopping", "resolved", 0.85),
    scenario("domain-with-port-query-fragment", "Domain normalization ignores port, query, and fragment", ["domain", "normalization"], {
      url: "https://www.apple.com:443/shop/bag?token=secret#checkout",
      hostname: "WWW.APPLE.COM.",
      detectedMerchantLabel: "Apple",
      transactionDate: now,
    }, "apple", "online_shopping", "resolved", 0.85),
    scenario("unsupported-protocol", "Unsupported protocol cannot resolve through URL alone", ["security", "url"], {
      url: "javascript:alert(1)",
      hostname: "",
      detectedMerchantLabel: "",
      transactionDate: now,
    }, undefined, "unknown", "unknown", 0, 0.59),
    scenario("category-only-fallback", "Category-only evidence stays low confidence", ["classification", "category_only"], {
      url: "https://unknown-dining.example/checkout",
      hostname: "unknown-dining.example",
      documentTextSignals: ["restaurant dining checkout"],
      transactionDate: now,
    }, undefined, "unknown", "unknown", 0, 0.59),
    scenario("shopify-known-merchant", "Known merchant using Shopify keeps merchant identity separate from provider", ["provider", "shopify"], {
      url: "https://www.nike.com/checkout",
      hostname: "www.nike.com",
      detectedMerchantLabel: "Nike",
      checkoutProviderSignals: ["Shopify"],
      transactionDate: now,
    }, "nike", "apparel", "resolved", 0.85),
    scenario("paypal-provider-only", "PayPal provider-only page does not become merchant", ["provider", "paypal"], {
      url: "https://www.paypal.com/checkoutnow",
      hostname: "www.paypal.com",
      checkoutProviderSignals: ["PayPal"],
      transactionDate: now,
    }, undefined, "unknown", "unknown", 0, 0.59),
    scenario("shop-pay-provider-only", "Shop Pay provider-only page does not become merchant", ["provider", "shop_pay"], {
      url: "https://shop.app/pay/session",
      hostname: "shop.app",
      checkoutProviderSignals: ["Shop Pay"],
      transactionDate: now,
    }, undefined, "unknown", "unknown", 0, 0.59),
    scenario("amazon-pay-provider-only", "Amazon Pay provider signal does not replace merchant identity", ["provider", "amazon_pay"], {
      url: "https://pay.amazon.com/checkout",
      hostname: "pay.amazon.com",
      checkoutProviderSignals: ["Amazon Pay"],
      transactionDate: now,
    }, "amazon", "online_shopping", "resolved", 0.85),
    scenario("travel-portal-expedia", "Travel portal is explicit for Expedia", ["channel", "travel_portal"], {
      url: "https://www.expedia.com/checkout",
      hostname: "www.expedia.com",
      detectedMerchantLabel: "Expedia travel portal",
      purchaseChannelHint: "travel_portal",
      transactionDate: now,
    }, "expedia", "travel", "resolved", 0.85),
    scenario("subscription-netflix", "Subscription channel is explicit", ["channel", "subscription"], {
      url: "https://www.netflix.com/billing",
      hostname: "www.netflix.com",
      detectedMerchantLabel: "Netflix subscription",
      purchaseChannelHint: "subscription",
      transactionDate: now,
    }, "netflix", "streaming", "resolved", 0.85),
    scenario("pickup-context", "Pickup channel is explicit when supplied", ["channel", "pickup"], {
      url: "https://www.target.com/checkout",
      hostname: "www.target.com",
      detectedMerchantLabel: "Target pickup",
      purchaseChannelHint: "pickup",
      transactionDate: now,
    }, "target", "departmentstores", "resolved", 0.85),
  ];
  const covered = new Set(coreScenarios.map((item) => item.expected.merchantId).filter(Boolean));
  const registryScenarios = listMerchantIntelligence()
    .filter((merchant) => merchant.active && merchant.websiteDomains.length && !covered.has(merchant.merchantId))
    .map((merchant) => {
      const usesSharedRootDomain = Boolean(
        merchant.merchantGroup &&
          merchant.merchantId !== merchant.merchantGroup &&
          listMerchantIntelligence().some(
            (candidate) =>
              candidate.merchantId === merchant.merchantGroup &&
              merchant.websiteDomains.some((domain) =>
                [...candidate.websiteDomains, ...candidate.knownCheckoutDomains]
                  .map((value) => value.toLowerCase().replace(/^(?:www|m)\./, ""))
                  .includes(domain.toLowerCase().replace(/^(?:www|m)\./, "")),
              ),
          ),
      );
      return scenario(
        `supported-${merchant.merchantId}`,
        `Supported registry merchant resolves: ${merchant.displayName}`,
        ["supported", "registry_merchant"],
        {
          url: usesSharedRootDomain
            ? ""
            : `https://${merchant.websiteDomains[0]}/checkout`,
          hostname: usesSharedRootDomain ? "" : merchant.websiteDomains[0],
          detectedMerchantLabel: merchant.displayName,
          transactionDate: now,
        },
        merchant.merchantId,
        String(merchant.category),
        "resolved",
        merchant.websiteDomains.some((domain) => domain === merchant.merchantGroup || domain.includes(`${merchant.merchantGroup}.`))
          ? 0.6
          : 0.85,
        undefined,
        merchant.merchantGroup || undefined,
      );
    });
  return [...coreScenarios, ...registryScenarios];
}

function scenario(
  scenarioId: string,
  description: string,
  tags: string[],
  input: MerchantIntelligenceInput,
  merchantId: string | undefined,
  category: string,
  resolutionStatus: MerchantResolutionStatus,
  minimumConfidence?: number,
  maximumConfidence?: number,
  merchantFamilyId?: string,
): MerchantIntelligenceScenario {
  return {
    scenarioId,
    description,
    tags,
    input,
    expected: {
      merchantId,
      merchantFamilyId,
      category,
      resolutionStatus,
      minimumConfidence,
      maximumConfidence,
    },
  };
}

function generatedMerchantScenarios(seed: number, count: number) {
  const merchants = listMerchantIntelligence().filter((merchant) =>
    merchant.websiteDomains.some(
      (domain) =>
        !merchant.merchantGroup ||
        merchant.merchantId === merchant.merchantGroup ||
        !listMerchantIntelligence().some(
          (candidate) =>
            candidate.merchantId === merchant.merchantGroup &&
            [...candidate.websiteDomains, ...candidate.knownCheckoutDomains]
              .map((value) => value.toLowerCase().replace(/^(?:www|m)\./, ""))
              .includes(domain.toLowerCase().replace(/^(?:www|m)\./, "")),
        ),
    ),
  );
  const random = seededRandom(seed);
  const out: MerchantIntelligenceScenario[] = [];
  const families = [
    "domain_variant",
    "alias_variant",
    "deceptive_domain",
    "unknown_domain",
    "evidence_order",
    "irrelevant_weak_evidence",
    "strong_conflict",
    "provider_separation",
    "marketplace_signal",
    "portal_direct",
    "category_only",
    "missing_category",
  ];
  for (let index = 0; index < count; index += 1) {
    const merchant = merchants[Math.floor(random() * merchants.length)];
    const family = families[index % families.length];
    const domain =
      merchant.websiteDomains.find(
        (value) =>
          !merchant.merchantGroup ||
          merchant.merchantId === merchant.merchantGroup ||
          !listMerchantIntelligence().some(
            (candidate) =>
              candidate.merchantId === merchant.merchantGroup &&
              [...candidate.websiteDomains, ...candidate.knownCheckoutDomains]
                .map((candidateDomain) =>
                  candidateDomain.toLowerCase().replace(/^(?:www|m)\./, ""),
                )
                .includes(value.toLowerCase().replace(/^(?:www|m)\./, "")),
          ),
      ) || merchant.websiteDomains[0];
    const useWww = random() > 0.5;
    const host = `${useWww ? "www." : ""}${domain}`;
    if (family === "deceptive_domain") {
      out.push(
        scenario(
          `generated-${family}-${index}`,
          `Generated deceptive suffix for ${merchant.displayName}`,
          ["generated", family],
          {
            url: `https://${domain}.attacker.example/checkout`,
            hostname: `${domain}.attacker.example`,
            transactionDate: "2026-07-24T00:00:00.000Z",
          },
          undefined,
          "unknown",
          "unknown",
          0,
          0.59,
        ),
      );
      continue;
    }
    if (family === "unknown_domain") {
      out.push(
        scenario(
          `generated-${family}-${index}`,
          "Generated unknown merchant fallback",
          ["generated", family],
          {
            url: `https://unknown-${index}.example/checkout`,
            hostname: `unknown-${index}.example`,
            detectedMerchantLabel: "",
            transactionDate: "2026-07-24T00:00:00.000Z",
          },
          undefined,
          "unknown",
          "unknown",
          0,
          0.59,
        ),
      );
      continue;
    }
    if (family === "strong_conflict") {
      const conflict = merchants.find((item) => item.merchantId !== merchant.merchantId) || merchant;
      const familyConflict = conflict.merchantGroup === merchant.merchantId;
      out.push(
        scenario(
          `generated-${family}-${index}`,
          `Generated strong domain with conflicting weak label for ${merchant.displayName}`,
          ["generated", family],
          {
            url: `https://${host}/checkout`,
            hostname: host,
            detectedMerchantLabel: `${conflict.displayName} checkout`,
            transactionDate: "2026-07-24T00:00:00.000Z",
          },
          familyConflict ? undefined : merchant.merchantId,
          familyConflict ? "unknown" : String(merchant.category),
          familyConflict ? "ambiguous" : "resolved",
          familyConflict ? 0.5 : 0.85,
          familyConflict ? 0.84 : undefined,
        ),
      );
      continue;
    }
    if (family === "provider_separation") {
      out.push(
        scenario(
          `generated-${family}-${index}`,
          "Generated provider-only checkout remains unknown merchant",
          ["generated", family],
          {
            url: "https://checkout.stripe.com/pay",
            hostname: "checkout.stripe.com",
            checkoutProviderSignals: ["Stripe Checkout"],
            transactionDate: "2026-07-24T00:00:00.000Z",
          },
          undefined,
          "unknown",
          "unknown",
          0,
          0.59,
        ),
      );
      continue;
    }
    if (family === "category_only") {
      out.push(
        scenario(
          `generated-${family}-${index}`,
          "Generated category-only signal remains conservative",
          ["generated", family],
          {
            url: `https://category-${index}.example/checkout`,
            hostname: `category-${index}.example`,
            documentTextSignals: ["grocery checkout"],
            transactionDate: "2026-07-24T00:00:00.000Z",
          },
          undefined,
          "unknown",
          "unknown",
          0,
          0.59,
        ),
      );
      continue;
    }
    const alias =
      family === "alias_variant"
        ? merchant.knownAliases[0] || merchant.displayName
        : merchant.knownAliases[Math.floor(random() * merchant.knownAliases.length)] ||
          merchant.displayName;
    out.push(
      scenario(
        `generated-${family}-${index}`,
        `Generated ${family} for ${merchant.displayName}`,
        ["generated", family],
        {
          url: `https://${host}:443/checkout?ignored=true#fragment`,
          hostname: family === "domain_variant" ? host.toUpperCase() : host,
          detectedMerchantLabel:
            family === "alias_variant"
              ? alias.toUpperCase().replace(/\s+/g, "   ")
              : merchant.displayName,
          documentTextSignals:
            family === "irrelevant_weak_evidence"
              ? ["unrelated footer text", "generic checkout"]
              : [],
          structuredData:
            family === "evidence_order"
              ? [{ type: "merchant_name", value: merchant.displayName, source: "fixture" }]
              : [],
          purchaseChannelHint:
            family === "portal_direct" && String(merchant.category) === "travel"
              ? "travel_portal"
              : family === "marketplace_signal"
                ? "marketplace"
                : undefined,
          transactionDate: "2026-07-24T00:00:00.000Z",
        },
        merchant.merchantId,
        String(merchant.category),
        "resolved",
        0.85,
      ),
    );
  }
  return out;
}

function assertionsForScenario(scenario: MerchantIntelligenceScenario, result: any) {
  const failures: string[] = [];
  if ((result.identity?.merchantId || undefined) !== scenario.expected.merchantId) {
    failures.push(`merchantId expected ${scenario.expected.merchantId || "none"} got ${result.identity?.merchantId || "none"}`);
  }
  if (
    scenario.expected.merchantFamilyId &&
    result.identity?.merchantFamilyId !== scenario.expected.merchantFamilyId
  ) {
    failures.push(`merchantFamilyId expected ${scenario.expected.merchantFamilyId} got ${result.identity?.merchantFamilyId || "none"}`);
  }
  if (String(result.classification.primaryCategory) !== scenario.expected.category) {
    failures.push(`category expected ${scenario.expected.category} got ${result.classification.primaryCategory}`);
  }
  if (result.resolutionStatus !== scenario.expected.resolutionStatus) {
    failures.push(`resolutionStatus expected ${scenario.expected.resolutionStatus} got ${result.resolutionStatus}`);
  }
  if (
    typeof scenario.expected.minimumConfidence === "number" &&
    result.confidence.score < scenario.expected.minimumConfidence
  ) {
    failures.push(`confidence ${result.confidence.score} below minimum ${scenario.expected.minimumConfidence}`);
  }
  if (
    typeof scenario.expected.maximumConfidence === "number" &&
    result.confidence.score > scenario.expected.maximumConfidence
  ) {
    failures.push(`confidence ${result.confidence.score} above maximum ${scenario.expected.maximumConfidence}`);
  }
  for (const evidenceType of scenario.expected.requiredEvidenceTypes || []) {
    if (!result.evidence.some((item: any) => item.type === evidenceType)) {
      failures.push(`missing required evidence type ${evidenceType}`);
    }
  }
  return failures;
}

function runMerchantInvariants(scenarios: MerchantIntelligenceScenario[]) {
  const checks = scenarios.flatMap((scenario) => {
    const base = evaluateMerchantIntelligence(scenario.input);
    const reordered = evaluateMerchantIntelligence({
      ...scenario.input,
      documentTextSignals: [...(scenario.input.documentTextSignals || [])].reverse(),
      structuredData: [...(scenario.input.structuredData || [])].reverse(),
      domSignals: [...(scenario.input.domSignals || [])].reverse(),
    });
    const deceptive = evaluateMerchantIntelligence({
      ...scenario.input,
      url: "https://amazon.com.attacker.example/checkout",
      hostname: "amazon.com.attacker.example",
      detectedMerchantLabel: "",
      documentTextSignals: [],
      structuredData: [],
      domSignals: [],
      checkoutProviderSignals: [],
    });
    const weak = evaluateMerchantIntelligence({
      ...scenario.input,
      documentTextSignals: [
        ...(scenario.input.documentTextSignals || []),
        "irrelevant privacy footer generic checkout text",
      ],
    });
    const removedExact = evaluateMerchantIntelligence({
      ...scenario.input,
      url: "",
      hostname: "",
    });
    const traceKeys = Object.keys(base.trace).sort();
    return [
      {
        invariant: "confidence_bounded",
        scenarioId: scenario.scenarioId,
        passed: Number.isFinite(base.confidence.score) && base.confidence.score >= 0 && base.confidence.score <= 1,
      },
      {
        invariant: "unknown_not_high_confidence",
        scenarioId: scenario.scenarioId,
        passed: base.resolutionStatus !== "unknown" || base.confidence.band !== "high",
      },
      {
        invariant: "ambiguous_has_no_authoritative_identity",
        scenarioId: scenario.scenarioId,
        passed: base.resolutionStatus !== "ambiguous" || !base.identity,
      },
      {
        invariant: "checkout_provider_not_identity",
        scenarioId: scenario.scenarioId,
        passed: !["stripe_checkout", "paypal", "shop_pay"].includes(base.identity?.merchantId || ""),
      },
      {
        invariant: "family_not_identity_replacement",
        scenarioId: scenario.scenarioId,
        passed:
          !base.identity?.merchantFamilyId ||
          base.identity.merchantId === base.identity.merchantFamilyId ||
          base.identity.displayName.toLowerCase() !== base.identity.merchantFamilyId,
      },
      {
        invariant: "deceptive_suffix_no_match",
        scenarioId: scenario.scenarioId,
        passed: deceptive.identity?.merchantId !== "amazon",
      },
      {
        invariant: "alias_no_substring_false_positive",
        scenarioId: scenario.scenarioId,
        passed:
          !evaluateMerchantIntelligence({
            url: "https://pineapple.example/checkout",
            hostname: "pineapple.example",
            detectedMerchantLabel: "Pineapple store",
            transactionDate: scenario.input.transactionDate,
          }).identity,
      },
      {
        invariant: "input_order_stable",
        scenarioId: scenario.scenarioId,
        passed:
          base.identity?.merchantId === reordered.identity?.merchantId &&
          base.resolutionStatus === reordered.resolutionStatus,
      },
      {
        invariant: "candidate_order_deterministic",
        scenarioId: scenario.scenarioId,
        passed:
          JSON.stringify(base.trace.registryCandidates.map((item) => item.merchantId)) ===
          JSON.stringify(evaluateMerchantIntelligence(scenario.input).trace.registryCandidates.map((item) => item.merchantId)),
      },
      {
        invariant: "identical_inputs_byte_equivalent",
        scenarioId: scenario.scenarioId,
        passed:
          JSON.stringify(base) ===
          JSON.stringify(evaluateMerchantIntelligence(scenario.input)),
      },
      {
        invariant: "weak_evidence_does_not_change_high_confidence_result",
        scenarioId: scenario.scenarioId,
        passed:
          base.confidence.band !== "high" ||
          base.identity?.merchantId === weak.identity?.merchantId,
      },
      {
        invariant: "removing_exact_evidence_does_not_increase_confidence",
        scenarioId: scenario.scenarioId,
        passed:
          base.resolutionStatus === "ambiguous" ||
          removedExact.confidence.score <= base.confidence.score,
      },
      {
        invariant: "low_confidence_no_merchant_specific_claim",
        scenarioId: scenario.scenarioId,
        passed:
          base.confidence.score >= 0.6 ||
          base.trace.warnings.includes("merchant_specific_benefits_require_caution"),
      },
      {
        invariant: "portal_requires_explicit_evidence",
        scenarioId: scenario.scenarioId,
        passed:
          base.context.purchaseChannel !== "travel_portal" ||
          scenario.input.purchaseChannelHint === "travel_portal",
      },
      {
        invariant: "marketplace_requires_explicit_or_registry_evidence",
        scenarioId: scenario.scenarioId,
        passed:
          !base.context.marketplace.isMarketplace ||
          /marketplace|mktp|seller|amazon/i.test(
            [
              scenario.input.detectedMerchantLabel,
              ...(scenario.input.documentTextSignals || []),
              base.identity?.merchantId,
            ].join(" "),
          ),
      },
      {
        invariant: "checkout_provider_channel_distinct",
        scenarioId: scenario.scenarioId,
        passed: base.context.checkoutProvider !== (base.context.purchaseChannel as unknown as string),
      },
      {
        invariant: "family_no_automatic_benefit_inheritance",
        scenarioId: scenario.scenarioId,
        passed: !base.trace.warnings.includes("automatic_family_benefit_inheritance"),
      },
      {
        invariant: "trace_allowlisted_fields",
        scenarioId: scenario.scenarioId,
        passed: traceKeys.every((key) =>
          [
            "inputSummary",
            "normalizedHostname",
            "registryCandidates",
            "aliasMatches",
            "categoryResolution",
            "channelResolution",
            "marketplaceResolution",
            "confidenceCalculation",
            "finalResolution",
            "warnings",
          ].includes(key),
        ),
      },
      {
        invariant: "trace_redacted_sensitive_values",
        scenarioId: scenario.scenarioId,
        passed: !JSON.stringify(base.trace).match(/\d{12,19}|@|token=|cookie|session|order[-_ ]?id/i),
      },
    ];
  });
  return {
    total: checks.length,
    passed: checks.filter((check) => check.passed).length,
    failed: checks.filter((check) => !check.passed).length,
    checks,
  };
}

function runMerchantMetamorphic(
  seed: number,
  curated: MerchantIntelligenceScenario[] = curatedMerchantScenarios(),
  generated: MerchantIntelligenceScenario[] = [],
) {
  const sample = [...curated, ...generated.slice(0, 25)].filter(
    (scenario) => scenario.expected.resolutionStatus === "resolved" && scenario.expected.merchantId,
  );
  const transforms = sample.flatMap((scenario) => {
    const base = evaluateMerchantIntelligence(scenario.input);
    const host = scenario.input.hostname || "";
    const directDomain = host.replace(/^(?:www|m)\./i, "");
    const cases = [
      metamorphicCase(seed, scenario, "add_www", {
        ...scenario.input,
        hostname: directDomain ? `www.${directDomain}` : host,
      }, (next) => next.identity?.merchantId === base.identity?.merchantId),
      metamorphicCase(seed, scenario, "change_hostname_casing", {
        ...scenario.input,
        hostname: host.toUpperCase(),
        detectedMerchantLabel: scenario.input.detectedMerchantLabel?.toUpperCase(),
      }, (next) => next.identity?.merchantId === base.identity?.merchantId),
      metamorphicCase(seed, scenario, "reorder_evidence", {
        ...scenario.input,
        documentTextSignals: [...(scenario.input.documentTextSignals || [])].reverse(),
        structuredData: [...(scenario.input.structuredData || [])].reverse(),
        domSignals: [...(scenario.input.domSignals || [])].reverse(),
      }, (next) => next.identity?.merchantId === base.identity?.merchantId),
      metamorphicCase(seed, scenario, "add_irrelevant_weak_text", {
        ...scenario.input,
        documentTextSignals: [
          ...(scenario.input.documentTextSignals || []),
          "footer rewards privacy generic text",
        ],
      }, (next) => next.identity?.merchantId === base.identity?.merchantId),
      metamorphicCase(seed, scenario, "add_conflicting_strong_evidence", {
        ...scenario.input,
        detectedMerchantLabel:
          scenario.expected.merchantId === "target" ? "Walmart checkout" : "Target checkout",
      }, (next) => next.confidence.score <= base.confidence.score || next.resolutionStatus === "ambiguous"),
      metamorphicCase(seed, scenario, "deceptive_suffix_domain", {
        ...scenario.input,
        hostname: `${directDomain}.attacker.example`,
        url: `https://${directDomain}.attacker.example/checkout`,
        detectedMerchantLabel: "",
        documentTextSignals: [],
        structuredData: [],
        domSignals: [],
        checkoutProviderSignals: [],
      }, (next) => next.identity?.merchantId !== base.identity?.merchantId),
      metamorphicCase(seed, scenario, "provider_only_domain", {
        ...scenario.input,
        hostname: "checkout.stripe.com",
        url: "https://checkout.stripe.com/pay",
        detectedMerchantLabel: "",
        documentTextSignals: [],
        structuredData: [],
        domSignals: [],
        checkoutProviderSignals: ["Stripe Checkout"],
      }, (next) => !next.identity),
      metamorphicCase(seed, scenario, "remove_exact_domain_evidence", {
        ...scenario.input,
        hostname: "",
        url: "",
      }, (next) =>
        base.resolutionStatus === "ambiguous" ||
        next.confidence.score <= base.confidence.score,
      ),
      metamorphicCase(seed, scenario, "remove_marketplace_evidence", {
        ...scenario.input,
        detectedMerchantLabel: scenario.input.detectedMerchantLabel?.replace(/marketplace|mktp/gi, ""),
        documentTextSignals: (scenario.input.documentTextSignals || []).filter(
          (value) => !/marketplace|mktp|seller/i.test(value),
        ),
        purchaseChannelHint:
          scenario.input.purchaseChannelHint === "marketplace"
            ? undefined
            : scenario.input.purchaseChannelHint,
      }, (next) =>
        !base.context.marketplace.isMarketplace ||
        !next.context.marketplace.isMarketplace ||
        base.identity?.merchantId === "amazon",
      ),
      metamorphicCase(seed, scenario, "replace_portal_with_direct", {
        ...scenario.input,
        purchaseChannelHint:
          scenario.input.purchaseChannelHint === "travel_portal"
            ? "online_direct"
            : scenario.input.purchaseChannelHint,
      }, (next) =>
        scenario.input.purchaseChannelHint !== "travel_portal" ||
        next.context.purchaseChannel !== "travel_portal",
      ),
      metamorphicCase(seed, scenario, "add_port", {
        ...scenario.input,
        hostname: host ? `${host}:443` : host,
        url: scenario.input.url?.replace(host, `${host}:443`),
      }, (next) => next.identity?.merchantId === base.identity?.merchantId),
      metamorphicCase(seed, scenario, "add_query_and_fragment", {
        ...scenario.input,
        url: `${scenario.input.url || `https://${host}/checkout`}?token=secret#fragment`,
      }, (next) => next.identity?.merchantId === base.identity?.merchantId),
      metamorphicCase(seed, scenario, "alias_punctuation", {
        ...scenario.input,
        detectedMerchantLabel: scenario.input.detectedMerchantLabel?.replace(/\s+/g, " * "),
      }, (next) => next.identity?.merchantId === base.identity?.merchantId || next.confidence.score <= base.confidence.score),
      metamorphicCase(seed, scenario, "add_family_sibling_evidence", {
        ...scenario.input,
        documentTextSignals: [
          ...(scenario.input.documentTextSignals || []),
          "Whole Foods sibling evidence",
        ],
      }, (next) => next.resolutionStatus !== "resolved" || next.identity?.merchantId === base.identity?.merchantId),
    ];
    return cases;
  });
  return {
    total: transforms.length,
    passed: transforms.filter((item) => item.passed).length,
    failed: transforms.filter((item) => !item.passed).length,
    transforms,
  };
}

function metamorphicCase(
  seed: number,
  scenario: MerchantIntelligenceScenario,
  transform: string,
  input: MerchantIntelligenceInput,
  predicate: (result: MerchantIntelligenceResult) => boolean,
) {
  const result = evaluateMerchantIntelligence(input);
  const passed = predicate(result);
  return {
    transform,
    scenarioId: scenario.scenarioId,
    seed,
    applicable: true,
    passed,
    merchantId: result.identity?.merchantId || null,
    confidence: result.confidence.score,
    reason: passed ? "expected relationship held" : "expected relationship failed",
  };
}

function buildMerchantCoverage(
  results: any[],
  invariants?: ReturnType<typeof runMerchantInvariants>,
  metamorphic?: ReturnType<typeof runMerchantMetamorphic>,
  registry?: ReturnType<typeof validateMerchantRegistryQuality>,
) {
  const providers = new Map<string, string[]>();
  const branches = new Map<string, string[]>();
  const add = (key: string, scenarioId: string) => {
    const existing = branches.get(key) || [];
    existing.push(scenarioId);
    branches.set(key, existing);
  };
  for (const result of results) {
    const id = result.scenarioId;
    if (result.actual.merchantId) add(`merchant:${result.actual.merchantId}`, id);
    add(`category:${String(result.actual.category)}`, id);
    add(`status:${result.actual.resolutionStatus}`, id);
    add(`confidence:${result.actual.confidenceBand}`, id);
    add(`channel:${result.actual.purchaseChannel}`, id);
    add(`commerce:${result.actual.commerceModel}`, id);
    add(`marketplace:${String(result.actual.marketplace)}`, id);
    add(`provider:${result.actual.checkoutProvider}`, id);
    for (const type of result.actual.evidenceTypes) add(`evidence:${type}`, id);
    if (result.tags.includes("security")) add("security:deceptive_or_substring", id);
    if (result.tags.includes("ambiguity")) add("ambiguity:conflicting_evidence", id);
    if (result.tags.includes("family")) add("family:preserved", id);
    if (result.tags.includes("category_only")) add("fallback:category_only", id);
  }
  for (const check of invariants?.checks || []) {
    if (check.passed) add(`invariant:${check.invariant}`, check.scenarioId);
  }
  for (const transform of metamorphic?.transforms || []) {
    if (transform.passed) add(`metamorphic:${transform.transform}`, transform.scenarioId || "metamorphic");
  }
  if (registry?.ok) add("registry:quality", "registry-validator");

  const merchants = new Set(results.map((result) => result.actual.merchantId).filter(Boolean));
  const categories = new Set(results.map((result) => String(result.actual.category)));
  const evidenceTypes = new Set(results.flatMap((result) => result.actual.evidenceTypes));
  const requiredMerchants = [
    ...listMerchantIntelligence()
      .filter((merchant) => merchant.active)
      .map((merchant) => merchant.merchantId),
  ];
  const requiredBranches = [
    ...requiredMerchants.map((merchant) => `merchant:${merchant}`),
    "category:online_shopping",
    "category:apparel",
    "category:dining",
    "category:groceries",
    "category:travel",
    "category:unknown",
    "status:resolved",
    "status:ambiguous",
    "status:unknown",
    "confidence:high",
    "confidence:medium",
    "confidence:unknown",
    "evidence:exact_canonical_domain",
    "evidence:known_subdomain",
    "evidence:exact_merchant_alias",
    "evidence:billing_descriptor",
    "evidence:checkout_provider_signal",
    "channel:online_direct",
    "channel:travel_portal",
    "channel:subscription",
    "channel:pickup",
    "marketplace:true",
    "marketplace:false",
    "provider:merchant_native",
    "provider:stripe_checkout",
    "provider:paypal",
    "provider:shop_pay",
    "provider:amazon_pay",
    "security:deceptive_or_substring",
    "ambiguity:conflicting_evidence",
    "family:preserved",
    "fallback:category_only",
    "registry:quality",
    ...(invariants?.checks || []).map((check) => `invariant:${check.invariant}`),
    ...(metamorphic?.transforms || []).map((transform) => `metamorphic:${transform.transform}`),
  ];
  const failures = [
    ...Array.from(new Set(requiredBranches))
      .filter((branch) => !(branches.get(branch) || []).length)
      .map((branch) => `missing semantic coverage: ${branch}`),
  ];
  return {
    ok: failures.length === 0,
    merchantCount: merchants.size,
    categoryCount: categories.size,
    evidenceTypeCount: evidenceTypes.size,
    requirements: Object.fromEntries(
      Array.from(branches.entries()).sort(([a], [b]) => a.localeCompare(b)),
    ),
    failures,
  };
}

function buildGeneratedCoverage(results: any[]) {
  const merchants = new Set(results.map((result) => result.actual.merchantId).filter(Boolean));
  const categories = new Set(results.map((result) => String(result.actual.category)));
  const evidenceTypes = new Set(results.flatMap((result) => result.actual.evidenceTypes));
  return {
    ok: results.length > 0,
    merchantCount: merchants.size,
    categoryCount: categories.size,
    evidenceTypeCount: evidenceTypes.size,
    failures: results.length > 0 ? [] : ["generated suite produced zero scenarios"],
  };
}

function runMerchantParityValidation(scenarios: MerchantIntelligenceScenario[]) {
  const fixtures = scenarios.filter((scenario) => scenario.expected.merchantId);
  const results = fixtures.map((scenario) => {
    const actual = evaluateMerchantIntelligence(scenario.input);
    const equivalent =
      actual.identity?.merchantId === scenario.expected.merchantId &&
      String(actual.classification.primaryCategory) === scenario.expected.category;
    return {
      scenarioId: scenario.scenarioId,
      status: equivalent ? "equivalent" : "regression",
      legacyMerchant: scenario.expected.merchantId || null,
      newMerchant: actual.identity?.merchantId || null,
      legacyCategory: scenario.expected.category,
      newCategory: actual.classification.primaryCategory,
      legacyChannel: scenario.expected.purchaseChannel || "online_direct",
      newChannel: actual.context.purchaseChannel,
      confidenceBand: actual.confidence.band,
      registryVersion: actual.registryVersion,
      rationale: equivalent
        ? "Merchant Intelligence matches approved fixture expectation."
        : "Merchant Intelligence differs from approved fixture expectation.",
    };
  });
  return {
    total: results.length,
    passed: results.filter((result) => result.status !== "regression").length,
    failed: results.filter((result) => result.status === "regression").length,
    results,
  };
}

function runMerchantPrivacyValidation() {
  const unsafe = {
    email: "test@example.com",
    phone: "312-555-1212",
    address: "123 Main Street",
    card: "4111111111111111",
    session: "session_token=abc123",
    order: "orderId=550e8400-e29b-41d4-a716-446655440000",
    customer: "Jane Customer",
    cart: "MacBook Pro 16 inch",
    cookie: "cookie=secret",
  };
  const result = evaluateMerchantIntelligence({
    url: `https://www.apple.com/shop/bag?${unsafe.session}`,
    hostname: "www.apple.com",
    pageTitle: `Checkout ${unsafe.email}`,
    detectedMerchantLabel: `Apple ${unsafe.customer}`,
    documentTextSignals: Object.values(unsafe),
    structuredData: [
      { type: "merchant_name", value: `Apple ${unsafe.card}`, source: "fixture" },
      { type: "checkout_provider", value: unsafe.cookie, source: "fixture" },
    ],
    domSignals: [
      { type: "merchant_marker", value: unsafe.address, source: "fixture" },
      { type: "checkout_marker", value: unsafe.order, source: "fixture" },
    ],
    checkoutProviderSignals: [unsafe.session],
    transactionDate: "invalid-date",
  });
  const serialized = JSON.stringify({
    trace: result.trace,
    evidence: result.evidence,
  });
  const checks = Object.entries(unsafe).map(([key, value]) => ({
    check: `redact_${key}`,
    passed: !serialized.includes(value),
  }));
  checks.push({
    check: "trace_schema_allowlist",
    passed: Object.keys(result.trace).every((key) =>
      [
        "inputSummary",
        "normalizedHostname",
        "registryCandidates",
        "aliasMatches",
        "categoryResolution",
        "channelResolution",
        "marketplaceResolution",
        "confidenceCalculation",
        "finalResolution",
        "warnings",
      ].includes(key),
    ),
  });
  return {
    total: checks.length,
    passed: checks.filter((check) => check.passed).length,
    failed: checks.filter((check) => !check.passed).length,
    checks,
  };
}

function runMerchantPerformanceValidation(seed: number, count: number) {
  const registryStart = Date.now();
  const registryCount = listMerchantIntelligence().length;
  const registryLoadMs = Date.now() - registryStart;
  const scenarios = generatedMerchantScenarios(seed, Math.min(Math.max(count, 100), 1000));
  const beforeMemory = process.memoryUsage().heapUsed;
  const durations = scenarios.map((scenario) => {
    const start = performanceNow();
    evaluateMerchantIntelligence(scenario.input);
    return performanceNow() - start;
  });
  const afterMemory = process.memoryUsage().heapUsed;
  const sorted = durations.slice().sort((a, b) => a - b);
  const metrics = {
    registryCount,
    registryLoadMs,
    medianEvaluationMs: percentile(sorted, 0.5),
    p95EvaluationMs: percentile(sorted, 0.95),
    p99EvaluationMs: percentile(sorted, 0.99),
    maxEvaluationMs: sorted[sorted.length - 1] || 0,
    generated1000RuntimeMs: measureGeneratedRuntime(seed, 1000),
    generated10000RuntimeMs:
      count >= 10000 ? measureGeneratedRuntime(seed, 10000) : null,
    memoryDeltaBytes: afterMemory - beforeMemory,
  };
  const checks = [
    { check: "p99_under_25ms", passed: metrics.p99EvaluationMs < 25 },
    { check: "generated_1000_under_5000ms", passed: metrics.generated1000RuntimeMs < 5000 },
    { check: "registry_load_under_100ms", passed: metrics.registryLoadMs < 100 },
  ];
  return {
    metrics,
    total: checks.length,
    passed: checks.filter((check) => check.passed).length,
    failed: checks.filter((check) => !check.passed).length,
    checks,
  };
}

function measureGeneratedRuntime(seed: number, count: number) {
  const started = Date.now();
  for (const scenario of generatedMerchantScenarios(seed, count)) {
    evaluateMerchantIntelligence(scenario.input);
  }
  return Date.now() - started;
}

function performanceNow() {
  const [seconds, nanos] = process.hrtime();
  return seconds * 1000 + nanos / 1_000_000;
}

function percentile(values: number[], pct: number) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.floor(values.length * pct));
  return Number(values[index].toFixed(4));
}

function summarizeGeneratedFamilies(scenarios: MerchantIntelligenceScenario[]) {
  return scenarios.reduce<Record<string, number>>((acc, scenario) => {
    const family = scenario.tags.find((tag) => tag !== "generated") || "unknown";
    acc[family] = (acc[family] || 0) + 1;
    return acc;
  }, {});
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
