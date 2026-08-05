import type { FavoriteMerchant, NearbyMerchant } from "../types/location";
import type { PaymentJourneyEntry } from "../types/paymentJourney";
import type { PersonalContextCard, DailyBriefing } from "../types/personalIntelligence";
import type { ShoppingPlan } from "../types/planning";
import type { WalletCard } from "../types/rewardly";
import type { WalletCoachSnapshot } from "../types/walletCoach";

const MAX_BRIEFING_CARDS = 4;

export type DailyBriefingInput = {
  wallet: WalletCard[];
  walletCoach?: WalletCoachSnapshot | null;
  paymentJourney: PaymentJourneyEntry[];
  plans: ShoppingPlan[];
  nearbyMerchants: NearbyMerchant[];
  favoriteMerchants: FavoriteMerchant[];
  locationGranted: boolean;
  generatedAt?: string;
};

export function createDailyBriefing(input: DailyBriefingInput): DailyBriefing {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const cards = buildContextCards(input, generatedAt)
    .filter(
      (card) => !card.expiresAt || Date.parse(card.expiresAt) > Date.parse(generatedAt),
    )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_BRIEFING_CARDS);

  return {
    headline: cards[0]?.title || "Rewardly is ready.",
    subheadline:
      cards[0]?.explanation ||
      "Ask Smart Pay before your next purchase and Rewardly will choose the best card from your wallet.",
    cards,
    emptyState: createSmartPayFallback(),
    generatedAt,
  };
}

function buildContextCards(
  input: DailyBriefingInput,
  generatedAt: string,
): PersonalContextCard[] {
  const cards: PersonalContextCard[] = [];

  if (!input.wallet.length) {
    cards.push({
      id: "wallet-empty",
      kind: "wallet_empty",
      title: "Add your first card.",
      explanation:
        "Rewardly needs your wallet before it can recommend the smartest payment method.",
      primaryActionLabel: "Add card",
      primaryAction: "add_card",
      icon: "wallet",
      priority: 100,
    });
    return cards;
  }

  const activePlan = findActivePlan(input.plans);
  if (activePlan) {
    const remaining = activePlan.items.filter(
      (item) => item.completionState !== "completed",
    ).length;
    cards.push({
      id: `plan-${activePlan.planId}`,
      kind: "shopping_plan",
      title:
        remaining === 1
          ? "One planned purchase is waiting."
          : `${remaining} planned purchases are waiting.`,
      explanation: `${activePlan.title} is ready for Smart Pay when you are.`,
      primaryActionLabel: "Review plan",
      primaryAction: "open_plan",
      secondaryActionLabel: "Smart Pay",
      secondaryAction: "open_smart_pay",
      icon: "plan",
      priority: 92,
      metadata: { planId: activePlan.planId },
    });
  }

  const nearby = input.nearbyMerchants[0];
  if (input.locationGranted && nearby) {
    const recentForMerchant = input.paymentJourney.find(
      (entry) => normalize(entry.merchant) === normalize(nearby.name),
    );
    cards.push({
      id: `nearby-${normalize(nearby.name)}`,
      kind: "nearby_smart_pay",
      title: `${nearby.name} is nearby.`,
      explanation: recentForMerchant?.recommendedCard
        ? `Last time, Rewardly recommended ${recentForMerchant.recommendedCard}.`
        : "Tap once and enter the amount when you are ready to pay.",
      primaryActionLabel: "Smart Pay",
      primaryAction: "open_smart_pay_merchant",
      secondaryActionLabel: isFavorite(input.favoriteMerchants, nearby.name)
        ? "Saved"
        : undefined,
      icon: "location",
      priority: 88,
      metadata: {
        merchantName: nearby.name,
        merchantCategory: nearby.category,
        distanceMiles: nearby.distanceMiles,
        accuracy: nearby.accuracy,
        recommendedCard: recentForMerchant?.recommendedCard,
      },
    });
  }

  const topOpportunity = input.walletCoach?.topOpportunity;
  if (topOpportunity) {
    cards.push({
      id: `coach-${topOpportunity.opportunityId}`,
      kind: "wallet_coach",
      title: topOpportunity.title,
      explanation: topOpportunity.explanation,
      primaryActionLabel: "View coach",
      primaryAction: "open_wallet_coach",
      icon: "coach",
      priority: topOpportunity.priority === "High" ? 84 : 72,
      metadata: {
        opportunityId: topOpportunity.opportunityId,
        valueLabel:
          topOpportunity.estimatedAnnualValue === null
            ? undefined
            : `$${Math.round(topOpportunity.estimatedAnnualValue)}`,
      },
    });
  }

  const recentWin = input.walletCoach?.biggestRecentWin || input.paymentJourney[0];
  if (recentWin) {
    cards.push({
      id: `recent-${recentWin.paymentId}`,
      kind: "recent_decision",
      title: "Your last smart decision is saved.",
      explanation: `${recentWin.recommendedCard} was recommended at ${recentWin.merchant}.`,
      primaryActionLabel: "View decision",
      primaryAction: "open_payment",
      secondaryActionLabel: "Journey",
      secondaryAction: "open_journey",
      icon: "spark",
      priority: 68,
      metadata: {
        paymentId: recentWin.paymentId,
        merchantName: recentWin.merchant,
        recommendedCard: recentWin.recommendedCard,
        valueLabel:
          recentWin.estimatedRewardValue === null
            ? undefined
            : `$${recentWin.estimatedRewardValue.toFixed(2)}`,
      },
      expiresAt: addDays(generatedAt, 7),
    });
  }

  const weekly = input.walletCoach?.weeklySummary;
  if (weekly && weekly.purchasesCompleted > 0) {
    cards.push({
      id: "weekly-progress",
      kind: "weekly_progress",
      title: `${weekly.optimizedPurchases} optimized this week.`,
      explanation:
        weekly.estimatedRewards > 0
          ? `Rewardly tracked about $${weekly.estimatedRewards.toFixed(2)} in value.`
          : "Your journey is building a clearer picture of your payment habits.",
      primaryActionLabel: "View journey",
      primaryAction: "open_journey",
      icon: "progress",
      priority: 58,
    });
  }

  cards.push(createSmartPayFallback());
  return cards;
}

function findActivePlan(plans: ShoppingPlan[]) {
  return plans.find(
    (plan) =>
      plan.status === "active" &&
      plan.items.some((item) => item.completionState !== "completed"),
  );
}

function createSmartPayFallback(): PersonalContextCard {
  return {
    id: "smart-pay-default",
    kind: "smart_pay",
    title: "Smart Pay is ready.",
    explanation:
      "Search a merchant, enter an amount, and Rewardly will recommend the best card.",
    primaryActionLabel: "Start Smart Pay",
    primaryAction: "open_smart_pay",
    icon: "pay",
    priority: 40,
  };
}

function isFavorite(favorites: FavoriteMerchant[], merchantName: string) {
  return favorites.some((favorite) => normalize(favorite.name) === normalize(merchantName));
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
