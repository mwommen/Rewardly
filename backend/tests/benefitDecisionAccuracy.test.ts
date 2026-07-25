import { evaluateWalletDecision } from "../src/services/walletDecisionEngine";
import {
  benefitDecisionAccuracyCards as cards,
  walletStateFor,
} from "./fixtures/benefitDecisionAccuracyFixture";

const NOW = new Date("2026-07-24T00:00:00.000Z");

type Scenario = {
  name: string;
  wallet: any[];
  purchase: {
    merchant: string;
    category: string;
    amount: number;
    classification?: {
      category: string | null;
      confidence: number;
      source: "merchant_registry" | "purchase_intelligence" | "mcc" | "inferred" | "unknown";
      evidence: string[];
    };
  };
  walletStates?: any[];
  expectedWinner: string;
  expectedRule: RegExp;
  assumptions: string[];
};

const amexGroceryCap = walletStateFor(cards.amexGold, /4x on groceries/i, {
  remainingSpendCap: 25000,
  cycleSpendLimit: 25000,
});
const citiGasCap = walletStateFor(cards.citiCustomCash, /5% on gas/i, {
  remainingSpendCap: 500,
  cycleSpendLimit: 500,
});
const citiGroceryCap = walletStateFor(cards.citiCustomCash, /5% on groceries/i, {
  remainingSpendCap: 500,
  cycleSpendLimit: 500,
});
const activeFreedomGas = walletStateFor(cards.chaseFreedomFlex, /5% on gas/i, {
  activationStatus: "activated",
  remainingSpendCap: 1500,
  cycleSpendLimit: 1500,
});
const inactiveFreedomGas = walletStateFor(cards.chaseFreedomFlex, /5% on gas/i, {
  activationStatus: "not_activated",
  remainingSpendCap: 1500,
  cycleSpendLimit: 1500,
});
const bestBuyCreditRemaining = walletStateFor(cards.bestBuyOfferCard, /\$20 statement credit/i, {
  enrollmentStatus: "enrolled",
  remainingValue: 20,
  cycleValueLimit: 20,
});
const bestBuyCreditExhausted = walletStateFor(cards.bestBuyOfferCard, /\$20 statement credit/i, {
  enrollmentStatus: "enrolled",
  remainingValue: 0,
  cycleValueLimit: 20,
});

const scenarios: Scenario[] = [
  {
    name: "dining",
    wallet: [cards.amexGold, cards.chaseSapphirePreferred, cards.capitalOneVenture],
    purchase: { merchant: "Starbucks", category: "dining", amount: 50 },
    expectedWinner: "amex-gold",
    expectedRule: /4x on dining/i,
    assumptions: ["Membership Rewards valued using Rewardly default valuation."],
  },
  {
    name: "grocery",
    wallet: [cards.amexGold, cards.citiCustomCash, cards.capitalOneVenture],
    purchase: { merchant: "Whole Foods Market", category: "groceries", amount: 150 },
    walletStates: [amexGroceryCap, citiGroceryCap],
    expectedWinner: "amex-gold",
    expectedRule: /4x on groceries/i,
    assumptions: ["Amex grocery cap and Citi grocery cap both have remaining spend."],
  },
  {
    name: "general retail",
    wallet: [cards.capitalOneVenture, cards.wellsFargoActiveCash],
    purchase: { merchant: "General Retailer", category: "general_retail", amount: 100 },
    expectedWinner: "capital-one-venture",
    expectedRule: /2x on all purchases/i,
    assumptions: ["Tie resolved deterministically by card name."],
  },
  {
    name: "airline direct",
    wallet: [cards.chaseSapphirePreferred, cards.wellsFargoAutograph, cards.capitalOneVenture],
    purchase: { merchant: "Delta", category: "travel", amount: 300 },
    expectedWinner: "chase-sapphire-preferred",
    expectedRule: /2x on travel/i,
    assumptions: ["Chase points and Wells Fargo points use different default valuations."],
  },
  {
    name: "issuer travel portal",
    wallet: [cards.chaseSapphirePreferred, cards.chaseFreedomFlex, cards.capitalOneVenture],
    purchase: { merchant: "Chase Travel", category: "issuer_travel_portal", amount: 400 },
    expectedWinner: "chase-sapphire-preferred",
    expectedRule: /5x on issuer_travel_portal/i,
    assumptions: ["Purchase classified as issuer travel portal, not direct airline/hotel."],
  },
  {
    name: "streaming",
    wallet: [cards.chaseSapphirePreferred, cards.wellsFargoAutograph, cards.capitalOneVenture],
    purchase: { merchant: "Netflix", category: "streaming", amount: 30 },
    expectedWinner: "chase-sapphire-preferred",
    expectedRule: /3x on streaming/i,
    assumptions: ["Streaming classification is verified."],
  },
  {
    name: "drugstore",
    wallet: [cards.chaseFreedomFlex, cards.capitalOneVenture],
    purchase: { merchant: "CVS", category: "drugstores", amount: 80 },
    expectedWinner: "chase-freedom-flex",
    expectedRule: /3% on drugstores/i,
    assumptions: ["Drugstore rule is a category rule, not a merchant-specific override."],
  },
  {
    name: "rotating category active",
    wallet: [cards.chaseFreedomFlex, cards.capitalOneVenture],
    purchase: { merchant: "Shell", category: "gas", amount: 75 },
    walletStates: [activeFreedomGas],
    expectedWinner: "chase-freedom-flex",
    expectedRule: /5% on gas/i,
    assumptions: ["Quarterly gas category is activated and has remaining spend cap."],
  },
  {
    name: "rotating category not activated",
    wallet: [cards.chaseFreedomFlex, cards.capitalOneVenture],
    purchase: { merchant: "Shell", category: "gas", amount: 75 },
    walletStates: [inactiveFreedomGas],
    expectedWinner: "capital-one-venture",
    expectedRule: /2x on all purchases/i,
    assumptions: ["Unactivated rotating category cannot influence recommendation."],
  },
  {
    name: "statement credit remaining",
    wallet: [cards.bestBuyOfferCard, cards.capitalOneVenture],
    purchase: { merchant: "Best Buy", category: "general_retail", amount: 120 },
    walletStates: [bestBuyCreditRemaining],
    expectedWinner: "bestbuy-offer-card",
    expectedRule: /\$20 statement credit/i,
    assumptions: ["Enrollment complete and credit has $20 remaining."],
  },
  {
    name: "statement credit exhausted",
    wallet: [cards.bestBuyOfferCard, cards.capitalOneVenture],
    purchase: { merchant: "Best Buy", category: "general_retail", amount: 120 },
    walletStates: [bestBuyCreditExhausted],
    expectedWinner: "capital-one-venture",
    expectedRule: /2x on all purchases/i,
    assumptions: ["Exhausted statement credit cannot influence recommendation."],
  },
  {
    name: "unknown merchant",
    wallet: [cards.capitalOneVenture, cards.chaseSapphirePreferred],
    purchase: { merchant: "Unknown Merchant", category: "unknown", amount: 60 },
    expectedWinner: "capital-one-venture",
    expectedRule: /2x on all purchases/i,
    assumptions: ["Unknown merchant falls back to verified base earning only."],
  },
  {
    name: "ambiguous merchant",
    wallet: [cards.amexGold, cards.capitalOneVenture],
    purchase: {
      merchant: "Cafe Market",
      category: "dining",
      amount: 40,
      classification: {
        category: "dining",
        confidence: 0.55,
        source: "inferred",
        evidence: ["merchant name contains cafe"],
      },
    },
    expectedWinner: "amex-gold",
    expectedRule: /4x on dining/i,
    assumptions: ["Ambiguous classification reduces confidence and copy avoids verified language."],
  },
  {
    name: "points versus cash",
    wallet: [cards.amexGold, cards.citiCustomCash],
    purchase: { merchant: "Whole Foods Market", category: "groceries", amount: 100 },
    walletStates: [amexGroceryCap, citiGroceryCap],
    expectedWinner: "amex-gold",
    expectedRule: /4x on groceries/i,
    assumptions: ["Points and cash are compared using estimated cash-equivalent value."],
  },
  {
    name: "equal estimated value",
    wallet: [cards.capitalOneVenture, cards.wellsFargoActiveCash],
    purchase: { merchant: "Online Store", category: "unknown", amount: 100 },
    expectedWinner: "capital-one-venture",
    expectedRule: /2x on all purchases/i,
    assumptions: ["Equal estimated value is resolved deterministically."],
  },
  {
    name: "missing wallet state for state-required benefit",
    wallet: [cards.amexGold, cards.capitalOneVenture],
    purchase: { merchant: "Whole Foods Market", category: "groceries", amount: 100 },
    expectedWinner: "capital-one-venture",
    expectedRule: /2x on all purchases/i,
    assumptions: ["Amex grocery spending cap requires wallet state and is rejected when missing."],
  },
];

function runScenario(scenario: Scenario) {
  return evaluateWalletDecision({
    wallet: {
      cards: scenario.wallet,
      cardSlugs: scenario.wallet.map((card) => card.slug),
    },
    purchase: {
      merchant: {
        name: scenario.purchase.merchant,
        category: scenario.purchase.category,
      },
      category: scenario.purchase.category,
      amount: scenario.purchase.amount,
      purchaseChannel: "online",
      classification: scenario.purchase.classification,
    },
    walletBenefitStates: scenario.walletStates || [],
    now: NOW,
  });
}

function reportRow(scenario: Scenario, result: ReturnType<typeof evaluateWalletDecision>) {
  return {
    scenario: scenario.name,
    expectedWinner: scenario.expectedWinner,
    actualWinner: result.winningCard?.card.slug || null,
    winningRule: result.winningRule?.label || null,
    runnerUp: result.runnerUp?.card.slug || null,
    popupExplanation: result.explanation,
    confidence: result.confidence.label,
    pass: result.winningCard?.card.slug === scenario.expectedWinner,
    assumptions: scenario.assumptions,
  };
}

describe("benefit decision accuracy", () => {
  const report = scenarios.map((scenario) => reportRow(scenario, runScenario(scenario)));

  test.each(scenarios)("$name expected recommendation", (scenario) => {
    const result = runScenario(scenario);

    expect(result.evaluatedCards.map((item) => item.card.slug).sort()).toEqual(
      scenario.wallet.map((card) => card.slug).sort(),
    );
    expect(result.winningCard?.card.slug).toBe(scenario.expectedWinner);
    expect(result.winningRule?.label).toMatch(scenario.expectedRule);
    expect(result.winningCard?.trace.length).toBeGreaterThan(0);
    expect(result.winningCard?.applicableRule?.label).toBe(result.winningRule?.label);
    expect(result.winningCard?.trace.every((item) => item.valuation)).toBe(true);
  });

  test("decision report covers every required scenario", () => {
    expect(report).toHaveLength(16);
    expect(report.every((row) => row.pass)).toBe(true);
  });

  test("trace shows applicable and rejected rules for every owned card", () => {
    const result = runScenario(scenarios[0]);

    result.evaluatedCards.forEach((cardScore) => {
      expect(cardScore.trace.length).toBeGreaterThan(0);
      expect(cardScore.trace.some((rule) => rule.applicable)).toBe(true);
      expect(cardScore.trace.some((rule) => !rule.applicable)).toBe(true);
      expect(cardScore.trace[0]).toEqual(
        expect.objectContaining({
          earningRate: expect.anything(),
          estimatedCashEquivalentValue: expect.any(Number),
          confidence: expect.any(Number),
          walletStateEffect: expect.any(String),
        }),
      );
    });
  });

  test("points, miles, and cash comparisons disclose estimated value valuation", () => {
    const result = runScenario(
      scenarios.find((scenario) => scenario.name === "points versus cash")!,
    );

    expect(result.comparison.mode).toBe("estimated_cash_equivalent");
    if (result.comparison.mode === "estimated_cash_equivalent") {
      expect(result.comparison.valuations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "rewardly_default_valuation",
            rewardCurrency: "points",
            valuePerUnitUSD: 0.015,
          }),
          expect.objectContaining({
            source: "cash",
            rewardCurrency: "cash",
            valuePerUnitUSD: 1,
          }),
        ]),
      );
    }
    expect(result.comparison.explanation).toMatch(/estimated cash-equivalent value/i);
  });

  test("direct cash comparisons are distinguished from cross-currency comparisons", () => {
    const result = evaluateWalletDecision({
      wallet: {
        cards: [cards.chaseFreedomFlex, cards.citiCustomCash],
        cardSlugs: ["chase-freedom-flex", "citi-custom-cash"],
      },
      purchase: {
        merchant: { name: "Shell", category: "gas" },
        category: "gas",
        amount: 100,
        purchaseChannel: "online",
      },
      walletBenefitStates: [activeFreedomGas, citiGasCap],
      now: NOW,
    });

    expect(result.comparison.mode).toBe("direct_earning_rate");
    expect(result.comparison.explanation).toMatch(/earning rates directly/i);
  });

  test("ambiguous purchase classification lowers confidence and avoids verified language", () => {
    const result = runScenario(
      scenarios.find((scenario) => scenario.name === "ambiguous merchant")!,
    );

    expect(result.classification).toEqual(
      expect.objectContaining({
        category: "dining",
        confidence: 0.55,
        source: "inferred",
        verified: false,
      }),
    );
    expect(result.confidence.score).toBeLessThan(0.8);
    expect(result.explanation).toMatch(/appears to be Dining/i);
    expect(result.explanation).not.toMatch(/classified as Dining/i);
  });

  test("missing wallet state rejection is explicit for state-required rules", () => {
    const result = runScenario(
      scenarios.find((scenario) => scenario.name === "missing wallet state for state-required benefit")!,
    );
    const amexTrace = result.evaluatedCards.find((item) => item.card.slug === "amex-gold")!;

    expect(amexTrace.rejectedRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "4x on groceries",
          rejectionReasons: expect.arrayContaining(["wallet_state_required"]),
        }),
      ]),
    );
  });

  test("accuracy report rows contain the beta review fields", () => {
    expect(report[0]).toEqual(
      expect.objectContaining({
        expectedWinner: expect.any(String),
        actualWinner: expect.any(String),
        winningRule: expect.any(String),
        runnerUp: expect.any(String),
        popupExplanation: expect.any(String),
        confidence: expect.any(String),
        pass: true,
        assumptions: expect.any(Array),
      }),
    );
  });
});
