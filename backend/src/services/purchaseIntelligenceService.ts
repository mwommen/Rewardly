import type {
  Purchase,
  PurchaseCategory,
  PurchaseConfidenceLabel,
  PurchaseItem,
  RecommendationPurchaseContext,
} from "../../../packages/rewardly-core/src";

export type CheckoutProvider =
  | "amazon"
  | "apple"
  | "best_buy"
  | "costco"
  | "home_depot"
  | "lowes"
  | "nike"
  | "target"
  | "walmart"
  | "generic"
  | "unknown";

export type RawCheckoutItem = {
  name?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  brand?: string | null;
  category?: string | null;
};

export type RawCheckoutData = {
  merchantId?: string | null;
  merchantName?: string | null;
  hostname?: string | null;
  url?: string | null;
  title?: string | null;
  visibleText?: string | null;
  checkoutProvider?: string | null;
  subtotal?: number | string | null;
  tax?: number | string | null;
  shipping?: number | string | null;
  discounts?: number | string | null;
  total?: number | string | null;
  currency?: string | null;
  items?: RawCheckoutItem[];
};

export type PurchaseExtractionReport = {
  purchase: Purchase;
  performance: {
    purchaseExtractionMs: number;
    categoryClassificationMs: number;
    totalMs: number;
    withinTargets: boolean;
  };
  warnings: string[];
  adapterId: CheckoutProvider;
};

export type MerchantCheckoutAdapter = {
  adapterId: CheckoutProvider;
  merchantIds: string[];
  domains: string[];
  extract(raw: RawCheckoutData): RawCheckoutData;
};

export const PURCHASE_PERFORMANCE_TARGETS = {
  purchaseExtractionMs: 300,
  categoryClassificationMs: 150,
  recommendationPipelineMs: 1000,
};

export const MATERIAL_MIXED_CART_SHARE_THRESHOLD = 0.2;
export const MATERIAL_EXCLUDED_SHARE_THRESHOLD = 0.05;

export const CHECKOUT_ADAPTERS: MerchantCheckoutAdapter[] = [
  adapter("amazon", ["amazon"], ["amazon.com"]),
  adapter("target", ["target"], ["target.com"]),
  adapter("costco", ["costco"], ["costco.com"]),
  adapter("best_buy", ["best-buy", "best buy"], ["bestbuy.com"]),
  adapter("apple", ["apple"], ["apple.com"]),
  adapter("nike", ["nike"], ["nike.com"]),
  adapter("walmart", ["walmart"], ["walmart.com"]),
  adapter("home_depot", ["home-depot", "home depot"], ["homedepot.com"]),
  adapter("lowes", ["lowes", "lowe's"], ["lowes.com"]),
  adapter("generic", [], []),
];

export function extractPurchaseIntelligence(raw: RawCheckoutData): PurchaseExtractionReport {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const adapterRecord = selectCheckoutAdapter(raw);
  const adapted = adapterRecord.extract(raw);
  const extractionMs = Math.max(1, Date.now() - startedAt);
  const classificationStartedAt = Date.now();
  const items = normalizeItems(adapted, warnings);
  const classificationMs = Math.max(1, Date.now() - classificationStartedAt);
  const totals = normalizeTotals(adapted, items, warnings);
  const confidenceScore = purchaseConfidenceScore({
    itemCount: items.length,
    hasTotal: totals.total !== null,
    hasSubtotal: totals.subtotal !== null,
    hasProvider: adapterRecord.adapterId !== "unknown",
    warnings,
    itemConfidence: items.length
      ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
      : 0,
  });
  const extractedAt = new Date().toISOString();
  const purchase: Purchase = {
    purchaseId: stableId("purchase", [
      adapted.merchantId || adapted.merchantName || adapted.hostname,
      totals.total,
      items.map((item) => item.name).join("|"),
    ]),
    merchantId: adapted.merchantId || normalizedMerchantId(adapted.merchantName || adapted.hostname),
    subtotal: totals.subtotal,
    tax: totals.tax,
    shipping: totals.shipping,
    discounts: totals.discounts,
    total: totals.total,
    currency: adapted.currency || "USD",
    checkoutProvider: adapterRecord.adapterId,
    confidence: {
      score: confidenceScore,
      label: confidenceLabel(confidenceScore),
    },
    items,
    categoryDistribution: calculateCategoryDistribution(items, totals.subtotal ?? totals.total),
    exclusions: Array.from(new Set(items.flatMap((item) => item.exclusions))),
    extractedAt,
  };
  const totalMs = Math.max(1, Date.now() - startedAt);
  return {
    purchase,
    performance: {
      purchaseExtractionMs: extractionMs,
      categoryClassificationMs: classificationMs,
      totalMs,
      withinTargets:
        extractionMs <= PURCHASE_PERFORMANCE_TARGETS.purchaseExtractionMs &&
        classificationMs <= PURCHASE_PERFORMANCE_TARGETS.categoryClassificationMs &&
        totalMs <= PURCHASE_PERFORMANCE_TARGETS.recommendationPipelineMs,
    },
    warnings,
    adapterId: adapterRecord.adapterId,
  };
}

export function classifyPurchaseItem(raw: RawCheckoutItem, merchantCategory?: string | null): PurchaseItem {
  const name = String(raw.name || "Unknown item").trim();
  const classification = classifyName(name, raw.category || merchantCategory || null);
  const price = money(raw.price);
  const quantity = Math.max(1, Math.floor(Number(raw.quantity || 1) || 1));
  const exclusions = exclusionsFor(name, classification.normalizedCategory);
  const confidence = itemConfidence(name, price, classification.confidence);
  return {
    itemId: stableId("item", [name, quantity, price, raw.brand]),
    name,
    quantity,
    price,
    category: raw.category || null,
    merchantCategory: merchantCategory || null,
    normalizedCategory: classification.normalizedCategory,
    recommendationCategory: classification.recommendationCategory,
    brand: raw.brand || inferBrand(name),
    digitalOrPhysical: digitalOrPhysical(name, classification.normalizedCategory),
    exclusions,
    confidence,
  };
}

export function calculateCategoryDistribution(
  items: PurchaseItem[],
  totalAmount?: number | null,
): Purchase["categoryDistribution"] {
  if (!items.length) return [];
  const fallbackAmount = totalAmount !== null && totalAmount !== undefined ? totalAmount / items.length : null;
  const totals = new Map<PurchaseCategory, { count: number; amount: number | null }>();
  for (const item of items) {
    const current = totals.get(item.normalizedCategory) || { count: 0, amount: 0 };
    const itemAmount =
      typeof item.price === "number" ? item.price * item.quantity : fallbackAmount;
    totals.set(item.normalizedCategory, {
      count: current.count + 1,
      amount:
        current.amount === null || itemAmount === null
          ? null
          : current.amount + itemAmount,
    });
  }
  const denominator =
    Array.from(totals.values()).reduce((sum, value) => sum + (value.amount || 0), 0) ||
    totalAmount ||
    items.length;
  return Array.from(totals.entries())
    .map(([normalizedCategory, value]) => ({
      normalizedCategory,
      itemCount: value.count,
      estimatedAmount:
        typeof value.amount === "number" ? round(value.amount) : null,
      share:
        typeof value.amount === "number"
          ? round(value.amount / denominator, 4)
          : round(value.count / items.length, 4),
    }))
    .sort((a, b) => b.share - a.share);
}

export function selectCheckoutAdapter(raw: RawCheckoutData): MerchantCheckoutAdapter {
  const merchantText = [
    raw.checkoutProvider,
    raw.merchantId,
    raw.merchantName,
    raw.hostname,
    raw.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    CHECKOUT_ADAPTERS.find(
      (item) =>
        item.adapterId !== "generic" &&
        [...item.merchantIds, ...item.domains].some((token) =>
          merchantText.includes(token),
        ),
    ) || CHECKOUT_ADAPTERS.find((item) => item.adapterId === "generic")!
  );
}

export function buildPurchaseIntelligenceReport(raw: RawCheckoutData) {
  const extraction = extractPurchaseIntelligence(raw);
  const recommendationPurchaseContext = toRecommendationPurchaseContext(extraction.purchase);
  return {
    ...extraction,
    recommendationPurchaseContext,
    summary: {
      itemCount: extraction.purchase.items.length,
      dominantCategory: recommendationPurchaseContext.dominantCategory || "unknown",
      hasGiftCard: recommendationPurchaseContext.hasGiftCard,
      hasDigitalGoods: recommendationPurchaseContext.hasDigitalGoods,
      materiallyMixed: recommendationPurchaseContext.materiallyMixed,
      confidence: extraction.purchase.confidence,
    },
  };
}

export function toRecommendationPurchaseContext(
  purchase: Purchase,
): RecommendationPurchaseContext {
  const dominant = purchase.categoryDistribution[0] || null;
  const excludedCategories = new Set(["gift_card"]);
  const excludedAmount = purchase.categoryDistribution
    .filter((item) => excludedCategories.has(item.normalizedCategory))
    .reduce((sum, item) => sum + (item.estimatedAmount || 0), 0);
  const excludedShare = purchase.categoryDistribution
    .filter((item) => excludedCategories.has(item.normalizedCategory))
    .reduce((sum, item) => sum + item.share, 0);
  const nonDominantMaterial = purchase.categoryDistribution
    .slice(1)
    .some((item) => item.share >= MATERIAL_MIXED_CART_SHARE_THRESHOLD);
  const materiallyMixed =
    nonDominantMaterial || excludedShare >= MATERIAL_EXCLUDED_SHARE_THRESHOLD;
  const hasGiftCard = purchase.exclusions.includes("gift_card");
  const hasCashEquivalent = purchase.exclusions.includes("cash_equivalent");
  const hasSubscription =
    purchase.exclusions.includes("subscription") ||
    purchase.items.some((item) => item.normalizedCategory === "subscription");
  const hasDigitalGoods = purchase.items.some(
    (item) => item.digitalOrPhysical === "digital",
  );
  const eligibleAmount =
    purchase.total === null
      ? null
      : Math.max(0, round(purchase.total - excludedAmount));
  return {
    dominantCategory: dominant?.normalizedCategory || null,
    categoryDistribution: purchase.categoryDistribution.map((item) => ({
      normalizedCategory: item.normalizedCategory,
      estimatedAmount: item.estimatedAmount,
      share: item.share,
    })),
    exclusions: purchase.exclusions,
    confidenceScore: purchase.confidence.score,
    confidenceLabel: purchase.confidence.label,
    hasGiftCard,
    hasCashEquivalent,
    hasDigitalGoods,
    hasSubscription,
    total: purchase.total,
    eligibleAmount,
    materiallyMixed,
    mixedCartThreshold: MATERIAL_MIXED_CART_SHARE_THRESHOLD,
    refinement: refinementFor({
      confidenceLabel: purchase.confidence.label,
      materiallyMixed,
      hasGiftCard,
      hasCashEquivalent,
    }),
  };
}

export function purchaseFixture(name: string): RawCheckoutData {
  const fixtures: Record<string, RawCheckoutData> = {
    "amazon-electronics": {
      merchantId: "amazon",
      merchantName: "Amazon",
      hostname: "www.amazon.com",
      checkoutProvider: "amazon",
      subtotal: 999,
      tax: 82.42,
      shipping: 0,
      discounts: 50,
      total: 1031.42,
      items: [{ name: "Apple MacBook Air laptop", quantity: 1, price: 999 }],
    },
    "amazon-groceries": {
      merchantId: "amazon",
      merchantName: "Amazon",
      subtotal: 42,
      tax: 1.25,
      shipping: 0,
      total: 43.25,
      items: [{ name: "Whole Foods organic groceries", quantity: 1, price: 42 }],
    },
    "amazon-gift-card": {
      merchantId: "amazon",
      merchantName: "Amazon",
      subtotal: 50,
      total: 50,
      items: [{ name: "Amazon.com Gift Card", quantity: 1, price: 50 }],
    },
    apple: {
      merchantId: "apple",
      merchantName: "Apple",
      hostname: "apple.com",
      subtotal: 799,
      tax: 65.92,
      shipping: 0,
      total: 864.92,
      items: [{ name: "iPhone 16", quantity: 1, price: 799, brand: "Apple" }],
    },
    "best-buy-electronics": {
      merchantId: "best-buy",
      merchantName: "Best Buy",
      subtotal: 399,
      tax: 32.92,
      shipping: 0,
      total: 431.92,
      items: [{ name: "Sony noise cancelling headphones", quantity: 1, price: 399 }],
    },
    "target-groceries": {
      merchantId: "target",
      merchantName: "Target",
      subtotal: 68,
      tax: 2.4,
      shipping: 0,
      total: 70.4,
      items: [{ name: "Milk eggs bread groceries", quantity: 1, price: 68 }],
    },
    mixed: {
      merchantId: "amazon",
      merchantName: "Amazon",
      subtotal: 1149,
      tax: 89.9,
      shipping: 0,
      discounts: 20,
      total: 1218.9,
      items: [
        { name: "Lenovo laptop", quantity: 1, price: 899 },
        { name: "Amazon Gift Card", quantity: 1, price: 100 },
        { name: "Monthly streaming subscription", quantity: 1, price: 20 },
        { name: "Organic groceries", quantity: 2, price: 65 },
      ],
    },
    unknown: {
      merchantName: "Unknown Merchant",
      total: 25,
      visibleText: "Order total $25",
      items: [{ name: "Mystery item", quantity: 1, price: 25 }],
    },
  };
  return fixtures[name] || fixtures.unknown;
}

function normalizeItems(raw: RawCheckoutData, warnings: string[]) {
  const rawItems = raw.items?.length ? raw.items : inferItemsFromText(raw.visibleText || "");
  if (!rawItems.length) warnings.push("items_not_detected");
  return rawItems.map((item) => classifyPurchaseItem(item, raw.merchantName || raw.merchantId || null));
}

function normalizeTotals(raw: RawCheckoutData, items: PurchaseItem[], warnings: string[]) {
  const itemSubtotal = items.reduce(
      (sum, item) => sum + (typeof item.price === "number" ? item.price * item.quantity : 0),
      0,
    );
  const subtotal = money(raw.subtotal) ?? (itemSubtotal || null);
  const tax = money(raw.tax);
  const shipping = money(raw.shipping);
  const discounts = money(raw.discounts);
  const total =
    money(raw.total) ??
    (subtotal !== null
      ? round(subtotal + (tax || 0) + (shipping || 0) - (discounts || 0))
      : null);
  if (total === null) warnings.push("total_not_detected");
  return { subtotal, tax, shipping, discounts, total };
}

function classifyName(name: string, merchantCategory?: string | null): {
  normalizedCategory: PurchaseCategory;
  recommendationCategory: string;
  confidence: number;
} {
  const text = `${name} ${merchantCategory || ""}`.toLowerCase();
  if (/gift\s*card|e-gift|egift/.test(text)) return cls("gift_card", "Excluded or special purchase", 0.95);
  if (/subscription|monthly|prime video|audible|streaming|netflix|spotify/.test(text)) return cls("subscription", "Subscription", 0.9);
  if (/download|digital|ebook|kindle|app store|icloud|software/.test(text)) return cls("digital_goods", "Digital purchase", 0.88);
  if (/flight|hotel|airline|rental car|booking|trip|travel/.test(text)) return cls("travel", "Travel purchase", 0.9);
  if (/grocery|groceries|whole foods|milk|eggs|bread|organic|produce/.test(text)) return cls("groceries", "Groceries", 0.88);
  if (/laptop|iphone|ipad|macbook|headphone|tv|camera|computer|electronics|console|phone/.test(text)) return cls("electronics", "Technology purchase", 0.92);
  if (/restaurant|dining|doordash|uber eats|coffee|pizza|burger/.test(text)) return cls("restaurant", "Dining purchase", 0.9);
  if (/fuel|gasoline|gas station/.test(text)) return cls("fuel", "Fuel purchase", 0.88);
  if (/pharmacy|drugstore|prescription|cvs|walgreens/.test(text)) return cls("pharmacy", "Pharmacy purchase", 0.86);
  if (/home depot|lowe|tool|hardware|appliance|paint|lumber/.test(text)) return cls("home_improvement", "Home improvement", 0.86);
  if (/shoe|shirt|jacket|nike|apparel|clothing|lululemon/.test(text)) return cls("apparel", "Apparel purchase", 0.84);
  return cls("unknown", "General purchase", 0.38);
}

function cls(normalizedCategory: PurchaseCategory, recommendationCategory: string, confidence: number) {
  return { normalizedCategory, recommendationCategory, confidence };
}

function exclusionsFor(name: string, category: PurchaseCategory) {
  const text = name.toLowerCase();
  const exclusions: string[] = [];
  if (category === "gift_card") exclusions.push("gift_card");
  if (/cash equivalent|prepaid|reload/.test(text)) exclusions.push("cash_equivalent");
  if (category === "subscription") exclusions.push("subscription");
  return exclusions;
}

function digitalOrPhysical(name: string, category: PurchaseCategory): PurchaseItem["digitalOrPhysical"] {
  if (category === "digital_goods" || /download|digital|subscription|ebook|kindle/.test(name.toLowerCase())) return "digital";
  if (category === "subscription") return "digital";
  if (category === "unknown") return "unknown";
  return "physical";
}

function itemConfidence(name: string, price: number | null, classificationConfidence: number) {
  let score = classificationConfidence;
  if (name && name !== "Unknown item") score += 0.04;
  if (typeof price === "number") score += 0.04;
  return round(Math.min(0.99, score));
}

function purchaseConfidenceScore(input: {
  itemCount: number;
  hasTotal: boolean;
  hasSubtotal: boolean;
  hasProvider: boolean;
  warnings: string[];
  itemConfidence: number;
}) {
  let score = 0.25;
  if (input.itemCount) score += 0.22;
  if (input.hasTotal) score += 0.16;
  if (input.hasSubtotal) score += 0.12;
  if (input.hasProvider) score += 0.1;
  score += input.itemConfidence * 0.25;
  score -= input.warnings.length * 0.08;
  if (input.itemCount && input.itemConfidence < 0.5) score = Math.min(score, 0.6);
  return round(Math.max(0.05, Math.min(0.99, score)));
}

function confidenceLabel(score: number): PurchaseConfidenceLabel {
  if (score >= 0.82) return "high";
  if (score >= 0.62) return "medium";
  if (score >= 0.35) return "low";
  return "unknown";
}

function refinementFor(input: {
  confidenceLabel: PurchaseConfidenceLabel;
  materiallyMixed: boolean;
  hasGiftCard: boolean;
  hasCashEquivalent: boolean;
}): RecommendationPurchaseContext["refinement"] {
  if (input.confidenceLabel === "low" || input.confidenceLabel === "unknown") {
    return "low_confidence_fallback";
  }
  if (input.materiallyMixed || input.hasGiftCard || input.hasCashEquivalent) {
    return "mixed_cart_fallback";
  }
  return input.confidenceLabel === "high"
    ? "purchase_refined"
    : "merchant_based";
}

function inferItemsFromText(text: string): RawCheckoutItem[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 4 && line.length < 120);
  return lines
    .filter((line) => /\$[0-9]/.test(line))
    .slice(0, 8)
    .map((line) => ({
      name: line.replace(/\$[0-9,]+(?:\.[0-9]{2})?.*$/, "").trim(),
      price: line.match(/\$([0-9,]+(?:\.[0-9]{2})?)/)?.[1] || null,
    }));
}

function inferBrand(name: string) {
  const brands = ["Apple", "Sony", "Samsung", "Nike", "Lenovo", "Amazon", "Microsoft", "Dell"];
  const found = brands.find((brand) => new RegExp(`\\b${brand}\\b`, "i").test(name));
  return found || null;
}

function adapter(adapterId: CheckoutProvider, merchantIds: string[], domains: string[]): MerchantCheckoutAdapter {
  return {
    adapterId,
    merchantIds,
    domains,
    extract(raw) {
      return {
        ...raw,
        checkoutProvider: raw.checkoutProvider || adapterId,
        merchantId: raw.merchantId || merchantIds[0] || normalizedMerchantId(raw.merchantName || raw.hostname),
      };
    },
  };
}

function normalizedMerchantId(value?: string | null) {
  const normalized = String(value || "").toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || null;
}

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? round(value) : null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? round(parsed) : null;
}

function stableId(prefix: string, parts: Array<unknown>) {
  const seed = parts.map((part) => String(part || "")).join("|");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `${prefix}_${hash.toString(16)}`;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
