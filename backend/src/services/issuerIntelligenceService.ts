import type { CanonicalBenefitRecord, CanonicalBenefitType } from "./benefitIntelligenceService";
import type { BenefitSourceRecord, SourceHealthStatus } from "./benefitPipelineTypes";
import { compareCandidateToApproved } from "./benefitComparisonService";
import { createCandidatesFromExtraction } from "./benefitExtractionService";
import { evaluateSourceHealth } from "./benefitHealthService";

export type IssuerId =
  | "american-express"
  | "chase"
  | "capital-one"
  | "citi"
  | "discover"
  | "bank-of-america"
  | "us-bank"
  | "wells-fargo"
  | "bilt";

export type IssuerReviewStatus = "pilot" | "sandbox" | "active" | "disabled" | "review_required";
export type IssuerCapability = "html" | "pdf" | "structured_json" | "terms" | "manual_fixture";
export type ProductStatus = "active" | "sandbox" | "deprecated";
export type Network = "American Express" | "Visa" | "Mastercard" | "Discover" | "Unknown";

export type CanonicalIssuer = {
  issuerId: IssuerId;
  displayName: string;
  aliases: string[];
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoKey: string;
  };
  country: string;
  supportedProducts: string[];
  parserVersion: string;
  sourceRegistry: string[];
  extractionCapabilities: IssuerCapability[];
  normalizationCapabilities: string[];
  reviewStatus: IssuerReviewStatus;
  confidenceProfile: {
    defaultConfidence: number;
    parserConfidenceFloor: number;
    sourceReliability: number;
  };
};

export type IssuerProduct = {
  issuer: IssuerId;
  productId: string;
  displayName: string;
  network: Network;
  annualFee: number | null;
  rewardCurrency: string;
  benefitGroups: string[];
  travelPartners: string[];
  status: ProductStatus;
  version: number;
  aliases: string[];
};

export type IssuerSource = BenefitSourceRecord & {
  issuerId: IssuerId;
  productId: string;
  expectedSections: string[];
};

export type IssuerExtractionInput = {
  issuer: CanonicalIssuer;
  source: IssuerSource;
  fixturePayload?: unknown;
  observedAt?: string;
};

export type IssuerExtractionResult = {
  issuerId: IssuerId;
  sourceId: string;
  observedAt: string;
  rawExtractedData: unknown;
  normalizedBenefits: CanonicalBenefitRecord[];
  parserConfidence: number;
  warnings: string[];
  unsupportedFields: string[];
  missingFields: string[];
};

export type IssuerValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  benefitCount: number;
};

export type IssuerConfidenceEstimate = {
  issuerId: IssuerId;
  sourceId: string;
  confidence: number;
  reasons: string[];
};

export type SourceChangeDetection = {
  issuerId: IssuerId;
  sourceId: string;
  reviewRequired: boolean;
  changes: string[];
  expectedSectionsMissing: string[];
  checksumChanged: boolean;
};

export type IssuerHealthReport = {
  issuerId: IssuerId;
  displayName: string;
  status: IssuerReviewStatus;
  extractionSuccess: number;
  normalizationSuccess: number;
  validationSuccess: number;
  promotionSuccess: number;
  rejectedBenefits: number;
  parserErrors: string[];
  sourceFailures: string[];
  confidenceTrend: number;
  parserHealth: SourceHealthStatus;
};

export type IssuerStatistics = {
  issuerId: IssuerId;
  productCount: number;
  sourceCount: number;
  activeSourceCount: number;
  supportedProductCount: number;
  capabilityCount: number;
};

export type BenefitMappingResult = {
  rawName: string;
  canonicalName: string;
  benefitType: CanonicalBenefitType;
  sourceKind: CanonicalBenefitRecord["sourceKind"];
  confidence: number;
  strategy: "exact" | "synonym" | "keyword" | "unknown";
};

export type IssuerAdapter = {
  issuerId: IssuerId;
  discoverSources(): IssuerSource[];
  extractBenefits(input: IssuerExtractionInput): IssuerExtractionResult;
  normalizeBenefits(benefits: CanonicalBenefitRecord[]): CanonicalBenefitRecord[];
  validateBenefits(benefits: CanonicalBenefitRecord[]): IssuerValidationResult;
  compareChanges(
    extractedBenefits: CanonicalBenefitRecord[],
    approvedBenefits: CanonicalBenefitRecord[],
  ): ReturnType<typeof compareCandidateToApproved>[];
  estimateConfidence(result: IssuerExtractionResult): IssuerConfidenceEstimate;
};

const NOW = "2026-07-22T00:00:00.000Z";

export const ISSUER_REGISTRY: CanonicalIssuer[] = [
  issuer({
    issuerId: "american-express",
    displayName: "American Express",
    aliases: ["amex", "american express", "americanexpress"],
    supportedProducts: ["amex-platinum", "amex-gold"],
    parserVersion: "amex-pilot-v1",
    sourceRegistry: [
      "src:amex-platinum:benefits",
      "src:amex-platinum:terms",
      "src:amex-platinum:rewards",
      "src:amex-gold:benefits",
    ],
    extractionCapabilities: ["html", "pdf", "structured_json", "terms", "manual_fixture"],
    normalizationCapabilities: ["credits", "rewards", "protections", "travel", "access"],
    reviewStatus: "pilot",
    defaultConfidence: 0.9,
    color: "#2e77d0",
  }),
  issuer({
    issuerId: "chase",
    displayName: "Chase",
    aliases: ["jp morgan chase", "jpmorgan chase"],
    supportedProducts: ["chase-sapphire-preferred", "chase-sapphire-reserve", "freedom-unlimited"],
    parserVersion: "sandbox-v1",
    sourceRegistry: [],
    extractionCapabilities: ["manual_fixture"],
    normalizationCapabilities: ["rewards", "protections", "travel"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.72,
    color: "#0b5cab",
  }),
  issuer({
    issuerId: "capital-one",
    displayName: "Capital One",
    aliases: ["capitalone", "cap one"],
    supportedProducts: ["capital-one-venture-x"],
    parserVersion: "sandbox-v1",
    sourceRegistry: ["src:capital-one-venture-x:rewards"],
    extractionCapabilities: ["structured_json", "manual_fixture"],
    normalizationCapabilities: ["rewards", "travel", "credits"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.74,
    color: "#b70018",
  }),
  issuer({
    issuerId: "citi",
    displayName: "Citi",
    aliases: ["citibank"],
    supportedProducts: ["citi-strata-premier"],
    parserVersion: "sandbox-v1",
    sourceRegistry: [],
    extractionCapabilities: ["manual_fixture"],
    normalizationCapabilities: ["rewards", "travel"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.7,
    color: "#255be3",
  }),
  issuer({
    issuerId: "discover",
    displayName: "Discover",
    aliases: ["discover bank"],
    supportedProducts: ["discover-it"],
    parserVersion: "sandbox-v1",
    sourceRegistry: [],
    extractionCapabilities: ["manual_fixture"],
    normalizationCapabilities: ["rotating_categories", "cash_back"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.68,
    color: "#f58220",
  }),
  issuer({
    issuerId: "bank-of-america",
    displayName: "Bank of America",
    aliases: ["boa", "bofa"],
    supportedProducts: [],
    parserVersion: "sandbox-v1",
    sourceRegistry: [],
    extractionCapabilities: ["manual_fixture"],
    normalizationCapabilities: ["rewards"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.65,
    color: "#d4001a",
  }),
  issuer({
    issuerId: "us-bank",
    displayName: "US Bank",
    aliases: ["u.s. bank", "usbank"],
    supportedProducts: [],
    parserVersion: "sandbox-v1",
    sourceRegistry: [],
    extractionCapabilities: ["manual_fixture"],
    normalizationCapabilities: ["rewards"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.65,
    color: "#1f5aa6",
  }),
  issuer({
    issuerId: "wells-fargo",
    displayName: "Wells Fargo",
    aliases: ["wells"],
    supportedProducts: [],
    parserVersion: "sandbox-v1",
    sourceRegistry: [],
    extractionCapabilities: ["manual_fixture"],
    normalizationCapabilities: ["rewards"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.65,
    color: "#d71e28",
  }),
  issuer({
    issuerId: "bilt",
    displayName: "Bilt",
    aliases: ["bilt rewards", "bilt mastercard"],
    supportedProducts: ["bilt-mastercard"],
    parserVersion: "sandbox-v1",
    sourceRegistry: [],
    extractionCapabilities: ["manual_fixture"],
    normalizationCapabilities: ["rent", "travel", "rewards"],
    reviewStatus: "sandbox",
    defaultConfidence: 0.68,
    color: "#111827",
  }),
];

export const PRODUCT_CATALOG: IssuerProduct[] = [
  product("american-express", "amex-platinum", "The Platinum Card from American Express", "American Express", 695, "Membership Rewards", ["travel", "credits", "lounge_access", "protections"], ["Delta", "Hilton", "Marriott"]),
  product("american-express", "amex-gold", "American Express Gold Card", "American Express", 325, "Membership Rewards", ["dining", "groceries", "credits"], ["Delta", "Hilton", "Marriott"]),
  product("chase", "chase-sapphire-preferred", "Chase Sapphire Preferred", "Visa", 95, "Ultimate Rewards", ["travel", "dining", "protections"], ["United", "Hyatt", "Southwest"]),
  product("chase", "chase-sapphire-reserve", "Chase Sapphire Reserve", "Visa", 550, "Ultimate Rewards", ["travel", "lounge_access", "protections"], ["United", "Hyatt", "Southwest"]),
  product("chase", "freedom-unlimited", "Chase Freedom Unlimited", "Visa", 0, "Ultimate Rewards", ["cash_back", "drugstores", "dining"], []),
  product("capital-one", "capital-one-venture-x", "Capital One Venture X", "Visa", 395, "Capital One Miles", ["travel", "lounge_access", "credits"], ["Accor", "Wyndham"]),
  product("citi", "citi-strata-premier", "Citi Strata Premier", "Mastercard", 95, "ThankYou Points", ["travel", "gas", "groceries"], ["Choice", "Wyndham"]),
  product("discover", "discover-it", "Discover it Cash Back", "Discover", 0, "Cash Back", ["rotating_categories", "cash_back"], []),
  product("bilt", "bilt-mastercard", "Bilt Mastercard", "Mastercard", 0, "Bilt Points", ["rent", "travel", "dining"], ["Hyatt", "United", "American Airlines"]),
];

export const ISSUER_SANDBOX_FIXTURES: Record<IssuerId, string[]> = {
  "american-express": ["amex-gold", "amex-platinum"],
  chase: ["chase-sapphire-preferred", "chase-sapphire-reserve", "freedom-unlimited"],
  "capital-one": ["capital-one-venture-x"],
  citi: ["citi-strata-premier"],
  discover: ["discover-it"],
  "bank-of-america": [],
  "us-bank": [],
  "wells-fargo": [],
  bilt: ["bilt-mastercard"],
};

const BENEFIT_SYNONYMS: Array<{
  canonicalName: string;
  benefitType: CanonicalBenefitType;
  sourceKind: CanonicalBenefitRecord["sourceKind"];
  synonyms: string[];
}> = [
  {
    canonicalName: "Dining Credit",
    benefitType: "dining_benefit",
    sourceKind: "recurring_credit",
    synonyms: ["dining credit", "restaurant credit", "food credit", "monthly dining benefit"],
  },
  {
    canonicalName: "Travel Credit",
    benefitType: "travel_benefit",
    sourceKind: "recurring_credit",
    synonyms: ["travel credit", "annual travel credit", "airline credit", "flight credit"],
  },
  {
    canonicalName: "Purchase Protection",
    benefitType: "protection",
    sourceKind: "insurance",
    synonyms: ["purchase protection", "damage and theft protection"],
  },
  {
    canonicalName: "Extended Warranty",
    benefitType: "protection",
    sourceKind: "insurance",
    synonyms: ["extended warranty", "warranty extension"],
  },
  {
    canonicalName: "Lounge Access",
    benefitType: "access",
    sourceKind: "access",
    synonyms: ["lounge access", "priority pass", "airport lounge"],
  },
  {
    canonicalName: "Reward Multiplier",
    benefitType: "reward_multiplier",
    sourceKind: "reward_category",
    synonyms: ["cash back", "points", "miles", "rewards", "multiplier"],
  },
];

export function listIssuers() {
  return ISSUER_REGISTRY.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getIssuer(issuerIdOrAlias: string) {
  const normalized = normalize(issuerIdOrAlias);
  return (
    listIssuers().find(
      (issuer) =>
        issuer.issuerId === normalized ||
        normalize(issuer.displayName) === normalized ||
        issuer.aliases.some((alias) => normalize(alias) === normalized),
    ) || null
  );
}

export function listIssuerProducts(issuerId?: IssuerId) {
  const products = issuerId
    ? PRODUCT_CATALOG.filter((product) => product.issuer === issuerId)
    : PRODUCT_CATALOG;
  return products.slice().sort((a, b) => a.issuer.localeCompare(b.issuer) || a.displayName.localeCompare(b.displayName));
}

export function getIssuerStatistics(): IssuerStatistics[] {
  return listIssuers().map((issuer) => {
    const products = listIssuerProducts(issuer.issuerId);
    return {
      issuerId: issuer.issuerId,
      productCount: products.length,
      sourceCount: issuer.sourceRegistry.length,
      activeSourceCount: issuer.sourceRegistry.length,
      supportedProductCount: issuer.supportedProducts.length,
      capabilityCount: issuer.extractionCapabilities.length,
    };
  });
}

export function setIssuerEnabled(issuerId: IssuerId, enabled: boolean): CanonicalIssuer {
  const issuerRecord = requireIssuer(issuerId);
  return {
    ...issuerRecord,
    reviewStatus: enabled
      ? issuerRecord.reviewStatus === "disabled"
        ? "sandbox"
        : issuerRecord.reviewStatus
      : "disabled",
  };
}

export function mapBenefitName(rawName: string): BenefitMappingResult {
  const normalized = normalize(rawName);
  for (const mapping of BENEFIT_SYNONYMS) {
    if (mapping.synonyms.some((synonym) => normalize(synonym) === normalized)) {
      return { rawName, canonicalName: mapping.canonicalName, benefitType: mapping.benefitType, sourceKind: mapping.sourceKind, confidence: 0.98, strategy: "exact" };
    }
  }
  for (const mapping of BENEFIT_SYNONYMS) {
    if (mapping.synonyms.some((synonym) => normalized.includes(normalize(synonym)))) {
      return { rawName, canonicalName: mapping.canonicalName, benefitType: mapping.benefitType, sourceKind: mapping.sourceKind, confidence: 0.9, strategy: "synonym" };
    }
  }
  for (const mapping of BENEFIT_SYNONYMS) {
    if (mapping.synonyms.some((synonym) => normalize(synonym).split(" ").some((word) => word.length > 5 && normalized.includes(word)))) {
      return { rawName, canonicalName: mapping.canonicalName, benefitType: mapping.benefitType, sourceKind: mapping.sourceKind, confidence: 0.72, strategy: "keyword" };
    }
  }
  return {
    rawName,
    canonicalName: titleCase(rawName || "Unknown Benefit"),
    benefitType: "other",
    sourceKind: "perk",
    confidence: 0.35,
    strategy: "unknown",
  };
}

export function createIssuerAdapter(issuerId: IssuerId): IssuerAdapter {
  const issuerRecord = requireIssuer(issuerId);
  return {
    issuerId,
    discoverSources() {
      return issuerSourcesFor(issuerRecord);
    },
    extractBenefits(input) {
      return extractFixtureBenefits(input);
    },
    normalizeBenefits(benefits) {
      return benefits.map((benefit) => {
        const mapped = mapBenefitName(benefit.benefitName || benefit.label);
        return {
          ...benefit,
          benefitName: mapped.canonicalName,
          benefitType: mapped.benefitType,
          sourceKind: mapped.sourceKind,
          confidenceScore: round(Math.min(1, benefit.confidenceScore * mapped.confidence), 2),
        };
      });
    },
    validateBenefits(benefits) {
      return validateIssuerBenefits(issuerId, benefits);
    },
    compareChanges(extractedBenefits, approvedBenefits) {
      const source = issuerSourcesFor(issuerRecord)[0] || makeIssuerSource(issuerRecord, issuerRecord.supportedProducts[0] || "unknown-product");
      return createCandidatesFromExtraction({
        sourceId: source.sourceId,
        observedAt: NOW,
        rawExtractedData: extractedBenefits,
        normalizedBenefits: extractedBenefits,
        parserConfidence: issuerRecord.confidenceProfile.defaultConfidence,
        warnings: [],
        unsupportedFields: [],
        missingFields: [],
      }).map((candidate) => compareCandidateToApproved(candidate, approvedBenefits, NOW));
    },
    estimateConfidence(result) {
      const reasons: string[] = [];
      if (result.warnings.length) reasons.push("parser_warnings_present");
      if (result.missingFields.length) reasons.push("missing_fields_present");
      if (!result.normalizedBenefits.length) reasons.push("no_benefits_extracted");
      if (!reasons.length) reasons.push("source_extracted_and_normalized");
      const issuerConfidence = issuerRecord.confidenceProfile.sourceReliability;
      const confidence = Math.max(
        issuerRecord.confidenceProfile.parserConfidenceFloor,
        round((result.parserConfidence + issuerConfidence) / 2 - result.missingFields.length * 0.04, 2),
      );
      return { issuerId, sourceId: result.sourceId, confidence, reasons };
    },
  };
}

export function listIssuerAdapters() {
  return listIssuers().map((issuerRecord) => createIssuerAdapter(issuerRecord.issuerId));
}

export function runIssuerAdapterTest(issuerId: IssuerId, observedAt = NOW) {
  const issuerRecord = requireIssuer(issuerId);
  const adapter = createIssuerAdapter(issuerId);
  const source = adapter.discoverSources()[0] || makeIssuerSource(issuerRecord, issuerRecord.supportedProducts[0] || "unknown-product");
  const extraction = adapter.extractBenefits({
    issuer: issuerRecord,
    source,
    observedAt,
    fixturePayload: issuerSandboxPayload(issuerId),
  });
  const normalizedBenefits = adapter.normalizeBenefits(extraction.normalizedBenefits);
  const validation = adapter.validateBenefits(normalizedBenefits);
  const confidence = adapter.estimateConfidence({ ...extraction, normalizedBenefits });
  const health = buildIssuerHealthReport(issuerId, {
    extractionSucceeded: Boolean(extraction.normalizedBenefits.length),
    validationSucceeded: validation.valid,
    parserErrors: validation.errors,
    rejectedBenefits: validation.errors.length,
    confidence: confidence.confidence,
  });
  return { issuer: issuerRecord, source, extraction: { ...extraction, normalizedBenefits }, validation, confidence, health };
}

export function buildIssuerHealthReport(
  issuerId: IssuerId,
  input: Partial<{
    extractionSucceeded: boolean;
    normalizationSucceeded: boolean;
    validationSucceeded: boolean;
    promotionSucceeded: boolean;
    rejectedBenefits: number;
    parserErrors: string[];
    sourceFailures: string[];
    confidence: number;
  }> = {},
): IssuerHealthReport {
  const issuerRecord = requireIssuer(issuerId);
  const extractionSuccess = input.extractionSucceeded === false ? 0 : 1;
  const normalizationSuccess = input.normalizationSucceeded === false ? 0 : extractionSuccess;
  const validationSuccess = input.validationSucceeded === false ? 0 : normalizationSuccess;
  const parserErrors = input.parserErrors || [];
  const sourceFailures = input.sourceFailures || [];
  const health = evaluateSourceHealth({
    source: issuerSourcesFor(issuerRecord)[0] || makeIssuerSource(issuerRecord, issuerRecord.supportedProducts[0] || "unknown-product"),
    checkedAt: NOW,
    extractionSucceeded: extractionSuccess === 1 && parserErrors.length === 0,
    parserWarnings: parserErrors,
    sourceUnavailable: sourceFailures.length > 0,
  });
  return {
    issuerId,
    displayName: issuerRecord.displayName,
    status: parserErrors.length || sourceFailures.length ? "review_required" : issuerRecord.reviewStatus,
    extractionSuccess,
    normalizationSuccess,
    validationSuccess,
    promotionSuccess: input.promotionSucceeded === false ? 0 : 1,
    rejectedBenefits: input.rejectedBenefits || 0,
    parserErrors,
    sourceFailures,
    confidenceTrend: round(input.confidence ?? issuerRecord.confidenceProfile.defaultConfidence, 2),
    parserHealth: health.status,
  };
}

export function buildIssuerRegistryReport() {
  return {
    issuers: listIssuers(),
    statistics: getIssuerStatistics(),
    adapters: listIssuerAdapters().map((adapter) => ({
      issuerId: adapter.issuerId,
      sourceCount: adapter.discoverSources().length,
    })),
  };
}

export function validateProductCatalog() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const productRecord of PRODUCT_CATALOG) {
    if (seen.has(productRecord.productId)) errors.push(`duplicate_product:${productRecord.productId}`);
    seen.add(productRecord.productId);
    if (!getIssuer(productRecord.issuer)) errors.push(`unknown_issuer:${productRecord.productId}`);
    if (!productRecord.displayName) errors.push(`missing_name:${productRecord.productId}`);
    if (productRecord.version < 1) errors.push(`invalid_version:${productRecord.productId}`);
    if (!productRecord.benefitGroups.length) warnings.push(`missing_benefit_groups:${productRecord.productId}`);
  }
  return {
    valid: errors.length === 0,
    productCount: PRODUCT_CATALOG.length,
    issuerCount: new Set(PRODUCT_CATALOG.map((productRecord) => productRecord.issuer)).size,
    errors,
    warnings,
  };
}

export function detectIssuerSourceChange(input: {
  issuerId: IssuerId;
  source: IssuerSource;
  payloadText: string;
  previousChecksum?: string | null;
}): SourceChangeDetection {
  const payload = input.payloadText || "";
  const checksum = checksumText(payload);
  const expectedSectionsMissing = input.source.expectedSections.filter(
    (section) => !normalize(payload).includes(normalize(section)),
  );
  const changes: string[] = [];
  if (input.previousChecksum && input.previousChecksum !== checksum) changes.push("checksum_changed");
  if (expectedSectionsMissing.length) changes.push("expected_sections_missing");
  if (payload.trim().length < 80) changes.push("payload_too_short");
  return {
    issuerId: input.issuerId,
    sourceId: input.source.sourceId,
    reviewRequired: changes.length > 0,
    changes,
    expectedSectionsMissing,
    checksumChanged: Boolean(input.previousChecksum && input.previousChecksum !== checksum),
  };
}

function validateIssuerBenefits(issuerId: IssuerId, benefits: CanonicalBenefitRecord[]): IssuerValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const benefit of benefits) {
    if (!benefit.id) errors.push("missing_benefit_id");
    if (!benefit.cardSlug) errors.push(`missing_card_slug:${benefit.id || "unknown"}`);
    if (benefit.cardIssuer && normalize(benefit.cardIssuer) !== normalize(requireIssuer(issuerId).displayName)) {
      warnings.push(`issuer_name_differs:${benefit.id}`);
    }
    if (benefit.confidenceScore < 0.6) warnings.push(`low_confidence:${benefit.id}`);
  }
  return { valid: errors.length === 0, errors, warnings, benefitCount: benefits.length };
}

function extractFixtureBenefits(input: IssuerExtractionInput): IssuerExtractionResult {
  const observedAt = input.observedAt || NOW;
  const payload = input.fixturePayload as { benefits?: Partial<CanonicalBenefitRecord>[]; brokenHtml?: boolean } | undefined;
  if (payload?.brokenHtml) {
    return {
      issuerId: input.issuer.issuerId,
      sourceId: input.source.sourceId,
      observedAt,
      rawExtractedData: payload,
      normalizedBenefits: [],
      parserConfidence: input.issuer.confidenceProfile.parserConfidenceFloor,
      warnings: ["source_change_suspected"],
      unsupportedFields: [],
      missingFields: ["benefits"],
    };
  }
  const products = listIssuerProducts(input.issuer.issuerId);
  const productRecord = products[0] || product(input.issuer.issuerId, "unknown-product", "Unknown Product", "Unknown", null, "Unknown", ["other"], []);
  const benefitSeeds = payload?.benefits?.length ? payload.benefits : sandboxBenefits(input.issuer, productRecord, observedAt);
  const normalizedBenefits = benefitSeeds.map((seed, index) =>
    canonicalBenefit({
      issuer: input.issuer,
      product: productRecord,
      name: String(seed.benefitName || seed.label || `${productRecord.displayName} Benefit ${index + 1}`),
      observedAt,
      overrides: seed,
    }),
  );
  return {
    issuerId: input.issuer.issuerId,
    sourceId: input.source.sourceId,
    observedAt,
    rawExtractedData: benefitSeeds,
    normalizedBenefits,
    parserConfidence: input.issuer.confidenceProfile.defaultConfidence,
    warnings: [],
    unsupportedFields: [],
    missingFields: [],
  };
}

function sandboxBenefits(issuerRecord: CanonicalIssuer, productRecord: IssuerProduct, observedAt: string): Partial<CanonicalBenefitRecord>[] {
  const mapped = mapBenefitName(productRecord.benefitGroups[0] || "Reward Multiplier");
  return [
    {
      id: `${productRecord.productId}:${slug(mapped.canonicalName)}`,
      cardSlug: productRecord.productId,
      cardIssuer: issuerRecord.displayName,
      cardName: productRecord.displayName,
      benefitName: mapped.canonicalName,
      benefitDescription: `${productRecord.displayName} sandbox ${mapped.canonicalName.toLowerCase()} fixture.`,
      benefitType: mapped.benefitType,
      rewardMechanism: mapped.benefitType === "reward_multiplier" ? "points" : "statement_credit",
      label: mapped.canonicalName,
      merchantCategory: productRecord.benefitGroups[0] || "other",
      confidenceScore: issuerRecord.confidenceProfile.defaultConfidence,
      sourceKind: mapped.sourceKind,
      sourceUrl: `fixture://${issuerRecord.issuerId}/${productRecord.productId}`,
      sourceTitle: `${issuerRecord.displayName} sandbox fixture`,
      lastObservedAt: observedAt,
    },
  ];
}

function issuerSandboxPayload(issuerId: IssuerId) {
  const issuerRecord = requireIssuer(issuerId);
  const productRecord =
    listIssuerProducts(issuerId)[0] ||
    product(
      issuerRecord.issuerId,
      `${issuerRecord.issuerId}-sandbox-product`,
      `${issuerRecord.displayName} Sandbox Product`,
      "Unknown",
      null,
      "Unknown",
      ["Reward Multiplier"],
      [],
    );
  return { benefits: sandboxBenefits(issuerRecord, productRecord, NOW) };
}

function issuerSourcesFor(issuerRecord: CanonicalIssuer): IssuerSource[] {
  if (!issuerRecord.sourceRegistry.length) {
    return issuerRecord.supportedProducts.map((productId) => makeIssuerSource(issuerRecord, productId));
  }
  return issuerRecord.sourceRegistry.map((sourceId, index) =>
    makeIssuerSource(
      issuerRecord,
      productIdFromSourceId(sourceId, issuerRecord.supportedProducts) ||
        issuerRecord.supportedProducts[index % Math.max(1, issuerRecord.supportedProducts.length)] ||
        "unknown-product",
      sourceId,
    ),
  );
}

function makeIssuerSource(issuerRecord: CanonicalIssuer, productId: string, sourceId = `src:${productId}:sandbox`) {
  return {
    sourceId,
    issuerId: issuerRecord.issuerId,
    productId,
    cardSlug: productId,
    issuer: issuerRecord.displayName,
    sourceUrl: `fixture://${issuerRecord.issuerId}/${productId}`,
    sourceType: "issuer_benefit_page" as const,
    priority: 1,
    expectedUpdateFrequency: "monthly" as const,
    parserStrategy: "manual_upload" as const,
    status: "active" as const,
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown" as const,
    expectedSections: ["benefits", "rewards"],
  };
}

function canonicalBenefit(input: {
  issuer: CanonicalIssuer;
  product: IssuerProduct;
  name: string;
  observedAt: string;
  overrides: Partial<CanonicalBenefitRecord>;
}): CanonicalBenefitRecord {
  const mapped = mapBenefitName(input.name);
  const baseId = `${input.product.productId}:${slug(mapped.canonicalName)}`;
  return {
    id: input.overrides.id || baseId,
    cardId: input.product.productId,
    cardSlug: input.product.productId,
    cardIssuer: input.issuer.displayName,
    cardName: input.product.displayName,
    benefitName: mapped.canonicalName,
    benefitDescription: `${input.product.displayName} includes ${mapped.canonicalName}.`,
    benefitType: mapped.benefitType,
    rewardMechanism: mapped.benefitType === "reward_multiplier" ? "points" : "statement_credit",
    label: mapped.canonicalName,
    merchantCategory: null,
    specificMerchantIds: [],
    specificMerchant: null,
    eligiblePurchaseChannels: ["any"],
    multiplier: null,
    statementCredit: null,
    annualCredits: null,
    spendingCap: null,
    minimumSpend: null,
    enrollmentRequired: false,
    activationRequired: false,
    travelBenefits: [],
    diningBenefits: [],
    shoppingBenefits: [],
    redemptionLimitations: [],
    exclusions: [],
    geographicRestrictions: [],
    effectiveDate: null,
    expirationDate: null,
    sourceUrl: `fixture://${input.issuer.issuerId}/${input.product.productId}`,
    sourceType: "issuer_official",
    sourceTitle: `${input.issuer.displayName} sandbox fixture`,
    lastObservedAt: input.observedAt,
    lastVerified: null,
    verificationSource: null,
    confidenceScore: mapped.confidence,
    verificationStatus: "automatically_extracted",
    productionEligible: false,
    version: 1,
    createdAt: input.observedAt,
    updatedAt: input.observedAt,
    sourceKind: mapped.sourceKind,
    ...input.overrides,
  };
}

function issuer(input: Omit<CanonicalIssuer, "branding" | "confidenceProfile" | "country"> & {
  color: string;
  defaultConfidence: number;
}): CanonicalIssuer {
  return {
    issuerId: input.issuerId,
    displayName: input.displayName,
    aliases: input.aliases,
    branding: {
      primaryColor: input.color,
      secondaryColor: "#111827",
      logoKey: input.issuerId,
    },
    country: "US",
    supportedProducts: input.supportedProducts,
    parserVersion: input.parserVersion,
    sourceRegistry: input.sourceRegistry,
    extractionCapabilities: input.extractionCapabilities,
    normalizationCapabilities: input.normalizationCapabilities,
    reviewStatus: input.reviewStatus,
    confidenceProfile: {
      defaultConfidence: input.defaultConfidence,
      parserConfidenceFloor: 0.45,
      sourceReliability: input.reviewStatus === "pilot" ? 0.9 : 0.7,
    },
  };
}

function product(
  issuerId: IssuerId,
  productId: string,
  displayName: string,
  network: Network,
  annualFee: number | null,
  rewardCurrency: string,
  benefitGroups: string[],
  travelPartners: string[],
): IssuerProduct {
  return {
    issuer: issuerId,
    productId,
    displayName,
    network,
    annualFee,
    rewardCurrency,
    benefitGroups,
    travelPartners,
    status: issuerId === "american-express" ? "active" : "sandbox",
    version: 1,
    aliases: [displayName, productId],
  };
}

function requireIssuer(issuerId: IssuerId) {
  const issuerRecord = getIssuer(issuerId);
  if (!issuerRecord) throw new Error(`Unknown issuer: ${issuerId}`);
  return issuerRecord;
}

function checksumText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return `checksum_${hash.toString(16)}`;
}

function normalize(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(value: string) {
  return normalize(value).replace(/\s+/g, "-") || "unknown";
}

function productIdFromSourceId(sourceId: string, productIds: string[]) {
  return productIds.find((productId) => sourceId.includes(productId)) || null;
}

function titleCase(value: string) {
  return normalize(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
