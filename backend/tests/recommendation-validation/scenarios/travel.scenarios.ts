import { expandScenarioSet, hydratedScenario } from "./scenarioHelpers";

export const travelScenarios = [
  ...expandScenarioSet({
    prefix: "travel",
    tag: "travel",
    merchantName: "Delta",
    category: "travel",
    wallet: ["wells-fargo-autograph", "chase-sapphire-preferred", "capital-one-venture"],
    amounts: [50, 120, 300, 600, 1000, 1500, 2500, 5000],
    expectedRuleType: "category",
  }),
  hydratedScenario({
    id: "travel-airline-direct-001",
    name: "Direct airline booking uses direct travel rule",
    tags: ["curated", "travel", "airfare"],
    wallet: ["chase-sapphire-preferred", "capital-one-venture"],
    merchantName: "Delta",
    category: "travel",
    amount: 300,
    expectedRuleType: "category",
  }),
  hydratedScenario({
    id: "travel-hotel-direct-001",
    name: "Direct hotel booking uses general travel rule",
    tags: ["curated", "travel", "hotel"],
    wallet: ["wells-fargo-autograph", "capital-one-venture"],
    merchantName: "Marriott",
    category: "travel",
    amount: 300,
    expectedRuleType: "category",
  }),
];
