import { Router } from "express";
import { decidePayment } from "../services/paymentDecisionService";
import {
  createLifecycleEvent,
  generateRecommendationPresentation,
} from "../services/productExperienceService";
import { extractPurchaseIntelligence } from "../services/purchaseIntelligenceService";
import type { PaymentDecision } from "../../../packages/rewardly-core/src";

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
      merchantSignals: sanitizeMerchantSignals(req.body?.merchantSignals, {
        url: typeof req.body?.url === "string" ? req.body.url : "",
        hostname:
          typeof req.body?.hostname === "string" ? req.body.hostname : "",
        pageTitle: typeof req.body?.title === "string" ? req.body.title : "",
        detectedMerchantLabel:
          typeof req.body?.merchant === "string" ? req.body.merchant : "",
        checkoutStage:
          typeof purchaseContext?.checkoutStage === "string"
            ? purchaseContext.checkoutStage
            : undefined,
      }) as any,
    });

    const presentation = generateRecommendationPresentation({ decision });
    console.log(
      "[Rewardly] decision-explanation-payload",
      decisionExplanationDebugPayload(decision),
    );
    traceDecisionRouteResponse(decision);
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
      merchant: safeMerchantSummary((decision as any).merchantIntelligence),
    });
  } catch (error) {
    console.error("[decisionRoutes/payment] Error:", error);
    res.status(500).json({ error: "Failed to create payment decision" });
  }
});

export default router;

function traceDecisionRouteResponse(decision: PaymentDecision) {
  if (process.env.REWARDLY_TRACE_DECISION !== "true") return;
  console.log(
    "[Rewardly] decision-route-response",
    decisionExplanationDebugPayload(decision),
  );
}

function decisionExplanationDebugPayload(decision: PaymentDecision) {
  const recommendation = decision?.recommendedCard || null;
  const winningReason =
    decision?.winningReason || recommendation?.winningReason || null;
  const relevantBenefits =
    decision?.relevantBenefits || recommendation?.relevantBenefits || [];
  const legacyBenefits = [
    ...(decision?.unlockedBenefits || []),
    ...(recommendation?.unlockedBenefits || []),
  ];

  return {
    merchant: decision?.merchant?.name || null,
    recommendedCard:
      recommendation?.card?.slug || recommendation?.card?.name || null,
    decisionNarrative: decision?.decisionNarrative
      ? {
          reasonType: decision.decisionNarrative.reasonType || null,
          headline: decision.decisionNarrative.headline || null,
          summary: decision.decisionNarrative.summary || null,
          estimatedReward: decision.decisionNarrative.estimatedReward || null,
          comparison: decision.decisionNarrative.comparison || null,
          confidence: decision.decisionNarrative.confidence || null,
          primaryReason: decision.decisionNarrative.primaryReason || null,
        }
      : null,
    recommendationIntegrity: decision?.recommendationIntegrity || null,
    winningReason: winningReason
      ? {
          type: winningReason.type || null,
          title: winningReason.title || null,
          explanation: winningReason.explanation || null,
          applicableToPurchase: winningReason.applicableToPurchase,
          influencedRecommendation: winningReason.influencedRecommendation,
          sourceBenefitId: winningReason.sourceBenefitId || null,
          sourceRuleId: winningReason.sourceRuleId || null,
        }
      : null,
    relevantBenefits: relevantBenefits.map((match) => ({
      label: match?.benefit?.label || match?.summary || null,
      sourceBenefitId: match?.benefit?.id || null,
    })),
    legacyWhyThisWins:
      decision?.primaryReason?.detail ||
      recommendation?.primaryReason?.detail ||
      null,
    legacyBenefits: legacyBenefits.map((match) => ({
      label: match?.benefit?.label || match?.summary || null,
      sourceBenefitId: match?.benefit?.id || null,
    })),
    sourceBenefitIds: [
      winningReason?.sourceBenefitId,
      ...relevantBenefits.map((match) => match?.benefit?.id),
    ].filter(Boolean),
    sourceRuleIds: [winningReason?.sourceRuleId].filter(Boolean),
  };
}

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
  if (
    ["merchant", "hostname", "url", "title", "pageText"].some(
      (field) => typeof body?.[field] === "string" && body[field].trim(),
    )
  ) {
    return true;
  }
  return Boolean(
    body?.merchantSignals &&
      typeof body.merchantSignals === "object" &&
      ["url", "hostname", "pageTitle", "detectedMerchantLabel"].some(
        (field) =>
          typeof body.merchantSignals?.[field] === "string" &&
          body.merchantSignals[field].trim(),
      ),
  );
}

function sanitizeMerchantSignals(raw: any, fallback: any) {
  const input = raw && typeof raw === "object" ? raw : {};
  return {
    url: stringField(input.url) || fallback.url || "",
    hostname: stringField(input.hostname) || fallback.hostname || "",
    pageTitle: stringField(input.pageTitle) || fallback.pageTitle || "",
    detectedMerchantLabel:
      stringField(input.detectedMerchantLabel) ||
      fallback.detectedMerchantLabel ||
      "",
    documentTextSignals: stringList(input.documentTextSignals, 12),
    structuredData: Array.isArray(input.structuredData)
      ? input.structuredData.slice(0, 12).map((signal: any) => ({
          type: stringField(signal?.type),
          value: stringField(signal?.value),
          source: stringField(signal?.source),
        }))
      : [],
    checkoutProviderSignals: stringList(input.checkoutProviderSignals, 12),
    domSignals: Array.isArray(input.domSignals)
      ? input.domSignals.slice(0, 20).map((signal: any) => ({
          type: stringField(signal?.type),
          value: stringField(signal?.value),
          source: stringField(signal?.source),
        }))
      : [],
    purchaseChannelHint: stringField(input.purchaseChannelHint),
    checkoutStage: stringField(input.checkoutStage) || fallback.checkoutStage,
    transactionDate: stringField(input.transactionDate) || new Date().toISOString(),
  };
}

function safeMerchantSummary(intelligence: any) {
  if (!intelligence) return null;
  return {
    merchantId: intelligence.identity?.merchantId || undefined,
    displayName: intelligence.identity?.displayName || undefined,
    category: intelligence.classification?.primaryCategory || "unknown",
    confidence: intelligence.confidence?.score ?? 0,
    confidenceBand: intelligence.confidence?.band || "unknown",
    resolutionStatus: intelligence.resolutionStatus || "unknown",
    purchaseChannel: intelligence.context?.purchaseChannel || "unknown",
    commerceModel: intelligence.context?.commerceModel || "unknown",
    marketplace: Boolean(intelligence.context?.marketplace?.isMarketplace),
    checkoutProvider: intelligence.context?.checkoutProvider || "unknown",
    registryVersion: intelligence.registryVersion || null,
    warnings: Array.isArray(intelligence.trace?.warnings)
      ? intelligence.trace.warnings
      : [],
  };
}

function stringField(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(
          /\b(?:\d[ -]*?){12,19}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|token=[^&\s]+|cookie=[^&\s]+|session[_-]?token[=:\s][^&\s]+/gi,
          "[redacted]",
        )
        .slice(0, 200)
    : "";
}

function stringList(values: unknown, maxCount: number) {
  return Array.isArray(values)
    ? values
        .filter((value) => typeof value === "string")
        .map((value) => value.slice(0, 160))
        .slice(0, maxCount)
    : [];
}
