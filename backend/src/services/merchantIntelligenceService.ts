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
  | "online_direct"
  | "issuer_portal"
  | "travel_portal"
  | "in_store"
  | "mobile_web"
  | "mobile_app"
  | "subscription"
  | "delivery"
  | "pickup"
  | "gift_card"
  | "marketplace"
  | "third_party_checkout"
  | "international"
  | "airport_location"
  | "unknown";

export type CommerceModel =
  | "direct"
  | "marketplace"
  | "subscription"
  | "delivery"
  | "pickup"
  | "third_party_checkout"
  | "unknown";

export type CheckoutProvider =
  | "merchant_native"
  | "shopify"
  | "stripe_checkout"
  | "paypal"
  | "shop_pay"
  | "amazon_pay"
  | "unknown";

export type MerchantResolutionStatus = "resolved" | "ambiguous" | "unknown";

export type MerchantConfidenceBand = "high" | "medium" | "low" | "unknown";

export type MerchantEvidenceType =
  | "exact_canonical_domain"
  | "known_subdomain"
  | "exact_merchant_alias"
  | "billing_descriptor"
  | "structured_data_merchant_name"
  | "checkout_provider_signal"
  | "merchant_specific_dom_marker"
  | "page_metadata"
  | "hostname_keyword"
  | "extension_merchant_hint"
  | "category_only_signal"
  | "mcc"
  | "conflicting_evidence"
  | "ambiguous_alias"
  | "untrusted_text_only_evidence";

export type MerchantEvidence = {
  evidenceId: string;
  type: MerchantEvidenceType;
  source: string;
  matchedValue?: string;
  candidateMerchantId?: string;
  weight: number;
  reliability: "verified" | "strong" | "medium" | "weak" | "untrusted";
  effect: "supporting" | "conflicting" | "neutral";
  explanation: string;
};

export type MerchantIdentity = {
  merchantId: string;
  canonicalName: string;
  displayName: string;
  merchantFamilyId?: string;
};

export type MarketplaceContext = {
  isMarketplace: boolean;
  platformMerchantId?: string;
  sellerName?: string;
  sellerId?: string;
  sellerConfidence?: number;
  fulfillmentType?: string;
};

export type MerchantContext = {
  category: MerchantCategory | string | "unknown";
  subcategory?: string | null;
  purchaseChannel: MerchantPurchaseChannel;
  commerceModel: CommerceModel;
  marketplace: MarketplaceContext;
  checkoutProvider: CheckoutProvider;
};

export type MerchantClassification = {
  primaryCategory: MerchantCategory | string | "unknown";
  secondaryCategories: Array<MerchantCategory | string>;
  subcategory?: string | null;
  source:
    | "verified_registry_mapping"
    | "exact_domain_mapping"
    | "exact_merchant_alias"
    | "structured_data"
    | "checkout_provider"
    | "dom_evidence"
    | "title_or_metadata"
    | "inferred_fallback"
    | "unknown";
  classificationConfidence: number;
};

export type MerchantCandidate = {
  merchantId: string;
  canonicalName: string;
  score: number;
  confidence: number;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  category?: MerchantCategory | string;
};

export type StructuredMerchantSignal = {
  type: "merchant_name" | "organization" | "checkout_provider" | "category";
  value: string;
  source?: string;
};

export type MerchantDomSignal = {
  type: "merchant_marker" | "payment_provider" | "checkout_marker" | "category_marker";
  value: string;
  source?: string;
};

export type MerchantIntelligenceInput = {
  url: string;
  hostname?: string;
  pageTitle?: string;
  documentTextSignals?: string[];
  structuredData?: StructuredMerchantSignal[];
  detectedMerchantLabel?: string;
  checkoutProviderSignals?: string[];
  domSignals?: MerchantDomSignal[];
  purchaseChannelHint?: MerchantPurchaseChannel;
  checkoutStage?: string;
  transactionDate: string;
};

export type MerchantIntelligenceTrace = {
  inputSummary: {
    hasUrl: boolean;
    hostname?: string;
    pageTitle?: string;
    documentTextSignalCount: number;
    structuredDataCount: number;
    domSignalCount: number;
    checkoutProviderSignalCount: number;
    checkoutStage?: string;
  };
  normalizedHostname?: string;
  registryCandidates: MerchantCandidate[];
  aliasMatches: Array<{ merchantId: string; alias: string; evidenceId: string }>;
  categoryResolution: {
    category: string;
    source: MerchantClassification["source"];
    confidence: number;
  };
  channelResolution: {
    purchaseChannel: MerchantPurchaseChannel;
    commerceModel: CommerceModel;
  };
  marketplaceResolution: MarketplaceContext;
  confidenceCalculation: {
    topScore: number;
    secondScore: number;
    conflictPenalty: number;
    ambiguityPenalty: number;
    finalConfidence: number;
    band: MerchantConfidenceBand;
  };
  finalResolution: {
    status: MerchantResolutionStatus;
    merchantId?: string;
    reason: string;
  };
  warnings: string[];
};

export type MerchantIntelligenceResult = {
  identity: MerchantIdentity | null;
  context: MerchantContext;
  classification: MerchantClassification;
  confidence: {
    score: number;
    band: MerchantConfidenceBand;
  };
  evidence: MerchantEvidence[];
  alternatives: MerchantCandidate[];
  trace: MerchantIntelligenceTrace;
  registryVersion: string;
  resolutionStatus: MerchantResolutionStatus;
};

export const MERCHANT_INTELLIGENCE_REGISTRY_VERSION = "2026.07.sprint7";

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
  supportedPaymentMethods: string[];
  loyaltyPrograms: string[];
  merchantTags: string[];
  merchantMetadata: Record<string, string | number | boolean | null>;
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

export function evaluateMerchantIntelligence(
  input: MerchantIntelligenceInput,
): MerchantIntelligenceResult {
  const safeInput = sanitizeMerchantIntelligenceInput(input);
  const hostname = normalizeHost(safeInput.hostname || safeInput.url);
  const textSignals = [
    safeInput.detectedMerchantLabel,
    safeInput.pageTitle,
    ...(safeInput.documentTextSignals || []),
    ...(safeInput.structuredData || []).map((signal) => signal.value),
    ...(safeInput.domSignals || []).map((signal) => signal.value),
  ]
    .filter(Boolean)
    .map(normalizeText)
    .filter(Boolean);

  const evidence: MerchantEvidence[] = [];
  const candidateEvidence = new Map<string, MerchantEvidence[]>();

  function addEvidence(item: Omit<MerchantEvidence, "evidenceId">) {
    const evidenceItem = {
      ...item,
      evidenceId: `mi-e${evidence.length + 1}`,
    };
    evidence.push(evidenceItem);
    if (evidenceItem.candidateMerchantId) {
      const current = candidateEvidence.get(evidenceItem.candidateMerchantId) || [];
      current.push(evidenceItem);
      candidateEvidence.set(evidenceItem.candidateMerchantId, current);
    }
  }

  if (hostname) {
    for (const merchant of MERCHANT_INTELLIGENCE_REGISTRY) {
      const domains = [...merchant.websiteDomains, ...merchant.knownCheckoutDomains];
      for (const domain of domains) {
        const normalizedDomain = normalizeHost(domain);
        if (!normalizedDomain) continue;
        if (isSharedFamilyDomainOwnedByRoot(merchant, normalizedDomain)) continue;
        if (hostname === normalizedDomain) {
          addEvidence({
            type: "exact_canonical_domain",
            source: "hostname",
            matchedValue: normalizedDomain,
            candidateMerchantId: merchant.merchantId,
            weight: 0.9,
            reliability: "verified",
            effect: "supporting",
            explanation: `Hostname exactly matched ${merchant.displayName}.`,
          });
        } else if (hostname.endsWith(`.${normalizedDomain}`)) {
          addEvidence({
            type: "known_subdomain",
            source: "hostname",
            matchedValue: normalizedDomain,
            candidateMerchantId: merchant.merchantId,
            weight: 0.82,
            reliability: "strong",
            effect: "supporting",
            explanation: `Hostname is a known subdomain for ${merchant.displayName}.`,
          });
        }
      }
    }
  }

  for (const text of textSignals) {
    const descriptor = bestDescriptorMatch(text);
    if (descriptor) {
      addEvidence({
        type: "billing_descriptor",
        source: "merchant_text",
        matchedValue: descriptor.alias,
        candidateMerchantId: descriptor.merchant.merchantId,
        weight: 0.88,
        reliability: "verified",
        effect: "supporting",
        explanation: `Known billing descriptor matched ${descriptor.merchant.displayName}.`,
      });
    }
    const alias = bestAliasMatch(text);
    if (alias) {
      addEvidence({
        type: "exact_merchant_alias",
        source: "merchant_text",
        matchedValue: alias.alias,
        candidateMerchantId: alias.merchant.merchantId,
        weight: 0.78,
        reliability: "strong",
        effect: "supporting",
        explanation: `Known alias matched ${alias.merchant.displayName}.`,
      });
    }
    const categoryMatch = inferByCategory(text);
    if (categoryMatch) {
      addEvidence({
        type: "category_only_signal",
        source: "merchant_text",
        matchedValue: String(categoryMatch.category),
        candidateMerchantId: categoryMatch.merchantId,
        weight: 0.35,
        reliability: "weak",
        effect: "supporting",
        explanation: `Weak category text matched ${categoryMatch.displayName}.`,
      });
    }
  }

  for (const signal of safeInput.structuredData || []) {
    if (signal.type === "merchant_name" || signal.type === "organization") {
      const alias = bestAliasMatch(normalizeText(signal.value));
      if (alias) {
        addEvidence({
          type: "structured_data_merchant_name",
          source: signal.source || "structured_data",
          matchedValue: alias.alias,
          candidateMerchantId: alias.merchant.merchantId,
          weight: 0.8,
          reliability: "strong",
          effect: "supporting",
          explanation: `Structured merchant metadata matched ${alias.merchant.displayName}.`,
        });
      }
    }
  }

  const provider = checkoutProviderFrom([
    ...(safeInput.checkoutProviderSignals || []),
    ...(safeInput.domSignals || []).map((signal) => signal.value),
    hostname,
  ]);
  if (provider !== "unknown") {
    addEvidence({
      type: "checkout_provider_signal",
      source: "checkout_provider",
      matchedValue: provider,
      weight: 0.12,
      reliability: "medium",
      effect: "neutral",
      explanation: `${provider} identified as checkout provider, not purchase merchant.`,
    });
  }

  const candidates = buildMerchantCandidates(candidateEvidence);
  const conflicts = conflictingCandidateCount(candidates);
  const top = candidates[0] || null;
  const second = candidates[1] || null;
  const ambiguityMargin = 0.08;
  const ambiguous = Boolean(
    top &&
      second &&
      top.confidence >= 0.55 &&
      (Math.abs(top.confidence - second.confidence) < ambiguityMargin ||
        (second.confidence >= 0.65 && top.confidence - second.confidence < 0.18)),
  );
  const conflictPenalty = conflicts > 1 ? Math.min(0.2, (conflicts - 1) * 0.06) : 0;
  const ambiguityPenalty = ambiguous ? 0.18 : 0;
  const finalConfidence = clamp01((top?.confidence || 0) - conflictPenalty - ambiguityPenalty);
  const band = confidenceBand(finalConfidence);
  const resolvedMerchant =
    !ambiguous && top && finalConfidence >= 0.6 ? findMerchant(top.merchantId) : null;
  const resolutionStatus: MerchantResolutionStatus = resolvedMerchant
    ? "resolved"
    : ambiguous
      ? "ambiguous"
      : "unknown";

  const context = contextForMerchant(
    resolvedMerchant,
    safeInput,
    provider,
    textSignals,
  );
  const classification = classificationForMerchant(
    resolvedMerchant,
    context,
    finalConfidence,
    top,
    safeInput,
  );
  const warnings = merchantWarnings({
    resolutionStatus,
    finalConfidence,
    provider,
    candidates,
    input: safeInput,
  });

  return {
    identity: resolvedMerchant
      ? {
          merchantId: resolvedMerchant.merchantId,
          canonicalName: resolvedMerchant.canonicalName,
          displayName: resolvedMerchant.displayName,
          merchantFamilyId: resolvedMerchant.merchantGroup || undefined,
        }
      : null,
    context,
    classification,
    confidence: { score: finalConfidence, band },
    evidence,
    alternatives: candidates.slice(1, 4),
    trace: {
      inputSummary: {
        hasUrl: Boolean(safeInput.url),
        hostname: hostname || undefined,
        pageTitle: safeInput.pageTitle,
        documentTextSignalCount: safeInput.documentTextSignals?.length || 0,
        structuredDataCount: safeInput.structuredData?.length || 0,
        domSignalCount: safeInput.domSignals?.length || 0,
        checkoutProviderSignalCount: safeInput.checkoutProviderSignals?.length || 0,
        checkoutStage: safeInput.checkoutStage,
      },
      normalizedHostname: hostname || undefined,
      registryCandidates: candidates,
      aliasMatches: evidence
        .filter((item) => item.type === "exact_merchant_alias" || item.type === "billing_descriptor")
        .map((item) => ({
          merchantId: item.candidateMerchantId || "unknown",
          alias: item.matchedValue || "",
          evidenceId: item.evidenceId,
        })),
      categoryResolution: {
        category: String(classification.primaryCategory),
        source: classification.source,
        confidence: classification.classificationConfidence,
      },
      channelResolution: {
        purchaseChannel: context.purchaseChannel,
        commerceModel: context.commerceModel,
      },
      marketplaceResolution: context.marketplace,
      confidenceCalculation: {
        topScore: top?.confidence || 0,
        secondScore: second?.confidence || 0,
        conflictPenalty,
        ambiguityPenalty,
        finalConfidence,
        band,
      },
      finalResolution: {
        status: resolutionStatus,
        merchantId: resolvedMerchant?.merchantId,
        reason: resolvedMerchant
          ? "Resolved with sufficient deterministic evidence."
          : ambiguous
            ? "Multiple merchant candidates were too close to resolve safely."
            : "No deterministic merchant evidence reached the resolution threshold.",
      },
      warnings,
    },
    registryVersion: MERCHANT_INTELLIGENCE_REGISTRY_VERSION,
    resolutionStatus,
  };
}

export function merchantDecisionInputAdapter(
  result: MerchantIntelligenceResult,
): {
  merchant: string | null;
  hostname: string | null;
  category: string | null;
  purchaseChannel: MerchantPurchaseChannel;
} {
  return {
    merchant: result.identity?.displayName || null,
    hostname: result.trace.normalizedHostname || null,
    category:
      result.classification.primaryCategory === "unknown"
        ? null
        : String(result.classification.primaryCategory),
    purchaseChannel: result.context.purchaseChannel,
  };
}

export function validateMerchantRegistryQuality() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const merchantIds = new Set<string>();
  const aliases = new Map<string, string>();
  const domains = new Map<string, string>();
  for (const record of MERCHANT_INTELLIGENCE_REGISTRY) {
    if (merchantIds.has(record.merchantId)) {
      errors.push(`duplicate merchantId: ${record.merchantId}`);
    }
    merchantIds.add(record.merchantId);
    if (!record.active) warnings.push(`inactive merchant ignored: ${record.merchantId}`);
    if (!record.createdAt || Number.isNaN(Date.parse(record.createdAt))) {
      errors.push(`invalid createdAt for ${record.merchantId}`);
    }
    if (!record.updatedAt || Number.isNaN(Date.parse(record.updatedAt))) {
      errors.push(`invalid updatedAt for ${record.merchantId}`);
    }
    if (record.knownAliases.length === 0) {
      errors.push(`missing aliases for ${record.merchantId}`);
    }
    for (const alias of record.knownAliases) {
      const normalized = normalizeText(alias);
      if (!normalized) errors.push(`empty normalized alias for ${record.merchantId}`);
      const owner = aliases.get(normalized);
      if (owner && owner !== record.merchantId) {
        errors.push(`alias collision: ${normalized} (${owner}, ${record.merchantId})`);
      }
      aliases.set(normalized, record.merchantId);
    }
    for (const domain of [...record.websiteDomains, ...record.knownCheckoutDomains]) {
      const normalized = normalizeHost(domain);
      if (!normalized || normalized.includes("*")) {
        errors.push(`invalid domain for ${record.merchantId}: ${domain}`);
      }
      const owner = domains.get(normalized);
      if (
        owner &&
        owner !== record.merchantId &&
        !isAllowedSharedDomain(owner, record.merchantId, normalized)
      ) {
        errors.push(`domain collision: ${normalized} (${owner}, ${record.merchantId})`);
      }
      domains.set(normalized, record.merchantId);
    }
    for (const rel of record.relationships) {
      if (!findMerchant(rel.merchantId)) {
        errors.push(`missing family reference ${rel.merchantId} from ${record.merchantId}`);
      }
    }
  }
  return {
    ok: errors.length === 0,
    registryVersion: MERCHANT_INTELLIGENCE_REGISTRY_VERSION,
    merchantCount: MERCHANT_INTELLIGENCE_REGISTRY.length,
    errors,
    warnings,
  };
}

function isAllowedSharedDomain(ownerId: string, candidateId: string, domain: string) {
  const owner = findMerchant(ownerId);
  const candidate = findMerchant(candidateId);
  if (!owner || !candidate) return false;
  const sameFamily =
    owner.merchantGroup &&
    candidate.merchantGroup &&
    owner.merchantGroup === candidate.merchantGroup;
  if (!sameFamily) return false;
  const root = findMerchant(owner.merchantGroup || "");
  return Boolean(
    root &&
      [...root.websiteDomains, ...root.knownCheckoutDomains]
        .map(normalizeHost)
        .includes(domain),
  );
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
      if (text === normalized || containsNormalizedPhrase(text, normalized)) {
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

function containsNormalizedPhrase(text: string, phrase: string) {
  if (!text || !phrase) return false;
  const escaped = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHost(value?: string | null) {
  if (!value) return "";
  try {
    const parsed = value.includes("://") ? new URL(value).hostname : value;
    return parsed
      .replace(/\.$/g, "")
      .replace(/:\d+$/g, "")
      .replace(/^(?:www|m)\./i, "")
      .toLowerCase();
  } catch {
    return value
      .replace(/\.$/g, "")
      .replace(/:\d+$/g, "")
      .replace(/^(?:www|m)\./i, "")
      .toLowerCase();
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
    supportedPaymentMethods: input.supportedPaymentMethods || defaultPaymentMethodsFor(input),
    loyaltyPrograms: input.loyaltyPrograms || defaultLoyaltyProgramsFor(input),
    merchantTags: input.merchantTags || defaultMerchantTagsFor(input),
    merchantMetadata: input.merchantMetadata || {},
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

function defaultPaymentMethodsFor(input: Partial<CanonicalMerchant>) {
  const methods = new Set(["credit_card", "debit_card"]);
  const text = `${input.displayName || ""} ${input.category || ""} ${input.validationCategory || ""}`.toLowerCase();
  if (/amazon|target|walmart|apple|best buy|nike|costco|lululemon/.test(text)) {
    methods.add("gift_card");
  }
  if (/apple/.test(text)) methods.add("apple_pay");
  if (/travel|airline|hotel|restaurant|coffee|delivery|retail|online|department|electronics|apparel/.test(text)) {
    methods.add("paypal");
  }
  return Array.from(methods);
}

function defaultLoyaltyProgramsFor(input: Partial<CanonicalMerchant>) {
  const displayName = String(input.displayName || "").toLowerCase();
  const programs: Record<string, string> = {
    amazon: "Amazon Prime",
    target: "Target Circle",
    starbucks: "Starbucks Rewards",
    delta: "Delta SkyMiles",
    united: "MileagePlus",
    southwest: "Rapid Rewards",
    marriott: "Marriott Bonvoy",
    hilton: "Hilton Honors",
    airbnb: "Airbnb",
    costco: "Costco Membership",
    walmart: "Walmart Rewards",
  };
  return Object.entries(programs)
    .filter(([token]) => displayName.includes(token))
    .map(([, program]) => program);
}

function defaultMerchantTagsFor(input: Partial<CanonicalMerchant>) {
  return Array.from(
    new Set(
      [
        input.validationCategory,
        input.category,
        input.subcategory,
        input.merchantType,
        input.parentCompany ? "parent_company_known" : null,
        input.knownMccs?.length ? "mcc_known" : null,
        input.knownAliases?.length ? "aliases_known" : null,
      ]
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  );
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

function isSharedFamilyDomainOwnedByRoot(
  merchant: CanonicalMerchant,
  normalizedDomain: string,
) {
  if (!merchant.merchantGroup || merchant.merchantId === merchant.merchantGroup) {
    return false;
  }
  return MERCHANT_INTELLIGENCE_REGISTRY.some(
    (candidate) =>
      candidate.merchantId === merchant.merchantGroup &&
      [...candidate.websiteDomains, ...candidate.knownCheckoutDomains]
        .map(normalizeHost)
        .includes(normalizedDomain),
  );
}

function sanitizeMerchantIntelligenceInput(
  input: MerchantIntelligenceInput,
): MerchantIntelligenceInput {
  return {
    url: sanitizeUrl(input.url),
    hostname: sanitizeScalar(input.hostname, 128),
    pageTitle: sanitizeScalar(input.pageTitle, 160),
    detectedMerchantLabel: sanitizeScalar(input.detectedMerchantLabel, 120),
    documentTextSignals: sanitizeSignalList(input.documentTextSignals, 12, 120),
    checkoutProviderSignals: sanitizeSignalList(
      input.checkoutProviderSignals,
      12,
      80,
    ),
    structuredData: (input.structuredData || [])
      .slice(0, 12)
      .map((signal) => ({
        type: signal.type,
        value: sanitizeScalar(signal.value, 120),
        source: sanitizeScalar(signal.source, 60),
      }))
      .filter((signal) => Boolean(signal.value)),
    domSignals: (input.domSignals || [])
      .slice(0, 20)
      .map((signal) => ({
        type: signal.type,
        value: sanitizeScalar(signal.value, 100),
        source: sanitizeScalar(signal.source, 60),
      }))
      .filter((signal) => Boolean(signal.value)),
    purchaseChannelHint: input.purchaseChannelHint,
    checkoutStage: sanitizeScalar(input.checkoutStage, 40),
    transactionDate:
      input.transactionDate && !Number.isNaN(Date.parse(input.transactionDate))
        ? input.transactionDate
        : new Date().toISOString(),
  };
}

function sanitizeUrl(value: string) {
  try {
    const parsed = new URL(String(value || ""));
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "";
  }
}

function sanitizeSignalList(
  values: string[] | undefined,
  maxCount: number,
  maxLength: number,
) {
  return Array.from(
    new Set((values || []).map((value) => sanitizeScalar(value, maxLength))),
  )
    .filter((value) => Boolean(value))
    .slice(0, maxCount);
}

function sanitizeScalar(value: unknown, maxLength: number) {
  const text = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(
      /\b(?:\d[ -]*?){12,19}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[redacted]",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

function buildMerchantCandidates(
  candidateEvidence: Map<string, MerchantEvidence[]>,
): MerchantCandidate[] {
  return Array.from(candidateEvidence.entries())
    .map(([merchantId, evidence]) => {
      const supporting = evidence.filter((item) => item.effect === "supporting");
      const conflicting = evidence.filter((item) => item.effect === "conflicting");
      const score = clamp01(
        1 -
          supporting.reduce(
            (remaining, item) => remaining * (1 - item.weight),
            1,
          ) -
          Math.min(0.25, conflicting.length * 0.08),
      );
      const merchant = findMerchant(merchantId);
      return {
        merchantId,
        canonicalName: merchant?.canonicalName || merchantId,
        score,
        confidence: score,
        supportingEvidenceIds: supporting.map((item) => item.evidenceId),
        conflictingEvidenceIds: conflicting.map((item) => item.evidenceId),
        category: merchant?.category,
      };
    })
    .sort((a, b) => b.confidence - a.confidence || a.merchantId.localeCompare(b.merchantId));
}

function conflictingCandidateCount(candidates: MerchantCandidate[]) {
  return candidates.filter((candidate) => candidate.confidence >= 0.45).length;
}

function confidenceBand(value: number): MerchantConfidenceBand {
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  if (value > 0) return "low";
  return "unknown";
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function contextForMerchant(
  merchant: CanonicalMerchant | null,
  input: MerchantIntelligenceInput,
  checkoutProvider: CheckoutProvider,
  textSignals: string[],
): MerchantContext {
  const joined = textSignals.join(" ");
  const marketplace =
    merchant?.merchantType === "marketplace" ||
    /marketplace|seller|fulfilled by|third party|mktp/.test(joined);
  const purchaseChannel =
    input.purchaseChannelHint ||
    (/portal/.test(joined)
      ? "travel_portal"
      : marketplace
        ? "online_direct"
        : /subscription|recurring/.test(joined)
          ? "subscription"
          : "online_direct");
  const commerceModel: CommerceModel = marketplace
    ? "marketplace"
    : /delivery/.test(joined)
      ? "delivery"
      : /pickup/.test(joined)
        ? "pickup"
        : /subscription|recurring/.test(joined)
          ? "subscription"
          : "direct";
  return {
    category: merchant?.category || "unknown",
    subcategory: merchant?.subcategory,
    purchaseChannel,
    commerceModel,
    marketplace: {
      isMarketplace: marketplace,
      platformMerchantId: marketplace ? merchant?.merchantId : undefined,
      sellerConfidence: marketplace ? 0.4 : undefined,
    },
    checkoutProvider,
  };
}

function classificationForMerchant(
  merchant: CanonicalMerchant | null,
  context: MerchantContext,
  confidence: number,
  candidate: MerchantCandidate | null,
  input: MerchantIntelligenceInput,
): MerchantClassification {
  if (!merchant) {
    return {
      primaryCategory: "unknown",
      secondaryCategories: [],
      source: input.detectedMerchantLabel ? "inferred_fallback" : "unknown",
      classificationConfidence: 0,
    };
  }
  const source: MerchantClassification["source"] =
    candidate?.supportingEvidenceIds.length && confidence >= 0.85
      ? "verified_registry_mapping"
      : "inferred_fallback";
  return {
    primaryCategory: context.category,
    secondaryCategories: merchant.categoryIds
      .map((id) => findCategory(id)?.displayName || id)
      .filter((value) => normalizeText(value) !== normalizeText(context.category)),
    subcategory: merchant.subcategory,
    source,
    classificationConfidence: confidence,
  };
}

function checkoutProviderFrom(values: Array<string | undefined>) {
  const text = normalizeText(values.filter(Boolean).join(" "));
  if (!text) return "unknown";
  if (/\bshopify\b/.test(text)) return "shopify";
  if (/\bstripe\b/.test(text)) return "stripe_checkout";
  if (/\bpaypal\b/.test(text)) return "paypal";
  if (/\bshop pay\b|\bshoppay\b/.test(text)) return "shop_pay";
  if (/\bamazon pay\b/.test(text)) return "amazon_pay";
  return "merchant_native";
}

function merchantWarnings(input: {
  resolutionStatus: MerchantResolutionStatus;
  finalConfidence: number;
  provider: CheckoutProvider;
  candidates: MerchantCandidate[];
  input: MerchantIntelligenceInput;
}) {
  const warnings: string[] = [];
  if (input.resolutionStatus === "unknown") {
    warnings.push("merchant_identity_unknown");
  }
  if (input.resolutionStatus === "ambiguous") {
    warnings.push("merchant_identity_ambiguous");
  }
  if (input.finalConfidence < 0.85) {
    warnings.push("merchant_specific_benefits_require_caution");
  }
  if (input.provider !== "unknown" && !input.candidates.length) {
    warnings.push("checkout_provider_is_not_merchant");
  }
  if ((input.input.documentTextSignals || []).length > 10) {
    warnings.push("merchant_signal_payload_capped");
  }
  return warnings;
}
