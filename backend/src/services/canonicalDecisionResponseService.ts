import crypto from "crypto";
import type { PaymentDecision } from "../../../packages/rewardly-core/src";
import type { PaymentDecisionRequest } from "./paymentDecisionService";
import {
  API_VERSION,
  SCORING_POLICY_VERSION,
  type DecisionTrustRecord,
} from "./trustInfrastructureService";
import {
  DECISION_ENGINE_VERSION,
  DECISION_EXPLANATION_VERSION,
} from "./decisionIntelligenceService";

export const KNOWLEDGE_VERSION = "knowledge_2026_08";
export const BENEFIT_REGISTRY_VERSION = "benefit_registry_011";
export const MERCHANT_REGISTRY_VERSION = "merchant_registry_004";
export const RULE_VERSION = SCORING_POLICY_VERSION;

export type CanonicalConfidenceLevel = "high" | "medium" | "low";

export type CanonicalConfidenceFactor = {
  name: string;
  level: CanonicalConfidenceLevel;
  score: number | null;
  explanation: string;
};

export type CanonicalDecisionEvidence = {
  evidenceId: string;
  type: string;
  source: string;
  statement: string;
  effect: string;
  confidence: number | null;
  version?: string | null;
};

export type CanonicalDecisionAlternative = {
  paymentMethodId: string;
  displayName: string;
  rank: number;
  estimatedValue: number | null;
  confidence: number | null;
  reasonNotSelected: string;
  supportingEvidence: string[];
};

export type CanonicalDecisionResponse = {
  decisionId: string;
  requestId: string;
  status: "recommended" | "no_recommendation";
  recommendation: {
    paymentMethodId: string | null;
    displayName: string | null;
    estimatedValue: number | null;
    currency: "USD";
    winningRule: string | null;
  };
  confidence: {
    score: number;
    label: CanonicalConfidenceLevel;
  };
  confidenceFactors: CanonicalConfidenceFactor[];
  alternatives: CanonicalDecisionAlternative[];
  explanation: {
    summary: string;
    factors: string[];
  };
  evidence: CanonicalDecisionEvidence[];
  warnings: Array<{
    code: string;
    severity: string;
    message: string;
    userAction?: string;
  }>;
  merchant: {
    name: string;
    category: string | null;
    confidence: number | null;
  };
  walletSnapshot: {
    source: string;
    cardSlugs: string[];
    evaluatedCardCount: number;
  };
  purchaseContext: {
    amount: number | null;
    currency: "USD";
    checkoutStage?: string | null;
    context?: unknown;
  };
  ruleVersion: string;
  merchantRegistryVersion: string;
  benefitRegistryVersion: string;
  knowledgeVersion: string;
  decisionEngineVersion: string;
  generatedAt: string;
  latency: {
    merchantResolutionMs: number | null;
    engineMs: number;
    evidenceGenerationMs: number;
    totalMs: number;
  };
  replayAvailable: boolean;
};

export type CanonicalDecisionLatency = {
  engineMs: number;
  evidenceGenerationMs: number;
  totalMs: number;
};

export function createDeterministicDecisionId(
  normalizedRequest: PaymentDecisionRequest,
) {
  return stableId("pdec", {
    request: normalizedRequest,
    versions: decisionVersions(),
  });
}

export function createCanonicalDecisionResponse({
  decision,
  normalizedRequest,
  decisionId,
  trustRecord,
  latency,
}: {
  decision: PaymentDecision;
  normalizedRequest: PaymentDecisionRequest;
  decisionId: string;
  trustRecord?: DecisionTrustRecord;
  latency: CanonicalDecisionLatency;
}): CanonicalDecisionResponse {
  const confidenceScore = normalizeConfidence(
    trustRecord?.confidence.overall ?? decision.confidence.score,
  );
  const confidenceLabel = confidenceLabelFor(
    trustRecord?.confidence.level || decision.confidence.label,
    confidenceScore,
  );
  const evidence = evidenceFor(decision, trustRecord);
  const alternatives = alternativesFor(decision, trustRecord);
  const warnings = warningsFor(decision, trustRecord, normalizedRequest);
  const estimatedValue =
    numberOrNull(
      decision.decisionNarrative?.estimatedRewardValue ??
        decision.recommendedCard?.rewardEstimate?.estimatedValueUSD ??
        decision.winningReason?.estimatedValue,
    ) ?? null;
  const summary =
    decision.decisionNarrative?.summary ||
    decision.recommendationSummary ||
    "Rewardly evaluated the cards in this wallet.";
  const factors = explanationFactors(decision, trustRecord);

  return {
    decisionId,
    requestId: stableId("req", normalizedRequest),
    status: decision.recommendedCard ? "recommended" : "no_recommendation",
    recommendation: {
      paymentMethodId: decision.recommendedCard?.card.slug || null,
      displayName: decision.recommendedCard?.card.name || null,
      estimatedValue,
      currency: "USD",
      winningRule:
        decision.winningReason?.title ||
        decision.decisionNarrative?.primaryReason.headline ||
        null,
    },
    confidence: {
      score: confidenceScore,
      label: confidenceLabel,
    },
    confidenceFactors: confidenceFactorsFor(decision, trustRecord),
    alternatives,
    explanation: {
      summary,
      factors,
    },
    evidence,
    warnings,
    merchant: {
      name: decision.merchant?.name || normalizedRequest.merchant || "Unknown",
      category:
        decision.merchant?.category || normalizedRequest.category || null,
      confidence: numberOrNull(decision.merchant?.confidence),
    },
    walletSnapshot: {
      source: decision.wallet?.source || "unknown",
      cardSlugs:
        decision.wallet?.cardSlugs || normalizedRequest.manualCardSlugs || [],
      evaluatedCardCount:
        decision.wallet?.cardSlugs?.length ||
        normalizedRequest.manualCardSlugs?.length ||
        0,
    },
    purchaseContext: {
      amount: numberOrNull(normalizedRequest.amount),
      currency: "USD",
      checkoutStage: normalizedRequest.purchaseContext?.checkoutStage || null,
      context: normalizedRequest.context,
    },
    ...decisionVersions(),
    generatedAt: decision.generatedAt || new Date().toISOString(),
    latency: {
      merchantResolutionMs: numberOrNull(
        (decision.merchantIntelligence as any)?.latencyMs,
      ),
      engineMs: latency.engineMs,
      evidenceGenerationMs: latency.evidenceGenerationMs,
      totalMs: latency.totalMs,
    },
    replayAvailable:
      trustRecord?.reproducibility.replayable ??
      Boolean(decision.recommendedCard || decision.decisionExplanation),
  };
}

function decisionVersions() {
  return {
    ruleVersion: RULE_VERSION,
    merchantRegistryVersion: MERCHANT_REGISTRY_VERSION,
    benefitRegistryVersion: BENEFIT_REGISTRY_VERSION,
    knowledgeVersion: KNOWLEDGE_VERSION,
    decisionEngineVersion: DECISION_ENGINE_VERSION,
  };
}

function confidenceFactorsFor(
  decision: PaymentDecision,
  trustRecord?: DecisionTrustRecord,
): CanonicalConfidenceFactor[] {
  const components = trustRecord?.confidence.components || {};
  return [
    factor(
      "Merchant Resolution",
      components.merchantResolution,
      decision.merchant?.confidence,
      decision.merchant?.name
        ? `Merchant resolved as ${decision.merchant.name}.`
        : "Merchant could not be resolved with high certainty.",
    ),
    factor(
      "Wallet Completeness",
      components.walletCompleteness,
      decision.wallet?.cardSlugs?.length ? 1 : 0,
      `${decision.wallet?.cardSlugs?.length || 0} wallet cards were evaluated.`,
    ),
    factor(
      "Benefit Freshness",
      components.benefitEligibility,
      trustRecord ? 0.9 : decision.recommendedCard ? 0.75 : 0.35,
      decision.recommendedCard
        ? "Benefit evidence was available for the winning card."
        : "No winning benefit evidence was available.",
    ),
    factor(
      "Purchase Context",
      components.contextCompleteness,
      Number.isFinite(Number((decision as any).purchase?.total ?? undefined))
        ? 0.85
        : Number.isFinite(
              Number((decision as any).recommendationPurchaseContext?.total),
            )
          ? 0.8
          : Number.isFinite(Number(decision.rewardEstimate?.estimatedValueUSD))
            ? 0.7
            : 0.58,
      "Rewardly used the available purchase amount and checkout context.",
    ),
    factor(
      "Rule Certainty",
      components.ruleFreshness,
      decision.winningReason ? 0.9 : 0.45,
      decision.winningReason
        ? "The winning rule was present in structured decision evidence."
        : "No winning rule was available.",
    ),
    factor(
      "Data Freshness",
      components.ruleFreshness,
      trustRecord ? 0.9 : 0.78,
      "Decision versions were pinned for reproducibility.",
    ),
  ];
}

function factor(
  name: string,
  component: number | "unavailable" | undefined,
  fallback: number | undefined,
  explanation: string,
): CanonicalConfidenceFactor {
  const score =
    typeof component === "number"
      ? normalizeConfidence(component)
      : normalizeConfidence(fallback);
  return {
    name,
    score,
    level: score >= 0.8 ? "high" : score >= 0.58 ? "medium" : "low",
    explanation,
  };
}

function evidenceFor(
  decision: PaymentDecision,
  trustRecord?: DecisionTrustRecord,
): CanonicalDecisionEvidence[] {
  if (trustRecord?.evidence.length) {
    return trustRecord.evidence.map((item) => ({
      evidenceId: item.evidenceId,
      type: item.type,
      source: item.source,
      statement: item.statement,
      effect: item.effect,
      confidence: numberOrNull(item.confidence),
      version: item.version || null,
    }));
  }

  const evidence: CanonicalDecisionEvidence[] = [];
  if (decision.merchant?.name) {
    evidence.push(
      canonicalEvidence(
        "MERCHANT_MATCH",
        "merchant_intelligence",
        `Merchant resolved as ${decision.merchant.name}.`,
        decision.merchant.confidence,
      ),
    );
  }
  if (decision.wallet?.cardSlugs?.length) {
    evidence.push(
      canonicalEvidence(
        "WALLET_EVALUATED",
        "wallet_service",
        `${decision.wallet.cardSlugs.length} owned cards evaluated.`,
        1,
      ),
    );
  }
  if (decision.winningReason?.explanation) {
    evidence.push(
      canonicalEvidence(
        "WINNING_RULE",
        "decision_engine",
        decision.winningReason.explanation,
        decision.confidence.score,
      ),
    );
  }
  for (const benefit of decision.unlockedBenefits || []) {
    evidence.push(
      canonicalEvidence(
        "BENEFIT_ELIGIBILITY",
        "benefit_registry",
        benefit.summary,
        decision.confidence.score,
      ),
    );
  }
  return evidence;
}

function canonicalEvidence(
  type: string,
  source: string,
  statement: string,
  confidence?: number,
) {
  return {
    evidenceId: stableId("evd", { type, source, statement }),
    type,
    source,
    statement,
    effect: "supports",
    confidence: numberOrNull(confidence),
    version: null,
  };
}

function alternativesFor(
  decision: PaymentDecision,
  trustRecord?: DecisionTrustRecord,
): CanonicalDecisionAlternative[] {
  if (trustRecord?.alternatives.length) {
    return trustRecord.alternatives.map((item) => ({
      paymentMethodId: item.paymentMethodId,
      displayName: item.displayName,
      rank: item.rank,
      estimatedValue: numberOrNull(item.estimatedValue),
      confidence: numberOrNull(item.confidence),
      reasonNotSelected: item.reasonNotSelected.message,
      supportingEvidence: item.tradeoffs,
    }));
  }

  return (decision.alternativeCards || []).map((item, index) => ({
    paymentMethodId: item.card.slug,
    displayName: item.card.name,
    rank: index + 2,
    estimatedValue: numberOrNull(item.rewardEstimate?.estimatedValueUSD),
    confidence: numberOrNull(item.confidence?.score),
    reasonNotSelected:
      item.primaryReason?.detail ||
      "Ranked below the selected card by the canonical Decision Engine.",
    supportingEvidence: [item.primaryReason?.detail].filter(
      Boolean,
    ) as string[],
  }));
}

function warningsFor(
  decision: PaymentDecision,
  trustRecord: DecisionTrustRecord | undefined,
  normalizedRequest: PaymentDecisionRequest,
) {
  const warnings: CanonicalDecisionResponse["warnings"] =
    trustRecord?.warnings.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      userAction: warning.userAction,
    })) || [];

  if (!decision.recommendedCard) {
    warnings.push({
      code:
        decision.wallet?.cardSlugs?.length ||
        normalizedRequest.manualCardSlugs?.length
          ? "NO_ELIGIBLE_RECOMMENDATION"
          : "INCOMPLETE_WALLET",
      severity: "caution",
      message: decision.recommendationSummary,
    });
  }
  if (!normalizedRequest.merchant) {
    warnings.push({
      code: "UNKNOWN_MERCHANT",
      severity: "caution",
      message: "Merchant context was incomplete.",
    });
  }
  if (!Number.isFinite(Number(normalizedRequest.amount))) {
    warnings.push({
      code: "MISSING_PURCHASE_CONTEXT",
      severity: "caution",
      message: "Purchase amount was unavailable.",
    });
  }
  if (!trustRecord) {
    warnings.push({
      code: "TRUST_RECORD_UNAVAILABLE",
      severity: "info",
      message: "Decision was generated without a persisted trust record.",
    });
  }
  return dedupeByCode(warnings);
}

function explanationFactors(
  decision: PaymentDecision,
  trustRecord?: DecisionTrustRecord,
) {
  const trustFactors =
    trustRecord?.explanation.supportingReasons.map(
      (reason) => reason.message,
    ) || [];
  const narrativeFactors =
    decision.decisionNarrative?.supportingReasons.map(
      (reason) => reason.summary,
    ) || [];
  const fallbackFactors = [
    decision.winningReason?.explanation,
    decision.primaryReason?.detail,
    ...(decision.unlockedBenefits || []).map((benefit) => benefit.summary),
  ].filter(Boolean) as string[];

  return Array.from(
    new Set([...trustFactors, ...narrativeFactors, ...fallbackFactors]),
  )
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim())
    .slice(0, 8);
}

function confidenceLabelFor(
  label: string | undefined,
  score: number,
): CanonicalConfidenceLevel {
  if (label === "high" || label === "medium" || label === "low") return label;
  if (score >= 0.8) return "high";
  if (score >= 0.58) return "medium";
  return "low";
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function numberOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function dedupeByCode<T extends { code: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
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
