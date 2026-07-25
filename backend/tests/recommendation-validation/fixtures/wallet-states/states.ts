import {
  benefitDecisionAccuracyCards as cards,
  walletStateFor,
} from "../../../fixtures/benefitDecisionAccuracyFixture";

export const recommendationValidationWalletStates = {
  amexGroceryCap: walletStateFor(cards.amexGold, /4x on groceries/i, {
    remainingSpendCap: 25000,
    cycleSpendLimit: 25000,
    confidenceSource: "user_verified",
  }),
  amexGroceryCapExhausted: walletStateFor(cards.amexGold, /4x on groceries/i, {
    remainingSpendCap: 0,
    cycleSpendLimit: 25000,
    confidenceSource: "user_verified",
  }),
  citiGasCap: walletStateFor(cards.citiCustomCash, /5% on gas/i, {
    remainingSpendCap: 500,
    cycleSpendLimit: 500,
    confidenceSource: "user_verified",
  }),
  citiGasCapExhausted: walletStateFor(cards.citiCustomCash, /5% on gas/i, {
    remainingSpendCap: 0,
    cycleSpendLimit: 500,
    confidenceSource: "user_verified",
  }),
  citiGroceryCap: walletStateFor(cards.citiCustomCash, /5% on groceries/i, {
    remainingSpendCap: 500,
    cycleSpendLimit: 500,
    confidenceSource: "user_verified",
  }),
  citiGroceryCapPartial: walletStateFor(cards.citiCustomCash, /5% on groceries/i, {
    remainingSpendCap: 300,
    cycleSpendLimit: 500,
    confidenceSource: "user_verified",
  }),
  freedomGasActivated: walletStateFor(cards.chaseFreedomFlex, /5% on gas/i, {
    activationStatus: "activated",
    remainingSpendCap: 1500,
    cycleSpendLimit: 1500,
    confidenceSource: "user_verified",
  }),
  freedomGasNotActivated: walletStateFor(cards.chaseFreedomFlex, /5% on gas/i, {
    activationStatus: "not_activated",
    remainingSpendCap: 1500,
    cycleSpendLimit: 1500,
    confidenceSource: "user_verified",
  }),
  freedomGasCapExhausted: walletStateFor(cards.chaseFreedomFlex, /5% on gas/i, {
    activationStatus: "activated",
    remainingSpendCap: 0,
    cycleSpendLimit: 1500,
    confidenceSource: "user_verified",
  }),
  bestBuyCreditRemaining: walletStateFor(cards.bestBuyOfferCard, /\$20 statement credit/i, {
    enrollmentStatus: "enrolled",
    remainingValue: 20,
    cycleValueLimit: 20,
    confidenceSource: "user_verified",
  }),
  bestBuyCreditPartial: walletStateFor(cards.bestBuyOfferCard, /\$20 statement credit/i, {
    enrollmentStatus: "enrolled",
    remainingValue: 8,
    cycleValueLimit: 20,
    confidenceSource: "user_verified",
  }),
  bestBuyCreditExhausted: walletStateFor(cards.bestBuyOfferCard, /\$20 statement credit/i, {
    enrollmentStatus: "enrolled",
    remainingValue: 0,
    cycleValueLimit: 20,
    confidenceSource: "user_verified",
  }),
  bestBuyCreditNotEnrolled: walletStateFor(cards.bestBuyOfferCard, /\$20 statement credit/i, {
    enrollmentStatus: "not_enrolled",
    remainingValue: 20,
    cycleValueLimit: 20,
    confidenceSource: "user_verified",
  }),
};
