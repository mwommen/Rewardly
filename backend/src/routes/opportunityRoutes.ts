import { Router } from "express";
import {
  buildOpportunityReport,
  detectOpportunities,
  generateOpportunityTimeline,
  opportunityFixtureStates,
  simulateOpportunity,
} from "../services/opportunityIntelligenceService";

const router = Router();

router.get("/opportunities", (req, res) => {
  const userId = String(req.query.userId || "devUser");
  const walletBenefitStates = opportunityFixtureStates(userId);
  const opportunities = detectOpportunities({
    userId,
    walletBenefitStates,
  });
  res.json({ ok: true, opportunities });
});

router.get("/opportunities/timeline", (req, res) => {
  const userId = String(req.query.userId || "devUser");
  const walletBenefitStates = opportunityFixtureStates(userId);
  const opportunities = detectOpportunities({
    userId,
    walletBenefitStates,
  });
  res.json({
    ok: true,
    timeline: generateOpportunityTimeline(opportunities, walletBenefitStates),
  });
});

router.post("/opportunities/simulate", (req, res) => {
  const userId = String(req.body?.userId || "devUser");
  const walletBenefitStates = opportunityFixtureStates(userId);
  const opportunities = detectOpportunities({
    userId,
    walletBenefitStates,
  });
  const opportunity =
    opportunities.find((item) => item.opportunityId === req.body?.opportunityId) ||
    opportunities[0];
  if (!opportunity) {
    return res.status(404).json({ error: "No opportunity available to simulate." });
  }
  res.json({ ok: true, simulation: simulateOpportunity(opportunity) });
});

router.get("/opportunities/report", (req, res) => {
  const userId = String(req.query.userId || "devUser");
  res.json({
    ok: true,
    report: buildOpportunityReport({
      userId,
      walletBenefitStates: opportunityFixtureStates(userId),
    }),
  });
});

export default router;
