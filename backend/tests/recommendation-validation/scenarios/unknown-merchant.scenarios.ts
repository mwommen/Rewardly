import { expandScenarioSet, hydratedScenario } from "./scenarioHelpers";

export const unknownMerchantScenarios = [
  ...expandScenarioSet({
    prefix: "unknown-merchant",
    tag: "unknown-merchant",
    merchantName: "Unknown Merchant",
    category: "unknown",
    wallet: ["capital-one-venture", "chase-sapphire-preferred", "amex-gold"],
    amounts: [1, 15, 60, 100, 300, 800, 1200, 3000],
    expectedRuleType: "base",
    confidence: 0.5,
    source: "unknown",
  }),
  hydratedScenario({
    id: "unknown-no-specific-invention-001",
    name: "Unknown merchant does not trigger category rule",
    tags: ["curated", "unknown-merchant", "classification"],
    wallet: ["amex-gold", "capital-one-venture"],
    merchantName: "Mystery Store",
    category: "unknown",
    amount: 100,
    confidence: 0.4,
    source: "unknown",
    verified: false,
    expectedRuleType: "base",
  }),
];
