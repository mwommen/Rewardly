import {
  canonicalizeWalletBenefitState,
  recordWalletBenefitEvent,
  resetWalletBenefitCycle,
  type CanonicalWalletBenefitState,
} from "./walletIntelligenceService";

const USER_ID = "wallet-demo-user";
const NOW = "2026-07-22T00:00:00.000Z";

export const walletFixtureBenefitIds = {
  lululemonCredit: "amex-platinum:merchant-credit:amex-platinum-lululemon-credit",
  uberCredit: "amex-gold:recurring-credit:uber-cash",
  diningCredit: "amex-gold:recurring-credit:dining-credit",
  quarterlyCategory: "chase-freedom-flex:rotating:grocery-5x",
  travelCredit: "capital-one-venture-x:recurring-credit:travel-credit",
  streamingCredit: "amex-platinum:recurring-credit:streaming-credit",
};

export function walletIntelligenceFixtureStates(): CanonicalWalletBenefitState[] {
  const states = [
    canonicalizeWalletBenefitState({
      userId: USER_ID,
      cardId: "amex-platinum",
      cardSlug: "amex-platinum",
      issuer: "American Express",
      benefitId: walletFixtureBenefitIds.lululemonCredit,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 75,
      cycleValueLimit: 75,
      cycleFrequency: "quarterly",
      cycleStartsAt: "2026-07-01T00:00:00.000Z",
      cycleEndsAt: "2026-09-30T23:59:59.000Z",
      currentSpend: 0,
      benefitUsageCount: 0,
      currentCycle: "2026-Q3",
      resetDate: "2026-10-01T00:00:00.000Z",
      lastObserved: NOW,
      lastVerified: NOW,
      confidenceSource: "user_verified",
      notes: ["User confirmed enrollment"],
    }),
    canonicalizeWalletBenefitState({
      userId: USER_ID,
      cardId: "amex-gold",
      cardSlug: "amex-gold",
      issuer: "American Express",
      benefitId: walletFixtureBenefitIds.uberCredit,
      enrollmentStatus: "not_required",
      activationStatus: "not_required",
      remainingValue: 6,
      cycleValueLimit: 10,
      cycleFrequency: "monthly",
      cycleStartsAt: "2026-07-01T00:00:00.000Z",
      cycleEndsAt: "2026-07-31T23:59:59.000Z",
      currentSpend: 4,
      benefitUsageCount: 1,
      currentCycle: "2026-07",
      lastUsed: "2026-07-10T00:00:00.000Z",
      resetDate: "2026-08-01T00:00:00.000Z",
      confidenceSource: "estimated",
      lastObserved: NOW,
      notes: ["Estimated from manual usage"],
    }),
    canonicalizeWalletBenefitState({
      userId: USER_ID,
      cardId: "amex-gold",
      cardSlug: "amex-gold",
      issuer: "American Express",
      benefitId: walletFixtureBenefitIds.diningCredit,
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 0,
      cycleValueLimit: 10,
      cycleFrequency: "monthly",
      cycleStartsAt: "2026-07-01T00:00:00.000Z",
      cycleEndsAt: "2026-07-31T23:59:59.000Z",
      currentSpend: 10,
      benefitUsageCount: 1,
      currentCycle: "2026-07",
      lastUsed: "2026-07-12T00:00:00.000Z",
      resetDate: "2026-08-01T00:00:00.000Z",
      confidenceSource: "user_verified",
      lastObserved: NOW,
      notes: ["Monthly dining credit exhausted"],
    }),
    canonicalizeWalletBenefitState({
      userId: USER_ID,
      cardId: "chase-freedom-flex",
      cardSlug: "chase-freedom-flex",
      issuer: "Chase",
      benefitId: walletFixtureBenefitIds.quarterlyCategory,
      enrollmentStatus: "not_required",
      activationStatus: "not_activated",
      remainingSpendCap: 1500,
      cycleSpendLimit: 1500,
      cycleFrequency: "quarterly",
      cycleStartsAt: "2026-07-01T00:00:00.000Z",
      cycleEndsAt: "2026-09-30T23:59:59.000Z",
      currentSpend: 0,
      currentCycle: "2026-Q3",
      resetDate: "2026-10-01T00:00:00.000Z",
      confidenceSource: "imported",
      lastObserved: NOW,
    }),
    canonicalizeWalletBenefitState({
      userId: USER_ID,
      cardId: "capital-one-venture-x",
      cardSlug: "capital-one-venture-x",
      issuer: "Capital One",
      benefitId: walletFixtureBenefitIds.travelCredit,
      enrollmentStatus: "not_required",
      activationStatus: "not_required",
      remainingValue: 300,
      cycleValueLimit: 300,
      cycleFrequency: "annual",
      cycleStartsAt: "2026-01-01T00:00:00.000Z",
      cycleEndsAt: "2026-12-31T23:59:59.000Z",
      currentSpend: 0,
      currentCycle: "2026",
      resetDate: "2027-01-01T00:00:00.000Z",
      confidenceSource: "issuer_verified",
      lastObserved: NOW,
      lastVerified: NOW,
    }),
    canonicalizeWalletBenefitState({
      userId: USER_ID,
      cardId: "amex-platinum",
      cardSlug: "amex-platinum",
      issuer: "American Express",
      benefitId: walletFixtureBenefitIds.streamingCredit,
      status: "expired",
      enrollmentStatus: "enrolled",
      activationStatus: "not_required",
      remainingValue: 20,
      cycleValueLimit: 240,
      cycleFrequency: "annual",
      expirationDate: "2026-01-01T00:00:00.000Z",
      confidenceSource: "issuer_verified",
      lastObserved: NOW,
      lastVerified: "2025-12-01T00:00:00.000Z",
    }),
    canonicalizeWalletBenefitState({
      userId: USER_ID,
      cardId: "amex-platinum",
      cardSlug: "amex-platinum",
      issuer: "American Express",
      benefitId: "amex-platinum:limited-use:centurion-lounge-guest-pass",
      enrollmentStatus: "not_required",
      activationStatus: "not_required",
      remainingUses: 2,
      cycleUsageLimit: 2,
      cycleFrequency: "usage_count",
      currentCycle: "2026",
      resetDate: "2027-01-01T00:00:00.000Z",
      confidenceSource: "user_verified",
      lastObserved: NOW,
    }),
  ];

  return states.map((state) => {
    if (state.status === "exhausted") {
      return recordWalletBenefitEvent(state, {
        eventType: "credit_exhausted",
        occurredAt: NOW,
        source: state.confidenceSource,
      });
    }
    return state;
  });
}

export function walletResetDemoState(state?: CanonicalWalletBenefitState) {
  const exhausted =
    state ||
    walletIntelligenceFixtureStates().find(
      (candidate) => candidate.benefitId === walletFixtureBenefitIds.diningCredit,
    );
  if (!exhausted) throw new Error("Missing dining credit fixture");
  return resetWalletBenefitCycle(exhausted, "2026-08-01T00:00:00.000Z");
}
