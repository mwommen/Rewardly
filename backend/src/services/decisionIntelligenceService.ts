import { createHash } from "crypto";
import type { Merchant, Wallet } from "../../../packages/rewardly-core/src";
import type { CanonicalWalletBenefitState } from "./walletIntelligenceService";

export const DECISION_EXPLANATION_VERSION = "2026-07-22.1";
export const DECISION_ENGINE_VERSION = "rewardly-decision-engine-v1";

export type DecisionEvidenceItem = {
  type: string;
  label: string;
  value?: unknown;
  source?: string | null;
  confidence?: number | null;
};

export type DecisionWarning = {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
  evidenceRef?: string | null;
};

export type MissingInformation = {
  code: string;
  label: string;
  impact: "low" | "medium" | "high";
};

export type DecisionAlternative = {
  cardId: string;
  cardName: string;
  estimatedValueUSD: number | null;
  confidence: number | null;
  whyItLost: string;
};

export type DecisionConfidenceBreakdown = {
  overall: number;
  label: "high" | "medium" | "low";
  components: {
    matchQuality: number;
    merchantResolution: number;
    benefitVerification: number;
    walletState: number;
    dataFreshness: number;
    sourceQuality: number;
  };
  weights: Record<keyof DecisionConfidenceBreakdown["components"], number>;
  reasons: string[];
};

export type DecisionExplanation = {
  decisionId: string;
  recommendationId: string;
  userId: string;
  merchantId: string | null;
  merchantConfidence: number | null;
  selectedCardId: string | null;
  selectedBenefitId: string | null;
  recommendationConfidence: DecisionConfidenceBreakdown;
  generatedAt: string;
  explanationVersion: string;
  evidence: {
    merchant: DecisionEvidenceItem[];
    benefit: DecisionEvidenceItem[];
    wallet: DecisionEvidenceItem[];
    scoring: DecisionEvidenceItem[];
    confidence: DecisionEvidenceItem[];
  };
  missingInformation: MissingInformation[];
  alternativeCards: DecisionAlternative[];
  warnings: DecisionWarning[];
  audit: {
    engineVersion: string;
    benefitVersion: string | null;
    merchantVersion: string | null;
    walletVersion: string | null;
    scoringVersion: string;
    explanationVersion: string;
  };
  replayHash: string;
};

export type RecommendationForExplanation = {
  slug?: string;
  name?: string;
  effectiveRate?: number;
  estValueUSD?: number;
  matchTier?: string;
  matchedBenefit?: string | null;
  matchedBenefitId?: string | null;
  lastVerified?: string | null;
  sourceUrl?: string | null;
  intelligenceConfidence?: {
    score: number;
    label: "high" | "medium" | "low";
    factors?: Record<string, number>;
    reasons?: string[];
  };
  walletEvidence?: unknown[];
  explanationEvidence?: {
    merchant?: DecisionEvidenceItem[];
    benefit?: DecisionEvidenceItem[];
    wallet?: DecisionEvidenceItem[];
    scoring?: DecisionEvidenceItem[];
    missingInformation?: MissingInformation[];
    warnings?: DecisionWarning[];
  };
};

export type DecisionExplanationInput = {
  userId: string;
  merchant: Merchant & {
    merchantId?: string | null;
    matchingStrategy?: string | null;
    aliasUsed?: string | null;
  };
  wallet: Pick<Wallet, "source" | "cardSlugs"> & {
    benefitStates?: CanonicalWalletBenefitState[];
  };
  recommendations: RecommendationForExplanation[];
  generatedAt?: string;
};

export type DecisionReplaySnapshot = {
  explanationVersion: string;
  engineVersion: string;
  userId: string;
  generatedAt: string;
  merchant: DecisionExplanationInput["merchant"];
  wallet: DecisionExplanationInput["wallet"];
  recommendations: RecommendationForExplanation[];
  expectedDecisionId: string;
  expectedSelectedCardId: string | null;
  replayHash: string;
};

export type DecisionReplayResult = {
  matched: boolean;
  selectedCardId: string | null;
  expectedSelectedCardId: string | null;
  replayHash: string;
  expectedReplayHash: string;
};

export type DecisionAuditRecord = {
  auditRecordId: string;
  explanation: DecisionExplanation;
  createdAt: string;
  immutable: true;
};

const CONFIDENCE_WEIGHTS: DecisionConfidenceBreakdown["weights"] = {
  matchQuality: 0.28,
  merchantResolution: 0.2,
  benefitVerification: 0.18,
  walletState: 0.16,
  dataFreshness: 0.1,
  sourceQuality: 0.08,
};

const auditRecords = new Map<string, DecisionAuditRecord>();

export function explainRecommendationDecision(
  input: DecisionExplanationInput,
): DecisionExplanation {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const selected = input.recommendations[0] || null;
  const confidence = buildDecisionConfidence({
    recommendation: selected,
    merchantConfidence: input.merchant.confidence,
    walletStates: input.wallet.benefitStates || [],
  });
  const missingInformation = missingInformationFor(input, selected);
  const warnings = warningsFor(input, selected, confidence);
  const decisionId = stableId("decision", {
    userId: input.userId,
    merchant: input.merchant,
    selectedCardId: selected?.slug || null,
    selectedBenefitId: selected?.matchedBenefitId || null,
    generatedAt,
  });
  const recommendationId = stableId("recommendation", {
    decisionId,
    selectedCardId: selected?.slug || null,
    selectedBenefitId: selected?.matchedBenefitId || null,
  });
  const explanation: Omit<DecisionExplanation, "replayHash"> = {
    decisionId,
    recommendationId,
    userId: input.userId,
    merchantId: input.merchant.merchantId || normalizedMerchantId(input.merchant.name),
    merchantConfidence: input.merchant.confidence ?? null,
    selectedCardId: selected?.slug || null,
    selectedBenefitId: selected?.matchedBenefitId || null,
    recommendationConfidence: confidence,
    generatedAt,
    explanationVersion: DECISION_EXPLANATION_VERSION,
    evidence: {
      merchant: [
        evidence("resolved_merchant", "Resolved merchant", input.merchant.name, "merchant_resolver", input.merchant.confidence),
        evidence("merchant_category", "Merchant category", input.merchant.category || null, "merchant_resolver", input.merchant.confidence),
        ...((selected?.explanationEvidence?.merchant as DecisionEvidenceItem[]) || []),
      ],
      benefit: [
        evidence("selected_benefit", "Selected benefit", selected?.matchedBenefit || null, selected?.sourceUrl || null, null),
        evidence("benefit_verified_at", "Benefit verified at", selected?.lastVerified || null, selected?.sourceUrl || null, null),
        ...((selected?.explanationEvidence?.benefit as DecisionEvidenceItem[]) || []),
      ],
      wallet: [
        evidence("wallet_source", "Wallet source", input.wallet.source, "wallet_service", null),
        evidence("wallet_cards", "Cards considered", input.wallet.cardSlugs, "wallet_service", null),
        ...walletStateEvidence(input.wallet.benefitStates || [], selected?.matchedBenefitId || null),
        ...((selected?.explanationEvidence?.wallet as DecisionEvidenceItem[]) || []),
        ...normalizeRawEvidence(selected?.walletEvidence || []),
      ],
      scoring: [
        evidence("estimated_value_usd", "Estimated value", selected?.estValueUSD ?? null, "recommendation_service", confidence.overall),
        evidence("effective_rate", "Effective rate", selected?.effectiveRate ?? null, "recommendation_service", confidence.overall),
        evidence("match_tier", "Match tier", selected?.matchTier || null, "recommendation_service", confidence.overall),
        ...((selected?.explanationEvidence?.scoring as DecisionEvidenceItem[]) || []),
      ],
      confidence: Object.entries(confidence.components).map(([key, value]) =>
        evidence(key, key, value, "decision_confidence_engine", value),
      ),
    },
    missingInformation,
    alternativeCards: alternativeCardsFor(input.recommendations),
    warnings,
    audit: {
      engineVersion: DECISION_ENGINE_VERSION,
      benefitVersion: selected?.matchedBenefitId ? "canonical-benefit-id" : null,
      merchantVersion: input.merchant.merchantId ? "merchant-registry-v1" : null,
      walletVersion: walletVersion(input.wallet.benefitStates || []),
      scoringVersion: "recommendation-scoring-v1",
      explanationVersion: DECISION_EXPLANATION_VERSION,
    },
  };
  return {
    ...explanation,
    replayHash: replayHashFor(explanation),
  };
}

export function buildDecisionConfidence(input: {
  recommendation: RecommendationForExplanation | null;
  merchantConfidence?: number | null;
  walletStates?: CanonicalWalletBenefitState[];
}): DecisionConfidenceBreakdown {
  const recommendation = input.recommendation;
  const baseFactors = recommendation?.intelligenceConfidence?.factors || {};
  const matchQuality = component(baseFactors.matchQuality, recommendation?.matchTier === "exact_benefit" ? 0.92 : recommendation?.matchTier === "category_match" ? 0.74 : 0.55);
  const merchantResolution = component(input.merchantConfidence, baseFactors.merchant ?? 0.55);
  const benefitVerification = component(baseFactors.benefitFreshness, recommendation?.lastVerified ? 0.82 : 0.45);
  const walletState = walletStateConfidence(input.walletStates || [], recommendation?.matchedBenefitId || null);
  const dataFreshness = recommendation?.lastVerified ? 0.82 : 0.45;
  const sourceQuality = recommendation?.sourceUrl ? 0.86 : 0.58;
  const components = {
    matchQuality,
    merchantResolution,
    benefitVerification,
    walletState,
    dataFreshness,
    sourceQuality,
  };
  const overall = clamp(
    Object.entries(CONFIDENCE_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + components[key as keyof typeof components] * weight,
      0,
    ),
  );
  return {
    overall,
    label: overall >= 0.8 ? "high" : overall >= 0.58 ? "medium" : "low",
    components,
    weights: CONFIDENCE_WEIGHTS,
    reasons: confidenceReasons(components),
  };
}

export function createDecisionReplaySnapshot(
  explanation: DecisionExplanation,
  input: DecisionExplanationInput,
): DecisionReplaySnapshot {
  return {
    explanationVersion: explanation.explanationVersion,
    engineVersion: explanation.audit.engineVersion,
    userId: input.userId,
    generatedAt: input.generatedAt || explanation.generatedAt,
    merchant: input.merchant,
    wallet: input.wallet,
    recommendations: input.recommendations,
    expectedDecisionId: explanation.decisionId,
    expectedSelectedCardId: explanation.selectedCardId,
    replayHash: explanation.replayHash,
  };
}

export function replayDecisionSnapshot(snapshot: DecisionReplaySnapshot): DecisionReplayResult {
  logDecisionEvent("replay_executed", {
    expectedDecisionId: snapshot.expectedDecisionId,
  });
  const replay = explainRecommendationDecision({
    userId: snapshot.userId,
    merchant: snapshot.merchant,
    wallet: snapshot.wallet,
    recommendations: snapshot.recommendations,
    generatedAt: snapshot.generatedAt,
  });
  return {
    matched:
      replay.selectedCardId === snapshot.expectedSelectedCardId &&
      replay.replayHash === snapshot.replayHash,
    selectedCardId: replay.selectedCardId,
    expectedSelectedCardId: snapshot.expectedSelectedCardId,
    replayHash: replay.replayHash,
    expectedReplayHash: snapshot.replayHash,
  };
}

export function persistDecisionAuditRecord(
  explanation: DecisionExplanation,
): DecisionAuditRecord {
  const auditRecordId = stableId("decision-audit", {
    decisionId: explanation.decisionId,
    replayHash: explanation.replayHash,
  });
  if (auditRecords.has(auditRecordId)) {
    return auditRecords.get(auditRecordId)!;
  }
  const record = Object.freeze({
    auditRecordId,
    explanation: deepFreeze(JSON.parse(JSON.stringify(explanation))),
    createdAt: new Date().toISOString(),
    immutable: true as const,
  });
  auditRecords.set(auditRecordId, record);
  logDecisionEvent("recommendation_completed", {
    decisionId: explanation.decisionId,
    selectedCardId: explanation.selectedCardId,
    confidence: explanation.recommendationConfidence.overall,
  });
  return record;
}

export function listDecisionAuditRecords() {
  return Array.from(auditRecords.values());
}

export function compareDecisionExplanations(
  left: DecisionExplanation,
  right: DecisionExplanation,
) {
  return {
    sameSelectedCard: left.selectedCardId === right.selectedCardId,
    sameSelectedBenefit: left.selectedBenefitId === right.selectedBenefitId,
    confidenceDelta: round(right.recommendationConfidence.overall - left.recommendationConfidence.overall),
    replayHashChanged: left.replayHash !== right.replayHash,
  };
}

export function logDecisionEvent(eventName: string, payload: Record<string, unknown>) {
  if (process.env.REWARDLY_DECISION_LOGS !== "1") return;
  console.info(
    JSON.stringify({
      prefix: "[RewardlyDecision]",
      eventName,
      occurredAt: new Date().toISOString(),
      ...payload,
    }),
  );
}

function missingInformationFor(
  input: DecisionExplanationInput,
  selected: RecommendationForExplanation | null,
): MissingInformation[] {
  const missing: MissingInformation[] = [];
  if (!selected) missing.push(missingInfo("NO_RECOMMENDATION", "No card recommendation was produced.", "high"));
  if (!input.merchant.confidence || input.merchant.confidence < 0.7) {
    missing.push(missingInfo("LOW_MERCHANT_CONFIDENCE", "Merchant resolution is below the target confidence.", "medium"));
  }
  if (selected?.matchedBenefitId && !walletStateEvidence(input.wallet.benefitStates || [], selected.matchedBenefitId).length) {
    missing.push(missingInfo("WALLET_STATE_UNAVAILABLE", "Wallet state for the selected benefit is unavailable.", "high"));
  }
  if (selected?.matchedBenefit && !selected.lastVerified) {
    missing.push(missingInfo("BENEFIT_VERIFICATION_DATE_UNKNOWN", "Benefit verification date is unknown.", "medium"));
  }
  return [...missing, ...((selected?.explanationEvidence?.missingInformation as MissingInformation[]) || [])];
}

function warningsFor(
  input: DecisionExplanationInput,
  selected: RecommendationForExplanation | null,
  confidence: DecisionConfidenceBreakdown,
): DecisionWarning[] {
  const warnings: DecisionWarning[] = [];
  if (confidence.label === "low") {
    warnings.push({
      code: "LOW_RECOMMENDATION_CONFIDENCE",
      severity: "medium",
      message: "Recommendation confidence is low.",
    });
  }
  if ((input.wallet.benefitStates || []).some((state) => state.confidenceSource === "unknown")) {
    warnings.push({
      code: "UNKNOWN_WALLET_CONFIDENCE",
      severity: "medium",
      message: "One or more wallet states have unknown confidence.",
    });
  }
  return [...warnings, ...((selected?.explanationEvidence?.warnings as DecisionWarning[]) || [])];
}

function alternativeCardsFor(recommendations: RecommendationForExplanation[]) {
  const [winner, ...alternatives] = recommendations;
  return alternatives.slice(0, 3).map((item) => ({
    cardId: item.slug || "unknown-card",
    cardName: item.name || item.slug || "Unknown card",
    estimatedValueUSD: typeof item.estValueUSD === "number" ? item.estValueUSD : null,
    confidence: item.intelligenceConfidence?.score ?? null,
    whyItLost: whyAlternativeLost(winner, item),
  }));
}

function whyAlternativeLost(
  winner: RecommendationForExplanation | undefined,
  alternative: RecommendationForExplanation,
) {
  if (!winner) return "No winning card was available for comparison.";
  if ((alternative.estValueUSD ?? 0) < (winner.estValueUSD ?? 0)) {
    return "Lower estimated value than the selected card.";
  }
  if ((alternative.effectiveRate ?? 0) < (winner.effectiveRate ?? 0)) {
    return "Lower rewards rate than the selected card.";
  }
  if ((alternative.intelligenceConfidence?.score ?? 0) < (winner.intelligenceConfidence?.score ?? 0)) {
    return "Lower recommendation confidence than the selected card.";
  }
  return "Ranked below the selected card after tie-breakers.";
}

function walletStateEvidence(
  states: CanonicalWalletBenefitState[],
  benefitId: string | null,
) {
  if (!benefitId) return [];
  return states
    .filter((state) => state.benefitId === benefitId || `${state.cardSlug}:${state.benefitId}` === benefitId)
    .map((state) =>
      evidence("wallet_benefit_state", "Wallet benefit state", {
        status: state.status,
        enrollmentStatus: state.enrollmentStatus,
        activationStatus: state.activationStatus,
        remainingValue: state.remainingValue,
        remainingSpendCap: state.remainingSpendCap,
        remainingUses: state.remainingUses,
        confidenceSource: state.confidenceSource,
      }, "wallet_intelligence", state.confidence),
    );
}

function walletStateConfidence(
  states: CanonicalWalletBenefitState[],
  benefitId: string | null,
) {
  const matching = benefitId
    ? states.filter((state) => state.benefitId === benefitId || `${state.cardSlug}:${state.benefitId}` === benefitId)
    : states;
  if (!matching.length) return benefitId ? 0.35 : 0.55;
  return clamp(
    matching.reduce((sum, state) => sum + state.confidence, 0) / matching.length,
  );
}

function confidenceReasons(components: DecisionConfidenceBreakdown["components"]) {
  const reasons: string[] = [];
  if (components.matchQuality < 0.65) reasons.push("weak_match_quality");
  if (components.merchantResolution < 0.7) reasons.push("merchant_resolution_uncertain");
  if (components.benefitVerification < 0.7) reasons.push("benefit_verification_weak");
  if (components.walletState < 0.65) reasons.push("wallet_state_incomplete");
  if (components.dataFreshness < 0.7) reasons.push("stale_or_missing_data");
  if (components.sourceQuality < 0.7) reasons.push("source_quality_limited");
  if (!reasons.length) reasons.push("strong_structured_evidence");
  return reasons;
}

function evidence(
  type: string,
  label: string,
  value: unknown,
  source?: string | null,
  confidence?: number | null,
): DecisionEvidenceItem {
  return { type, label, value, source, confidence };
}

function normalizeRawEvidence(items: unknown[]): DecisionEvidenceItem[] {
  return items.map((item, index) => {
    if (
      item &&
      typeof item === "object" &&
      "type" in item &&
      "label" in item
    ) {
      return item as DecisionEvidenceItem;
    }
    return {
      type: "raw_wallet_scoring_evidence",
      label: `Wallet scoring evidence ${index + 1}`,
      value: item,
      source: "recommendation_service",
      confidence: null,
    };
  });
}

function missingInfo(
  code: string,
  label: string,
  impact: MissingInformation["impact"],
): MissingInformation {
  return { code, label, impact };
}

function walletVersion(states: CanonicalWalletBenefitState[]) {
  if (!states.length) return null;
  return stableId("wallet-version", states.map((state) => ({
    id: state.walletBenefitStateId,
    benefitId: state.benefitId,
    version: state.version,
    updatedAt: state.updatedAt,
  })));
}

function replayHashFor(explanation: Omit<DecisionExplanation, "replayHash">) {
  return stableId("decision-replay", {
    userId: explanation.userId,
    merchantId: explanation.merchantId,
    selectedCardId: explanation.selectedCardId,
    selectedBenefitId: explanation.selectedBenefitId,
    confidence: explanation.recommendationConfidence,
    evidence: explanation.evidence,
    missingInformation: explanation.missingInformation,
    alternativeCards: explanation.alternativeCards,
  });
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}_${createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function normalizedMerchantId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || null;
}

function component(value: unknown, fallback: number) {
  return clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback);
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
