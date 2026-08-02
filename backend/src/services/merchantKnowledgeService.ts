import {
  MERCHANT_CATEGORY_REGISTRY,
  MERCHANT_INTELLIGENCE_REGISTRY,
  MERCHANT_INTELLIGENCE_REGISTRY_VERSION,
  resolveMerchant,
  type CanonicalMerchant,
  type MerchantCategoryNode,
} from "./merchantIntelligenceService";

export type MerchantKnowledgeProfile = {
  merchantId: string;
  canonicalName: string;
  displayName: string;
  aliases: string[];
  category: string;
  categoryCode: string | null;
  subcategory: string | null;
  brand: string | null;
  parentCompany: string | null;
  merchantGroup: string | null;
  country: string;
  region: string | null;
  domains: string[];
  checkoutDomains: string[];
  billingDescriptors: string[];
  mccs: string[];
  supportedPaymentMethods: string[];
  loyaltyPrograms: string[];
  tags: string[];
  metadata: Record<string, string | number | boolean | null>;
  active: boolean;
  confidence: number;
  lastUpdated: string;
};

export type MerchantSearchResult = MerchantKnowledgeProfile & {
  score: number;
  matchType:
    | "exact_name"
    | "alias"
    | "domain"
    | "brand"
    | "category"
    | "partial"
    | "misspelling";
  matchedValue: string | null;
};

export type MerchantInsight = {
  merchantId: string;
  displayName: string;
  paymentJourneyEntries: number;
  mostUsedCard: string | null;
  estimatedRewardsEarned: number;
  averagePurchaseAmount: number | null;
  plannedSpendingEntries: number;
  lastUpdated: string;
};

export type MerchantSearchOptions = {
  query?: string;
  category?: string;
  country?: string;
  activeOnly?: boolean;
  limit?: number;
};

const ANALYTICS_FIXTURES: Record<string, Omit<MerchantInsight, "merchantId" | "displayName" | "lastUpdated">> = {
  amazon: {
    paymentJourneyEntries: 4,
    mostUsedCard: "Capital One Venture Rewards",
    estimatedRewardsEarned: 18.42,
    averagePurchaseAmount: 118.5,
    plannedSpendingEntries: 2,
  },
  target: {
    paymentJourneyEntries: 3,
    mostUsedCard: "Chase Freedom Flex",
    estimatedRewardsEarned: 9.75,
    averagePurchaseAmount: 74.33,
    plannedSpendingEntries: 1,
  },
  starbucks: {
    paymentJourneyEntries: 8,
    mostUsedCard: "American Express Gold",
    estimatedRewardsEarned: 6.2,
    averagePurchaseAmount: 8.15,
    plannedSpendingEntries: 0,
  },
};

export function listMerchantProfiles(options: MerchantSearchOptions = {}) {
  const limit = safeLimit(options.limit, 100);
  const category = normalize(options.category);
  const country = normalize(options.country);
  return MERCHANT_INTELLIGENCE_REGISTRY.filter((merchant) =>
    merchantMatchesFilters(merchant, { category, country, activeOnly: options.activeOnly !== false }),
  )
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, limit)
    .map(toMerchantKnowledgeProfile);
}

export function getMerchantProfile(merchantId: string) {
  const normalized = normalizeMerchantId(merchantId);
  const merchant =
    MERCHANT_INTELLIGENCE_REGISTRY.find((item) => item.merchantId === normalized) ||
    resolveMerchant({ merchant: merchantId }).merchant;
  return merchant ? toMerchantKnowledgeProfile(merchant) : null;
}

export function resolveMerchantKnowledge(input: {
  merchant?: string | null;
  rawMerchant?: string | null;
  billingDescriptor?: string | null;
  hostname?: string | null;
  url?: string | null;
  domain?: string | null;
  mcc?: string | null;
  country?: string | null;
  purchaseChannel?: string | null;
}) {
  const resolution = resolveMerchant(input);
  return {
    ...resolution,
    profile: resolution.merchant ? toMerchantKnowledgeProfile(resolution.merchant) : null,
  };
}

export function searchMerchantProfiles(options: MerchantSearchOptions = {}) {
  const query = normalize(options.query);
  if (!query) return listMerchantProfiles(options).map((profile) => ({
    ...profile,
    score: 0.5,
    matchType: "partial" as const,
    matchedValue: null,
  }));

  const category = normalize(options.category);
  const country = normalize(options.country);
  return MERCHANT_INTELLIGENCE_REGISTRY.filter((merchant) =>
    merchantMatchesFilters(merchant, { category, country, activeOnly: options.activeOnly !== false }),
  )
    .map((merchant) => scoreMerchantSearchResult(merchant, query))
    .filter((result): result is MerchantSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
    .slice(0, safeLimit(options.limit, 20));
}

export function listMerchantCategories() {
  const counts = new Map<string, number>();
  for (const merchant of MERCHANT_INTELLIGENCE_REGISTRY) {
    for (const categoryId of merchant.categoryIds) {
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    }
  }
  return MERCHANT_CATEGORY_REGISTRY.map((category) =>
    toMerchantCategoryResponse(category, counts.get(category.categoryId) || 0),
  );
}

export function getMerchantInsight(merchantId: string): MerchantInsight | null {
  const profile = getMerchantProfile(merchantId);
  if (!profile) return null;
  const fixture = ANALYTICS_FIXTURES[profile.merchantId] || {
    paymentJourneyEntries: 0,
    mostUsedCard: null,
    estimatedRewardsEarned: 0,
    averagePurchaseAmount: null,
    plannedSpendingEntries: 0,
  };
  return {
    merchantId: profile.merchantId,
    displayName: profile.displayName,
    ...fixture,
    lastUpdated: profile.lastUpdated,
  };
}

export function buildMerchantKnowledgeSummary() {
  return {
    registryVersion: MERCHANT_INTELLIGENCE_REGISTRY_VERSION,
    merchantCount: MERCHANT_INTELLIGENCE_REGISTRY.length,
    categoryCount: MERCHANT_CATEGORY_REGISTRY.length,
    activeMerchantCount: MERCHANT_INTELLIGENCE_REGISTRY.filter((merchant) => merchant.active).length,
    supportedCapabilities: [
      "merchant_lookup",
      "alias_resolution",
      "category_lookup",
      "merchant_search",
      "metadata_retrieval",
      "merchant_insights",
    ],
  };
}

function scoreMerchantSearchResult(
  merchant: CanonicalMerchant,
  query: string,
): MerchantSearchResult | null {
  const profile = toMerchantKnowledgeProfile(merchant);
  const fields = {
    exact_name: [merchant.displayName, merchant.canonicalName],
    alias: merchant.knownAliases,
    domain: [...merchant.websiteDomains, ...merchant.knownCheckoutDomains],
    brand: [merchant.brand, merchant.parentCompany, merchant.merchantGroup].filter(Boolean) as string[],
    category: [
      merchant.category,
      merchant.subcategory,
      ...merchant.categoryIds,
      ...profile.tags,
    ].filter(Boolean) as string[],
  };

  const rankedMatches = [
    matchValues(query, fields.exact_name, "exact_name", 1),
    matchValues(query, fields.alias, "alias", 0.94),
    matchValues(query, fields.domain, "domain", 0.9),
    matchValues(query, fields.brand, "brand", 0.84),
    matchValues(query, fields.category, "category", 0.74),
    partialMatch(query, merchant, 0.68),
    misspellingMatch(query, merchant, 0.58),
  ].filter(Boolean) as Array<Pick<MerchantSearchResult, "score" | "matchType" | "matchedValue">>;

  const best = rankedMatches.sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  return { ...profile, ...best };
}

function matchValues(
  query: string,
  values: string[],
  matchType: MerchantSearchResult["matchType"],
  weight: number,
) {
  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) continue;
    if (normalized === query) return { score: weight, matchType, matchedValue: value };
    if (normalized.includes(query) || query.includes(normalized)) {
      return {
        score: Math.max(0.6, weight - 0.12),
        matchType,
        matchedValue: value,
      };
    }
  }
  return null;
}

function partialMatch(query: string, merchant: CanonicalMerchant, score: number) {
  const haystack = [
    merchant.displayName,
    merchant.brand,
    merchant.parentCompany,
    merchant.category,
    merchant.subcategory,
    ...merchant.knownAliases,
  ]
    .map(normalize)
    .join(" ");
  if (!query || !haystack.includes(query)) return null;
  return {
    score,
    matchType: "partial" as const,
    matchedValue: query,
  };
}

function misspellingMatch(query: string, merchant: CanonicalMerchant, score: number) {
  if (query.length < 4) return null;
  const candidates = [merchant.displayName, ...merchant.knownAliases]
    .map(normalize)
    .filter(Boolean);
  const match = candidates.find((candidate) => levenshteinDistance(query, candidate) <= 2);
  return match ? { score, matchType: "misspelling" as const, matchedValue: match } : null;
}

function merchantMatchesFilters(
  merchant: CanonicalMerchant,
  filters: { category: string; country: string; activeOnly: boolean },
) {
  if (filters.activeOnly && !merchant.active) return false;
  if (filters.country && normalize(merchant.country) !== filters.country) return false;
  if (filters.category) {
    const categoryTokens = [
      merchant.category,
      merchant.subcategory,
      merchant.validationCategory,
      ...merchant.categoryIds,
      ...merchant.merchantTags,
    ].map(normalize);
    if (!categoryTokens.includes(filters.category)) return false;
  }
  return true;
}

function toMerchantKnowledgeProfile(merchant: CanonicalMerchant): MerchantKnowledgeProfile {
  return {
    merchantId: merchant.merchantId,
    canonicalName: merchant.canonicalName,
    displayName: merchant.displayName,
    aliases: merchant.knownAliases,
    category: String(merchant.category),
    categoryCode: merchant.knownMccs[0] || null,
    subcategory: merchant.subcategory,
    brand: merchant.brand,
    parentCompany: merchant.parentCompany,
    merchantGroup: merchant.merchantGroup,
    country: merchant.country,
    region: merchant.region,
    domains: merchant.websiteDomains,
    checkoutDomains: merchant.knownCheckoutDomains,
    billingDescriptors: merchant.knownBillingDescriptors,
    mccs: merchant.knownMccs,
    supportedPaymentMethods: merchant.supportedPaymentMethods,
    loyaltyPrograms: merchant.loyaltyPrograms,
    tags: merchant.merchantTags,
    metadata: {
      ...merchant.merchantMetadata,
      merchantType: merchant.merchantType,
      registryVersion: MERCHANT_INTELLIGENCE_REGISTRY_VERSION,
      popupEligible: merchant.popupEligible,
    },
    active: merchant.active,
    confidence: merchant.confidence,
    lastUpdated: merchant.updatedAt,
  };
}

function toMerchantCategoryResponse(category: MerchantCategoryNode, merchantCount: number) {
  return {
    categoryId: category.categoryId,
    displayName: category.displayName,
    parentCategoryId: category.parentCategoryId,
    aliases: category.aliases,
    merchantCount,
  };
}

function normalizeMerchantId(value: string) {
  return normalize(value).replace(/\s+/g, "-");
}

function safeLimit(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.floor(number), 1), 100);
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[*_/.-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}
