import { recommendationValidationWalletStates as states } from "../fixtures/wallet-states/states";
import { expandScenarioSet, hydratedScenario } from "./scenarioHelpers";

export const groceryScenarios = [
  ...expandScenarioSet({
    prefix: "grocery",
    tag: "grocery",
    merchantName: "Whole Foods Market",
    category: "grocery",
    wallet: ["amex-gold", "citi-custom-cash", "capital-one-venture"],
    amounts: [20, 75, 150, 499.99, 500, 500.01, 1000, 2500],
    expectedRuleType: "category",
    walletBenefitStates: [states.amexGroceryCap, states.citiGroceryCap],
  }),
  hydratedScenario({
    id: "grocery-partial-cap-001",
    name: "Partially used grocery cap still wins below remaining cap",
    tags: ["curated", "grocery", "cap"],
    wallet: ["citi-custom-cash", "capital-one-venture"],
    merchantName: "Whole Foods Market",
    category: "grocery",
    amount: 120,
    walletBenefitStates: [states.citiGroceryCapPartial],
    expectedRuleType: "category",
  }),
  hydratedScenario({
    id: "grocery-cap-exhausted-001",
    name: "Grocery cap exhaustion changes winner",
    tags: ["curated", "grocery", "cap"],
    wallet: ["amex-gold", "capital-one-venture"],
    merchantName: "Whole Foods Market",
    category: "grocery",
    amount: 120,
    walletBenefitStates: [states.amexGroceryCapExhausted],
    expectedRuleType: "base",
  }),
  hydratedScenario({
    id: "grocery-missing-state-001",
    name: "State-required grocery rule cannot win without state",
    tags: ["curated", "grocery", "wallet-state"],
    wallet: ["amex-gold", "capital-one-venture"],
    merchantName: "Whole Foods Market",
    category: "grocery",
    amount: 120,
    expectedRuleType: "base",
  }),
];
