import { expandScenarioSet, hydratedScenario } from "./scenarioHelpers";

export const generalRetailScenarios = [
  ...expandScenarioSet({
    prefix: "general-retail",
    tag: "general-retail",
    merchantName: "General Retailer",
    category: "general_retail",
    wallet: ["capital-one-venture", "wells-fargo-active-cash", "chase-sapphire-preferred"],
    amounts: [0.01, 5, 25, 100, 250, 1000, 2500, 10000],
    expectedRuleType: "base",
  }),
  hydratedScenario({
    id: "general-retail-no-category-invention-001",
    name: "General retail does not invent grocery or dining bonus",
    tags: ["curated", "general-retail", "classification"],
    wallet: ["amex-gold", "capital-one-venture"],
    merchantName: "Online Store",
    category: "general_retail",
    amount: 88,
    expectedRuleType: "base",
  }),
];
