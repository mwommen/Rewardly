import { expandScenarioSet } from "./scenarioHelpers";

export const drugstoreScenarios = expandScenarioSet({
  prefix: "drugstore",
  tag: "drugstore",
  merchantName: "CVS",
  category: "drugstore",
  wallet: ["chase-freedom-flex", "capital-one-venture", "wells-fargo-active-cash"],
  amounts: [5, 20, 45, 80, 120, 200, 350, 600],
  expectedRuleType: "category",
});
