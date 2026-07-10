import { Router } from "express";
import { decidePayment } from "../services/paymentDecisionService";

const router = Router();

export const PAYMENT_DECISION_ROUTE = "/decisions/payment";

router.post(PAYMENT_DECISION_ROUTE, async (req, res) => {
  try {
    if (!hasPaymentDecisionContext(req.body)) {
      return res.status(400).json({
        error:
          "payment decision requires merchant, hostname, url, title, or pageText",
      });
    }

    const decision = await decidePayment({
      userId: String(req.body?.userId || "devUser"),
      merchant:
        typeof req.body?.merchant === "string" ? req.body.merchant : undefined,
      hostname:
        typeof req.body?.hostname === "string" ? req.body.hostname : undefined,
      url: typeof req.body?.url === "string" ? req.body.url : undefined,
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
      pageText:
        typeof req.body?.pageText === "string" ? req.body.pageText : undefined,
      category:
        typeof req.body?.category === "string" ? req.body.category : undefined,
      mcc: typeof req.body?.mcc === "string" ? req.body.mcc : undefined,
      amount:
        typeof req.body?.amount === "number" && Number.isFinite(req.body.amount)
          ? req.body.amount
          : undefined,
      manualCardSlugs: Array.isArray(req.body?.manualCardSlugs)
        ? req.body.manualCardSlugs.map(String)
        : undefined,
      restrictToWallet:
        typeof req.body?.restrictToWallet === "boolean"
          ? req.body.restrictToWallet
          : true,
      purchaseContext:
        req.body?.purchaseContext &&
        typeof req.body.purchaseContext === "object"
          ? req.body.purchaseContext
          : undefined,
    });

    res.json({ decision });
  } catch (error) {
    console.error("[decisionRoutes/payment] Error:", error);
    res.status(500).json({ error: "Failed to create payment decision" });
  }
});

export default router;

function hasPaymentDecisionContext(body: any) {
  return ["merchant", "hostname", "url", "title", "pageText"].some(
    (field) => typeof body?.[field] === "string" && body[field].trim(),
  );
}
