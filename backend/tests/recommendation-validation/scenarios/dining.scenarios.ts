import { expandScenarioSet, hydratedScenario } from "./scenarioHelpers";

export const diningScenarios = [
  ...expandScenarioSet({
    prefix: "dining",
    tag: "dining",
    merchantName: "Starbucks",
    category: "dining",
    wallet: ["amex-gold", "chase-sapphire-preferred", "capital-one-venture"],
    amounts: [12.5, 25, 50, 80, 140, 250, 500, 999],
    expectedRuleType: "category",
  }),
  hydratedScenario({
    id: "dining-inferred-001",
    name: "Inferred dining lowers confidence",
    tags: ["curated", "dining", "confidence"],
    wallet: ["amex-gold", "capital-one-venture"],
    merchantName: "Cafe Market",
    category: "dining",
    amount: 40,
    confidence: 0.55,
    source: "inferred",
    verified: false,
    expectedRuleType: "category",
    mustContain: ["appears to be Dining"],
  }),
  hydratedScenario({
    id: "dining-tie-001",
    name: "Equal dining value is deterministic",
    tags: ["curated", "dining", "tie-breaker"],
    wallet: ["chase-sapphire-preferred", "wells-fargo-autograph"],
    merchantName: "Local Restaurant",
    category: "dining",
    amount: 100,
    expectedRuleType: "category",
  }),
];
