import { getDb } from "../db";
import { inferCategories } from "../utils/category";
import { toCashEquivalent } from "../utils/valuation";
import { collectCreditMatches } from "../utils/merchantMatching";
import { isLikelyJunkBenefitText } from "../scrapers/benefitsQuality";

type MatchTier = "exact_benefit" | "category_match" | "base_rate";

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
}) {
  const {
    merchant,
    amount = 0,
    mcc,
    includeRotating = true,
    minRate = 0,
    allowedCardSlugs,
  } = opts;

  const db = await getDb();
  const allCards = await db.collection("cards").find({}).toArray();
  const cards = filterAllowedCards(allCards, allowedCardSlugs);

  const baseCats = normalizeArray<string>(inferCategories(merchant, mcc)).map(
    (c) => String(c).toLowerCase(),
  );
  const cats = expandCategories(baseCats.length ? baseCats : ["other"]);
  const now = new Date();
  const broadCategoryQuery = isBroadCategoryQuery(merchant);

  const results = cards.map((c: any) => {
    let bestRate = 0;
    let src = "baseline";
    let notes: string[] = [];
    let conf = typeof c.confidence === "number" ? c.confidence : 0.6;
    const unitHint = issuerDefaultsToPoints(c.issuer) ? "points" : "cash";

    const seenMatches = new Set<string>();

    // 1) flat rewards
    for (const e of normalizeArray<RewardEntry>(c.rewardsFlat)) {
      const r =
        typeof e.rate === "string"
          ? parseRateUnknown(e.rate, c.issuer, e.unit ?? unitHint)
          : toCashEquivalent(e.unit ?? "cash", e.rate, c.issuer ?? "other");
      if (r > bestRate) {
        bestRate = r;
        src = "flat";
        notes = ["flat rate"];
      }
    }

    // 2) category map object
    if (c.rewardsByCategory && !Array.isArray(c.rewardsByCategory)) {
      const map = c.rewardsByCategory as Record<string, number | string>;
      for (const key of cats) {
        if (map[key] !== undefined) {
          const r = parseRateUnknown(map[key], c.issuer, unitHint);
          if (r > bestRate) {
            bestRate = r;
            src = `category:${key}`;
            notes = ["object map"];
          }
          seenMatches.add(key);
        }
      }
      if (map["other"] !== undefined) {
        const r = parseRateUnknown(map["other"], c.issuer, unitHint);
        if (r > bestRate) {
          bestRate = r;
          src = "category:other";
          notes = ["object map fallback"];
        }
        seenMatches.add("other");
      }
    }

    // 3) category array entries
    if (Array.isArray(c.rewardsByCategory)) {
      for (const e of normalizeArray<RewardEntry>(c.rewardsByCategory)) {
        if (!keysMatch(e.keys, cats)) continue;
        const r =
          typeof e.rate === "string"
            ? parseRateUnknown(e.rate, c.issuer, e.unit ?? unitHint)
            : toCashEquivalent(e.unit ?? "cash", e.rate, c.issuer ?? "other");
        if (r > bestRate) {
          bestRate = r;
          src = `category:${normalizeArray(e.keys).map(String).join("|")}`;
          notes = ["array match"];
        }
        normalizeArray(e.keys).forEach((k) =>
          seenMatches.add(String(k).toLowerCase()),
        );
      }
    }

    // 4) rotating categories
    if (includeRotating) {
      for (const q of normalizeArray<RotatingQuarter>(c.rewardsRotating)) {
        const active =
          q.start && q.end
            ? now >= new Date(q.start) && now <= new Date(q.end)
            : true;
        const confPenalty = q.start && q.end ? 0 : 0.05;

        for (const e of normalizeArray<RewardEntry>(q.categories)) {
          if (!keysMatch(e.keys, cats)) continue;
          const r =
            typeof e.rate === "string"
              ? parseRateUnknown(e.rate, c.issuer, e.unit ?? unitHint)
              : toCashEquivalent(e.unit ?? "cash", e.rate, c.issuer ?? "other");
          const rEff = active ? r : r * 0.9;
          if (rEff > bestRate) {
            bestRate = rEff;
            src = `rotating:${normalizeArray(e.keys).map(String).join("|")}${active ? "" : ":inactive"}`;
            notes = [
              active ? "rotating (active)" : "rotating (uncertain window)",
            ];
          }
          normalizeArray(e.keys).forEach((k) =>
            seenMatches.add(String(k).toLowerCase()),
          );
          conf = Math.max(
            0,
            conf - confPenalty - (q.activationRequired ? 0.05 : 0),
          );
        }
      }
    }

    if (!bestRate || bestRate < 0) bestRate = 0;

    const creditMatches = broadCategoryQuery
      ? []
      : collectCreditMatches(c, merchant);
    const creditMatchCount = creditMatches.length;
    const creditPerks = cleanPerks(formatCreditPerks(creditMatches), 140, 6);
    const cleanedCardPerks = cleanPerks(
      normalizeArray<string>(c.perks),
      140,
      6,
    );
    const displayPerks = Array.from(
      new Set([...creditPerks, ...cleanedCardPerks]),
    ).slice(0, 8);
    const perkMatches = broadCategoryQuery
      ? []
      : collectPerkMatches(c.perks, merchant);
    const creditValueUSD = creditMatches.reduce((sum, credit: any) => {
      const val = Number.isFinite(credit?.amountUSD)
        ? Number(credit.amountUSD)
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
      c?.benefitsDetail?.lastScraped || c?.lastScraped || null;

    const why: string[] = [];
    if (primaryBenefit) why.push(`Benefit: ${primaryBenefit}`);
    if (bestRate > 0)
      why.push(`Rewards rate: ${(bestRate * 100).toFixed(2)}% effective`);
    why.push(
      `Annual fee: $${typeof c.annualFee === "number" ? c.annualFee : 0}`,
    );
    if (lastVerified) why.push(`Last verified: ${lastVerified}`);

    return {
      slug: c.slug,
      name: c.name,
      issuer: c.issuer,
      effectiveRate: round(bestRate, 4),
      estValueUSD: round(amount * bestRate + creditValueUSD, 2),
      confidence: conf,
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
      signupOffer: c.signupOffer ?? null,
      sourceUrl: c.sourceUrl ?? null,
    };
  });

  // filter out zeros unless perks/signup
  const filtered = results.filter(
    (r) =>
      r.effectiveRate > minRate || (r.perks && r.perks.length) || r.signupOffer,
  );

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
    offers: filtered,
  };
}

// --- Minimal wrapper to keep /best working using the same core logic ---
export async function recommendBestCards(opts: {
  merchant: string;
  amount?: number;
  mcc?: string;
  includeRotating?: boolean;
  allowedCardSlugs?: string[];
}) {
  const {
    merchant,
    amount = 0,
    mcc,
    includeRotating = true,
    allowedCardSlugs,
  } = opts;

  const { categoriesUsed, offers } = await recommendAllBenefits({
    merchant,
    amount,
    mcc,
    includeRotating,
    minRate: -1,
    allowedCardSlugs,
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
    confidenceLabel: o.confidenceLabel,
    matchTier: o.matchTier,
    matchedBenefit: o.matchedBenefit,
    why: o.why,
    lastVerified: o.lastVerified,
    reason: o.reason,
    annualFee: o.annualFee,
    sourceUrl: o.sourceUrl,
  }));

  return { merchant, amount, categoriesUsed, recommendations: top };
}
