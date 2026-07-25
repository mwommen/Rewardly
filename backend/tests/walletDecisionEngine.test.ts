import { evaluateWalletDecision } from "../src/services/walletDecisionEngine";
import { canonicalizeCardBenefits } from "../src/services/benefitIntelligenceService";
import { canonicalizeWalletBenefitState } from "../src/services/walletIntelligenceService";

const NOW = new Date("2026-07-24T00:00:00.000Z");

function card(overrides: any) {
  return {
    slug: overrides.slug,
    name: overrides.name,
    issuer: overrides.issuer || "Other",
    annualFee: overrides.annualFee ?? 0,
    productionEligible: true,
    sourceUrl: overrides.sourceUrl || "https://issuer.example/card",
    benefitsDetail: {
      sourceUrl: overrides.sourceUrl || "https://issuer.example/card",
      sourceType: "issuer_official",
      lastVerified: "2026-07-01T00:00:00.000Z",
      confidence: 0.95,
      productionEligible: true,
      ...overrides.benefitsDetail,
    },
  };
}

const amexGold = card({
  slug: "amex-gold",
  name: "Amex Gold",
  issuer: "American Express",
  benefitsDetail: {
    rewardsByCategory: [
      { keys: ["dining"], rate: "4x", unit: "points" },
      { keys: ["groceries"], rate: "4x", unit: "points" },
    ],
    rewardsFlat: [{ rate: "1x", unit: "points" }],
  },
});

const sapphirePreferred = card({
  slug: "chase-sapphire-preferred",
  name: "Chase Sapphire Preferred",
  issuer: "Chase",
  benefitsDetail: {
    rewardsByCategory: [
      { keys: ["dining"], rate: "3x", unit: "points" },
      { keys: ["travel"], rate: "3x", unit: "points" },
    ],
    rewardsFlat: [{ rate: "1x", unit: "points" }],
  },
});

const venture = card({
  slug: "capital-one-venture",
  name: "Capital One Venture Rewards",
  issuer: "Capital One",
  benefitsDetail: {
    rewardsFlat: [{ rate: "2x", unit: "miles" }],
  },
});

const gasCard = card({
  slug: "gas-card",
  name: "Gas Card",
  benefitsDetail: {
    rewardsByCategory: [{ keys: ["gas"], rate: "5%", unit: "cash" }],
    rewardsFlat: [{ rate: "1%", unit: "cash" }],
  },
});

const retailCard = card({
  slug: "retail-card",
  name: "Retail Card",
  benefitsDetail: {
    rewardsByCategory: [{ keys: ["online_shopping"], rate: "3%", unit: "cash" }],
    rewardsFlat: [{ rate: "1%", unit: "cash" }],
  },
});

function decision(cards: any[], purchase: any, walletBenefitStates: any[] = []) {
  return evaluateWalletDecision({
    wallet: { cards, cardSlugs: cards.map((item) => item.slug) },
    purchase: {
      merchant: { name: purchase.merchant, category: purchase.category },
      amount: purchase.amount ?? 100,
      category: purchase.category,
      purchaseChannel: "online",
    },
    walletBenefitStates,
    now: NOW,
  });
}

function benefitId(cardFixture: any, labelPattern: RegExp) {
  const benefit = canonicalizeCardBenefits(cardFixture, { now: NOW }).find((item) =>
    labelPattern.test(item.label),
  );
  if (!benefit) throw new Error(`Missing fixture benefit ${labelPattern}`);
  return benefit.id;
}

describe("walletDecisionEngine", () => {
  test("Dining: chooses Amex Gold 4x over owned alternatives and explains the exact rule", () => {
    const result = decision([venture, sapphirePreferred, amexGold], {
      merchant: "Starbucks",
      category: "dining",
      amount: 50,
    });

    expect(result.winningCard?.card.slug).toBe("amex-gold");
    expect(result.runnerUp?.card.slug).toBe("chase-sapphire-preferred");
    expect(result.winningRule).toEqual(
      expect.objectContaining({
        label: "4x on dining",
        rewardProgram: "Membership Rewards",
        earningRate: 4,
        earningUnit: "points_per_dollar",
      }),
    );
    expect(result.explanation).toContain("Merchant classified as Dining.");
    expect(result.explanation).toContain("Amex Gold earns 4x Membership Rewards.");
    expect(result.explanation).toContain("Chase Sapphire Preferred earns 3x Ultimate Rewards.");
  });

  test("Grocery: uses grocery category earn when it beats base earn", () => {
    const result = decision([venture, amexGold], {
      merchant: "Whole Foods Market",
      category: "groceries",
      amount: 120,
    });

    expect(result.winningCard?.card.slug).toBe("amex-gold");
    expect(result.winningRule?.label).toBe("4x on groceries");
    expect(result.winningRule?.sourceKind).toBe("reward_category");
  });

  test("Gas: picks a verified gas category rule", () => {
    const result = decision([venture, gasCard], {
      merchant: "Shell",
      category: "gas",
      amount: 60,
    });

    expect(result.winningCard?.card.slug).toBe("gas-card");
    expect(result.winningRule).toEqual(
      expect.objectContaining({
        label: "5% on gas",
        earningUnit: "percent_back",
      }),
    );
  });

  test("Travel: picks travel rewards from the user's owned wallet", () => {
    const result = decision([venture, sapphirePreferred], {
      merchant: "Delta",
      category: "travel",
      amount: 300,
    });

    expect(result.winningCard?.card.slug).toBe("chase-sapphire-preferred");
    expect(result.runnerUp?.card.slug).toBe("capital-one-venture");
    expect(result.winningRule?.label).toBe("3x on travel");
  });

  test("General Retail: uses a reusable retail category rule", () => {
    const result = decision([venture, retailCard], {
      merchant: "Best Buy",
      category: "general_retail",
      amount: 200,
    });

    expect(result.winningCard?.card.slug).toBe("retail-card");
    expect(result.winningRule?.sourceKind).toBe("reward_category");
    expect(result.winningRule?.label).toBe("3% on online_shopping");
  });

  test("Unknown merchant: falls back to the best owned base earning rule", () => {
    const result = decision([sapphirePreferred, venture], {
      merchant: "Unknown Merchant",
      category: "unknown",
      amount: 75,
    });

    expect(result.winningCard?.card.slug).toBe("capital-one-venture");
    expect(result.winningRule).toEqual(
      expect.objectContaining({
        sourceKind: "reward_flat",
        label: "2x on all purchases",
      }),
    );
  });

  test("Two cards with equal rewards: keeps deterministic runner-up comparison", () => {
    const equalA = card({
      slug: "equal-a",
      name: "Alpha Card",
      benefitsDetail: { rewardsFlat: [{ rate: "2%", unit: "cash" }] },
    });
    const equalB = card({
      slug: "equal-b",
      name: "Beta Card",
      benefitsDetail: { rewardsFlat: [{ rate: "2%", unit: "cash" }] },
    });

    const result = decision([equalB, equalA], {
      merchant: "General Store",
      category: "unknown",
      amount: 100,
    });

    expect(result.winningCard?.card.slug).toBe("equal-a");
    expect(result.runnerUp?.card.slug).toBe("equal-b");
  });

  test("Category vs base earn: category rule beats lower base earn on the same purchase", () => {
    const result = decision([venture, amexGold], {
      merchant: "Restaurant",
      category: "dining",
      amount: 100,
    });

    expect(result.winningRule?.sourceKind).toBe("reward_category");
    expect(result.winningRule?.label).toBe("4x on dining");
  });

  test("Merchant-specific rule beats category rule when it has more value", () => {
    const merchantCard = card({
      slug: "merchant-card",
      name: "Merchant Card",
      benefitsDetail: {
        merchantCredits: [
          {
            id: "bestbuy-credit",
            label: "$25 statement credit at Best Buy",
            amountUSD: 25,
            period: "year",
            eligibleWhen: { merchantPatterns: ["best buy"] },
            requiresEnrollment: false,
          },
        ],
      },
    });
    const creditId = benefitId(merchantCard, /\$25 statement credit/i);
    const activeState = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "merchant-card",
      benefitId: creditId,
      enrollmentStatus: "not_required",
      activationStatus: "not_required",
      remainingValue: 25,
      cycleValueLimit: 25,
      confidenceSource: "user_verified",
    });

    const result = decision(
      [retailCard, merchantCard],
      { merchant: "Best Buy", category: "general_retail", amount: 100 },
      [activeState],
    );

    expect(result.winningCard?.card.slug).toBe("merchant-card");
    expect(result.winningRule).toEqual(
      expect.objectContaining({
        sourceKind: "merchant_credit",
        merchantRestrictions: expect.arrayContaining(["best buy"]),
        estimatedValueUSD: 25,
      }),
    );
  });

  test("Expired offer: expired merchant credit cannot win", () => {
    const expiredCard = card({
      slug: "expired-offer-card",
      name: "Expired Offer Card",
      benefitsDetail: {
        merchantCredits: [
          {
            id: "expired-credit",
            label: "$50 statement credit at Best Buy",
            amountUSD: 50,
            period: "year",
            expiresAt: "2026-01-01T00:00:00.000Z",
            eligibleWhen: { merchantPatterns: ["best buy"] },
            requiresEnrollment: false,
          },
        ],
      },
    });
    const expiredId = benefitId(expiredCard, /\$50 statement credit/i);
    const activeState = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "expired-offer-card",
      benefitId: expiredId,
      enrollmentStatus: "not_required",
      activationStatus: "not_required",
      remainingValue: 50,
      cycleValueLimit: 50,
      confidenceSource: "user_verified",
    });

    const result = decision(
      [expiredCard, venture],
      { merchant: "Best Buy", category: "general_retail", amount: 100 },
      [activeState],
    );

    expect(result.winningCard?.card.slug).toBe("capital-one-venture");
    expect(result.evaluatedCards.find((item) => item.card.slug === "expired-offer-card")?.winningRule).toBeNull();
  });

  test("Enrollment-required benefit: unenrolled benefit is ignored", () => {
    const enrollmentCard = card({
      slug: "enrollment-card",
      name: "Enrollment Card",
      benefitsDetail: {
        merchantCredits: [
          {
            id: "merchant-enrollment-credit",
            label: "$30 statement credit at Best Buy",
            amountUSD: 30,
            period: "year",
            eligibleWhen: { merchantPatterns: ["best buy"] },
            requiresEnrollment: true,
          },
        ],
      },
    });
    const enrollmentId = benefitId(enrollmentCard, /\$30 statement credit/i);
    const notEnrolled = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "enrollment-card",
      benefitId: enrollmentId,
      enrollmentStatus: "not_enrolled",
      activationStatus: "not_required",
      remainingValue: 30,
      cycleValueLimit: 30,
      confidenceSource: "user_verified",
    });

    const result = decision(
      [enrollmentCard, venture],
      { merchant: "Best Buy", category: "general_retail", amount: 100 },
      [notEnrolled],
    );

    expect(result.winningCard?.card.slug).toBe("capital-one-venture");
    expect(result.evaluatedCards.find((item) => item.card.slug === "enrollment-card")?.winningRule).toBeNull();
  });

  test("Never compares against cards outside the user's wallet", () => {
    const result = decision([venture], {
      merchant: "Starbucks",
      category: "dining",
      amount: 100,
    });

    expect(result.evaluatedCards).toHaveLength(1);
    expect(result.winningCard?.card.slug).toBe("capital-one-venture");
    expect(result.explanation).not.toContain("Amex Gold");
    expect(result.explanation).not.toContain("Sapphire");
  });
});
