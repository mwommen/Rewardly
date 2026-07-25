import type {
  RecommendationScenario,
  ScenarioCatalog,
} from "./recommendationScenario.types";
import { adaptCardToReference } from "./reference/referenceFixtureAdapter";

export class RecommendationScenarioValidationError extends Error {
  constructor(
    public readonly scenarioId: string,
    public readonly errors: string[],
  ) {
    super(`Scenario ${scenarioId} is invalid:\n${errors.join("\n")}`);
  }
}

export function validateRecommendationScenarios(
  scenarios: RecommendationScenario[],
  catalog: ScenarioCatalog,
) {
  const ids = new Set<string>();
  scenarios.forEach((scenario) => {
    const errors = validateRecommendationScenario(scenario, catalog);
    if (ids.has(scenario.id)) errors.push(`Duplicate scenario ID "${scenario.id}".`);
    ids.add(scenario.id);
    if (errors.length) {
      throw new RecommendationScenarioValidationError(scenario.id, errors);
    }
  });
}

export function validateRecommendationScenario(
  scenario: RecommendationScenario,
  catalog: ScenarioCatalog,
) {
  const errors: string[] = [];
  const walletSlugs = new Set(scenario.wallet.cards.map((card) => card.cardSlug));
  if (!scenario.id.trim()) errors.push("Scenario ID is required.");
  if (!scenario.name.trim()) errors.push("Scenario name is required.");
  if (!scenario.tags.length) errors.push("At least one tag is required.");
  if (!scenario.wallet.userId.trim()) errors.push("Wallet userId is required.");
  if (!scenario.wallet.cards.length) errors.push("Wallet must contain at least one card.");
  if (scenario.purchase.currency !== "USD") errors.push("Only USD purchases are supported.");
  if (!Number.isFinite(scenario.purchase.amount) || scenario.purchase.amount < 0) {
    errors.push("Purchase amount must be a non-negative number.");
  }
  if (Number.isNaN(Date.parse(scenario.purchase.transactionDate))) {
    errors.push(`Invalid transactionDate "${scenario.purchase.transactionDate}".`);
  }
  if (scenario.classification.confidence < 0 || scenario.classification.confidence > 1) {
    errors.push("Classification confidence must be between 0 and 1.");
  }
  scenario.wallet.cards.forEach((card) => {
    if (!catalog[card.cardSlug]) errors.push(`Unknown wallet card "${card.cardSlug}".`);
  });
  if (!walletSlugs.has(scenario.expected.winnerCardSlug)) {
    errors.push(
      `Expected winner "${scenario.expected.winnerCardSlug}" is not present in the scenario wallet.`,
    );
  }
  if (
    scenario.expected.runnerUpCardSlug &&
    !walletSlugs.has(scenario.expected.runnerUpCardSlug)
  ) {
    errors.push(
      `Expected runner-up "${scenario.expected.runnerUpCardSlug}" is not present in the scenario wallet.`,
    );
  }
  assertBenefitBelongsToCard(
    catalog,
    scenario.expected.winnerCardSlug,
    scenario.expected.winnerBenefitId,
    "winner",
    errors,
  );
  if (scenario.expected.runnerUpCardSlug && scenario.expected.runnerUpBenefitId) {
    assertBenefitBelongsToCard(
      catalog,
      scenario.expected.runnerUpCardSlug,
      scenario.expected.runnerUpBenefitId,
      "runner-up",
      errors,
    );
  }
  if (
    scenario.expected.confidence?.minScore !== undefined &&
    scenario.expected.confidence?.maxScore !== undefined &&
    scenario.expected.confidence.minScore > scenario.expected.confidence.maxScore
  ) {
    errors.push("Confidence minScore cannot exceed maxScore.");
  }
  return errors;
}

function assertBenefitBelongsToCard(
  catalog: ScenarioCatalog,
  cardSlug: string,
  benefitId: string,
  label: string,
  errors: string[],
) {
  const card = catalog[cardSlug];
  if (!card) return;
  const benefit = adaptCardToReference(card).benefits.find((item) => item.id === benefitId);
  if (!benefit) {
    errors.push(
      `Expected ${label} benefit "${benefitId}" is not associated with "${cardSlug}".`,
    );
  }
}
