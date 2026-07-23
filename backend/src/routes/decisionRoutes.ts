import { Router } from "express";
import { decidePayment } from "../services/paymentDecisionService";
import {
  createLifecycleEvent,
  generateRecommendationPresentation,
} from "../services/productExperienceService";
import { extractPurchaseIntelligence } from "../services/purchaseIntelligenceService";

const router = Router();

export const PAYMENT_DECISION_ROUTE = "/decisions/payment";
const BETA_SESSION_HEADER = "x-rewardly-beta-session";

router.post(PAYMENT_DECISION_ROUTE, async (req, res) => {
  try {
    if (!hasPaymentDecisionContext(req.body)) {
      return res.status(400).json({
        error:
          "payment decision requires merchant, hostname, url, title, or pageText",
      });
    }

    const identity = resolvePaymentIdentity(req);
    if ("error" in identity) {
      return res.status(identity.status).json({ error: identity.error });
    }

    const purchaseContext =
      req.body?.purchaseContext && typeof req.body.purchaseContext === "object"
        ? req.body.purchaseContext
        : undefined;
    const purchaseReport =
      purchaseContext?.purchase && typeof purchaseContext.purchase === "object"
        ? extractPurchaseIntelligence({
            ...(purchaseContext.purchase as any),
            merchantId:
              typeof req.body?.merchant === "string"
                ? req.body.merchant
                : undefined,
            hostname:
              typeof req.body?.hostname === "string"
                ? req.body.hostname
                : undefined,
            url: typeof req.body?.url === "string" ? req.body.url : undefined,
            total:
              typeof req.body?.amount === "number" && Number.isFinite(req.body.amount)
                ? req.body.amount
                : (purchaseContext.purchase as any)?.total,
          })
        : null;

    const decision = await decidePayment({
      userId: identity.userId,
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
      manualCardSlugs: identity.manualCardSlugs,
      restrictToWallet: identity.allowClientWalletControls
        ? typeof req.body?.restrictToWallet === "boolean"
          ? req.body.restrictToWallet
          : true
        : true,
      purchaseContext: purchaseContext
        ? {
            ...purchaseContext,
            purchase: purchaseReport?.purchase || purchaseContext.purchase,
          }
        : undefined,
    });

    const presentation = generateRecommendationPresentation({ decision });
    const lifecycle = [
      createLifecycleEvent({
        stage: "decision_generated",
        decision,
        presentation,
      }),
      createLifecycleEvent({
        stage: "presentation_generated",
        decision,
        presentation,
      }),
    ];

    res.json({
      decision,
      presentation,
      lifecycle,
      purchase: purchaseReport?.purchase || null,
      purchasePerformance: purchaseReport?.performance || null,
    });
  } catch (error) {
    console.error("[decisionRoutes/payment] Error:", error);
    res.status(500).json({ error: "Failed to create payment decision" });
  }
});

export default router;

type PaymentIdentity =
  | {
      userId: string;
      manualCardSlugs?: string[];
      allowClientWalletControls: boolean;
    }
  | {
      status: 401;
      error: string;
    };

function resolvePaymentIdentity(req: any): PaymentIdentity {
  if (allowDevelopmentOverrides()) {
    return {
      userId: String(req.body?.userId || "devUser"),
      manualCardSlugs: Array.isArray(req.body?.manualCardSlugs)
        ? req.body.manualCardSlugs.map(String)
        : undefined,
      allowClientWalletControls: true,
    };
  }

  const expectedToken = process.env.REWARDLY_BETA_SESSION_TOKEN;
  const betaUserId = process.env.REWARDLY_BETA_USER_ID;
  const providedToken = String(req.headers?.[BETA_SESSION_HEADER] || "");

  if (!expectedToken || !betaUserId || providedToken !== expectedToken) {
    return {
      status: 401,
      error: "Valid Rewardly beta session required.",
    };
  }

  return {
    userId: betaUserId,
    manualCardSlugs: undefined,
    allowClientWalletControls: false,
  };
}

function allowDevelopmentOverrides() {
  return process.env.REWARDLY_ALLOW_DEV_OVERRIDES === "true";
}

function hasPaymentDecisionContext(body: any) {
  return ["merchant", "hostname", "url", "title", "pageText"].some(
    (field) => typeof body?.[field] === "string" && body[field].trim(),
  );
}
