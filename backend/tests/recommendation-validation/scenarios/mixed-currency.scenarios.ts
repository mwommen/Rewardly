import { recommendationValidationWalletStates as states } from "../fixtures/wallet-states/states";
import { hydratedScenario } from "./scenarioHelpers";

export const mixedCurrencyScenarios = [
  hydratedScenario({
    id: "mixed-points-cash-001",
    name: "Points versus cash uses estimated value",
    tags: ["curated", "mixed-currency", "valuation"],
    wallet: ["amex-gold", "citi-custom-cash"],
    merchantName: "Whole Foods Market",
    category: "grocery",
    amount: 100,
    walletBenefitStates: [states.amexGroceryCap, states.citiGroceryCap],
    expectedRuleType: "category",
    mustContain: ["American Express Gold"],
  }),
  hydratedScenario({
    id: "mixed-miles-cash-001",
    name: "Miles versus cash uses estimated value",
    tags: ["curated", "mixed-currency", "valuation"],
    wallet: ["capital-one-venture", "wells-fargo-active-cash"],
    merchantName: "General Retailer",
    category: "general_retail",
    amount: 100,
    expectedRuleType: "base",
  }),
];
