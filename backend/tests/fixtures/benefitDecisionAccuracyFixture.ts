import { canonicalizeCardBenefits } from "../../src/services/benefitIntelligenceService";
import { canonicalizeWalletBenefitState } from "../../src/services/walletIntelligenceService";

const SOURCE_DATE = "2026-07-01T00:00:00.000Z";

function card(input: any) {
  return {
    slug: input.slug,
    name: input.name,
    issuer: input.issuer,
    annualFee: input.annualFee ?? 0,
    productionEligible: true,
    sourceUrl: input.sourceUrl || `https://issuer.example/${input.slug}`,
    benefitsDetail: {
      sourceUrl: input.sourceUrl || `https://issuer.example/${input.slug}`,
      sourceType: "issuer_official",
      sourceTitle: `${input.name} Rewards and Benefits`,
      lastVerified: SOURCE_DATE,
      confidence: 0.95,
      productionEligible: true,
      ...input.benefitsDetail,
    },
  };
}

export const benefitDecisionAccuracyCards = {
  amexGold: card({
    slug: "amex-gold",
    name: "American Express Gold Card",
    issuer: "American Express",
    annualFee: 325,
    benefitsDetail: {
      rewardsByCategory: [
        { keys: ["dining"], rate: "4x", unit: "points" },
        { keys: ["groceries"], rate: "4x", unit: "points", capPerPeriodUSD: 25000, period: "year" },
      ],
      rewardsFlat: [{ rate: "1x", unit: "points" }],
      recurringCredits: [
        {
          id: "amex-gold-dining-credit",
          label: "$10 monthly dining credit",
          amountUSD: 10,
          period: "month",
          requiresEnrollment: true,
          eligibleWhen: { merchantPatterns: ["grubhub", "restaurants"] },
        },
      ],
    },
  }),
  chaseSapphirePreferred: card({
    slug: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred",
    issuer: "Chase",
    annualFee: 95,
    benefitsDetail: {
      rewardsByCategory: [
        { keys: ["dining"], rate: "3x", unit: "points" },
        { keys: ["travel"], rate: "2x", unit: "points" },
        { keys: ["streaming"], rate: "3x", unit: "points" },
        { keys: ["issuer_travel_portal"], rate: "5x", unit: "points" },
      ],
      rewardsFlat: [{ rate: "1x", unit: "points" }],
    },
  }),
  chaseFreedomFlex: card({
    slug: "chase-freedom-flex",
    name: "Chase Freedom Flex",
    issuer: "Chase",
    annualFee: 0,
    benefitsDetail: {
      rewardsByCategory: [
        { keys: ["dining"], rate: "3%", unit: "cash" },
        { keys: ["drugstores"], rate: "3%", unit: "cash" },
        { keys: ["issuer_travel_portal"], rate: "5%", unit: "cash" },
      ],
      rewardsRotating: [
        {
          start: "2026-07-01T00:00:00.000Z",
          end: "2026-09-30T23:59:59.000Z",
          activationRequired: true,
          categories: [
            { keys: ["gas"], rate: "5%", unit: "cash", capPerPeriodUSD: 1500, period: "quarter" },
          ],
        },
      ],
      rewardsFlat: [{ rate: "1%", unit: "cash" }],
    },
  }),
  capitalOneVenture: card({
    slug: "capital-one-venture",
    name: "Capital One Venture Rewards",
    issuer: "Capital One",
    annualFee: 95,
    benefitsDetail: {
      rewardsByCategory: [
        { keys: ["issuer_travel_portal"], rate: "5x", unit: "miles" },
      ],
      rewardsFlat: [{ rate: "2x", unit: "miles" }],
    },
  }),
  citiCustomCash: card({
    slug: "citi-custom-cash",
    name: "Citi Custom Cash",
    issuer: "Citi",
    annualFee: 0,
    benefitsDetail: {
      rewardsByCategory: [
        { keys: ["gas"], rate: "5%", unit: "cash", capPerPeriodUSD: 500, period: "month" },
        { keys: ["groceries"], rate: "5%", unit: "cash", capPerPeriodUSD: 500, period: "month" },
      ],
      rewardsFlat: [{ rate: "1%", unit: "cash" }],
    },
  }),
  citiDoubleCash: card({
    slug: "citi-double-cash",
    name: "Citi Double Cash",
    issuer: "Citi",
    annualFee: 0,
    benefitsDetail: {
      rewardsFlat: [{ rate: "2%", unit: "cash" }],
    },
  }),
  wellsFargoAutograph: card({
    slug: "wells-fargo-autograph",
    name: "Wells Fargo Autograph",
    issuer: "Wells Fargo",
    annualFee: 0,
    benefitsDetail: {
      rewardsByCategory: [
        { keys: ["dining"], rate: "3x", unit: "points" },
        { keys: ["travel"], rate: "3x", unit: "points" },
        { keys: ["gas"], rate: "3x", unit: "points" },
        { keys: ["streaming"], rate: "3x", unit: "points" },
      ],
      rewardsFlat: [{ rate: "1x", unit: "points" }],
    },
  }),
  wellsFargoActiveCash: card({
    slug: "wells-fargo-active-cash",
    name: "Wells Fargo Active Cash",
    issuer: "Wells Fargo",
    annualFee: 0,
    benefitsDetail: {
      rewardsFlat: [{ rate: "2%", unit: "cash" }],
    },
  }),
  bestBuyOfferCard: card({
    slug: "bestbuy-offer-card",
    name: "Bank Offer Card",
    issuer: "Wells Fargo",
    annualFee: 0,
    benefitsDetail: {
      merchantCredits: [
        {
          id: "bestbuy-statement-credit",
          label: "$20 statement credit at Best Buy",
          amountUSD: 20,
          period: "year",
          requiresEnrollment: true,
          eligibleWhen: { merchantPatterns: ["best buy"] },
        },
      ],
      rewardsFlat: [{ rate: "1%", unit: "cash" }],
    },
  }),
};

export function allBenefitDecisionAccuracyCards() {
  return Object.values(benefitDecisionAccuracyCards);
}

export function walletStateFor(
  cardFixture: any,
  labelPattern: RegExp,
  overrides: any,
) {
  const benefit = canonicalizeCardBenefits(cardFixture).find((item) =>
    labelPattern.test(item.label),
  );
  if (!benefit) throw new Error(`Missing benefit matching ${labelPattern}`);
  return canonicalizeWalletBenefitState({
    userId: "accuracy-user",
    cardSlug: cardFixture.slug,
    benefitId: benefit.id,
    enrollmentStatus: "not_required",
    activationStatus: "not_required",
    confidenceSource: "user_verified",
    ...overrides,
  });
}
