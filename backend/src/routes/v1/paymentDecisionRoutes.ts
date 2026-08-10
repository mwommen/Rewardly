import { Router } from "express";
import cardCatalogRoutes from "./payment-decisions/cardCatalogRoutes";
import paymentDecisionRoutes, {
  V1_PAYMENT_DECISIONS_ROUTE,
} from "./payment-decisions/routes";
import runtimeRoutes from "./payment-decisions/runtimeRoutes";
import { openApiDocument } from "./payment-decisions/openapi";

const router = Router();

router.use(paymentDecisionRoutes);
router.use(runtimeRoutes);

router.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument());
});

router.use(cardCatalogRoutes);

export default router;
export { V1_PAYMENT_DECISIONS_ROUTE, openApiDocument };
export { validatePaymentDecisionRequest } from "./payment-decisions/validation";
export type { NormalizedV1PaymentDecisionRequest } from "./payment-decisions/validation";
export {
  createPublicDecisionId,
  toV1PaymentDecisionResponse,
} from "./payment-decisions/responseMapper";
