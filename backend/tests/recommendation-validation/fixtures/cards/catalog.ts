import {
  allBenefitDecisionAccuracyCards,
  benefitDecisionAccuracyCards,
} from "../../../fixtures/benefitDecisionAccuracyFixture";

export const recommendationValidationCards = benefitDecisionAccuracyCards;

export function recommendationValidationCatalog() {
  return Object.fromEntries(
    allBenefitDecisionAccuracyCards().map((card: any) => [card.slug, card]),
  );
}

export function recommendationValidationCardList() {
  return allBenefitDecisionAccuracyCards();
}
