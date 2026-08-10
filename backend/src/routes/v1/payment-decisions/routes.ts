import { Router } from "express";
import { createPaymentDecisionController } from "./controller";

const router = Router();

export const V1_PAYMENT_DECISIONS_ROUTE = "/payment-decisions";

router.post(V1_PAYMENT_DECISIONS_ROUTE, createPaymentDecisionController);

export default router;
