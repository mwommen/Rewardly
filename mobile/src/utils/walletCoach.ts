import type { PaymentJourneyEntry } from "../types/paymentJourney";
import type { WalletCard } from "../types/rewardly";
import type {
  DismissedOpportunity,
  OptimizationScore,
  OpportunityPriority,
  SuccessMoment,
  WalletCoachOpportunity,
  WalletCoachSnapshot,
  WeeklySummary
} from "../types/walletCoach";

const OPTIMIZED_CONFIDENCE_THRESHOLD = 0.85;
const CATEGORY_COVERAGE_TARGET = 5;
const WALLET_DIVERSITY_TARGET = 3;

type CategorySummary = {
  category: string;
  entries: PaymentJourneyEntry[];
  optimizedEntries: PaymentJourneyEntry[];
  estimatedRewards: number;
};

export function createWalletCoachSnapshot({
  wallet,
  journey,
  dismissedOpportunityIds = [],
  now = new Date()
}: {
  wallet: WalletCard[];
  journey: PaymentJourneyEntry[];
  dismissedOpportunityIds?: string[];
  now?: Date;
}): WalletCoachSnapshot {
  const safeJourney = sortJourney(journey);
  const generatedAt = now.toISOString();
  const rawOpportunities = generateOpportunities({
    wallet,
    journey: safeJourney,
    now,
    generatedAt
  });
  const dismissed = new Set(dismissedOpportunityIds);
  const opportunities = dedupeOpportunities(rawOpportunities)
    .filter((opportunity) => !dismissed.has(opportunity.opportunityId))
    .sort(compareOpportunityPriority);
  const optimizationScore = calculateOptimizationScore(wallet, safeJourney, now);
  const weeklySummary = calculateWeeklySummary(safeJourney, opportunities, now);
  const topOpportunity = opportunities[0] || null;

  return {
    generatedAt,
    topOpportunity,
    opportunities,
    biggestRecentWin: findBiggestRecentWin(safeJourney, now),
    mostImprovedCategory: findMostImprovedCategory(safeJourney, now),
    optimizationScore,
    weeklySummary,
    successMoments: generateSuccessMoments(safeJourney, optimizationScore, now),
    suggestedAction:
      topOpportunity?.suggestedAction ||
      "Keep using Smart Pay before larger purchases to build your wallet history."
  };
}

export function generateOpportunities({
  wallet,
  journey,
  now,
  generatedAt = now.toISOString()
}: {
  wallet: WalletCard[];
  journey: PaymentJourneyEntry[];
  now: Date;
  generatedAt?: string;
}): WalletCoachOpportunity[] {
  const opportunities: WalletCoachOpportunity[] = [];
  const recentJourney = entriesSince(journey, now, 45);
  const categorySummaries = summarizeCategories(recentJourney);
  const optimizedRate = optimizedPurchaseRate(journey);

  if (!wallet.length) {
    opportunities.push(
      createOpportunity({
        opportunityId: "add-wallet-cards",
        title: "Add cards to unlock coaching",
        explanation:
          "Rewardly needs your owned cards before it can coach your payment strategy.",
        priority: "High",
        suggestedAction: "Add the cards you already carry.",
        whySurfaced: "Your mobile wallet is empty.",
        supportingPaymentIds: [],
        estimatedAnnualValue: null,
        category: null,
        createdAt: generatedAt
      })
    );
  }

  if (!journey.length) {
    opportunities.push(
      createOpportunity({
        opportunityId: "complete-first-smart-pay",
        title: "Complete your first Smart Pay purchase",
        explanation:
          "Your coaching improves after Rewardly sees completed payment decisions.",
        priority: "High",
        suggestedAction: "Run Smart Pay before your next checkout.",
        whySurfaced: "No completed Payment Journey entries exist yet.",
        supportingPaymentIds: [],
        estimatedAnnualValue: null,
        category: null,
        createdAt: generatedAt
      })
    );
    return opportunities;
  }

  if (optimizedRate < 0.75) {
    const unoptimized = journey
      .filter((entry) => !isOptimizedPurchase(entry))
      .slice(0, 3);
    opportunities.push(
      createOpportunity({
        opportunityId: "choose-recommended-card-more-often",
        title: "Use the recommended card more consistently",
        explanation:
          "Some completed purchases did not use the card Rewardly recommended.",
        priority: optimizedRate < 0.5 ? "High" : "Medium",
        suggestedAction: "Choose the Rewardly card when the explanation fits your purchase.",
        whySurfaced: `Your optimized purchase rate is ${Math.round(optimizedRate * 100)}%.`,
        supportingPaymentIds: unoptimized.map((entry) => entry.paymentId),
        estimatedAnnualValue: estimateAnnualValue(unoptimized),
        category: null,
        createdAt: generatedAt
      })
    );
  }

  categorySummaries.forEach((summary) => {
    if (summary.entries.length >= 3 && categoryOptimizedRate(summary) < 0.8) {
      opportunities.push(
        createOpportunity({
          opportunityId: `improve-${slugify(summary.category)}-usage`,
          title: `${titleCase(summary.category)} rewards could improve`,
          explanation:
            "Rewardly sees repeated purchases in this category with room to optimize.",
          priority: summary.entries.length >= 5 ? "High" : "Medium",
          suggestedAction: `Check Smart Pay before your next ${summary.category} purchase.`,
          whySurfaced: `${summary.entries.length} recent ${summary.category} purchases were found.`,
          supportingPaymentIds: summary.entries.slice(0, 3).map((entry) => entry.paymentId),
          estimatedAnnualValue: estimateAnnualValue(summary.entries),
          category: summary.category,
          createdAt: generatedAt
        })
      );
    }
  });

  const targetEntries = recentJourney.filter(
    (entry) => normalizeMerchant(entry.merchant) === "target"
  );
  if (targetEntries.length >= 2) {
    opportunities.push(
      createOpportunity({
        opportunityId: "frequent-target-shopper",
        title: "You frequently shop at Target",
        explanation:
          "Repeated Target purchases are worth checking because merchant-specific value can beat base rewards.",
        priority: "Medium",
        suggestedAction: "Run Smart Pay when shopping at Target.",
        whySurfaced: `${targetEntries.length} recent Target purchases are in your journey.`,
        supportingPaymentIds: targetEntries.slice(0, 3).map((entry) => entry.paymentId),
        estimatedAnnualValue: estimateAnnualValue(targetEntries),
        category: "general retail",
        createdAt: generatedAt
      })
    );
  }

  const travelCard = wallet.find((card) =>
    /sapphire|venture|platinum|travel|delta|united|southwest/i.test(
      `${card.displayName} ${card.rewardProgram || ""}`
    )
  );
  const travelEntries = categorySummaries.find((summary) => summary.category === "travel");
  if (travelCard && !travelEntries) {
    opportunities.push(
      createOpportunity({
        opportunityId: "travel-card-unused",
        title: "Your travel card has not appeared recently",
        explanation:
          "A travel-focused card is in your wallet, but recent travel purchases are missing from your journey.",
        priority: "Low",
        suggestedAction: "Use Smart Pay before your next flight, hotel, or rental car booking.",
        whySurfaced: `${travelCard.displayName} looks travel-focused and no recent travel purchases were found.`,
        supportingPaymentIds: [],
        estimatedAnnualValue: null,
        category: "travel",
        createdAt: generatedAt
      })
    );
  }

  const restaurantSummary = categorySummaries.find(
    (summary) => summary.category === "restaurants"
  );
  if (restaurantSummary && restaurantSummary.entries.length >= 3 && categoryOptimizedRate(restaurantSummary) >= 0.9) {
    opportunities.push(
      createOpportunity({
        opportunityId: "restaurant-rewards-maximized",
        title: "Restaurant rewards are being maximized",
        explanation:
          "Your recent restaurant decisions are consistently using the recommended card.",
        priority: "Low",
        suggestedAction: "Keep checking Smart Pay when dining or ordering delivery.",
        whySurfaced: `${restaurantSummary.optimizedEntries.length} of ${restaurantSummary.entries.length} restaurant purchases were optimized.`,
        supportingPaymentIds: restaurantSummary.entries.slice(0, 3).map((entry) => entry.paymentId),
        estimatedAnnualValue: null,
        category: "restaurants",
        createdAt: generatedAt
      })
    );
  }

  return opportunities;
}

export function calculateOptimizationScore(
  wallet: WalletCard[],
  journey: PaymentJourneyEntry[],
  now = new Date()
): OptimizationScore {
  const currentEntries = entriesInMonth(journey, now, 0);
  const previousEntries = entriesInMonth(journey, now, -1);
  const currentScore = calculateRawScore(wallet, currentEntries);
  const previousScore = calculateRawScore(wallet, previousEntries);
  const optimizedRate = optimizedPurchaseRate(currentEntries);
  const acceptanceRate = recommendationAcceptanceRate(currentEntries);
  const categoryCoverage = normalizedCategoryCoverage(currentEntries);
  const walletDiversity = normalizedWalletDiversity(wallet);
  const missedOpportunityPenalty = calculateMissedOpportunityPenalty(currentEntries);

  return {
    score: currentScore,
    trend: currentScore - previousScore,
    optimizedPurchaseRate: optimizedRate,
    categoryCoverage,
    recommendationAcceptanceRate: acceptanceRate,
    walletDiversity,
    missedOpportunityPenalty,
    explanation: scoreExplanation(currentScore, currentEntries.length)
  };
}

export function calculateWeeklySummary(
  journey: PaymentJourneyEntry[],
  opportunities: WalletCoachOpportunity[] = [],
  now = new Date()
): WeeklySummary {
  const weekEntries = entriesSince(journey, now, 7);
  const categories = summarizeCategories(weekEntries).sort(
    (a, b) =>
      categoryOptimizedRate(b) - categoryOptimizedRate(a) ||
      b.estimatedRewards - a.estimatedRewards
  );
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: now.toISOString(),
    purchasesCompleted: weekEntries.length,
    optimizedPurchases: weekEntries.filter(isOptimizedPurchase).length,
    estimatedRewards: roundCurrency(
      weekEntries.reduce((sum, entry) => sum + (entry.estimatedRewardValue || 0), 0)
    ),
    biggestOpportunity: opportunities[0]?.title || null,
    strongestCategory: categories[0]?.category || null
  };
}

export function addDismissedOpportunity(
  dismissed: DismissedOpportunity[],
  opportunityId: string,
  now = new Date()
) {
  if (dismissed.some((item) => item.opportunityId === opportunityId)) {
    return dismissed;
  }
  return [
    ...dismissed,
    {
      opportunityId,
      dismissedAt: now.toISOString()
    }
  ];
}

export function safeDismissedOpportunities(value: unknown): DismissedOpportunity[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DismissedOpportunity => {
    if (!item || typeof item !== "object") return false;
    const dismissed = item as DismissedOpportunity;
    return Boolean(dismissed.opportunityId && dismissed.dismissedAt);
  });
}

export function coachNavigationTarget(opportunityId: string) {
  return {
    screen: "OpportunityDetail",
    params: { opportunityId }
  } as const;
}

function calculateRawScore(wallet: WalletCard[], entries: PaymentJourneyEntry[]) {
  if (!entries.length) {
    return wallet.length ? 42 : 20;
  }
  const optimizedRate = optimizedPurchaseRate(entries);
  const acceptanceRate = recommendationAcceptanceRate(entries);
  const categoryCoverage = normalizedCategoryCoverage(entries);
  const walletDiversity = normalizedWalletDiversity(wallet);
  const rewardSignal = entries.some((entry) => (entry.estimatedRewardValue || 0) > 0) ? 1 : 0;
  const missedOpportunityPenalty = calculateMissedOpportunityPenalty(entries);
  const score =
    optimizedRate * 40 +
    acceptanceRate * 25 +
    categoryCoverage * 15 +
    walletDiversity * 10 +
    rewardSignal * 10 -
    missedOpportunityPenalty;
  return clampScore(Math.round(score));
}

function optimizedPurchaseRate(entries: PaymentJourneyEntry[]) {
  if (!entries.length) return 0;
  return entries.filter(isOptimizedPurchase).length / entries.length;
}

function recommendationAcceptanceRate(entries: PaymentJourneyEntry[]) {
  if (!entries.length) return 0;
  const accepted = entries.filter(
    (entry) => normalize(entry.selectedCard) === normalize(entry.recommendedCard)
  ).length;
  return accepted / entries.length;
}

function normalizedCategoryCoverage(entries: PaymentJourneyEntry[]) {
  const categories = new Set(entries.map((entry) => classifyJourneyCategory(entry)));
  return Math.min(categories.size / CATEGORY_COVERAGE_TARGET, 1);
}

function normalizedWalletDiversity(wallet: WalletCard[]) {
  const issuers = new Set(wallet.map((card) => normalize(card.issuer || "unknown")));
  return Math.min(Math.max(issuers.size, wallet.length ? 1 : 0) / WALLET_DIVERSITY_TARGET, 1);
}

function calculateMissedOpportunityPenalty(entries: PaymentJourneyEntry[]) {
  const missed = entries.filter((entry) => !isOptimizedPurchase(entry)).length;
  return Math.min(missed * 4, 20);
}

function isOptimizedPurchase(entry: PaymentJourneyEntry) {
  return (
    normalize(entry.selectedCard) === normalize(entry.recommendedCard) &&
    entry.confidence >= OPTIMIZED_CONFIDENCE_THRESHOLD
  );
}

function generateSuccessMoments(
  journey: PaymentJourneyEntry[],
  score: OptimizationScore,
  now: Date
): SuccessMoment[] {
  const optimizedEntries = journey.filter(isOptimizedPurchase);
  const totalRewards = journey.reduce(
    (sum, entry) => sum + (entry.estimatedRewardValue || 0),
    0
  );
  const moments: SuccessMoment[] = [];
  if (optimizedEntries.length >= 25) {
    moments.push({
      momentId: "twenty-five-optimized-purchases",
      title: "25 optimized purchases",
      explanation: "You have built a strong Smart Pay habit."
    });
  }
  if (totalRewards >= 100) {
    moments.push({
      momentId: "one-hundred-estimated-rewards",
      title: "$100 in estimated rewards",
      explanation: "Your completed decisions are adding measurable value."
    });
  }
  if (score.score >= 90 && entriesInMonth(journey, now, 0).length > 0) {
    moments.push({
      momentId: "first-month-above-ninety",
      title: "Above 90% this month",
      explanation: "Your wallet optimization score is in excellent shape."
    });
  }
  const restaurantSummary = summarizeCategories(journey).find(
    (summary) => summary.category === "restaurants"
  );
  if (restaurantSummary && restaurantSummary.entries.length >= 5 && categoryOptimizedRate(restaurantSummary) >= 0.9) {
    moments.push({
      momentId: "restaurant-expert",
      title: "Restaurant expert",
      explanation: "Dining and delivery purchases are consistently optimized."
    });
  }
  const travelSummary = summarizeCategories(journey).find(
    (summary) => summary.category === "travel"
  );
  if (travelSummary && travelSummary.entries.length >= 3 && categoryOptimizedRate(travelSummary) >= 0.9) {
    moments.push({
      momentId: "travel-optimizer",
      title: "Travel optimizer",
      explanation: "Recent travel decisions are using the recommended card."
    });
  }
  return moments;
}

function findBiggestRecentWin(journey: PaymentJourneyEntry[], now: Date) {
  return (
    entriesSince(journey, now, 30)
      .filter((entry) => (entry.estimatedRewardValue || 0) > 0)
      .sort(
        (a, b) =>
          (b.estimatedRewardValue || 0) - (a.estimatedRewardValue || 0)
      )[0] || null
  );
}

function findMostImprovedCategory(journey: PaymentJourneyEntry[], now: Date) {
  const current = summarizeCategories(entriesInMonth(journey, now, 0));
  const previous = summarizeCategories(entriesInMonth(journey, now, -1));
  let bestCategory: string | null = null;
  let bestImprovement = Number.NEGATIVE_INFINITY;
  current.forEach((summary) => {
    const previousSummary = previous.find((item) => item.category === summary.category);
    const improvement =
      categoryOptimizedRate(summary) -
      (previousSummary ? categoryOptimizedRate(previousSummary) : 0);
    if (improvement > bestImprovement) {
      bestCategory = summary.category;
      bestImprovement = improvement;
    }
  });
  return bestCategory || current[0]?.category || null;
}

function summarizeCategories(entries: PaymentJourneyEntry[]): CategorySummary[] {
  const summaries = new Map<string, PaymentJourneyEntry[]>();
  entries.forEach((entry) => {
    const category = classifyJourneyCategory(entry);
    summaries.set(category, [...(summaries.get(category) || []), entry]);
  });
  return [...summaries.entries()].map(([category, categoryEntries]) => ({
    category,
    entries: sortJourney(categoryEntries),
    optimizedEntries: categoryEntries.filter(isOptimizedPurchase),
    estimatedRewards: categoryEntries.reduce(
      (sum, entry) => sum + (entry.estimatedRewardValue || 0),
      0
    )
  }));
}

function categoryOptimizedRate(summary: CategorySummary) {
  if (!summary.entries.length) return 0;
  return summary.optimizedEntries.length / summary.entries.length;
}

function estimateAnnualValue(entries: PaymentJourneyEntry[]) {
  const rewards = entries
    .map((entry) => entry.estimatedRewardValue)
    .filter((value): value is number => typeof value === "number" && value > 0);
  if (entries.length < 2 || rewards.length < 2) return null;
  const averageReward = rewards.reduce((sum, value) => sum + value, 0) / rewards.length;
  return roundCurrency(averageReward * 12);
}

function classifyJourneyCategory(entry: PaymentJourneyEntry) {
  const merchant = normalizeMerchant(entry.merchant);
  const explanation = normalize(
    `${entry.recommendationExplanation.summary} ${entry.recommendationExplanation.factors.join(" ")}`
  );
  if (/starbucks|restaurant|dining|doordash|uber eats|domino|chipotle|sweetgreen/.test(merchant) || explanation.includes("dining")) {
    return "restaurants";
  }
  if (/delta|united|southwest|marriott|hilton|airbnb|expedia|booking|flight|hotel|travel|rental car/.test(merchant) || explanation.includes("travel")) {
    return "travel";
  }
  if (/costco|grocery|groceries|whole foods|supermarket|kroger|safeway/.test(merchant) || explanation.includes("grocery")) {
    return "groceries";
  }
  if (/gas|shell|exxon|chevron|bp/.test(merchant) || explanation.includes("gas")) {
    return "gas";
  }
  if (/best buy|apple|electronics|iphone/.test(merchant)) {
    return "electronics";
  }
  if (/target|walmart|amazon|lululemon|nike|home depot|lowe/.test(merchant)) {
    return "general retail";
  }
  return "general";
}

function entriesSince(entries: PaymentJourneyEntry[], now: Date, days: number) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  return sortJourney(
    entries.filter((entry) => new Date(entry.completionTimestamp) >= start)
  );
}

function entriesInMonth(entries: PaymentJourneyEntry[], now: Date, offset: number) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return sortJourney(
    entries.filter((entry) => {
      const completedAt = new Date(entry.completionTimestamp);
      return completedAt >= start && completedAt < end;
    })
  );
}

function sortJourney(entries: PaymentJourneyEntry[]) {
  return [...entries].sort(
    (a, b) =>
      new Date(b.completionTimestamp).getTime() -
      new Date(a.completionTimestamp).getTime()
  );
}

function dedupeOpportunities(opportunities: WalletCoachOpportunity[]) {
  const deduped = new Map<string, WalletCoachOpportunity>();
  opportunities.forEach((opportunity) => {
    if (!deduped.has(opportunity.opportunityId)) {
      deduped.set(opportunity.opportunityId, opportunity);
    }
  });
  return [...deduped.values()];
}

function compareOpportunityPriority(
  a: WalletCoachOpportunity,
  b: WalletCoachOpportunity
) {
  const priorityOrder: Record<OpportunityPriority, number> = {
    High: 0,
    Medium: 1,
    Low: 2
  };
  return priorityOrder[a.priority] - priorityOrder[b.priority];
}

function createOpportunity(opportunity: WalletCoachOpportunity) {
  return opportunity;
}

function scoreExplanation(score: number, entryCount: number) {
  if (!entryCount) {
    return "Start completing Smart Pay decisions to build a reliable score.";
  }
  if (score >= 90) {
    return "Your recent purchases are highly optimized.";
  }
  if (score >= 75) {
    return "Your wallet is performing well with a few chances to improve.";
  }
  return "Rewardly found clear room to improve recent payment choices.";
}

function normalizeMerchant(value: string) {
  return normalize(value).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}
