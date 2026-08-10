import type { PaymentDecisionRequest } from "../../../services/paymentDecisionService";
import type { NormalizedV1PaymentDecisionRequest } from "./validation";

export function toPaymentDecisionRequest(
  request: NormalizedV1PaymentDecisionRequest,
): PaymentDecisionRequest {
  return {
    userId: "pending-decision-id",
    merchant: request.merchant.name,
    hostname: request.merchant.domain,
    category: request.merchant.category,
    mcc: request.merchant.mcc,
    amount: request.purchase.amount,
    manualCardSlugs: request.wallet.cards.map((card) => card.cardId),
    restrictToWallet: true,
    purchaseContext: {
      surface: "backend",
      amount: request.purchase.amount,
      currency: request.purchase.currency,
      checkoutDetected: true,
      checkoutStage: "payment",
    },
    context: request.context,
  };
}
