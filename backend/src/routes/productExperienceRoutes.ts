import { Router } from "express";
import {
  buildDashboardExperienceModel,
  createFeedbackEvent,
  createLifecycleEvent,
  createProductAnalyticsEvent,
  generateRecommendationPresentation,
} from "../services/productExperienceService";
import type { PaymentDecision } from "../../../packages/rewardly-core/src";

const router = Router();

router.post("/experience/presentation", (req, res) => {
  try {
    const decision = req.body?.decision as PaymentDecision | undefined;
    if (!decision || typeof decision !== "object") {
      return res.status(400).json({ error: "Payment decision is required." });
    }
    const presentation = generateRecommendationPresentation({
      decision,
      actualPerformanceMs:
        req.body?.performance && typeof req.body.performance === "object"
          ? req.body.performance
          : undefined,
    });
    const lifecycle = createLifecycleEvent({
      stage: "presentation_generated",
      presentation,
      decision,
    });
    res.json({ ok: true, presentation, lifecycle });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Failed to generate recommendation presentation.",
    });
  }
});

router.post("/experience/feedback", (req, res) => {
  try {
    const feedback = createFeedbackEvent({
      type: req.body?.type,
      userId: req.body?.userId,
      installationId: req.body?.installationId,
      presentationId: req.body?.presentationId,
      merchantName: req.body?.merchantName,
      cardSlug: req.body?.cardSlug,
      reason: req.body?.reason,
    });
    const analytics = createProductAnalyticsEvent({
      type:
        feedback.type === "recommendation_dismissed"
          ? "dismissed"
          : feedback.type === "recommendation_accepted"
            ? "recommendation_clicked"
            : "error",
      userId: feedback.userId,
      installationId: feedback.installationId,
      surface: "extension",
      metadata: {
        feedbackType: feedback.type,
        presentationId: feedback.presentationId,
        merchantName: feedback.merchantName,
        cardSlug: feedback.cardSlug,
      },
    });
    res.json({ ok: true, feedback, analytics });
  } catch (error: any) {
    res.status(400).json({
      error: error?.message || "Invalid feedback event.",
    });
  }
});

router.get("/experience/dashboard/:userId", (req, res) => {
  const userId = String(req.params.userId || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "User id is required." });
  }
  res.json({
    ok: true,
    dashboard: buildDashboardExperienceModel({
      userId,
      walletCardSlugs: [],
      activeBenefits: [],
      expiringBenefits: [],
      recentRecommendations: [],
      recommendationHistory: [],
    }),
  });
});

export default router;
