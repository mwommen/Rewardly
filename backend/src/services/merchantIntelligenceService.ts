import type { MerchantCategory } from "../../../packages/rewardly-core/src";

export type MerchantType =
  | "retailer"
  | "marketplace"
  | "restaurant"
  | "delivery"
  | "travel"
  | "hotel"
  | "airline"
  | "subscription"
  | "digital_service"
  | "grocery"
  | "gas"
  | "coffee"
  | "health"
  | "other";

export type MerchantRelationshipType =
  | "parent"
  | "child"
  | "sibling"
  | "brand"
  | "subsidiary"
  | "virtual_brand"
  | "future_acquisition";

export type MerchantPurchaseChannel =
  | "online"
  | "in_store"
  | "mobile_app"
  | "subscription"
  | "gift_card"
  | "marketplace"
  | "third_party_checkout"
  | "international"
  | "airport_location";

export type MerchantCategoryNode = {
  categoryId: string;
  displayName: string;
  parentCategoryId: string | null;
  aliases: string[];
};

export type MerchantMccProfile = {
  codes: string[];
  issuerOverrides: Record<string, string[]>;
  networkOverrides: Record<string, string[]>;
  historical: Array<{ mcc: string; from: string; to: string | null; note: string }>;
  exceptions: string[];
};

export type CanonicalMerchant = {
  merchantId: string;
  displayName: string;
  canonicalName: string;
  merchantGroup: string | null;
  parentCompany: string | null;
  brand: string | null;
  category: MerchantCategory | string;
  subcategory: string | null;
  categoryIds: string[];
  country: string;
  region: string | null;
  websiteDomains: string[];
  mobileAppIdentifiers: string[];
  knownAliases: string[];
  knownCheckoutDomains: string[];
  knownBillingDescriptors: string[];
  knownMccs: string[];
  mccProfile: MerchantMccProfile;
  merchantType: MerchantType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  confidence: number;
  notes: string[];
  relationships: Array<{
    merchantId: string;
    relationshipType: MerchantRelationshipType;
  }>;
  supportedBenefitMappings: string[];
  issuerNamingDifferences: Record<string, string[]>;
  checkoutUrlPatterns: string[];
  paymentPagePatterns: string[];
  popupEligible: boolean;
  validationCategory:
    | "travel"
    | "airlines"
    | "hotels"
    | "restaurants"
    | "grocery"
    | "gas"
    | "online_retail"
    | "electronics"
    | "home_improvement"
    | "subscription_services"
    | "coffee"
    | "pharmacies"
    | "department_stores";
};

export type MerchantResolutionInput = {
  merchant?: string | null;
  rawMerchant?: string | null;
  billingDescriptor?: string | null;
  hostname?: string | null;
  url?: string | null;
  domain?: string | null;
  mcc?: string | null;
  country?: string | null;
  purchaseChannel?: MerchantPurchaseChannel | string | null;
};

export type MerchantResolutionResult = {
  merchant: CanonicalMerchant | null;
  confidence: number;
  matchingStrategy:
    | "merchant_id"
    | "alias"
    | "billing_descriptor"
    | "domain"
    | "checkout_domain"
    | "mcc"
    | "category_inference"
    | "weak_fuzzy"
    | "unknown";
  aliasUsed: string | null;
  normalizationSteps: string[];
  inheritedMerchantIds: string[];
  inheritedCategoryIds: string[];
  purchaseContext: {
    channel: string | null;
    marketplace: boolean;
    subscription: boolean;
    international: boolean;
    thirdPartyCheckout: boolean;
    airportLocation: boolean;
    giftCard: boolean;
  };
};

const NOW = "2026-07-22T00:00:00.000Z";

export const MERCHANT_CATEGORY_REGISTRY: MerchantCategoryNode[] = [
  category("retail", "Retail", null, ["shopping"]),
  category("retail.online", "Online Retail", "retail", ["online shopping", "ecommerce"]),
  category("retail.electronics", "Electronics", "retail", ["consumer electronics"]),
  category("retail.apparel", "Apparel", "retail", ["clothing"]),
  category("retail.department", "Department Stores", "retail", ["departmentstores"]),
  category("grocery", "Grocery", "retail", ["groceries", "supermarket"]),
  category("restaurant", "Restaurant", null, ["dining", "restaurants"]),
  category("restaurant.delivery", "Delivery", "restaurant", ["food delivery"]),
  category("restaurant.coffee", "Coffee", "restaurant", ["specialty coffee", "coffee shop"]),
  category("travel", "Travel", null, ["trip", "booking"]),
  category("travel.airline", "Airline", "travel", ["airfare", "flights"]),
  category("travel.hotel", "Hotel", "travel", ["lodging"]),
  category("travel.lounge", "Airport Lounge", "travel", ["airport club"]),
  category("subscription", "Subscription", null, ["recurring", "membership"]),
  category("gas", "Gas", null, ["fuel", "gasoline"]),
  category("health.optical", "Optical", "retail", ["vision", "eyewear"]),
];

export const MERCHANT_INTELLIGENCE_REGISTRY: CanonicalMerchant[] = [
  merchant({
    merchantId: "amazon",
    displayName: "Amazon",
    merchantGroup: "amazon",
    parentCompany: "Amazon",
    brand: "Amazon",
    category: "online_shopping",
    subcategory: "marketplace",
    categoryIds: ["retail", "retail.online"],
    websiteDomains: ["amazon.com", "smile.amazon.com"],
    knownCheckoutDomains: ["amazon.com", "www.amazon.com"],
    knownAliases: ["amazon", "amazon marketplace", "amzn", "amzn mktp", "amazon.com"],
    knownBillingDescriptors: ["amzn mktp", "amazon marketplace", "amazon.com", "amzn digital"],
    knownMccs: ["5942", "5999", "5969"],
    merchantType: "marketplace",
    validationCategory: "online_retail",
    popupEligible: true,
    supportedBenefitMappings: ["amazon", "amazon group", "online_shopping", "marketplace"],
    issuerNamingDifferences: {
      amex: ["Amazon.com", "Amazon Marketplace"],
      chase: ["Amazon.com"],
      capitalone: ["Amazon", "Amazon Marketplace"],
    },
    checkoutUrlPatterns: ["/gp/buy", "/checkout", "/gp/buy/payselect", "/gp/buy/spc"],
    paymentPagePatterns: ["payment method", "place your order", "payselect"],
    notes: ["Amazon Marketplace resolves to Amazon unless line-item data is available."],
  }),
  merchant({
    merchantId: "whole-foods",
    displayName: "Whole Foods Market",
    merchantGroup: "amazon",
    parentCompany: "Amazon",
    brand: "Whole Foods",
    category: "groceries",
    subcategory: "organic grocery",
    categoryIds: ["retail", "grocery"],
    websiteDomains: ["wholefoodsmarket.com"],
    knownAliases: ["whole foods", "whole foods market", "wholefds", "wholefds market"],
    knownBillingDescriptors: ["wholefds", "whole foods", "whole foods market"],
    knownMccs: ["5411"],
    merchantType: "grocery",
    validationCategory: "grocery",
    relationships: [{ merchantId: "amazon", relationshipType: "subsidiary" }],
    supportedBenefitMappings: ["whole foods", "amazon group", "groceries"],
    notes: ["Whole Foods inherits Amazon corporate identity but remains grocery category."],
  }),
  merchant({
    merchantId: "amazon-fresh",
    displayName: "Amazon Fresh",
    merchantGroup: "amazon",
    parentCompany: "Amazon",
    brand: "Amazon Fresh",
    category: "groceries",
    subcategory: "grocery delivery",
    categoryIds: ["retail", "grocery"],
    websiteDomains: ["amazon.com"],
    knownAliases: ["amazon fresh", "amzn fresh"],
    knownBillingDescriptors: ["amazon fresh", "amzn fresh"],
    knownMccs: ["5411", "5969"],
    merchantType: "grocery",
    validationCategory: "grocery",
    relationships: [{ merchantId: "amazon", relationshipType: "child" }],
    supportedBenefitMappings: ["amazon", "amazon group", "groceries"],
  }),
  merchant({
    merchantId: "prime-video",
    displayName: "Prime Video",
    merchantGroup: "amazon",
    parentCompany: "Amazon",
    brand: "Prime Video",
    category: "streaming",
    subcategory: "video subscription",
    categoryIds: ["subscription"],
    websiteDomains: ["primevideo.com", "amazon.com"],
    knownAliases: ["prime video", "amazon prime video"],
    knownBillingDescriptors: ["prime video", "amazon prime"],
    knownMccs: ["4899", "5968"],
    merchantType: "subscription",
    validationCategory: "subscription_services",
    relationships: [{ merchantId: "amazon", relationshipType: "child" }],
    supportedBenefitMappings: ["amazon group", "streaming", "subscription"],
  }),
  merchant({
    merchantId: "audible",
    displayName: "Audible",
    merchantGroup: "amazon",
    parentCompany: "Amazon",
    brand: "Audible",
    category: "streaming",
    subcategory: "audio subscription",
    categoryIds: ["subscription"],
    websiteDomains: ["audible.com"],
    knownAliases: ["audible", "audible.com"],
    knownBillingDescriptors: ["audible", "audible.com"],
    knownMccs: ["4899", "5968"],
    merchantType: "subscription",
    validationCategory: "subscription_services",
    relationships: [{ merchantId: "amazon", relationshipType: "subsidiary" }],
    supportedBenefitMappings: ["amazon group", "streaming", "subscription"],
  }),
  merchant({
    merchantId: "uber",
    displayName: "Uber",
    merchantGroup: "uber",
    parentCompany: "Uber",
    brand: "Uber",
    category: "rideshare",
    subcategory: "rideshare",
    categoryIds: ["travel"],
    websiteDomains: ["uber.com"],
    mobileAppIdentifiers: ["com.ubercab"],
    knownAliases: ["uber", "uber trip", "uber ride", "uber *trip"],
    knownBillingDescriptors: ["uber *trip", "uber trip", "uber"],
    knownMccs: ["4121"],
    merchantType: "travel",
    validationCategory: "travel",
    supportedBenefitMappings: ["uber", "rideshare", "travel"],
  }),
  merchant({
    merchantId: "uber-eats",
    displayName: "Uber Eats",
    merchantGroup: "uber",
    parentCompany: "Uber",
    brand: "Uber Eats",
    category: "dining",
    subcategory: "food delivery",
    categoryIds: ["restaurant", "restaurant.delivery"],
    websiteDomains: ["ubereats.com"],
    mobileAppIdentifiers: ["com.ubercab.eats"],
    knownAliases: ["uber eats", "ubereats", "uber eat"],
    knownBillingDescriptors: ["uber eats", "ubereats"],
    knownMccs: ["5812", "5814"],
    merchantType: "delivery",
    validationCategory: "restaurants",
    relationships: [{ merchantId: "uber", relationshipType: "brand" }],
    supportedBenefitMappings: ["uber", "uber eats", "dining", "restaurants"],
    notes: ["Uber Eats can qualify for Uber-family credits and dining benefits."],
  }),
  merchant({
    merchantId: "starbucks",
    displayName: "Starbucks",
    category: "dining",
    subcategory: "specialty coffee",
    categoryIds: ["restaurant", "restaurant.coffee"],
    websiteDomains: ["starbucks.com"],
    mobileAppIdentifiers: ["com.starbucks.mobilecard"],
    knownAliases: ["starbucks", "starbucks coffee", "starbucks app"],
    knownBillingDescriptors: ["starbucks", "starbucks app", "sbux"],
    knownMccs: ["5814", "5812"],
    merchantType: "coffee",
    validationCategory: "coffee",
    supportedBenefitMappings: ["starbucks", "coffee", "dining", "restaurants"],
  }),
  merchant({
    merchantId: "marriott",
    displayName: "Marriott",
    merchantGroup: "marriott",
    parentCompany: "Marriott",
    brand: "Marriott",
    category: "travel",
    subcategory: "hotel",
    categoryIds: ["travel", "travel.hotel"],
    websiteDomains: ["marriott.com"],
    knownAliases: ["marriott", "marriott bonvoy", "marriott restaurant"],
    knownBillingDescriptors: ["marriott", "marriott hotel", "marriott restaurant"],
    knownMccs: ["3509", "7011", "5812"],
    merchantType: "hotel",
    validationCategory: "hotels",
    supportedBenefitMappings: ["marriott", "hotels", "travel", "restaurants"],
    notes: ["Restaurants inside Marriott may code as dining or hotel depending on processor."],
  }),
  merchant({
    merchantId: "hilton",
    displayName: "Hilton",
    merchantGroup: "hilton",
    parentCompany: "Hilton",
    brand: "Hilton",
    category: "travel",
    subcategory: "hotel",
    categoryIds: ["travel", "travel.hotel"],
    websiteDomains: ["hilton.com"],
    knownAliases: ["hilton", "hilton honors"],
    knownBillingDescriptors: ["hilton", "hilton hotels"],
    knownMccs: ["3504", "7011"],
    merchantType: "hotel",
    validationCategory: "hotels",
    supportedBenefitMappings: ["hilton", "hotels", "travel"],
  }),
  merchant({
    merchantId: "apple",
    displayName: "Apple",
    merchantGroup: "apple",
    parentCompany: "Apple",
    brand: "Apple",
    category: "online_shopping",
    subcategory: "electronics",
    categoryIds: ["retail", "retail.online", "retail.electronics"],
    websiteDomains: ["apple.com"],
    knownCheckoutDomains: ["apple.com", "secure.store.apple.com"],
    knownAliases: ["apple", "apple store", "apple.com", "apple.com/bill"],
    knownBillingDescriptors: ["apple.com/bill", "apple store", "apple services"],
    knownMccs: ["5732", "5045", "5815"],
    merchantType: "retailer",
    validationCategory: "electronics",
    supportedBenefitMappings: ["apple", "electronics", "online_shopping"],
    notes: ["Apple.com billing may represent retail, app store, or subscription context."],
  }),
  merchant({
    merchantId: "target",
    displayName: "Target",
    merchantGroup: "target",
    parentCompany: "Target",
    brand: "Target",
    category: "departmentstores",
    subcategory: "mass merchant",
    categoryIds: ["retail", "retail.department"],
    websiteDomains: ["target.com"],
    knownAliases: ["target", "target optical"],
    knownBillingDescriptors: ["target", "target optical"],
    knownMccs: ["5310", "5399", "8043"],
    merchantType: "retailer",
    validationCategory: "department_stores",
    supportedBenefitMappings: ["target", "departmentstores", "retail"],
    notes: ["Target Optical is Target brand with optical MCC context."],
  }),
  simpleMerchant("walmart", "Walmart", ["walmart.com"], "departmentstores", "department_stores", ["walmart.com", "wal-mart"], ["5310", "5411", "5542"]),
  simpleMerchant("costco", "Costco", ["costco.com"], "groceries", "grocery", ["costco wholesale"], ["5300", "5411"]),
  simpleMerchant("best-buy", "Best Buy", ["bestbuy.com"], "online_shopping", "electronics", ["bestbuy"], ["5732"]),
  simpleMerchant("nike", "Nike", ["nike.com"], "apparel", "department_stores", ["nike store"], ["5661", "5691"]),
  simpleMerchant("home-depot", "Home Depot", ["homedepot.com"], "other", "home_improvement", ["the home depot"], ["5200", "5211"]),
  simpleMerchant("lowes", "Lowe's", ["lowes.com"], "other", "home_improvement", ["lowes", "lowe’s"], ["5200", "5211"]),
  simpleMerchant("doordash", "DoorDash", ["doordash.com"], "dining", "restaurants", ["door dash"], ["5812", "5814"]),
  simpleMerchant("delta", "Delta", ["delta.com"], "travel", "airlines", ["delta air lines", "delta airlines", "delta sky club"], ["3058", "4511", "5812"]),
  simpleMerchant("united", "United", ["united.com"], "travel", "airlines", ["united airlines"], ["3000", "4511"]),
  simpleMerchant("southwest", "Southwest", ["southwest.com"], "travel", "airlines", ["southwest airlines"], ["3066", "4511"]),
  simpleMerchant("airbnb", "Airbnb", ["airbnb.com"], "travel", "hotels", [], ["4722", "7011"]),
  simpleMerchant("expedia", "Expedia", ["expedia.com"], "travel", "travel", [], ["4722"]),
  simpleMerchant("booking-com", "Booking.com", ["booking.com"], "travel", "travel", ["booking com"], ["4722", "7011"]),
  simpleMerchant("shell", "Shell", ["shell.com"], "gas", "gas", [], ["5541", "5542"]),
  simpleMerchant("netflix", "Netflix", ["netflix.com"], "streaming", "subscription_services", [], ["4899"]),
  simpleMerchant("cvs", "CVS", ["cvs.com"], "drugstores", "pharmacies", ["cvs pharmacy"], ["5912"]),
  simpleMerchant("macys", "Macy's", ["macys.com"], "departmentstores", "department_stores", ["macys"], ["5311"]),
  simpleMerchant("lululemon", "Lululemon", ["lululemon.com", "shop.lululemon.com", "checkout.lululemon.com"], "apparel", "department_stores", ["lulu lemon"], ["5691"]),
];

export function listMerchantIntelligence() {
  return MERCHANT_INTELLIGENCE_REGISTRY.slice();
}

export function listMerchantAliases() {
  return MERCHANT_INTELLIGENCE_REGISTRY.map((merchant) => ({
    merchantId: merchant.merchantId,
    displayName: merchant.displayName,
    aliases: merchant.knownAliases,
    billingDescriptors: merchant.knownBillingDescriptors,
    domains: merchant.websiteDomains,
    checkoutDomains: merchant.knownCheckoutDomains,
  }));
}

export function listMerchantMccProfiles() {
  return MERCHANT_INTELLIGENCE_REGISTRY.map((merchant) => ({
    merchantId: merchant.merchantId,
    displayName: merchant.displayName,
    mccProfile: merchant.mccProfile,
  }));
}

export function resolveMerchantIntelligence(input: MerchantResolutionInput): MerchantResolutionResult | null {
  return resolveMerchant(input).merchant ? resolveMerchant(input) : null;
}

export function resolveMerchant(input: MerchantResolutionInput): MerchantResolutionResult {
  const normalizationSteps: string[] = [];
  const rawText = [
    input.merchant,
    input.rawMerchant,
    input.billingDescriptor,
  ]
    .filter(Boolean)
    .join(" ");
  const normalizedText = normalizeText(rawText);
  if (rawText) normalizationSteps.push(`normalized text: ${normalizedText}`);
  const host = normalizeHost(input.hostname || input.domain || input.url);
  if (host) normalizationSteps.push(`normalized host: ${host}`);
  const mcc = normalizeMcc(input.mcc);
  if (mcc) normalizationSteps.push(`normalized MCC: ${mcc}`);
  const purchaseContext = purchaseContextFrom(input, normalizedText);

  const exactId = findByMerchantId(normalizedText);
  if (exactId) return result(exactId, 1, "merchant_id", exactId.merchantId, normalizationSteps, purchaseContext);

  const descriptor = bestDescriptorMatch(normalizedText);
  if (descriptor) return result(descriptor.merchant, 0.95, "billing_descriptor", descriptor.alias, normalizationSteps, purchaseContext);

  const domain = host ? bestDomainMatch(host, false) : null;
  if (domain) return result(domain.merchant, 0.9, domain.checkout ? "checkout_domain" : "domain", domain.alias, normalizationSteps, purchaseContext);

  const alias = bestAliasMatch(normalizedText);
  if (alias) return result(alias.merchant, 0.98, "alias", alias.alias, normalizationSteps, purchaseContext);

  const mccMatch = mcc ? bestMccMatch(mcc, normalizedText) : null;
  if (mccMatch) return result(mccMatch, 0.75, "mcc", mcc, normalizationSteps, purchaseContext);

  const categoryMatch = inferByCategory(normalizedText);
  if (categoryMatch) return result(categoryMatch, 0.75, "category_inference", null, normalizationSteps, purchaseContext);

  const fuzzy = weakFuzzyMatch(normalizedText);
  if (fuzzy) return result(fuzzy.merchant, 0.4, "weak_fuzzy", fuzzy.alias, normalizationSteps, purchaseContext);

  return {
    merchant: null,
    confidence: 0,
    matchingStrategy: "unknown",
    aliasUsed: null,
    normalizationSteps,
    inheritedMerchantIds: [],
    inheritedCategoryIds: [],
    purchaseContext,
  };
}

export function getMerchantHierarchy(merchantId: string) {
  const merchant = findMerchant(merchantId);
  if (!merchant) return null;
  const parents = merchant.relationships
    .filter((rel) => ["parent", "subsidiary", "child", "brand"].includes(rel.relationshipType))
    .map((rel) => findMerchant(rel.merchantId))
    .filter(Boolean);
  const children = MERCHANT_INTELLIGENCE_REGISTRY.filter((candidate) =>
    candidate.relationships.some((rel) => rel.merchantId === merchant.merchantId),
  );
  const siblings = MERCHANT_INTELLIGENCE_REGISTRY.filter(
    (candidate) =>
      candidate.merchantId !== merchant.merchantId &&
      Boolean(candidate.merchantGroup && candidate.merchantGroup === merchant.merchantGroup),
  );
  return { merchant, parents, children, siblings };
}

export function inheritedMerchantTokens(merchant: CanonicalMerchant | null) {
  if (!merchant) return [];
  const hierarchy = getMerchantHierarchy(merchant.merchantId);
  return Array.from(
    new Set(
      [
        merchant.merchantId,
        merchant.displayName,
        merchant.canonicalName,
        merchant.merchantGroup,
        merchant.parentCompany,
        merchant.brand,
        ...merchant.knownAliases,
        ...(hierarchy?.parents || []).flatMap((parent) =>
          parent ? [parent.merchantId, parent.displayName, parent.canonicalName, ...parent.knownAliases] : [],
        ),
      ]
        .filter(Boolean)
        .map((value) => normalizeText(value)),
    ),
  );
}

export function inheritedCategoryTokens(merchant: CanonicalMerchant | null) {
  if (!merchant) return [];
  const categoryIds = new Set<string>(merchant.categoryIds);
  for (const id of merchant.categoryIds) {
    let node = findCategory(id);
    while (node?.parentCategoryId) {
      categoryIds.add(node.parentCategoryId);
      node = findCategory(node.parentCategoryId);
    }
  }
  return Array.from(
    new Set([
      normalizeText(merchant.category),
      normalizeText(merchant.subcategory),
      ...Array.from(categoryIds).flatMap((id) => {
        const node = findCategory(id);
        return node ? [normalizeText(node.categoryId), normalizeText(node.displayName), ...node.aliases.map(normalizeText)] : [];
      }),
    ].filter(Boolean)),
  );
}

export function buildMerchantCoverageMatrix() {
  return MERCHANT_INTELLIGENCE_REGISTRY.map((record) => ({
    id: record.merchantId,
    merchant: record.displayName,
    category: record.validationCategory,
    runtimePopupEligible: record.popupEligible,
    domains: record.websiteDomains,
    hasCheckoutPatterns: record.checkoutUrlPatterns.length > 0,
    hasPaymentPatterns: record.paymentPagePatterns.length > 0,
    hasBenefitMappings: record.supportedBenefitMappings.length > 0,
    mccs: record.knownMccs,
    status:
      record.popupEligible &&
      record.checkoutUrlPatterns.length &&
      record.paymentPagePatterns.length
        ? "ready_for_manual_validation"
        : "registry_only",
  }));
}

export function auditMerchantRegistry() {
  const duplicateAliases = duplicateAliasesAcrossMerchants();
  const missingMcc = MERCHANT_INTELLIGENCE_REGISTRY.filter((merchant) => !merchant.knownMccs.length);
  const missingDomains = MERCHANT_INTELLIGENCE_REGISTRY.filter((merchant) => !merchant.websiteDomains.length);
  return {
    merchantCount: MERCHANT_INTELLIGENCE_REGISTRY.length,
    categoryCount: MERCHANT_CATEGORY_REGISTRY.length,
    duplicateAliasKeys: duplicateAliases,
    missingMcc: missingMcc.map((merchant) => merchant.merchantId),
    missingDomains: missingDomains.map((merchant) => merchant.merchantId),
    activeMerchants: MERCHANT_INTELLIGENCE_REGISTRY.filter((merchant) => merchant.active).length,
  };
}

function result(
  merchant: CanonicalMerchant,
  confidence: number,
  matchingStrategy: MerchantResolutionResult["matchingStrategy"],
  aliasUsed: string | null,
  normalizationSteps: string[],
  purchaseContext: MerchantResolutionResult["purchaseContext"],
): MerchantResolutionResult {
  return {
    merchant,
    confidence,
    matchingStrategy,
    aliasUsed,
    normalizationSteps,
    inheritedMerchantIds: inheritedMerchantTokens(merchant),
    inheritedCategoryIds: inheritedCategoryTokens(merchant),
    purchaseContext,
  };
}

function findByMerchantId(text: string) {
  return MERCHANT_INTELLIGENCE_REGISTRY.find((merchant) => text === merchant.merchantId);
}

function findMerchant(id: string) {
  return MERCHANT_INTELLIGENCE_REGISTRY.find((merchant) => merchant.merchantId === id) || null;
}

function findCategory(id: string) {
  return MERCHANT_CATEGORY_REGISTRY.find((category) => category.categoryId === id) || null;
}

function bestAliasMatch(text: string) {
  if (!text) return null;
  return bestTextMatch(text, (merchant) => [
    merchant.displayName,
    merchant.canonicalName,
    ...merchant.knownAliases,
  ]);
}

function bestDescriptorMatch(text: string) {
  if (!text) return null;
  return bestTextMatch(text, (merchant) => merchant.knownBillingDescriptors);
}

function bestTextMatch(
  text: string,
  valuesForMerchant: (merchant: CanonicalMerchant) => string[],
) {
  let best: { merchant: CanonicalMerchant; alias: string; length: number } | null = null;
  for (const merchant of MERCHANT_INTELLIGENCE_REGISTRY) {
    for (const alias of valuesForMerchant(merchant)) {
      const normalized = normalizeText(alias);
      if (!normalized) continue;
      if (text === normalized || text.includes(normalized) || normalized.includes(text)) {
        if (!best || normalized.length > best.length) {
          best = { merchant, alias, length: normalized.length };
        }
      }
    }
  }
  return best;
}

function bestDomainMatch(host: string, checkoutOnly: boolean) {
  for (const merchant of MERCHANT_INTELLIGENCE_REGISTRY) {
    const domains = checkoutOnly ? merchant.knownCheckoutDomains : [...merchant.knownCheckoutDomains, ...merchant.websiteDomains];
    const match = domains.find((domain) => host === normalizeHost(domain) || host.endsWith(`.${normalizeHost(domain)}`));
    if (match) return { merchant, alias: match, checkout: merchant.knownCheckoutDomains.includes(match) };
  }
  return null;
}

function bestMccMatch(mcc: string, text: string) {
  const matches = MERCHANT_INTELLIGENCE_REGISTRY.filter((merchant) =>
    merchant.knownMccs.includes(mcc),
  );
  if (matches.length === 1) return matches[0];
  return (
    matches.find((merchant) =>
      [merchant.displayName, ...merchant.knownAliases].some((alias) =>
        text.includes(normalizeText(alias)),
      ),
    ) || matches[0] || null
  );
}

function inferByCategory(text: string) {
  if (!text) return null;
  const category = MERCHANT_CATEGORY_REGISTRY.find((node) =>
    [node.categoryId, node.displayName, ...node.aliases].some((value) =>
      text.includes(normalizeText(value)),
    ),
  );
  if (!category) return null;
  return (
    MERCHANT_INTELLIGENCE_REGISTRY.find((merchant) =>
      merchant.categoryIds.includes(category.categoryId),
    ) || null
  );
}

function weakFuzzyMatch(text: string) {
  if (text.length < 4) return null;
  return bestTextMatch(text, (merchant) => [
    merchant.displayName,
    ...merchant.knownAliases,
  ]);
}

function purchaseContextFrom(
  input: MerchantResolutionInput,
  normalizedText: string,
): MerchantResolutionResult["purchaseContext"] {
  const channel = input.purchaseChannel || null;
  return {
    channel,
    marketplace: /marketplace|mktp|third party/.test(normalizedText),
    subscription: /subscription|monthly|prime|audible|netflix|bill/.test(normalizedText) || channel === "subscription",
    international: Boolean(input.country && input.country.toUpperCase() !== "US") || channel === "international",
    thirdPartyCheckout: /paypal|stripe|shop pay|third party/.test(normalizedText) || channel === "third_party_checkout",
    airportLocation: /sky club|airport|terminal|lounge/.test(normalizedText) || channel === "airport_location",
    giftCard: /gift card|egift/.test(normalizedText) || channel === "gift_card",
  };
}

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[*_/.-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(value?: string | null) {
  if (!value) return "";
  try {
    const parsed = value.includes("://") ? new URL(value).hostname : value;
    return parsed.replace(/^(?:www|m)\./i, "").toLowerCase();
  } catch {
    return value.replace(/^(?:www|m)\./i, "").toLowerCase();
  }
}

function normalizeMcc(value?: string | null) {
  const text = String(value || "").replace(/\D/g, "");
  return text || "";
}

function category(categoryId: string, displayName: string, parentCategoryId: string | null, aliases: string[]): MerchantCategoryNode {
  return { categoryId, displayName, parentCategoryId, aliases };
}

function merchant(
  input: Partial<CanonicalMerchant> &
    Pick<
      CanonicalMerchant,
      | "merchantId"
      | "displayName"
      | "category"
      | "subcategory"
      | "categoryIds"
      | "websiteDomains"
      | "knownAliases"
      | "knownBillingDescriptors"
      | "knownMccs"
      | "merchantType"
      | "validationCategory"
      | "supportedBenefitMappings"
    >,
): CanonicalMerchant {
  return {
    merchantId: input.merchantId,
    displayName: input.displayName,
    canonicalName: normalizeText(input.displayName),
    merchantGroup: input.merchantGroup || null,
    parentCompany: input.parentCompany || null,
    brand: input.brand || input.displayName,
    category: input.category,
    subcategory: input.subcategory || null,
    categoryIds: input.categoryIds,
    country: input.country || "US",
    region: input.region || null,
    websiteDomains: input.websiteDomains,
    mobileAppIdentifiers: input.mobileAppIdentifiers || [],
    knownAliases: Array.from(new Set([input.displayName.toLowerCase(), ...input.knownAliases])),
    knownCheckoutDomains: input.knownCheckoutDomains || input.websiteDomains,
    knownBillingDescriptors: input.knownBillingDescriptors,
    knownMccs: input.knownMccs,
    mccProfile: input.mccProfile || {
      codes: input.knownMccs,
      issuerOverrides: {},
      networkOverrides: {},
      historical: [],
      exceptions: input.notes || [],
    },
    merchantType: input.merchantType,
    active: input.active ?? true,
    createdAt: input.createdAt || NOW,
    updatedAt: input.updatedAt || NOW,
    confidence: input.confidence ?? 0.95,
    notes: input.notes || [],
    relationships: input.relationships || [],
    supportedBenefitMappings: input.supportedBenefitMappings,
    issuerNamingDifferences: input.issuerNamingDifferences || {},
    checkoutUrlPatterns: input.checkoutUrlPatterns || ["/checkout", "/payment"],
    paymentPagePatterns: input.paymentPagePatterns || ["payment", "place order", "order summary"],
    popupEligible: input.popupEligible ?? false,
    validationCategory: input.validationCategory,
  };
}

function simpleMerchant(
  merchantId: string,
  displayName: string,
  domains: string[],
  categoryValue: MerchantCategory | string,
  validationCategory: CanonicalMerchant["validationCategory"],
  extraAliases: string[] = [],
  mccs: string[] = [],
): CanonicalMerchant {
  return merchant({
    merchantId,
    displayName,
    category: categoryValue,
    subcategory: null,
    categoryIds: categoryIdsFor(categoryValue, validationCategory),
    websiteDomains: domains,
    knownAliases: [displayName.toLowerCase(), ...extraAliases],
    knownBillingDescriptors: [displayName.toLowerCase(), ...extraAliases],
    knownMccs: mccs,
    merchantType: merchantTypeFor(validationCategory),
    validationCategory,
    supportedBenefitMappings: [String(categoryValue), displayName.toLowerCase()],
  });
}

function categoryIdsFor(categoryValue: MerchantCategory | string, validationCategory: CanonicalMerchant["validationCategory"]) {
  const map: Record<string, string[]> = {
    groceries: ["retail", "grocery"],
    dining: ["restaurant"],
    apparel: ["retail", "retail.apparel"],
    departmentstores: ["retail", "retail.department"],
    online_shopping: ["retail", "retail.online"],
    travel: ["travel"],
    gas: ["gas"],
    streaming: ["subscription"],
    drugstores: ["retail"],
  };
  if (validationCategory === "airlines") return ["travel", "travel.airline"];
  if (validationCategory === "hotels") return ["travel", "travel.hotel"];
  return map[String(categoryValue)] || ["retail"];
}

function merchantTypeFor(validationCategory: CanonicalMerchant["validationCategory"]): MerchantType {
  const map: Partial<Record<CanonicalMerchant["validationCategory"], MerchantType>> = {
    airlines: "airline",
    hotels: "hotel",
    restaurants: "restaurant",
    grocery: "grocery",
    gas: "gas",
    coffee: "coffee",
    subscription_services: "subscription",
    online_retail: "retailer",
  };
  return map[validationCategory] || "retailer";
}

function duplicateAliasesAcrossMerchants() {
  const aliases = new Map<string, Set<string>>();
  for (const merchant of MERCHANT_INTELLIGENCE_REGISTRY) {
    for (const alias of merchant.knownAliases) {
      const normalized = normalizeText(alias);
      if (!normalized) continue;
      const merchants = aliases.get(normalized) || new Set<string>();
      merchants.add(merchant.merchantId);
      aliases.set(normalized, merchants);
    }
  }
  return Array.from(aliases.entries())
    .filter(([, merchants]) => merchants.size > 1)
    .map(([alias, merchants]) => ({
      alias,
      merchantIds: Array.from(merchants),
    }));
}
