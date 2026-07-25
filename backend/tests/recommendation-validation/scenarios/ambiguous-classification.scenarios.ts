import { hydratedScenario } from "./scenarioHelpers";

export const ambiguousClassificationScenarios = [
  hydratedScenario({
    id: "ambiguous-dining-001",
    name: "Ambiguous dining classification is cautious",
    tags: ["curated", "ambiguous", "confidence"],
    wallet: ["amex-gold", "capital-one-venture"],
    merchantName: "Cafe Market",
    category: "dining",
    amount: 40,
    confidence: 0.55,
    source: "inferred",
    verified: false,
    expectedRuleType: "category",
    mustContain: ["appears to be Dining"],
    mustNotContain: ["classified as Dining"],
  }),
  hydratedScenario({
    id: "ambiguous-gas-001",
    name: "Ambiguous gas classification lowers confidence",
    tags: ["curated", "ambiguous", "confidence"],
    wallet: ["citi-custom-cash", "capital-one-venture"],
    merchantName: "Travel Mart",
    category: "gas",
    amount: 40,
    confidence: 0.58,
    source: "inferred",
    verified: false,
    expectedRuleType: "category",
  }),
];
