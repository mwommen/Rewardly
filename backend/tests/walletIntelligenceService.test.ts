jest.mock("../src/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("../src/utils/category", () => ({
  inferCategories: jest.fn(),
}));

jest.mock("../src/utils/valuation", () => ({
  toCashEquivalent: jest.fn((unit: string, rate: number) => {
    if (unit === "cash") return rate / 100;
    return rate * 0.01;
  }),
}));

import { getDb } from "../src/db";
import { recommendBestCards } from "../src/services/recommendationService";
import {
  auditWalletBenefitStates,
  canonicalizeWalletBenefitState,
  evaluateWalletBenefitForRecommendation,
  findWalletStateForBenefit,
  recordWalletBenefitEvent,
  resetWalletBenefitCycle,
  WALLET_SYNC_PROVIDER_INTERFACES,
} from "../src/services/walletIntelligenceService";
import {
  InMemoryWalletBenefitStateRepository,
  WalletBenefitStateDuplicateEventError,
  WalletBenefitStateVersionError,
} from "../src/services/walletBenefitStateRepository";
import { WalletUsageMutationService } from "../src/services/walletUsageMutationService";
import { walletIntelligenceFixtureStates } from "../src/services/walletIntelligenceFixture";
import { canonicalizeCardBenefits } from "../src/services/benefitIntelligenceService";
import { inferCategories } from "../src/utils/category";

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockedInferCategories = inferCategories as jest.MockedFunction<typeof inferCategories>;

const DINING_CREDIT_ID = "amex-gold:recurring-credit:monthly-dining-credit";
const ACTIVATION_BENEFIT_ID = "chase-freedom-flex:rotating:grocery-5x";

function makeDb(cards: any[]) {
  return {
    collection: () => ({
      find: () => ({ toArray: async () => cards }),
    }),
  } as any;
}

function goldCard() {
  return {
    slug: "amex-gold",
    name: "American Express Gold Card",
    issuer: "American Express",
    annualFee: 325,
    productionEligible: true,
    benefitsDetail: {
      productionEligible: true,
      confidence: 0.95,
      lastVerified: "2026-07-01T00:00:00.000Z",
      recurringCredits: [
        {
          id: "monthly-dining-credit",
          label: "$10 monthly dining credit",
          amountUSD: 10,
          period: "month",
          requiresEnrollment: true,
          eligibleWhen: {
            merchantPatterns: ["grubhub"],
            channels: ["online"],
          },
        },
      ],
    },
  };
}

function freedomCard() {
  return {
    slug: "chase-freedom-flex",
    name: "Chase Freedom Flex",
    issuer: "Chase",
    annualFee: 0,
    productionEligible: true,
    benefitsDetail: {
      productionEligible: true,
      confidence: 0.95,
      lastVerified: "2026-07-01T00:00:00.000Z",
      rewardsRotating: [
        {
          start: "2026-07-01T00:00:00.000Z",
          end: "2026-09-30T23:59:59.000Z",
          activationRequired: true,
          categories: [
            {
              keys: ["groceries"],
              rate: "5%",
              unit: "cash",
            },
          ],
        },
      ],
    },
  };
}

function cappedGroceryCard() {
  return {
    slug: "capped-grocery",
    name: "Capped Grocery Card",
    issuer: "Other",
    annualFee: 0,
    productionEligible: true,
    lastVerified: "2026-07-01T00:00:00.000Z",
    benefitsDetail: {
      productionEligible: true,
      confidence: 0.95,
      rewardsFlat: [{ rate: "1%", unit: "cash" }],
      rewardsByCategory: [
        {
          keys: ["groceries"],
          rate: "5%",
          unit: "cash",
          capPerPeriodUSD: 20,
          period: "month",
        },
      ],
    },
  };
}

describe("walletIntelligenceService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    jest.clearAllMocks();
  });

  afterEach(() => jest.useRealTimers());

  test("canonical wallet state model covers lifecycle, usage, confidence, and provider interfaces", () => {
    const states = walletIntelligenceFixtureStates();
    const audit = auditWalletBenefitStates(states);

    expect(states[0]).toEqual(
      expect.objectContaining({
        walletBenefitStateId: expect.any(String),
        userId: "wallet-demo-user",
        cardId: "amex-platinum",
        benefitId: expect.any(String),
        status: expect.any(String),
        enrollmentStatus: expect.any(String),
        activationStatus: expect.any(String),
        remainingValue: expect.any(Number),
        confidence: expect.any(Number),
        events: expect.any(Array),
      }),
    );
    expect(audit).toEqual(
      expect.objectContaining({
        stateCount: 7,
        activationRequired: 1,
        partiallyUsed: 1,
        exhausted: 1,
        expired: 1,
      }),
    );
    expect(WALLET_SYNC_PROVIDER_INTERFACES.map((provider) => provider.providerType)).toEqual(
      expect.arrayContaining([
        "issuer_api",
        "plaid",
        "user_confirmation",
        "manual_edit",
        "receipt_analysis",
        "email_parsing",
      ]),
    );
  });

  test("evaluates enrollment required, activation required, unknown, partially used, exhausted, and expired states", () => {
    const benefit = canonicalizeCardBenefits(goldCard())[0];
    const enrolled = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: DINING_CREDIT_ID,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 7,
      cycleValueLimit: 10,
      confidenceSource: "user_verified",
    });
    const notEnrolled = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: DINING_CREDIT_ID,
      enrollmentStatus: "not_enrolled",
      activationStatus: "not_required",
      remainingValue: 10,
      cycleValueLimit: 10,
    });
    const exhausted = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: DINING_CREDIT_ID,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 0,
      cycleValueLimit: 10,
    });
    const expired = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: DINING_CREDIT_ID,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      expirationDate: "2026-01-01T00:00:00.000Z",
    });

    expect(evaluateWalletBenefitForRecommendation(benefit, [enrolled])).toEqual(
      expect.objectContaining({ eligible: true, reason: "partially_used", remainingValue: 7 }),
    );
    expect(evaluateWalletBenefitForRecommendation(benefit, [notEnrolled])).toEqual(
      expect.objectContaining({ eligible: false, reason: "enrollment_required" }),
    );
    expect(evaluateWalletBenefitForRecommendation(benefit, [exhausted])).toEqual(
      expect.objectContaining({ eligible: false, reason: "exhausted" }),
    );
    expect(evaluateWalletBenefitForRecommendation(benefit, [expired])).toEqual(
      expect.objectContaining({ eligible: false, reason: "expired" }),
    );
    expect(evaluateWalletBenefitForRecommendation(benefit, [])).toEqual(
      expect.objectContaining({ eligible: false, reason: "wallet_state_required" }),
    );
    expect(evaluateWalletBenefitForRecommendation(benefit, [], { statePolicy: "compatibility" })).toEqual(
      expect.objectContaining({ eligible: true, reason: "no_wallet_state" }),
    );
  });

  test("tracks history and deterministic monthly, quarterly, annual, and usage-count reset behavior", () => {
    const monthly = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: DINING_CREDIT_ID,
      enrollmentStatus: "enrolled",
      currentCycle: "2026-07",
      currentSpend: 10,
      benefitUsageCount: 1,
      remainingValue: 0,
      cycleValueLimit: 10,
      cycleFrequency: "monthly",
      cycleStartsAt: "2026-07-01T00:00:00.000Z",
      cycleEndsAt: "2026-07-31T23:59:59.000Z",
      resetDate: "2026-08-01T00:00:00.000Z",
      confidenceSource: "user_verified",
    });
    const withEvent = recordWalletBenefitEvent(monthly, {
      eventType: "credit_exhausted",
      occurredAt: "2026-07-12T00:00:00.000Z",
      valueDelta: -10,
      source: "user_verified",
    });
    const reset = resetWalletBenefitCycle(withEvent, "2026-08-01T00:00:00.000Z");

    expect(withEvent.events).toHaveLength(1);
    expect(reset.currentSpend).toBe(0);
    expect(reset.benefitUsageCount).toBe(0);
    expect(reset.remainingValue).toBe(10);
    expect(reset.status).toBe("active");
    expect(reset.historicalCycles).toHaveLength(1);
    expect(resetWalletBenefitCycle(reset, "2026-08-01T00:00:00.000Z").historicalCycles).toHaveLength(1);
    expect(reset.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["credit_exhausted", "cycle_reset"]),
    );

    const quarterly = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "chase-freedom-flex",
      benefitId: ACTIVATION_BENEFIT_ID,
      activationStatus: "activated",
      remainingSpendCap: 1200,
      cycleSpendLimit: 1500,
      cycleFrequency: "quarterly",
      resetDate: "2026-10-01T00:00:00.000Z",
    });
    const annual = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "capital-one-venture-x",
      benefitId: "capital-one-venture-x:travel-credit",
      remainingValue: 300,
      cycleValueLimit: 300,
      cycleFrequency: "annual",
      resetDate: "2027-01-01T00:00:00.000Z",
    });
    const usageCount = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-platinum",
      benefitId: "amex-platinum:limited-use",
      remainingUses: 0,
      cycleUsageLimit: 2,
      cycleFrequency: "usage_count",
      resetDate: "2027-01-01T00:00:00.000Z",
    });

    expect(quarterly.resetDate).toBe("2026-10-01T00:00:00.000Z");
    expect(annual.resetDate).toBe("2027-01-01T00:00:00.000Z");
    expect(resetWalletBenefitCycle(quarterly).remainingSpendCap).toBe(1500);
    expect(resetWalletBenefitCycle(annual).remainingValue).toBe(300);
    expect(resetWalletBenefitCycle(usageCount).remainingUses).toBe(2);
  });

  test("recommendation value changes with remaining value, exhaustion, enrollment, activation, reset, and expiration", async () => {
    mockedInferCategories.mockReturnValue(["restaurants"]);
    const benefitId = canonicalizeCardBenefits(goldCard())[0].id;
    const activeState = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 6,
      cycleValueLimit: 10,
      confidenceSource: "user_verified",
    });
    const exhaustedState = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 0,
      cycleValueLimit: 10,
      confidenceSource: "user_verified",
    });
    const resetState = resetWalletBenefitCycle(exhaustedState, "2026-08-01T00:00:00.000Z");
    const expiredState = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 6,
      cycleValueLimit: 10,
      confidenceSource: "user_verified",
      expirationDate: "2026-01-01T00:00:00.000Z",
    });

    mockedGetDb
      .mockResolvedValueOnce(makeDb([goldCard()]))
      .mockResolvedValueOnce(makeDb([goldCard()]))
      .mockResolvedValueOnce(makeDb([goldCard()]))
      .mockResolvedValueOnce(makeDb([goldCard()]));

    const active = await recommendBestCards({
      merchant: "Grubhub",
      amount: 20,
      scoringMode: "strict_production",
      purchaseChannel: "online",
      walletBenefitStates: [activeState],
      enrolledBenefitIds: [benefitId],
      knownEnrollmentBenefitIds: [benefitId],
    });
    const exhausted = await recommendBestCards({
      merchant: "Grubhub",
      amount: 20,
      scoringMode: "strict_production",
      purchaseChannel: "online",
      walletBenefitStates: [exhaustedState],
      enrolledBenefitIds: [benefitId],
      knownEnrollmentBenefitIds: [benefitId],
    });
    const reset = await recommendBestCards({
      merchant: "Grubhub",
      amount: 20,
      scoringMode: "strict_production",
      purchaseChannel: "online",
      walletBenefitStates: [resetState],
      enrolledBenefitIds: [benefitId],
      knownEnrollmentBenefitIds: [benefitId],
    });
    const expired = await recommendBestCards({
      merchant: "Grubhub",
      amount: 20,
      scoringMode: "strict_production",
      purchaseChannel: "online",
      walletBenefitStates: [expiredState],
      enrolledBenefitIds: [benefitId],
      knownEnrollmentBenefitIds: [benefitId],
    });

    expect(active.recommendations[0]).toEqual(
      expect.objectContaining({ estValueUSD: 6, matchedBenefit: "$6 monthly dining credit" }),
    );
    expect(exhausted.recommendations).toHaveLength(0);
    expect(reset.recommendations[0]).toEqual(
      expect.objectContaining({ estValueUSD: 10, matchedBenefit: "$10 monthly dining credit" }),
    );
    expect(expired.recommendations).toHaveLength(0);
  });

  test("activation state changes category recommendation", async () => {
    mockedInferCategories.mockReturnValue(["groceries"]);
    const benefit = canonicalizeCardBenefits(freedomCard())[0];
    const inactive = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "chase-freedom-flex",
      benefitId: benefit.id,
      activationStatus: "not_activated",
      remainingSpendCap: 1500,
      cycleSpendLimit: 1500,
      confidenceSource: "user_verified",
    });
    const active = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "chase-freedom-flex",
      benefitId: benefit.id,
      activationStatus: "activated",
      remainingSpendCap: 1500,
      cycleSpendLimit: 1500,
      confidenceSource: "user_verified",
    });

    mockedGetDb
      .mockResolvedValueOnce(makeDb([freedomCard()]))
      .mockResolvedValueOnce(makeDb([freedomCard()]));

    const beforeActivation = await recommendBestCards({
      merchant: "Whole Foods",
      amount: 100,
      scoringMode: "strict_production",
      purchaseChannel: "online",
      walletBenefitStates: [inactive],
      activatedBenefitIds: [],
      knownActivationBenefitIds: [benefit.id],
    });
    const afterActivation = await recommendBestCards({
      merchant: "Whole Foods",
      amount: 100,
      scoringMode: "strict_production",
      purchaseChannel: "online",
      walletBenefitStates: [active],
      activatedBenefitIds: [benefit.id],
      knownActivationBenefitIds: [benefit.id],
    });

    expect(beforeActivation.recommendations).toHaveLength(0);
    expect(afterActivation.recommendations[0]).toEqual(
      expect.objectContaining({
        slug: "chase-freedom-flex",
        effectiveRate: 0.05,
      }),
    );
  });

  test("splits capped reward scoring below, equal, above, and zero remaining spend cap", async () => {
    mockedInferCategories.mockReturnValue(["groceries"]);
    const card = cappedGroceryCard();
    const bonusBenefit = canonicalizeCardBenefits(card).find((benefit) => benefit.sourceKind === "reward_category");
    if (!bonusBenefit) throw new Error("Missing bonus benefit");

    const makeState = (remainingSpendCap: number) =>
      canonicalizeWalletBenefitState({
        userId: "u1",
        cardSlug: "capped-grocery",
        benefitId: bonusBenefit.id,
        enrollmentStatus: "not_required",
        activationStatus: "not_required",
        remainingSpendCap,
        cycleSpendLimit: 20,
        confidenceSource: "user_verified",
      });

    mockedGetDb
      .mockResolvedValueOnce(makeDb([card]))
      .mockResolvedValueOnce(makeDb([card]))
      .mockResolvedValueOnce(makeDb([card]))
      .mockResolvedValueOnce(makeDb([card]));

    const below = await recommendBestCards({
      merchant: "Whole Foods",
      amount: 10,
      scoringMode: "strict_production",
      walletBenefitStates: [makeState(20)],
    });
    const equal = await recommendBestCards({
      merchant: "Whole Foods",
      amount: 20,
      scoringMode: "strict_production",
      walletBenefitStates: [makeState(20)],
    });
    const above = await recommendBestCards({
      merchant: "Whole Foods",
      amount: 100,
      scoringMode: "strict_production",
      walletBenefitStates: [makeState(20)],
    });
    const zero = await recommendBestCards({
      merchant: "Whole Foods",
      amount: 100,
      scoringMode: "strict_production",
      walletBenefitStates: [makeState(0)],
    });

    expect(below.recommendations[0].effectiveRate).toBe(0.05);
    expect(equal.recommendations[0].effectiveRate).toBe(0.05);
    expect(above.recommendations[0]).toEqual(
      expect.objectContaining({
        effectiveRate: 0.018,
        walletEvidence: expect.arrayContaining([
          expect.objectContaining({
            kind: "spend_cap_split",
            cappedAmount: 20,
            uncappedAmount: 80,
          }),
        ]),
      }),
    );
    expect(zero.recommendations[0].effectiveRate).toBe(0.01);
  });

  test("usage mutation is atomic, idempotent, read-only for recommendations, and version guarded", async () => {
    const initial = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: DINING_CREDIT_ID,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 10,
      cycleValueLimit: 10,
      remainingUses: 1,
      cycleUsageLimit: 1,
      confidenceSource: "user_verified",
    });
    const repository = new InMemoryWalletBenefitStateRepository([initial]);
    const service = new WalletUsageMutationService(repository);

    const updated = await service.recordUsage({
      stateId: initial.walletBenefitStateId,
      occurredAt: "2026-07-22T12:00:00.000Z",
      idempotencyKey: "usage-1",
      valueUsed: 4,
      spendUsed: 4,
      usesUsed: 1,
      source: "user_verified",
    });

    expect(updated).toEqual(
      expect.objectContaining({
        remainingValue: 6,
        remainingUses: 0,
        status: "exhausted",
      }),
    );
    await expect(
      service.recordUsage({
        stateId: initial.walletBenefitStateId,
        occurredAt: "2026-07-22T12:00:00.000Z",
        idempotencyKey: "usage-1",
        valueUsed: 4,
      }),
    ).rejects.toBeInstanceOf(WalletBenefitStateDuplicateEventError);
    await expect(repository.saveState(initial, { expectedVersion: 99 })).rejects.toBeInstanceOf(
      WalletBenefitStateVersionError,
    );
  });

  test("confidence gating and stable canonical benefit identity protect strict recommendations", () => {
    const benefit = canonicalizeCardBenefits(goldCard())[0];
    const unknownConfidence = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: benefit.id,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 10,
      cycleValueLimit: 10,
      confidenceSource: "unknown",
    });
    const renamedLabelOnly = canonicalizeWalletBenefitState({
      userId: "u1",
      cardSlug: "amex-gold",
      benefitId: benefit.label,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 10,
      cycleValueLimit: 10,
      confidenceSource: "user_verified",
    });
    const explicitAlias = canonicalizeWalletBenefitState({
      ...renamedLabelOnly,
      benefitId: "legacy-dining-credit",
      legacyBenefitAliases: [benefit.id],
    });

    expect(evaluateWalletBenefitForRecommendation(benefit, [unknownConfidence])).toEqual(
      expect.objectContaining({
        eligible: false,
        reason: "wallet_confidence_too_low",
      }),
    );
    expect(findWalletStateForBenefit(benefit, [renamedLabelOnly])).toBeNull();
    expect(findWalletStateForBenefit(benefit, [explicitAlias])?.benefitId).toBe(
      "legacy-dining-credit",
    );
    expect(auditWalletBenefitStates([{ ...explicitAlias, ambiguousLegacyMapping: true }]).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "AMBIGUOUS_LEGACY_MAPPING" }),
      ]),
    );
  });
});
