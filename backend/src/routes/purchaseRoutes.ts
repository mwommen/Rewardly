import { Router } from "express";
import {
  buildPurchaseIntelligenceReport,
  classifyPurchaseItem,
  extractPurchaseIntelligence,
  purchaseFixture,
} from "../services/purchaseIntelligenceService";

const router = Router();

router.post("/purchase/extract", (req, res) => {
  const report = extractPurchaseIntelligence(req.body || {});
  res.json({ ok: true, ...report });
});

router.post("/purchase/classify", (req, res) => {
  const item = classifyPurchaseItem(req.body || {});
  res.json({ ok: true, item });
});

router.get("/purchase/report", (req, res) => {
  const fixtureName = String(req.query.fixture || "mixed");
  res.json({
    ok: true,
    report: buildPurchaseIntelligenceReport(purchaseFixture(fixtureName)),
  });
});

export default router;
