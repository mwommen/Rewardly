import { hydratedScenario } from "./scenarioHelpers";

export const tieBreakerScenarios = [
  hydratedScenario({
    id: "tie-base-001",
    name: "Equal base value resolves deterministically",
    tags: ["curated", "tie-breaker"],
    wallet: ["capital-one-venture", "wells-fargo-active-cash"],
    merchantName: "Online Store",
    category: "unknown",
    amount: 100,
    expectedRuleType: "base",
  }),
  hydratedScenario({
    id: "tie-category-001",
    name: "Equal category value resolves deterministically",
    tags: ["curated", "tie-breaker"],
    wallet: ["chase-sapphire-preferred", "wells-fargo-autograph"],
    merchantName: "Local Restaurant",
    category: "dining",
    amount: 100,
    expectedRuleType: "category",
  }),
];
