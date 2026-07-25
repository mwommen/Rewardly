import express from "express";
import { getAnalyticsCollection } from "../db";
import {
  AnalyticsPrivacyError,
  RecommendationAnalyticsService,
  createMongoRecommendationAnalyticsStore,
} from "../services/recommendationAnalyticsService";

const router = express.Router();

router.post("/event", async (req, res) => {
  try {
    const service = await analyticsService();
    const event = await service.record({
      installationId: req.body?.installationId,
      userId: req.body?.userId,
      source: req.body?.source,
      event: req.body?.event,
      eventType: req.body?.eventType,
      sessionId: req.body?.sessionId,
      metadata: req.body?.metadata,
      timestamp: req.body?.timestamp,
    });
    res.json({
      ok: true,
      eventId: event.eventId,
      sessionId: event.sessionId,
      eventType: event.eventType,
    });
  } catch (e: any) {
    if (e instanceof AnalyticsPrivacyError) {
      return res.status(400).json({ error: "Analytics event failed privacy validation" });
    }
    const message = e?.message || "Failed to log analytics event";
    res.status(/required|unsupported/i.test(message) ? 400 : 500).json({ error: message });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const service = await analyticsService();
    await service.cleanupExpired();
    res.json({ ok: true, summary: await service.summary() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load analytics summary" });
  }
});

router.get("/merchants", async (_req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const service = await analyticsService();
    res.json({ ok: true, merchants: await service.merchants() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load merchant analytics" });
  }
});

router.get("/confidence", async (_req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const service = await analyticsService();
    res.json({ ok: true, confidence: await service.confidence() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load confidence analytics" });
  }
});

router.get("/errors", async (_req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const service = await analyticsService();
    res.json({ ok: true, errors: await service.errors() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load error analytics" });
  }
});

router.get("/value", async (_req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const service = await analyticsService();
    res.json({ ok: true, value: await service.recommendationValue() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load recommendation value analytics" });
  }
});

router.get("/health", async (_req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const service = await analyticsService();
    res.json({ ok: true, health: await service.healthStatus() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load analytics health" });
  }
});

router.get("/funnel", async (_req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const service = await analyticsService();
    res.json({ ok: true, funnel: await service.funnel() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load funnel analytics" });
  }
});

router.get("/recent", async (req, res) => {
  try {
    if (!analyticsDashboardAllowed()) return res.status(404).json({ error: "Analytics dashboard is not enabled" });
    const col = await getAnalyticsCollection();
    const userId = String(req.query.userId || "").trim();
    const query = userId ? { userId } : {};
    const events = await col
      .find(query)
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ ok: true, events });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load analytics events" });
  }
});

async function analyticsService() {
  const col = await getAnalyticsCollection();
  return new RecommendationAnalyticsService(
    createMongoRecommendationAnalyticsStore(col),
    {
      retentionDays: Number(process.env.REWARDLY_ANALYTICS_RETENTION_DAYS || 30),
    },
  );
}

function analyticsDashboardAllowed() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.REWARDLY_ENABLE_ANALYTICS_DASHBOARD === "true"
  );
}

export default router;
