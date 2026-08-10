import crypto from "crypto";
import { getDecisionValidationsCollection } from "../db";
import {
  attachValidationToDecisionRuntime,
  getDecisionRuntime,
  type DecisionObject,
} from "./decisionRuntimeService";
import type { TrustAccessScope } from "./trustInfrastructureService";

export const DECISION_VALIDATOR_VERSION = "decision-validator-0.1.0";

export type DecisionValidationStatus =
  | "pending"
  | "validated"
  | "needs_review"
  | "superseded"
  | "archived";

export type ValidationOverallResult = "passed" | "warning" | "failed";
export type TrustScoreLevel = "excellent" | "strong" | "moderate" | "weak";

export type ValidationMetric = {
  score: number;
  result: ValidationOverallResult;
  notes: string[];
};

export type ValidationWarning = {
  code: string;
  severity: "info" | "caution" | "critical";
  message: string;
  component: string;
};

export type ValidationResult = {
  validationId: string;
  decisionId: string;
  status: DecisionValidationStatus;
  validatedAt: string;
  validatorVersion: string;
  overallResult: ValidationOverallResult;
  trustScore: number;
  trustScoreLevel: TrustScoreLevel;
  confidenceCalibration: ValidationMetric;
  evidenceCompleteness: ValidationMetric;
  recommendationCorrectness: ValidationMetric;
  ruleConsistency: ValidationMetric;
  merchantResolutionQuality: ValidationMetric;
  walletCoverage: ValidationMetric;
  warnings: ValidationWarning[];
  validationNotes: string[];
  edgeCases: string[];
  createdAt: string;
};

export type GoldenDecisionScenario = {
  scenarioId: string;
  title: string;
  merchant: string;
  category: string;
  expectedOutcome: ValidationOverallResult;
  expectedEdgeCases: string[];
};

export type EdgeCaseDefinition = {
  edgeCaseId: string;
  title: string;
  description: string;
  severity: "info" | "caution" | "critical";
  searchableTerms: string[];
};

type StoredValidation = {
  validationId: string;
  decisionId: string;
  ownerUserId: string | null;
  partnerId: string | null;
  validation: ValidationResult;
  createdAt: Date;
  schemaVersion: number;
};

const memoryValidations = new Map<string, StoredValidation>();
const memoryValidationByDecisionId = new Map<string, string>();

export const EDGE_CASE_REGISTRY: EdgeCaseDefinition[] = [
  {
    edgeCaseId: "unknown_merchant",
    title: "Unknown merchant",
    description: "Merchant identity or category confidence is low.",
    severity: "caution",
    searchableTerms: ["merchant", "unknown", "ambiguous"],
  },
  {
    edgeCaseId: "incomplete_wallet",
    title: "Incomplete wallet",
    description: "The evaluated wallet is empty or has too little coverage.",
    severity: "critical",
    searchableTerms: ["wallet", "empty", "coverage"],
  },
  {
    edgeCaseId: "missing_benefit_data",
    title: "Missing benefit data",
    description: "Evidence does not clearly identify the winning benefit rule.",
    severity: "caution",
    searchableTerms: ["benefit", "rule", "evidence"],
  },
  {
    edgeCaseId: "conflicting_rules",
    title: "Conflicting rules",
    description: "Multiple evidence records indicate overlapping winning rules.",
    severity: "critical",
    searchableTerms: ["conflict", "rules", "overlap"],
  },
  {
    edgeCaseId: "expired_benefit",
    title: "Expired benefit",
    description: "A decision warning references expired benefit data.",
    severity: "critical",
    searchableTerms: ["expired", "benefit", "date"],
  },
  {
    edgeCaseId: "ambiguous_purchase_context",
    title: "Ambiguous purchase context",
    description: "Purchase context exists but is incomplete or low confidence.",
    severity: "caution",
    searchableTerms: ["purchase", "context", "ambiguous"],
  },
];

export const GOLDEN_DECISION_SCENARIOS: GoldenDecisionScenario[] = [
  {
    scenarioId: "golden_grocery_purchase",
    title: "Grocery purchase",
    merchant: "Whole Foods",
    category: "grocery",
    expectedOutcome: "passed",
    expectedEdgeCases: [],
  },
  {
    scenarioId: "golden_travel_booking",
    title: "Travel booking",
    merchant: "Delta",
    category: "travel",
    expectedOutcome: "passed",
    expectedEdgeCases: [],
  },
  {
    scenarioId: "golden_dining_purchase",
    title: "Dining",
    merchant: "Starbucks",
    category: "dining",
    expectedOutcome: "passed",
    expectedEdgeCases: [],
  },
  {
    scenarioId: "golden_online_retail",
    title: "Online retail",
    merchant: "Amazon",
    category: "online_retail",
    expectedOutcome: "passed",
    expectedEdgeCases: [],
  },
  {
    scenarioId: "golden_gas_station",
    title: "Gas station",
    merchant: "Shell",
    category: "gas",
    expectedOutcome: "passed",
    expectedEdgeCases: [],
  },
  {
    scenarioId: "golden_large_purchase",
    title: "Large purchase",
    merchant: "Apple",
    category: "electronics",
    expectedOutcome: "warning",
    expectedEdgeCases: ["ambiguous_purchase_context"],
  },
  {
    scenarioId: "golden_subscription_renewal",
    title: "Subscription renewal",
    merchant: "Netflix",
    category: "streaming",
    expectedOutcome: "passed",
    expectedEdgeCases: [],
  },
];

export function resetDecisionValidationForTests() {
  memoryValidations.clear();
  memoryValidationByDecisionId.clear();
}

export async function validateDecisionById(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  const decision = await getDecisionRuntime(decisionId, accessScope);
  if (!decision) throw new DecisionValidationNotFoundError(decisionId);
  const validation = await validateDecisionObject(decision, accessScope);
  await attachValidationToDecisionRuntime(
    decisionId,
    {
      validationId: validation.validationId,
      status: validation.status,
      trustScore: validation.trustScore,
      trustScoreLevel: validation.trustScoreLevel,
      validatedAt: validation.validatedAt,
    },
    accessScope,
  );
  return validation;
}

export async function validateDecisionObject(
  decision: DecisionObject,
  accessScope?: TrustAccessScope,
) {
  const existing = await getValidationForDecision(
    decision.decisionId,
    accessScope,
  );
  if (existing) return existing;

  const recommendationCorrectness = evaluateRecommendationCorrectness(decision);
  const evidenceCompleteness = evaluateEvidenceCompleteness(decision);
  const confidenceCalibration = evaluateConfidenceCalibration(decision);
  const ruleConsistency = evaluateRuleConsistency(decision);
  const merchantResolutionQuality = evaluateMerchantResolutionQuality(decision);
  const walletCoverage = evaluateWalletCoverage(decision);
  const warnings = validationWarnings({
    decision,
    recommendationCorrectness,
    evidenceCompleteness,
    confidenceCalibration,
    ruleConsistency,
    merchantResolutionQuality,
    walletCoverage,
  });
  const trustScore = calculateTrustScore({
    recommendationCorrectness,
    evidenceCompleteness,
    confidenceCalibration,
    ruleConsistency,
    merchantResolutionQuality,
    walletCoverage,
  });
  const overallResult = overallResultFor(trustScore, warnings);
  const edgeCases = detectEdgeCases(decision, warnings);
  const validatedAt = new Date().toISOString();
  const validation: ValidationResult = deepFreeze({
    validationId: stableId("val", {
      decisionId: decision.decisionId,
      validatorVersion: DECISION_VALIDATOR_VERSION,
      runtimeVersion: decision.runtimeVersion,
    }),
    decisionId: decision.decisionId,
    status: overallResult === "passed" ? "validated" : "needs_review",
    validatedAt,
    validatorVersion: DECISION_VALIDATOR_VERSION,
    overallResult,
    trustScore,
    trustScoreLevel: trustScoreLevelFor(trustScore),
    confidenceCalibration,
    evidenceCompleteness,
    recommendationCorrectness,
    ruleConsistency,
    merchantResolutionQuality,
    walletCoverage,
    warnings,
    validationNotes: validationNotesFor(overallResult, edgeCases),
    edgeCases,
    createdAt: validatedAt,
  });
  await persistValidation(validation, decision);
  return validation;
}

export async function getValidationById(
  validationId: string,
  accessScope?: TrustAccessScope,
) {
  if (useMemoryValidationStore()) {
    const stored = memoryValidations.get(validationId);
    return stored && scopeMatches(stored, accessScope)
      ? stored.validation
      : null;
  }
  const collection = await getDecisionValidationsCollection();
  const stored = await collection.findOne({
    validationId,
    ...accessQuery(accessScope),
  } as any);
  return (stored?.validation as ValidationResult | undefined) || null;
}

export async function getValidationForDecision(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  if (useMemoryValidationStore()) {
    const validationId = memoryValidationByDecisionId.get(decisionId);
    const stored = validationId ? memoryValidations.get(validationId) : null;
    return stored && scopeMatches(stored, accessScope)
      ? stored.validation
      : null;
  }
  const collection = await getDecisionValidationsCollection();
  const stored = await collection.findOne({
    decisionId,
    ...accessQuery(accessScope),
  } as any);
  return (stored?.validation as ValidationResult | undefined) || null;
}

export class DecisionValidationNotFoundError extends Error {
  constructor(public decisionId: string) {
    super(`Decision validation source was not found for ${decisionId}.`);
  }
}

function evaluateRecommendationCorrectness(
  decision: DecisionObject,
): ValidationMetric {
  const notes: string[] = [];
  if (decision.recommendationStatus === "no_recommendation") {
    const emptyWallet = decision.walletSnapshot.evaluatedCardCount === 0;
    notes.push(
      emptyWallet
        ? "No recommendation is correct because the wallet is empty."
        : "No eligible recommendation was produced for the evaluated wallet.",
    );
    return metric(emptyWallet ? 82 : 60, emptyWallet ? "passed" : "warning", notes);
  }
  if (!decision.recommendation.paymentMethodId) {
    notes.push("The decision is missing a recommended payment method.");
    return metric(20, "failed", notes);
  }
  if (!decision.walletSnapshot.cardSlugs.includes(decision.recommendation.paymentMethodId)) {
    notes.push("The recommended payment method is outside the evaluated wallet.");
    return metric(10, "failed", notes);
  }
  if (!decision.recommendation.winningRule) {
    notes.push("The decision did not expose the winning rule.");
    return metric(68, "warning", notes);
  }
  notes.push("The recommended payment method is wallet-owned and has a winning rule.");
  return metric(94, "passed", notes);
}

function evaluateEvidenceCompleteness(decision: DecisionObject): ValidationMetric {
  const notes: string[] = [];
  const evidenceCount = decision.evidence.length;
  const factorCount = decision.confidenceFactors.length;
  if (evidenceCount >= 3 && factorCount >= 4) {
    notes.push("Evidence and confidence factors are complete.");
    return metric(94, "passed", notes);
  }
  if (evidenceCount >= 1) {
    notes.push("Evidence exists but is thinner than the validation target.");
    return metric(70, "warning", notes);
  }
  notes.push("No structured evidence was attached to the decision.");
  return metric(25, "failed", notes);
}

function evaluateConfidenceCalibration(decision: DecisionObject): ValidationMetric {
  const notes: string[] = [];
  const confidence = decision.confidence.score;
  const evidenceScore = decision.evidence.length >= 3 ? 0.9 : decision.evidence.length ? 0.65 : 0.25;
  if (confidence >= 0.8 && evidenceScore < 0.7) {
    notes.push("Decision confidence is high but evidence is weak.");
    return metric(52, "warning", notes);
  }
  if (confidence < 0.58 && evidenceScore >= 0.85) {
    notes.push("Evidence is strong but confidence is low.");
    return metric(58, "warning", notes);
  }
  notes.push("Confidence is consistent with available evidence.");
  return metric(Math.round(((confidence + evidenceScore) / 2) * 100), "passed", notes);
}

function evaluateRuleConsistency(decision: DecisionObject): ValidationMetric {
  const notes: string[] = [];
  const winningRuleEvidence = decision.evidence.filter((item) =>
    /WINNING_RULE|BASE_REWARD_RULE|CATEGORY_MATCH|MERCHANT_MATCH/.test(item.type),
  );
  const conflictingEvidence = decision.evidence.filter(
    (item) => item.effect === "excludes" || /conflict/i.test(item.statement),
  );
  if (conflictingEvidence.length) {
    notes.push("Evidence contains conflicting or excluding rule records.");
    return metric(45, "failed", notes);
  }
  if (!decision.recommendation.winningRule && decision.recommendationStatus === "recommended") {
    notes.push("A recommendation was produced without a traceable winning rule.");
    return metric(62, "warning", notes);
  }
  notes.push(`${winningRuleEvidence.length} rule-related evidence records were consistent.`);
  return metric(winningRuleEvidence.length ? 90 : 72, "passed", notes);
}

function evaluateMerchantResolutionQuality(
  decision: DecisionObject,
): ValidationMetric {
  const notes: string[] = [];
  const confidence = decision.merchant.confidence ?? 0.5;
  if (confidence >= 0.85) {
    notes.push("Merchant resolution quality is high.");
    return metric(Math.round(confidence * 100), "passed", notes);
  }
  if (confidence >= 0.58) {
    notes.push("Merchant resolution is usable but should be reviewed.");
    return metric(Math.round(confidence * 100), "warning", notes);
  }
  notes.push("Merchant resolution confidence is low.");
  return metric(Math.round(confidence * 100), "failed", notes);
}

function evaluateWalletCoverage(decision: DecisionObject): ValidationMetric {
  const notes: string[] = [];
  const count = decision.walletSnapshot.evaluatedCardCount;
  if (count >= 2) {
    notes.push(`${count} wallet cards were evaluated.`);
    return metric(92, "passed", notes);
  }
  if (count === 1) {
    notes.push("Only one wallet card was evaluated.");
    return metric(76, "warning", notes);
  }
  notes.push("No wallet cards were available for evaluation.");
  return metric(40, "failed", notes);
}

function validationWarnings(input: {
  decision: DecisionObject;
  recommendationCorrectness: ValidationMetric;
  evidenceCompleteness: ValidationMetric;
  confidenceCalibration: ValidationMetric;
  ruleConsistency: ValidationMetric;
  merchantResolutionQuality: ValidationMetric;
  walletCoverage: ValidationMetric;
}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  addMetricWarnings(warnings, "recommendation_correctness", input.recommendationCorrectness);
  addMetricWarnings(warnings, "evidence_completeness", input.evidenceCompleteness);
  addMetricWarnings(warnings, "confidence_calibration", input.confidenceCalibration);
  addMetricWarnings(warnings, "rule_consistency", input.ruleConsistency);
  addMetricWarnings(warnings, "merchant_resolution", input.merchantResolutionQuality);
  addMetricWarnings(warnings, "wallet_coverage", input.walletCoverage);
  for (const warning of input.decision.warnings) {
    if (/expired/i.test(warning.message) || /expired/i.test(warning.code)) {
      warnings.push({
        code: "EXPIRED_BENEFIT_SIGNAL",
        severity: "critical",
        message: "Decision warnings include expired benefit data.",
        component: "benefit_registry",
      });
    }
  }
  return dedupeWarnings(warnings);
}

function addMetricWarnings(
  warnings: ValidationWarning[],
  component: string,
  metricResult: ValidationMetric,
) {
  if (metricResult.result === "passed") return;
  warnings.push({
    code: `${component.toUpperCase()}_${metricResult.result.toUpperCase()}`,
    severity: metricResult.result === "failed" ? "critical" : "caution",
    message: metricResult.notes[0] || `${component} requires review.`,
    component,
  });
}

function calculateTrustScore(metrics: Record<string, ValidationMetric>) {
  const weights: Record<string, number> = {
    recommendationCorrectness: 0.26,
    confidenceCalibration: 0.18,
    evidenceCompleteness: 0.18,
    ruleConsistency: 0.16,
    merchantResolutionQuality: 0.12,
    walletCoverage: 0.1,
  };
  return Math.round(
    Object.entries(weights).reduce(
      (total, [key, weight]) => total + metrics[key].score * weight,
      0,
    ),
  );
}

function overallResultFor(
  trustScore: number,
  warnings: ValidationWarning[],
): ValidationOverallResult {
  if (warnings.some((warning) => warning.severity === "critical")) return "failed";
  if (trustScore >= 82 && warnings.length === 0) return "passed";
  return "warning";
}

function detectEdgeCases(
  decision: DecisionObject,
  warnings: ValidationWarning[],
) {
  const edgeCases = new Set<string>();
  if ((decision.merchant.confidence ?? 0) < 0.58) edgeCases.add("unknown_merchant");
  if (decision.walletSnapshot.evaluatedCardCount === 0) edgeCases.add("incomplete_wallet");
  if (!decision.recommendation.winningRule && decision.recommendationStatus === "recommended") {
    edgeCases.add("missing_benefit_data");
  }
  if (warnings.some((warning) => /RULE_CONSISTENCY|conflict/i.test(warning.code))) {
    edgeCases.add("conflicting_rules");
  }
  if (warnings.some((warning) => warning.code === "EXPIRED_BENEFIT_SIGNAL")) {
    edgeCases.add("expired_benefit");
  }
  if (!decision.purchaseContext.checkoutStage || !decision.purchaseContext.amount) {
    edgeCases.add("ambiguous_purchase_context");
  }
  return Array.from(edgeCases).sort();
}

function validationNotesFor(
  overallResult: ValidationOverallResult,
  edgeCases: string[],
) {
  if (overallResult === "passed") {
    return ["Decision passed validation checks."];
  }
  return [
    "Decision requires validation review before it should be treated as a high-quality validated sample.",
    edgeCases.length
      ? `Detected edge cases: ${edgeCases.join(", ")}.`
      : "No registered edge case matched the warning set.",
  ];
}

async function persistValidation(
  validation: ValidationResult,
  decision: DecisionObject,
) {
  const stored: StoredValidation = {
    validationId: validation.validationId,
    decisionId: validation.decisionId,
    ownerUserId: decision.userId,
    partnerId: decision.partnerId,
    validation,
    createdAt: new Date(validation.createdAt),
    schemaVersion: 1,
  };
  if (useMemoryValidationStore()) {
    memoryValidations.set(stored.validationId, stored);
    memoryValidationByDecisionId.set(stored.decisionId, stored.validationId);
    return;
  }
  const collection = await getDecisionValidationsCollection();
  await collection.updateOne(
    {
      decisionId: stored.decisionId,
      ownerUserId: stored.ownerUserId,
      partnerId: stored.partnerId,
    },
    { $setOnInsert: stored },
    { upsert: true },
  );
}

function metric(
  score: number,
  result: ValidationOverallResult,
  notes: string[],
): ValidationMetric {
  return { score: clampScore(score), result, notes };
}

function trustScoreLevelFor(score: number): TrustScoreLevel {
  if (score >= 92) return "excellent";
  if (score >= 82) return "strong";
  if (score >= 65) return "moderate";
  return "weak";
}

function scopeMatches(
  stored: Pick<StoredValidation, "ownerUserId" | "partnerId">,
  accessScope?: TrustAccessScope,
) {
  if (!accessScope) return true;
  return (
    (accessScope.ownerUserId || null) === stored.ownerUserId &&
    (accessScope.tenantId || null) === stored.partnerId
  );
}

function accessQuery(accessScope?: TrustAccessScope) {
  if (!accessScope) return {};
  return {
    ownerUserId: accessScope.ownerUserId || null,
    partnerId: accessScope.tenantId || null,
  };
}

function dedupeWarnings(warnings: ValidationWarning[]) {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.component}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function useMemoryValidationStore() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.REWARDLY_DECISION_VALIDATION_STORE === "memory"
  );
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}_${crypto
    .createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 16)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}
