import express from "express";
import { getAnalyticsCollection } from "../db";

const router = express.Router();

router.post("/event", async (req, res) => {
  try {
    const {
      userId,
      installationId,
      source = "unknown",
      event,
      metadata = {},
    } = req.body as {
      userId?: string;
      installationId?: string;
      source?: string;
      event?: string;
      metadata?: Record<string, unknown>;
    };
    if (!event || typeof event !== "string") {
      return res.status(400).json({ error: "Event name is required" });
    }
    if (!installationId && !userId) {
      return res
        .status(400)
        .json({ error: "Anonymous installation id is required" });
    }
    const col = await getAnalyticsCollection();
    await col.insertOne({
      userId: userId || null,
      installationId: installationId || null,
      source,
      event,
      metadata,
      createdAt: new Date(),
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to log analytics event" });
  }
});

router.get("/recent", async (req, res) => {
  try {
    const userId = String(req.query.userId || "devUser").trim();
    const col = await getAnalyticsCollection();
    const events = await col
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ ok: true, events });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load analytics events" });
  }
});

export default router;
