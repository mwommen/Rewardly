import { ambiguousClassificationScenarios } from "./ambiguous-classification.scenarios";
import { diningScenarios } from "./dining.scenarios";
import { drugstoreScenarios } from "./drugstore.scenarios";
import { gasScenarios } from "./gas.scenarios";
import { generalRetailScenarios } from "./general-retail.scenarios";
import { groceryScenarios } from "./grocery.scenarios";
import { mixedCurrencyScenarios } from "./mixed-currency.scenarios";
import { portalScenarios } from "./portal.scenarios";
import { rotatingCategoryScenarios } from "./rotating-category.scenarios";
import { statementCreditScenarios } from "./statement-credit.scenarios";
import { streamingScenarios } from "./streaming.scenarios";
import { tieBreakerScenarios } from "./tie-breaker.scenarios";
import { travelScenarios } from "./travel.scenarios";
import { unknownMerchantScenarios } from "./unknown-merchant.scenarios";

export const curatedRecommendationScenarios = [
  ...diningScenarios,
  ...groceryScenarios,
  ...gasScenarios,
  ...travelScenarios,
  ...portalScenarios,
  ...drugstoreScenarios,
  ...streamingScenarios,
  ...generalRetailScenarios,
  ...rotatingCategoryScenarios,
  ...statementCreditScenarios,
  ...unknownMerchantScenarios,
  ...ambiguousClassificationScenarios,
  ...mixedCurrencyScenarios,
  ...tieBreakerScenarios,
];
