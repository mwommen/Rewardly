import { recommendationValidationWalletStates as states } from "../fixtures/wallet-states/states";
import { expandScenarioSet, hydratedScenario } from "./scenarioHelpers";

export const gasScenarios = [
  ...expandScenarioSet({
    prefix: "gas",
    tag: "gas",
    merchantName: "Shell",
    category: "gas",
    wallet: ["chase-freedom-flex", "citi-custom-cash", "capital-one-venture"],
    amounts: [10, 35, 75, 120, 499, 500, 501, 1000],
    expectedRuleType: "category",
    walletBenefitStates: [states.freedomGasActivated, states.citiGasCap],
  }),
  hydratedScenario({
    id: "gas-not-activated-001",
    name: "Rotating gas category rejected when not activated",
    tags: ["curated", "gas", "activation"],
    wallet: ["chase-freedom-flex", "capital-one-venture"],
    merchantName: "Shell",
    category: "gas",
    amount: 60,
    walletBenefitStates: [states.freedomGasNotActivated],
    expectedRuleType: "base",
  }),
  hydratedScenario({
    id: "gas-cap-exhausted-001",
    name: "Gas cap exhausted falls back safely",
    tags: ["curated", "gas", "cap"],
    wallet: ["citi-custom-cash", "capital-one-venture"],
    merchantName: "Shell",
    category: "gas",
    amount: 60,
    walletBenefitStates: [states.citiGasCapExhausted],
    expectedRuleType: "base",
  }),
];
