import { getDb } from "../db";
import { inferCategories } from "../utils/category";
import { toCashEquivalent } from "../utils/valuation";
import { collectCreditMatches } from "../utils/merchantMatching";
import { isLikelyJunkBenefitText } from "../scrapers/benefitsQuality";
import {
  canonicalizeCardBenefits,
  type CanonicalBenefitRecord,
  type PurchaseChannel,
} from "./benefitIntelligenceService";
import { isBenefitEligibleForRecommendation } from "./benefitEligibilityService";
import { scoreRecommendationConfidence } from "./recommendationConfidenceService";
import {
  inheritedCategoryTokens,
  inheritedMerchantTokens,
  resolveMerchant as resolveMerchantIdentity,
  type MerchantResolutionResult,
} from "./merchantIntelligenceService";
import {
  applyWalletUsageToBenefitValue,
  findWalletStateForBenefit,
  type CanonicalWalletBenefitState,
  type WalletBenefitUsageEvidence,
} from "./walletIntelligenceService";
import type {
  DecisionEvidenceItem,
  DecisionWarning,
  MissingInformation,
} from "./decisionIntelligenceService";
import type {
  PurchaseCategory,
  RecommendationPurchaseContext,
} from "../../../packages/rewardly-core/src";

type MatchTier = "exact_benefit" | "category_match" | "base_rate";
export type RecommendationScoringMode = "strict_production" | "compatibility";

// ---------- Perk cleaning (strong version) ----------
// ---------- Perk cleaning (strong version) ----------
const PERK_STOPWORDS = [
  // generic/legal
  "terms of service",
  "privacy",
  "do not sell",
  "adchoices",
  "security center",
  "card agreements",
  "site map",
  "financial education",
  // nav/cta
  "opens new",
  "open new",
  "in the same window",
  "view details",
  "see details",
  "learn more",
  "apply now",
  "limited time",
  "offer ends",
  // marketing fluff
  "popular credit cards",
  "our most popular",
  "more cash back",
  "more points",
  // cross-promo
  "credit card product page",
  "offers and promotions",
  // too generic
  "category page",
];

const STRIP_TMARKS = /[™®©]/g;

// Any line that matches these is discarded outright
const EXTRA_DISCARD_PATTERNS: RegExp[] = [
  // “X credit card product page in the same window”
  /\bcredit card product page\b/i,
  /\bin the same window\b/i,
  // Cross-promo lines referencing other cards (usually nav)
  /\b(chase|amex|american express|citi|discover)\b.*\b(freedom|unlimited|flex|sapphire|preferred|gold|platinum|blue|everyday|cash)\b.*\b(product page|window|offers?)\b/i,
  // Pure promo/collection lines
  /\b(popular (credit )?cards?)\b/i,
  /\boffers? and promotions?\b/i,
];

const KEEP_KEYWORDS = [
  "no foreign transaction fee",
  "global entry",
  "tsa precheck",
  "priority pass",
  "lounge access",
  "cell phone protection",
  "travel insurance",
  "trip delay",
  "trip cancellation",
  "baggage",
  "purchase protection",
  "extended warranty",
  "return protection",
  "rental car",
  "auto collision",
  "primary rental",
  "secondary rental",
  "doordash",
  "uber credit",
  "lyft",
  "instacart",
  "grubhub",
  "hotel credit",
  "airline credit",
  "travel credit",
  "statement credit",
  "points transfer",
  "transfer partners",
  "after $",
  "after you spend", // signup heuristic
  "0% intro",
  "intro apr",
  "priority boarding",
  "free checked bag",
  "no annual fee",
];

const REWARD_NUMBER = /\b(\d+(\.\d+)?)\s?(%|x)\b/i; // e.g., 5%, 3x
const NUM_WITH_CATEGORY =
  /\b(\d+(\.\d+)?)\s?(%|x).{0,25}\b(dining|restaurants|grocer|gas|travel|transit|drug|online)\b/i;

function scoreLine(s: string): number {
  const low = s.toLowerCase();
  let score = 0;

  // Hard filters
  if (PERK_STOPWORDS.some((sw) => low.includes(sw))) return -5;
  if (EXTRA_DISCARD_PATTERNS.some((rx) => rx.test(s))) return -5;
  if (low.startsWith("opens ") || low.startsWith("open ")) return -5;

  // De-marketing patterns
  if (/\b(popular|learn more|see details)\b/i.test(s)) score -= 2;
  if (isLikelyJunkBenefitText(s)) return -5;

  // Strong keep signals
  if (REWARD_NUMBER.test(s)) score += 2; // "5%", "3x"
  if (NUM_WITH_CATEGORY.test(s)) score += 2; // "5% on dining"
  if (KEEP_KEYWORDS.some((k) => low.includes(k))) score += 2;

  // Useful nouns
  if (
    /\b(protection|insurance|warranty|credit|transfer|lounge|entry|precheck|boarding|bag|rental)\b/i.test(
      s,
    )
  )
    score += 1;

  // Penalize legal-ish strings
  if (/\b(registered trademark|copyright)\b/i.test(s)) score -= 3;

  // Length sanity
  if (s.length < 8) score -= 1;
  if (s.length > 220) score -= 1;

  return score;
}

function normalizeLine(raw: string): string {
  return (
    raw
      .replace(STRIP_TMARKS, "")
      .replace(/\s+/g, " ")
      .trim()
      // trim leading verbs commonly used in nav copy
      .replace(/^(opens?|view|see)\s+/i, "")
      // remove trailing nav fragments if any slipped through
      .replace(/\s*(in the same window|credit card product page)\s*$/i, "")
  );
}

function isMostlyNavOrCTA(s: string): boolean {
  const low = s.toLowerCase();
  return (
    (/\b(opens?|view|see|apply|learn|shop|explore)\b/.test(low) &&
      !REWARD_NUMBER.test(s)) ||
    EXTRA_DISCARD_PATTERNS.some((rx) => rx.test(s))
  );
}

function cleanPerks(
  input: string[] | undefined,
  maxLen = 140,
  maxItems = 8,
): string[] {
  if (!input || !input.length) return [];
  const seen = new Set<string>();
  const candidates: { text: string; score: number }[] = [];

  for (let raw of input) {
    if (!raw) continue;
    let s = normalizeLine(String(raw));
    if (!s) continue;

    if (isMostlyNavOrCTA(s)) continue;

    const sLow = s.toLowerCase();
    if (seen.has(sLow)) continue;

    const sc = scoreLine(s);
    if (sc <= -3) continue; // strong discard

    if (s.length > maxLen) s = s.slice(0, maxLen - 1) + "…";

    candidates.push({ text: s, score: sc });
    seen.add(sLow);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxItems).map((c) => c.text);
}

function collectPerkMatches(
  perks: string[] | undefined,
  merchant: string,
): string[] {
  const term = String(merchant || "")
    .trim()
    .toLowerCase();
  if (!term || !Array.isArray(perks)) return [];
  return perks
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .filter((p) => p.toLowerCase().includes(term))
    .slice(0, 3);
}

function formatPeriodLabel(period: string | undefined): string {
  if (!period) return "";
  if (period === "semi-annual") return "every 6 months";
  return `per ${period}`;
}

function formatCreditPerks(credits: any[]): string[] {
  if (!credits.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const c of credits) {
    const labelBase = String(c?.label || "")
      .replace(/\s+/g, " ")
      .trim();
    const amount = Number.isFinite(c?.amountUSD) ? Number(c.amountUSD) : null;
    const period = formatPeriodLabel(c?.period);
    const enrollment = c?.requiresEnrollment ? "enrollment required" : "";

    let line = labelBase;
    if (!line && amount) line = `$${amount} statement credit`;
    if (line && period && !line.toLowerCase().includes(period)) {
      line = `${line} (${period})`;
    }
    if (line && enrollment && !line.toLowerCase().includes(enrollment)) {
      line = `${line} — ${enrollment}`;
    }

    const normalized = line.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

// ---------- Types ----------
type RewardEntry = {
  keys?: unknown[];
  rate: number | string;
  unit?: "cash" | "points" | "miles";
};
type RotatingQuarter = {
  start?: string;
  end?: string;
  activationRequired?: boolean;
  categories?: RewardEntry[];
};

function filterAllowedCards(cards: any[], allowedCardSlugs?: string[]): any[] {
  if (!Array.isArray(allowedCardSlugs)) return cards;
  const allowed = new Set(
    allowedCardSlugs
      .map((slug) =>
        String(slug || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
  if (!allowed.size) return [];
  return cards.filter((card) =>
    allowed.has(
      String(card?.slug || "")
        .trim()
        .toLowerCase(),
    ),
  );
}

// ---------- Categories / matching ----------
const CAT_SYNONYMS: Record<string, string[]> = {
  restaurants: [
    "restaurants",
    "dining",
    "food",
    "coffee",
    "cafes",
    "eating out",
  ],
  groceries: ["groceries", "grocery", "supermarket", "supermarkets"],
  gas: ["gas", "fuel", "gasoline"],
  transit: ["transit", "subway", "bus", "train", "metro", "public transport"],
  rideshare: ["rideshare", "uber", "lyft", "taxi", "ride share"],
  travel: [
    "travel",
    "airfare",
    "airlines",
    "hotels",
    "hotel",
    "car rental",
    "rental car",
  ],
  entertainment: ["entertainment", "movies", "theaters", "concerts", "events"],
  streaming: ["streaming", "digital entertainment"],
  drugstores: ["drugstores", "pharmacy", "pharmacies"],
  apparel: ["apparel", "clothing", "departmentstores", "department stores"],
  departmentstores: [
    "departmentstores",
    "department stores",
    "apparel",
    "clothing",
  ],
  online: ["online", "online_shopping", "ecommerce", "e-commerce"],
  online_shopping: ["online_shopping", "online", "ecommerce", "e-commerce"],
  other: ["other", "everything", "all", "base"],
};

const BROAD_CATEGORY_TERMS = new Set([
  "dining",
  "restaurants",
  "restaurant",
  "groceries",
  "grocery",
  "gas",
  "fuel",
  "travel",
  "streaming",
  "entertainment",
  "drugstores",
  "drugstore",
  "apparel",
  "clothing",
  "departmentstores",
  "department stores",
  "online",
  "online shopping",
]);

function isBroadCategoryQuery(merchant: string): boolean {
  const normalized = String(merchant || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return BROAD_CATEGORY_TERMS.has(normalized);
}

function expandCategories(cats: string[]): string[] {
  const out = new Set<string>();
  for (const c of cats.map((s) => String(s).toLowerCase())) {
    out.add(c);
    for (const [std, syns] of Object.entries(CAT_SYNONYMS)) {
      if (std === c || syns.includes(c)) {
        syns.concat([std]).forEach((k) => out.add(k));
      }
    }
  }
  return [...out];
}

function normalizeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function issuerDefaultsToPoints(issuer?: string): boolean {
  const s = String(issuer || "").toLowerCase();
  return (
    s.includes("chase") ||
    s.includes("american express") ||
    s.includes("amex") ||
    s.includes("citi")
  );
}

// ---------- Rate parsing ----------
function parseRateUnknown(
  x: number | string,
  issuer: string | undefined,
  unitHint?: "cash" | "points" | "miles",
): number {
  const isPointsContext = unitHint === "points" || unitHint === "miles";
  const toPoints = (n: number) =>
    toCashEquivalent(unitHint ?? "points", n, issuer ?? "other");
  const asPercent = (n: number) => (n >= 1 ? n / 100 : n); // 1 -> 0.01

  if (typeof x === "number") {
    const p = asPercent(x);
    if (isPointsContext) {
      const px = toPoints(x);
      return Math.max(p, px);
    }
    return p;
  }

  const s = String(x).trim().toLowerCase();

  if (s.endsWith("%")) {
    const n = parseFloat(s.replace("%", ""));
    if (isNaN(n)) return 0;
    const p = n / 100;
    if (isPointsContext) {
      const px = toPoints(n);
      return Math.max(p, px);
    }
    return p;
  }

  const mx = s.match(/^\s*([\d.]+)\s*x\b/);
  if (mx) {
    const mult = parseFloat(mx[1]);
    return isNaN(mult) ? 0 : toPoints(mult);
  }

  const n = parseFloat(s);
  if (!isNaN(n)) {
    const p = asPercent(n);
    if (isPointsContext) {
      const px = toPoints(n);
      return Math.max(p, px);
    }
    return p;
  }

  return 0;
}

function keysMatch(entryKeys: unknown, cats: string[]): boolean {
  const arr = normalizeArray<unknown>(entryKeys);
  for (const k of arr) {
    const key = String(k ?? "").toLowerCase();
    if (cats.includes(key)) return true;
  }
  return false;
}

// ---------- Core services ----------
export async function recommendAllBenefits(opts: {
  merchant: string;
  amount?: number;
  mcc?: string;
  includeRotating?: boolean;
  minRate?: number; // filter out true zeros by default
  allowedCardSlugs?: string[];
  merchantConfidence?: number;
  scoringMode?: RecommendationScoringMode;
  purchaseChannel?: PurchaseChannel;
  enrolledBenefitIds?: string[];
  activatedBenefitIds?: string[];
  knownEnrollmentBenefitIds?: string[];
  knownActivationBenefitIds?: string[];
  walletBenefitStates?: CanonicalWalletBenefitState[];
  cardsOverride?: any[];
  recommendationPurchaseContext?: RecommendationPurchaseContext | null;
}) {
  const {
    merchant,
    amount = 0,
    mcc,
    includeRotating = true,
    minRate = 0,
    allowedCardSlugs,
    merchantConfidence,
    scoringMode = "strict_production",
    purchaseChannel = "online",
    enrolledBenefitIds,
    activatedBenefitIds,
    knownEnrollmentBenefitIds,
    knownActivationBenefitIds,
    walletBenefitStates = [],
    cardsOverride,
    recommendationPurchaseContext,
  } = opts;

  const allCards = cardsOverride || (await (await getDb()).collection("cards").find({}).toArray());
  const cards = filterAllowedCards(allCards, allowedCardSlugs);

  const baseCats = normalizeArray<string>(inferCategories(merchant, mcc)).map(
    (c) => String(c).toLowerCase(),
  );
  const merchantResolution = resolveMerchantIdentity({
    merchant,
    mcc,
    purchaseChannel,
  });
  const merchantCategoryTokens = inheritedCategoryTokens(merchantResolution.merchant);
  const merchantMatchText = merchantSearchText(merchant, merchantResolution);
  const purchaseImpact = purchaseImpactFor(recommendationPurchaseContext);
  const cats = expandCategories(
    Array.from(
      new Set([
        ...(baseCats.length ? baseCats : ["other"]),
        ...merchantCategoryTokens,
        ...purchaseImpact.categoryTokens,
      ]),
    ),
  );
  const scoringAmount = purchaseImpact.scoringAmount ?? amount;
  const now = new Date();
  const broadCategoryQuery = isBroadCategoryQuery(merchant);

  const results = cards.map((c: any) => {
    let bestRate = 0;
    let src = "baseline";
    let notes: string[] = [];
    let conf = typeof c.confidence === "number" ? c.confidence : 0.6;
    const unitHint = issuerDefaultsToPoints(c.issuer) ? "points" : "cash";
    const canonicalBenefits = canonicalizeCardBenefits(c);
    const baseFlatRate = Math.max(
      0,
      ...canonicalBenefits
        .filter((benefit) => benefit.sourceKind === "reward_flat")
        .map((benefit) => rateFromCanonicalBenefit(benefit, c, unitHint)),
    );
    const walletEvidenceByBenefitId = new Map<string, WalletBenefitUsageEvidence[]>();
    const missingInformation: MissingInformation[] = [];
    const warnings: DecisionWarning[] = [];
    const eligibleCanonicalBenefits = canonicalBenefits.flatMap((benefit) => {
      const walletAdjusted = applyWalletUsageToBenefitValue(
        benefit,
        walletBenefitStates,
        {
          statePolicy: scoringMode,
        },
      );
      if (!walletAdjusted.walletDecision.eligible) {
        missingInformation.push({
          code: walletAdjusted.walletDecision.reason.toUpperCase(),
          label: walletAdjusted.walletDecision.explanation,
          impact:
            walletAdjusted.walletDecision.reason === "wallet_state_required"
              ? "high"
              : "medium",
        });
        return [];
      }
      if (walletAdjusted.evidence.length) {
        walletEvidenceByBenefitId.set(benefit.id, walletAdjusted.evidence);
      }
      return benefitEligibleForScoring(walletAdjusted.benefit, cats, {
        merchant: merchantMatchText,
        purchaseChannel,
        productionOnly: scoringMode === "strict_production",
        minimumConfidence: scoringMode === "strict_production" ? undefined : 0,
        enrolledBenefitIds,
        activatedBenefitIds,
        knownEnrollmentBenefitIds,
        knownActivationBenefitIds,
      })
        ? [walletAdjusted.benefit]
        : [];
    });
    const seenMatches = new Set<string>();
    let winningRewardBenefit: CanonicalBenefitRecord | null = null;
    let winningExactBenefit: CanonicalBenefitRecord | null = null;

    for (const benefit of eligibleCanonicalBenefits) {
      if (benefit.benefitType !== "reward_multiplier") continue;
      if (!includeRotating && benefit.sourceKind === "reward_rotating") continue;
      if (!purchaseImpact.bonusEligible && benefit.sourceKind !== "reward_flat") continue;
      if (!canonicalRewardMatchesContext(benefit, cats, merchantMatchText, merchantResolution)) continue;

      const walletRate = walletAdjustedRewardRate({
        benefit,
        card: c,
        unitHint,
        amount: scoringAmount,
        baseFlatRate,
        walletBenefitStates,
      });
      const r = walletRate.rate;
      if (walletRate.evidence) {
        walletEvidenceByBenefitId.set(benefit.id, [
          ...(walletEvidenceByBenefitId.get(benefit.id) || []),
          walletRate.evidence,
        ]);
      }
      if (r > bestRate) {
        bestRate = r;
        winningRewardBenefit = benefit;
        src = sourceForCanonicalReward(benefit);
        notes = [benefit.label];
      }
      if (benefit.merchantCategory) {
        seenMatches.add(benefit.merchantCategory.toLowerCase());
      }
    }

    if (!bestRate || bestRate < 0) bestRate = 0;

    const creditBenefits = broadCategoryQuery
      ? []
      : eligibleCanonicalBenefits.filter((benefit) =>
          canonicalCreditMatchesMerchant(benefit, merchantMatchText, merchantResolution),
        );
    winningExactBenefit = creditBenefits[0] || null;
    const creditMatchCount = creditBenefits.length;
    const creditPerks = cleanPerks(
      creditBenefits.map((benefit) => benefit.label),
      140,
      6,
    );
    const cleanedCardPerks =
      scoringMode === "compatibility"
        ? cleanPerks(normalizeArray<string>(c.perks), 140, 6)
        : [];
    const displayPerks = Array.from(
      new Set([...creditPerks, ...cleanedCardPerks]),
    ).slice(0, 8);
    const rawPerkMatches = broadCategoryQuery
      ? []
      : collectPerkMatches(c.perks, merchant);
    const perkMatches = rawPerkMatches.filter((perk) =>
      eligibleCanonicalBenefits.some(
        (benefit) =>
          benefit.label.toLowerCase() === perk.toLowerCase() ||
          benefit.benefitDescription.toLowerCase() === perk.toLowerCase(),
      ),
    );
    if (!winningExactBenefit && perkMatches.length) {
      winningExactBenefit =
        eligibleCanonicalBenefits.find((benefit) =>
          perkMatches.some(
            (perk) =>
              benefit.label.toLowerCase() === perk.toLowerCase() ||
              benefit.benefitDescription.toLowerCase() === perk.toLowerCase(),
          ),
        ) || null;
    }
    const creditValueUSD = creditBenefits.reduce((sum, benefit) => {
      const val = Number.isFinite(benefit.statementCredit?.amountUSD)
        ? Number(benefit.statementCredit?.amountUSD)
        : 0;
      return sum + val;
    }, 0);
    if (creditPerks.length) {
      const preview = creditPerks.slice(0, 2).join("; ");
      notes = notes.length
        ? [...notes, `credit match: ${preview}`]
        : [`credit match: ${preview}`];
    }

    const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
    const hasCategoryRate =
      src.startsWith("category:") || src.startsWith("rotating:");
    const hasExactBenefit = creditMatchCount > 0 || perkMatches.length > 0;
    const matchTier: MatchTier = hasExactBenefit
      ? "exact_benefit"
      : hasCategoryRate
        ? "category_match"
        : "base_rate";
    const confidenceLabel =
      matchTier === "exact_benefit"
        ? "Exact benefit match"
        : matchTier === "category_match"
          ? "Category match"
          : "Base earn only";
    const primaryBenefit = creditPerks[0] || perkMatches[0] || null;
    const lastVerified =
      winningExactBenefit?.lastVerified ||
      winningRewardBenefit?.lastVerified ||
      null;
    const matchedCanonicalBenefit = winningExactBenefit || winningRewardBenefit;
    const eligibleSignupOffer =
      eligibleCanonicalBenefits.find(
        (benefit) => benefit.sourceKind === "signup_offer",
      ) || null;
    const intelligenceConfidence = scoreRecommendationConfidence({
      matchTier,
      merchantConfidence:
        merchantConfidence ?? merchantConfidenceForScoring(merchantResolution),
      benefitConfidence:
        matchedCanonicalBenefit?.confidenceScore ?? c?.benefitsDetail?.confidence,
      lastVerified,
      walletCardCount: allowedCardSlugs?.length,
      hasMatchedBenefit: Boolean(primaryBenefit),
    });
    conf = intelligenceConfidence.score;

    const why: string[] = [];
    if (primaryBenefit) why.push(`Benefit: ${primaryBenefit}`);
    if (bestRate > 0)
      why.push(`Rewards rate: ${(bestRate * 100).toFixed(2)}% effective`);
    why.push(
      `Annual fee: $${typeof c.annualFee === "number" ? c.annualFee : 0}`,
    );
    if (lastVerified) why.push(`Last verified: ${lastVerified}`);

    const purchaseEvidence = purchaseImpact.evidence.length
      ? purchaseEvidenceForExplanation(purchaseImpact)
      : [];
    missingInformation.push(...purchaseImpact.missingInformation);
    warnings.push(...purchaseImpact.warnings);

    return {
      slug: c.slug,
      name: c.name,
      issuer: c.issuer,
      effectiveRate: round(bestRate, 4),
      estValueUSD: round(scoringAmount * bestRate + creditValueUSD, 2),
      confidence: conf,
      intelligenceConfidence,
      reason: `${src}; ${notes.join(", ") || "baseline"}`,
      matchingCategories: [...seenMatches],
      annualFee: typeof c.annualFee === "number" ? c.annualFee : 0,
      hasCreditMatch: creditMatchCount > 0,
      creditMatchCount,
      perks: displayPerks,
      matchedBenefit: primaryBenefit,
      confidenceLabel,
      matchTier,
      why,
      lastVerified,
      matchedBenefitId: matchedCanonicalBenefit?.id ?? null,
      walletEvidence:
        matchedCanonicalBenefit === null
          ? []
          : walletEvidenceByBenefitId.get(matchedCanonicalBenefit.id) || [],
      explanationEvidence: {
        merchant: merchantEvidenceForExplanation(merchantResolution),
        benefit: benefitEvidenceForExplanation(matchedCanonicalBenefit),
        wallet: walletEvidenceForExplanation(
          matchedCanonicalBenefit,
          walletBenefitStates,
        ),
        scoring: scoringEvidenceForExplanation({
          amount: scoringAmount,
          bestRate: round(bestRate, 4),
          creditValueUSD: round(creditValueUSD, 2),
          estimatedValueUSD: round(scoringAmount * bestRate + creditValueUSD, 2),
          source: src,
          notes,
        }).concat(purchaseEvidence),
        missingInformation,
        warnings,
      },
      purchaseRefinement: purchaseImpact.refinement,
      recommendationPurchaseContext: recommendationPurchaseContext || null,
      sourceUrl: matchedCanonicalBenefit?.sourceUrl ?? c.sourceUrl ?? null,
      signupOffer:
        scoringMode === "compatibility"
          ? c.signupOffer ?? eligibleSignupOffer?.label ?? null
          : eligibleSignupOffer?.label ?? null,
      scoringMode,
    };
  });

  // filter out zeros unless perks/signup
  const filtered = results.filter((r) => {
    if (scoringMode === "compatibility") {
      return (
        r.effectiveRate > minRate ||
        (r.perks && r.perks.length) ||
        r.signupOffer
      );
    }
    return (
      r.effectiveRate > minRate &&
      (r.effectiveRate > 0 || r.matchTier === "exact_benefit" || r.signupOffer)
    );
  });

  filtered.sort((a, b) => {
    const tierWeight = (t: MatchTier) =>
      t === "exact_benefit" ? 3 : t === "category_match" ? 2 : 1;
    if (tierWeight(b.matchTier) !== tierWeight(a.matchTier))
      return tierWeight(b.matchTier) - tierWeight(a.matchTier);
    if (b.estValueUSD !== a.estValueUSD) return b.estValueUSD - a.estValueUSD;
    if (b.effectiveRate !== a.effectiveRate)
      return b.effectiveRate - a.effectiveRate;
    if ((b.confidence ?? 0) !== (a.confidence ?? 0))
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    return (a.annualFee ?? 0) - (b.annualFee ?? 0);
  });

  return {
    merchant,
    amount,
    categoriesUsed: cats,
    recommendationPurchaseContext: recommendationPurchaseContext || null,
    offers: filtered,
  };
}

type PurchaseImpact = {
  categoryTokens: string[];
  scoringAmount: number | null;
  evidence: DecisionEvidenceItem[];
  missingInformation: MissingInformation[];
  warnings: DecisionWarning[];
  bonusEligible: boolean;
  refinement:
    | "none"
    | RecommendationPurchaseContext["refinement"];
};

function purchaseImpactFor(
  context?: RecommendationPurchaseContext | null,
): PurchaseImpact {
  if (!context) {
    return {
      categoryTokens: [],
      scoringAmount: null,
      evidence: [],
      missingInformation: [],
      warnings: [],
      bonusEligible: true,
      refinement: "none",
    };
  }

  const warnings: DecisionWarning[] = [];
  const missingInformation: MissingInformation[] = [];
  const categoryTokens: string[] = [];
  const hasExclusion =
    context.hasGiftCard || context.hasCashEquivalent || context.exclusions.length > 0;
  const scoringAmount =
    hasExclusion && typeof context.eligibleAmount === "number"
      ? context.eligibleAmount
      : null;
  const bonusEligible = !(hasExclusion && scoringAmount === 0);

  if (
    context.refinement === "purchase_refined" &&
    context.confidenceLabel === "high" &&
    context.dominantCategory
  ) {
    categoryTokens.push(...recommendationCategoriesForPurchase(context.dominantCategory));
  }

  if (context.refinement === "low_confidence_fallback") {
    missingInformation.push({
      code: "LOW_PURCHASE_CONFIDENCE",
      label:
        "Purchase details were not confident enough to change the card ranking.",
      impact: "medium",
    });
  }

  if (context.materiallyMixed) {
    warnings.push({
      code: "MIXED_CART_LIMITATION",
      severity: "medium",
      message:
        "This cart contains multiple meaningful purchase categories, so Rewardly kept the recommendation merchant-based.",
    });
  }

  if (hasExclusion) {
    warnings.push({
      code: "PURCHASE_EXCLUSIONS_APPLIED",
      severity: "medium",
      message:
        "Gift cards or cash-equivalent items were excluded from bonus-category value when detected.",
    });
  }

  const evidence: DecisionEvidenceItem[] = [
    {
      type: "purchase_context",
      label: purchaseContextEvidenceLabel(context),
      value: {
        dominantCategory: context.dominantCategory,
        confidenceLabel: context.confidenceLabel,
        confidenceScore: context.confidenceScore,
        refinement: context.refinement,
        materiallyMixed: context.materiallyMixed,
        eligibleAmount: context.eligibleAmount,
        total: context.total,
      },
      source: "purchase_intelligence",
      confidence: context.confidenceScore,
    },
  ];

  return {
    categoryTokens,
    scoringAmount,
    evidence,
    missingInformation,
    warnings,
    bonusEligible,
    refinement: context.refinement,
  };
}

function recommendationCategoriesForPurchase(category: PurchaseCategory): string[] {
  const mapping: Partial<Record<PurchaseCategory, string[]>> = {
    apparel: ["apparel", "departmentstores"],
    digital_goods: ["online_shopping", "online"],
    electronics: ["online_shopping", "online"],
    fuel: ["gas", "fuel"],
    groceries: ["groceries"],
    home_improvement: ["other"],
    pharmacy: ["drugstores", "pharmacy"],
    restaurant: ["restaurants", "dining"],
    subscription: ["streaming"],
    technology_purchase: ["online_shopping", "online"],
    travel: ["travel"],
  };
  return mapping[category] || [];
}

function purchaseEvidenceForExplanation(impact: PurchaseImpact) {
  return impact.evidence.map((item) => ({
    ...item,
    label:
      impact.refinement === "purchase_refined"
        ? "Purchase details refined this recommendation."
        : impact.refinement === "mixed_cart_fallback"
          ? "Purchase details were captured, but the cart was mixed or included exclusions."
          : impact.refinement === "low_confidence_fallback"
            ? "Purchase details were captured with low confidence and were not used for ranking."
            : "Purchase details supported the merchant-based recommendation.",
  }));
}

function purchaseContextEvidenceLabel(context: RecommendationPurchaseContext) {
  if (context.refinement === "purchase_refined") {
    return `High-confidence ${context.dominantCategory || "purchase"} context refined scoring.`;
  }
  if (context.refinement === "mixed_cart_fallback") {
    return "Mixed-cart purchase context preserved merchant-level scoring.";
  }
  if (context.refinement === "low_confidence_fallback") {
    return "Low-confidence purchase context did not affect scoring.";
  }
  return "Purchase context supported the recommendation without changing ranking.";
}

function benefitEligibleForScoring(
  benefit: CanonicalBenefitRecord,
  cats: string[],
  context: {
    merchant: string;
    purchaseChannel: PurchaseChannel;
    productionOnly: boolean;
    minimumConfidence?: number;
    enrolledBenefitIds?: string[];
    activatedBenefitIds?: string[];
    knownEnrollmentBenefitIds?: string[];
    knownActivationBenefitIds?: string[];
  },
) {
  const categories = benefit.sourceKind === "reward_flat" ? [""] : cats;
  return categories.some(
    (category) =>
      isBenefitEligibleForRecommendation(benefit, {
        merchant: context.merchant,
        merchantCategory: category,
        purchaseChannel: context.purchaseChannel,
        productionOnly: context.productionOnly,
        minimumConfidence: context.minimumConfidence,
        enrolledBenefitIds: context.enrolledBenefitIds,
        activatedBenefitIds: context.activatedBenefitIds,
        knownEnrollmentBenefitIds: context.knownEnrollmentBenefitIds,
        knownActivationBenefitIds: context.knownActivationBenefitIds,
      }).eligible,
  );
}

function canonicalRewardMatchesContext(
  benefit: CanonicalBenefitRecord,
  cats: string[],
  merchant: string,
  merchantResolution?: MerchantResolutionResult,
) {
  if (benefit.sourceKind === "reward_flat") return true;
  if (
    benefit.specificMerchant ||
    benefit.specificMerchantIds.some((item) => item)
  ) {
    return canonicalMerchantMatches(benefit, merchant, merchantResolution);
  }
  return Boolean(
    benefit.merchantCategory &&
      cats.includes(benefit.merchantCategory.toLowerCase()),
  );
}

function canonicalCreditMatchesMerchant(
  benefit: CanonicalBenefitRecord,
  merchant: string,
  merchantResolution?: MerchantResolutionResult,
) {
  return (
    (benefit.sourceKind === "merchant_credit" ||
      benefit.sourceKind === "recurring_credit") &&
    canonicalMerchantMatches(benefit, merchant, merchantResolution)
  );
}

function canonicalMerchantMatches(
  benefit: CanonicalBenefitRecord,
  merchant: string,
  merchantResolution?: MerchantResolutionResult,
) {
  const normalizedMerchant = normalizeComparable(merchantSearchText(merchant, merchantResolution));
  const merchants = [
    benefit.specificMerchant,
    ...benefit.specificMerchantIds,
  ].map(normalizeComparable);
  return merchants.some(
    (item) =>
      item &&
      (normalizedMerchant.includes(item) || item.includes(normalizedMerchant)),
  );
}

function merchantSearchText(
  merchant: string,
  merchantResolution?: MerchantResolutionResult,
) {
  return [
    merchant,
    merchantResolution?.merchant?.merchantId,
    merchantResolution?.merchant?.displayName,
    merchantResolution?.merchant?.canonicalName,
    merchantResolution?.merchant?.merchantGroup,
    merchantResolution?.merchant?.parentCompany,
    merchantResolution?.merchant?.brand,
    ...(merchantResolution?.inheritedMerchantIds || []),
    ...(merchantResolution?.merchant?.supportedBenefitMappings || []),
  ]
    .filter(Boolean)
    .join(" ");
}

function merchantConfidenceForScoring(merchantResolution: MerchantResolutionResult) {
  if (
    merchantResolution.matchingStrategy === "category_inference" ||
    merchantResolution.matchingStrategy === "weak_fuzzy" ||
    merchantResolution.matchingStrategy === "unknown"
  ) {
    return undefined;
  }
  return merchantResolution.confidence || undefined;
}

function merchantEvidenceForExplanation(
  merchantResolution: MerchantResolutionResult,
): DecisionEvidenceItem[] {
  return [
    {
      type: "merchant_resolution",
      label: "Merchant resolution",
      value: {
        merchantId: merchantResolution.merchant?.merchantId || null,
        displayName: merchantResolution.merchant?.displayName || null,
        matchingStrategy: merchantResolution.matchingStrategy,
        aliasUsed: merchantResolution.aliasUsed,
        inheritedMerchantIds: merchantResolution.inheritedMerchantIds,
        inheritedCategoryIds: merchantResolution.inheritedCategoryIds,
        normalizationSteps: merchantResolution.normalizationSteps,
      },
      source: "merchant_intelligence",
      confidence: merchantResolution.confidence,
    },
  ];
}

function benefitEvidenceForExplanation(
  benefit: CanonicalBenefitRecord | null,
): DecisionEvidenceItem[] {
  if (!benefit) return [];
  return [
    {
      type: "benefit_selected",
      label: "Benefit selected",
      value: {
        benefitId: benefit.id,
        label: benefit.label,
        benefitType: benefit.benefitType,
        sourceKind: benefit.sourceKind,
        verificationStatus: benefit.verificationStatus,
        lastVerified: benefit.lastVerified,
        productionEligible: benefit.productionEligible,
      },
      source: benefit.sourceUrl || benefit.verificationSource || "benefit_intelligence",
      confidence: benefit.confidenceScore,
    },
  ];
}

function walletEvidenceForExplanation(
  benefit: CanonicalBenefitRecord | null,
  states: CanonicalWalletBenefitState[],
): DecisionEvidenceItem[] {
  if (!benefit) return [];
  const state = findWalletStateForBenefit(benefit, states);
  if (!state) return [];
  return [
    {
      type: "wallet_state",
      label: "Wallet benefit state",
      value: {
        walletBenefitStateId: state.walletBenefitStateId,
        status: state.status,
        enrollmentStatus: state.enrollmentStatus,
        activationStatus: state.activationStatus,
        remainingValue: state.remainingValue,
        remainingSpendCap: state.remainingSpendCap,
        remainingUses: state.remainingUses,
        cycleValueLimit: state.cycleValueLimit,
        cycleSpendLimit: state.cycleSpendLimit,
        cycleUsageLimit: state.cycleUsageLimit,
        confidenceSource: state.confidenceSource,
        version: state.version,
      },
      source: "wallet_intelligence",
      confidence: state.confidence,
    },
  ];
}

function scoringEvidenceForExplanation(input: {
  amount: number;
  bestRate: number;
  creditValueUSD: number;
  estimatedValueUSD: number;
  source: string;
  notes: string[];
}): DecisionEvidenceItem[] {
  return [
    {
      type: "scoring_result",
      label: "Scoring result",
      value: input,
      source: "recommendation_service",
      confidence: null,
    },
  ];
}

function rateFromCanonicalBenefit(
  benefit: CanonicalBenefitRecord,
  card: any,
  unitHint: "cash" | "points" | "miles",
) {
  const multiplier = benefit.multiplier ?? parseMultiplierFromLabel(benefit.label);
  if (!multiplier) return 0;
  if (benefit.rewardMechanism === "cash_back") {
    if (/%/.test(benefit.label)) return multiplier / 100;
    return multiplier >= 1 ? multiplier / 100 : multiplier;
  }
  if (benefit.rewardMechanism === "points" || benefit.rewardMechanism === "miles") {
    return toCashEquivalent(benefit.rewardMechanism, multiplier, card.issuer ?? "other");
  }
  return parseRateUnknown(multiplier, card.issuer, unitHint);
}

function walletAdjustedRewardRate(input: {
  benefit: CanonicalBenefitRecord;
  card: any;
  unitHint: "cash" | "points" | "miles";
  amount: number;
  baseFlatRate: number;
  walletBenefitStates: CanonicalWalletBenefitState[];
}): { rate: number; evidence: WalletBenefitUsageEvidence | null } {
  const rate = rateFromCanonicalBenefit(input.benefit, input.card, input.unitHint);
  const state = findWalletStateForBenefit(input.benefit, input.walletBenefitStates);
  const remainingCap = state?.remainingSpendCap ?? null;
  if (
    input.benefit.benefitType !== "reward_multiplier" ||
    remainingCap === null ||
    input.amount <= 0
  ) {
    return { rate, evidence: null };
  }
  if (remainingCap <= 0) {
    return {
      rate: input.baseFlatRate,
      evidence: {
        kind: "spend_cap_split",
        purchaseAmount: input.amount,
        cappedAmount: 0,
        uncappedAmount: input.amount,
        bonusRate: rate,
        baseRate: input.baseFlatRate,
        effectiveRate: input.baseFlatRate,
        remainingSpendCap: 0,
        explanation: "No bonus spend cap remains, so only the base rate applies.",
      },
    };
  }
  const cappedAmount = Math.min(input.amount, remainingCap);
  const uncappedAmount = Math.max(0, input.amount - cappedAmount);
  if (uncappedAmount === 0) {
    return {
      rate,
      evidence: {
        kind: "spend_cap_split",
        purchaseAmount: input.amount,
        cappedAmount,
        uncappedAmount,
        bonusRate: rate,
        baseRate: input.baseFlatRate,
        effectiveRate: rate,
        remainingSpendCap: remainingCap,
        explanation: "The full purchase fits inside the remaining bonus spend cap.",
      },
    };
  }
  const blendedRate =
    (cappedAmount * rate + uncappedAmount * input.baseFlatRate) / input.amount;
  return {
    rate: blendedRate,
    evidence: {
      kind: "spend_cap_split",
      purchaseAmount: input.amount,
      cappedAmount,
      uncappedAmount,
      bonusRate: rate,
      baseRate: input.baseFlatRate,
      effectiveRate: blendedRate,
      remainingSpendCap: remainingCap,
      explanation: `$${cappedAmount} earns the bonus rate; $${uncappedAmount} falls back to the base rate.`,
    },
  };
}

function sourceForCanonicalReward(benefit: CanonicalBenefitRecord) {
  if (benefit.sourceKind === "reward_flat") return "flat";
  if (benefit.sourceKind === "reward_rotating") {
    const category = benefit.merchantCategory || "unknown";
    return `rotating:${category}`;
  }
  return `category:${benefit.merchantCategory || "unknown"}`;
}

function parseMultiplierFromLabel(label: string) {
  const match = label.match(/([\d.]+)\s*(x|%)/i);
  return match ? Number(match[1]) : 0;
}

function normalizeComparable(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- Minimal wrapper to keep /best working using the same core logic ---
export async function recommendBestCards(opts: {
  merchant: string;
  amount?: number;
  mcc?: string;
  includeRotating?: boolean;
  allowedCardSlugs?: string[];
  merchantConfidence?: number;
  scoringMode?: RecommendationScoringMode;
  purchaseChannel?: PurchaseChannel;
  enrolledBenefitIds?: string[];
  activatedBenefitIds?: string[];
  knownEnrollmentBenefitIds?: string[];
  knownActivationBenefitIds?: string[];
  walletBenefitStates?: CanonicalWalletBenefitState[];
  cardsOverride?: any[];
  recommendationPurchaseContext?: RecommendationPurchaseContext | null;
}) {
  const {
    merchant,
    amount = 0,
    mcc,
    includeRotating = true,
    allowedCardSlugs,
    merchantConfidence,
    scoringMode,
    purchaseChannel,
    enrolledBenefitIds,
    activatedBenefitIds,
    knownEnrollmentBenefitIds,
    knownActivationBenefitIds,
    walletBenefitStates,
    cardsOverride,
    recommendationPurchaseContext,
  } = opts;

  const { categoriesUsed, offers } = await recommendAllBenefits({
    merchant,
    amount,
    mcc,
    includeRotating,
    minRate: -1,
    allowedCardSlugs,
    merchantConfidence,
    scoringMode,
    purchaseChannel,
    enrolledBenefitIds,
    activatedBenefitIds,
    knownEnrollmentBenefitIds,
    knownActivationBenefitIds,
    walletBenefitStates,
    cardsOverride,
    recommendationPurchaseContext,
  });

  const sorted = [...offers].sort((a, b) => {
    const tierWeight = (t: MatchTier) =>
      t === "exact_benefit" ? 3 : t === "category_match" ? 2 : 1;
    if (tierWeight(b.matchTier) !== tierWeight(a.matchTier))
      return tierWeight(b.matchTier) - tierWeight(a.matchTier);
    if ((b.estValueUSD ?? 0) !== (a.estValueUSD ?? 0))
      return (b.estValueUSD ?? 0) - (a.estValueUSD ?? 0);
    if ((b.effectiveRate ?? 0) !== (a.effectiveRate ?? 0))
      return (b.effectiveRate ?? 0) - (a.effectiveRate ?? 0);
    if ((b.confidence ?? 0) !== (a.confidence ?? 0))
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    return (a.annualFee ?? 0) - (b.annualFee ?? 0);
  });

  const top = sorted.slice(0, 8).map((o) => ({
    slug: o.slug,
    name: o.name,
    issuer: o.issuer,
    effectiveRate: o.effectiveRate,
    estValueUSD: o.estValueUSD,
    confidence: o.confidence,
    intelligenceConfidence: o.intelligenceConfidence,
    confidenceLabel: o.confidenceLabel,
    matchTier: o.matchTier,
    matchedBenefit: o.matchedBenefit,
    matchedBenefitId: o.matchedBenefitId,
    walletEvidence: o.walletEvidence,
    explanationEvidence: o.explanationEvidence,
    why: o.why,
    lastVerified: o.lastVerified,
    reason: o.reason,
    annualFee: o.annualFee,
    sourceUrl: o.sourceUrl,
    purchaseRefinement: o.purchaseRefinement,
    recommendationPurchaseContext: o.recommendationPurchaseContext,
  }));

  return { merchant, amount, categoriesUsed, recommendations: top };
}
