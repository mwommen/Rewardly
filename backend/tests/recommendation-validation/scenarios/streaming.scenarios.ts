import { expandScenarioSet, hydratedScenario } from "./scenarioHelpers";

export const streamingScenarios = [
  ...expandScenarioSet({
    prefix: "streaming",
    tag: "streaming",
    merchantName: "Netflix",
    category: "streaming",
    wallet: ["chase-sapphire-preferred", "wells-fargo-autograph", "capital-one-venture"],
    amounts: [6.99, 12.99, 19.99, 29.99, 49.99, 79.99, 120, 250],
    expectedRuleType: "category",
  }),
  hydratedScenario({
    id: "streaming-ineligible-service-001",
    name: "Generic online retailer does not trigger streaming",
    tags: ["curated", "streaming", "classification"],
    wallet: ["chase-sapphire-preferred", "capital-one-venture"],
    merchantName: "Online Store",
    category: "general_retail",
    amount: 50,
    expectedRuleType: "base",
  }),
];
