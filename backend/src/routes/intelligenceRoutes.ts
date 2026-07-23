import express from "express";
import {
  getBenefitReviewQueue,
  listCanonicalBenefits,
} from "../services/benefitIntelligenceService";
import {
  buildMerchantCoverageMatrix,
  listMerchantIntelligence,
  resolveMerchantIntelligence,
  auditMerchantRegistry,
  listMerchantAliases,
  listMerchantMccProfiles,
} from "../services/merchantIntelligenceService";
import { scoreRecommendationConfidence } from "../services/recommendationConfidenceService";
import { listBenefitSources } from "../services/benefitSourceRegistryService";
import {
  approveAndPromoteFixture,
  runBenefitPipelineFixture,
} from "../services/benefitPipelineService";

const router = express.Router();

router.get("/intelligence/benefits/canonical", async (_req, res) => {
  try {
    const benefits = await listCanonicalBenefits();
    res.json({
      ok: true,
      count: benefits.length,
      benefits,
    });
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || "Failed to load canonical benefits",
    });
  }
});

router.get("/intelligence/benefits/review-queue", async (_req, res) => {
  try {
    const benefits = await getBenefitReviewQueue();
    res.json({
      ok: true,
      count: benefits.length,
      benefits,
    });
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || "Failed to load benefit review queue",
    });
  }
});

router.get("/intelligence/merchants", (_req, res) => {
  res.json({
    ok: true,
    count: listMerchantIntelligence().length,
    merchants: listMerchantIntelligence(),
  });
});

router.get("/intelligence/merchants/coverage", (_req, res) => {
  const coverage = buildMerchantCoverageMatrix();
  res.json({
    ok: true,
    count: coverage.length,
    coverage,
  });
});

router.get("/intelligence/merchants/audit", (_req, res) => {
  res.json({
    ok: true,
    audit: auditMerchantRegistry(),
  });
});

router.get("/intelligence/merchants/aliases", (_req, res) => {
  const aliases = listMerchantAliases();
  res.json({
    ok: true,
    count: aliases.length,
    aliases,
  });
});

router.get("/intelligence/merchants/mcc", (_req, res) => {
  const mccProfiles = listMerchantMccProfiles();
  res.json({
    ok: true,
    count: mccProfiles.length,
    mccProfiles,
  });
});

router.get("/intelligence/merchants/resolve", (req, res) => {
  const result = resolveMerchantIntelligence({
    merchant: String(req.query.merchant || ""),
    rawMerchant: String(req.query.rawMerchant || ""),
    billingDescriptor: String(req.query.billingDescriptor || ""),
    hostname: String(req.query.hostname || ""),
    url: String(req.query.url || ""),
    mcc: String(req.query.mcc || ""),
    purchaseChannel: String(req.query.purchaseChannel || ""),
  });
  res.json({
    ok: true,
    resolution: result,
  });
});

router.post("/intelligence/confidence/score", (req, res) => {
  res.json({
    ok: true,
    confidence: scoreRecommendationConfidence(req.body || {}),
  });
});

router.get("/intelligence/sources", (_req, res) => {
  const sources = listBenefitSources();
  res.json({
    ok: true,
    count: sources.length,
    sources,
  });
});

router.get("/intelligence/pipeline/fixture", (_req, res) => {
  const pipeline = runBenefitPipelineFixture();
  res.json({
    ok: true,
    source: pipeline.source,
    candidates: pipeline.candidates,
    comparisons: pipeline.comparisons.map((item) => ({
      candidateId: item.candidate.candidateId,
      comparisonStatus: item.comparisonStatus,
      changes: item.changes,
    })),
    reviews: pipeline.reviews,
    health: pipeline.health,
    staleness: pipeline.staleness,
  });
});

router.post("/intelligence/pipeline/fixture/promote", (_req, res) => {
  const pipeline = approveAndPromoteFixture();
  res.json({
    ok: true,
    promotion: pipeline.promotion,
  });
});

export default router;
