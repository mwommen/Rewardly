import fs from "fs";
import path from "path";
import {
  defaultDecisionPolicies,
  evaluateWalletDecision,
} from "../../src/services/walletDecisionEngine";
import {
  mutationDefinitions,
  runRecommendationBehaviorMutationTests,
  runRecommendationMutationSmokeTests,
} from "../../src/validation/recommendationMutationSmoke";
import { recommendationValidationCatalog } from "./fixtures/cards/catalog";
import { curatedRecommendationScenarios } from "./scenarios";
import { scenarioToWalletDecisionInput } from "../../src/validation/recommendationScenarioRunner";

describe("recommendation mutation framework", () => {
  const catalog = recommendationValidationCatalog();
  const requiredMutationIds = [
    "allow-non-owned-global-card-to-win",
    "ignore-benefit-expiration",
    "ignore-activation-requirement",
    "ignore-enrollment-requirement",
    "ignore-cap-exhaustion",
    "use-wrong-point-valuation",
    "reverse-reward-value-sorting",
    "prefer-base-over-higher-category-rule",
    "wallet-array-order-final-tie-break",
    "runner-up-explanation-returned",
  ];

  test("production evaluation without policies uses default decision policies", () => {
    const scenario = curatedRecommendationScenarios.find((item) => item.id === "dining-001")!;
    const input = scenarioToWalletDecisionInput(scenario, catalog);
    const production = evaluateWalletDecision(input);
    const explicitDefault = evaluateWalletDecision({
      ...input,
      policies: defaultDecisionPolicies,
    });

    expect(production.winningCard?.card.slug).toBe(explicitDefault.winningCard?.card.slug);
    expect(production.explanation).toBe(explicitDefault.explanation);
  });

  test("injected policies affect only the requested evaluation and cannot contaminate production", () => {
    const scenario = curatedRecommendationScenarios.find((item) => item.id === "dining-001")!;
    const input = scenarioToWalletDecisionInput(scenario, catalog);
    const productionBefore = evaluateWalletDecision(input);
    const mutated = evaluateWalletDecision({
      ...input,
      policies: {
        ...defaultDecisionPolicies,
        compareCardScores: (a, b) => {
          if (a.estimatedValueUSD !== b.estimatedValueUSD) {
            return a.estimatedValueUSD - b.estimatedValueUSD;
          }
          return defaultDecisionPolicies.compareCardScores(a, b);
        },
      },
    });
    const productionAfter = evaluateWalletDecision(input);

    expect(mutated.winningCard?.card.slug).not.toBe(productionBefore.winningCard?.card.slug);
    expect(productionAfter.winningCard?.card.slug).toBe(productionBefore.winningCard?.card.slug);
  });

  test("all required mutations exist, select focused deterministic scenarios, and are killed", () => {
    const mutations = runRecommendationMutationSmokeTests(curatedRecommendationScenarios, catalog);

    expect(mutations.map((mutation) => mutation.mutationId).sort()).toEqual(
      requiredMutationIds.slice().sort(),
    );
    mutations.forEach((mutation) => {
      expect(mutation.passedBaseline).toBe(true);
      expect(mutation.mutationDetected).toBe(true);
      expect(mutation.scenariosRun).toBeGreaterThan(0);
      expect(mutation.selectedScenarioIds?.length).toBe(mutation.scenariosRun);
      expect(mutation.killedBy?.length).toBeGreaterThan(0);
      expect(mutation.killedBy?.join(" ")).toMatch(/winner|benefit|reward|cash|value|invariant|explanation|cap|activation|enrollment|date/i);
    });
  });

  test("unrelated exceptions do not count as mutation kills and score is calculated correctly", () => {
    const results = runRecommendationBehaviorMutationTests(
      curatedRecommendationScenarios.slice(0, 1),
      catalog,
    );
    const detected = results.filter((mutation) => mutation.killed).length;

    expect(detected / results.length).toBeLessThanOrEqual(1);
    results
      .filter((mutation) => mutation.unexpectedErrors.length > 0)
      .forEach((mutation) => {
        expect(mutation.killed).toBe(false);
      });
  });

  test("mutation definitions are not imported by app startup or extension paths", () => {
    const root = path.resolve(__dirname, "../../..");
    const appFiles = [
      "backend/src/server.ts",
      "backend/src/routes/decisionRoutes.ts",
      "extension/background.js",
      "extension/content.js",
      "frontend-vite/src/App.tsx",
    ];

    appFiles.forEach((relativePath) => {
      const source = fs.readFileSync(path.resolve(root, relativePath), "utf8");
      expect(source).not.toMatch(/recommendationMutationSmoke|mutationDefinitions|DecisionPolicies/);
    });
    expect(process.env.REWARDLY_MUTATION_MODE).toBeUndefined();
  });

  test("a surviving required mutation would be treated as a validation failure", () => {
    const fakeMutation = {
      passedBaseline: true,
      mutationDetected: false,
    };
    const failed = [fakeMutation].filter(
      (result) => !result.passedBaseline || !result.mutationDetected,
    );

    expect(failed).toHaveLength(1);
  });
});
