import { Router } from "express";
import { getFeedbackCollection } from "../db";
import {
  FeedbackPrivacyError,
  FeedbackService,
  createMongoFeedbackStore,
} from "../services/feedbackService";

const router = Router();

router.post("/feedback", async (req, res) => {
  try {
    const service = await feedbackService();
    const feedback = await service.record({
      type: req.body?.type,
      sessionId: req.body?.sessionId,
      installationId: req.body?.installationId,
      merchantName: req.body?.merchantName,
      merchantDomain: req.body?.merchantDomain,
      merchantCategory: req.body?.merchantCategory,
      confidenceBand: req.body?.confidenceBand,
      recommendedCardName: req.body?.recommendedCardName,
      reason: req.body?.reason,
      comment: req.body?.comment,
      extensionVersion: req.body?.extensionVersion,
      createdAt: req.body?.createdAt,
    });
    res.json({
      ok: true,
      feedbackId: feedback.feedbackId,
      type: feedback.type,
      normalizedMerchantName: feedback.normalizedMerchantName,
    });
  } catch (error: any) {
    if (error instanceof FeedbackPrivacyError) {
      return res.status(400).json({ error: "Feedback failed privacy validation" });
    }
    res.status(/required|unsupported|reason/i.test(error?.message || "") ? 400 : 500).json({
      error: error?.message || "Failed to record feedback",
    });
  }
});

router.get("/feedback/summary", async (_req, res) => {
  try {
    if (!feedbackDashboardAllowed()) return res.status(404).json({ error: "Feedback dashboard is not enabled" });
    const service = await feedbackService();
    res.json({ ok: true, summary: await service.summary() });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to load feedback summary" });
  }
});

router.get("/feedback/merchants", async (_req, res) => {
  try {
    if (!feedbackDashboardAllowed()) return res.status(404).json({ error: "Feedback dashboard is not enabled" });
    const service = await feedbackService();
    res.json({ ok: true, merchants: await service.merchants() });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to load merchant feedback" });
  }
});

router.get("/feedback/trends", async (_req, res) => {
  try {
    if (!feedbackDashboardAllowed()) return res.status(404).json({ error: "Feedback dashboard is not enabled" });
    const service = await feedbackService();
    res.json({ ok: true, trends: await service.trends() });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to load feedback trends" });
  }
});

async function feedbackService() {
  const collection = await getFeedbackCollection();
  return new FeedbackService(createMongoFeedbackStore(collection));
}

function feedbackDashboardAllowed() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.REWARDLY_ENABLE_FEEDBACK_DASHBOARD === "true"
  );
}

export default router;
