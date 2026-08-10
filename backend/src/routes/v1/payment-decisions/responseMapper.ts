import crypto from "crypto";
import type { PaymentDecision } from "../../../../../packages/rewardly-core/src";
import type { PaymentDecisionRequest } from "../../../services/paymentDecisionService";
import {
  createCanonicalDecisionResponse,
  type CanonicalDecisionLatency,
} from "../../../services/canonicalDecisionResponseService";
import {
  trustReferenceFor,
  type DecisionTrustRecord,
} from "../../../services/trustInfrastructureService";
import type { DecisionObject } from "../../../services/decisionRuntimeService";
import type { ValidationResult as DecisionValidationResult } from "../../../services/decisionValidationService";

export function toV1PaymentDecisionResponse(
  decision: PaymentDecision,
  fallbackDecisionId = createPublicDecisionId(),
  trustRecord?: DecisionTrustRecord,
  canonicalOptions?: {
    normalizedRequest: PaymentDecisionRequest;
    latency: CanonicalDecisionLatency;
    runtimeDecision?: DecisionObject;
    validationResult?: DecisionValidationResult;
  },
) {
  const recommendation = decision.recommendedCard;
  const narrative = decision.decisionNarrative;
  const estimatedValue =
    narrative?.estimatedRewardValue ??
    recommendation?.rewardEstimate?.estimatedValueUSD ??
    decision.winningReason?.estimatedValue ??
    null;
  const confidence =
    decision.confidence.score ??
    recommendation?.confidence?.score ??
    confidenceScoreFromLabel(decision.confidence.label);
  const decisionId =
    publicDecisionIdFromDecision(decision) || fallbackDecisionId;
  const reason =
    firstNonEmptyString([
      narrative?.primaryReason?.summary,
      decision.primaryReason?.detail,
      decision.recommendationSummary,
      recommendation
        ? "Rewardly recommends this payment method for this purchase."
        : "Add cards to your wallet to get personalized recommendations.",
    ]) || "Rewardly evaluated the cards in this wallet.";
  const summary =
    firstNonEmptyString([
      narrative?.summary,
      decision.recommendationSummary,
      "Rewardly evaluated the cards in this wallet.",
    ]) || "Rewardly evaluated the cards in this wallet.";

  const legacyResponse = {
    decisionId,
    status: recommendation ? "recommended" : "no_recommendation",
    recommendedPaymentMethod: recommendation
      ? {
          cardId: recommendation.card.slug,
          displayName: recommendation.card.name,
        }
      : null,
    reason,
    estimatedValue: Number.isFinite(Number(estimatedValue))
      ? Number(estimatedValue)
      : null,
    currency: "USD",
    confidence: clampConfidence(confidence),
    explanation: {
      summary,
      factors: explanationFactors(decision),
    },
    trust: trustRecord ? trustReferenceFor(trustRecord) : undefined,
  };

  if (!canonicalOptions) return legacyResponse;

  const canonical =
    canonicalOptions.runtimeDecision ||
    createCanonicalDecisionResponse({
      decision,
      normalizedRequest: canonicalOptions.normalizedRequest,
      decisionId,
      trustRecord,
      latency: canonicalOptions.latency,
    });

  return {
    ...legacyResponse,
    ...canonical,
    status: legacyResponse.status,
    ...(canonicalOptions.runtimeDecision
      ? {
          id: canonicalOptions.runtimeDecision.id,
          lifecycleStatus: canonicalOptions.runtimeDecision.status,
          runtimeVersion: canonicalOptions.runtimeDecision.runtimeVersion,
          apiVersion: canonicalOptions.runtimeDecision.apiVersion,
          decisionPolicy: canonicalOptions.runtimeDecision.decisionPolicy,
          replayStatus: canonicalOptions.runtimeDecision.replayStatus,
          eventCount: canonicalOptions.runtimeDecision.eventCount,
          validationStatus: canonicalOptions.runtimeDecision.validationStatus,
          validationId: canonicalOptions.runtimeDecision.validationId,
          trustScore: canonicalOptions.runtimeDecision.trustScore,
          trustScoreLevel: canonicalOptions.runtimeDecision.trustScoreLevel,
          validatedAt: canonicalOptions.runtimeDecision.validatedAt,
          createdAt: canonicalOptions.runtimeDecision.createdAt,
          updatedAt: canonicalOptions.runtimeDecision.updatedAt,
        }
      : {}),
    ...(canonicalOptions.validationResult
      ? { validation: canonicalOptions.validationResult }
      : {}),
    confidence: legacyResponse.confidence,
    confidenceLabel: canonical.confidence.label,
    decisionConfidence: canonical.confidence,
  };
}

function confidenceScoreFromLabel(
  label: PaymentDecision["confidence"]["label"],
) {
  if (label === "high") return 0.9;
  if (label === "medium") return 0.7;
  if (label === "low") return 0.45;
  return 0;
}


function explanationFactors(decision: PaymentDecision) {
  const narrativeFactors =
    decision.decisionNarrative?.supportingReasons?.map(
      (reason) => reason.summary,
    ) || [];
  const fallbackFactors = [
    decision.winningReason?.explanation,
    decision.primaryReason?.detail,
    ...(decision.unlockedBenefits || []).map((benefit) => benefit.summary),
  ].filter(Boolean) as string[];
  return Array.from(new Set([...narrativeFactors, ...fallbackFactors]))
    .filter((factor) => typeof factor === "string" && factor.trim())
    .map((factor) => factor.trim())
    .slice(0, 4);
}


export function createPublicDecisionId() {
  return `pdec_${crypto.randomUUID()}`;
}


function publicDecisionIdFromDecision(decision: PaymentDecision) {
  const candidates = [
    (decision.decisionExplanation as any)?.decisionId,
    (decision as any).auditLog?.decisionId,
  ];
  return candidates.find(
    (candidate) =>
      typeof candidate === "string" && /^pdec_[\w-]+$/.test(candidate),
  );
}


function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}


function firstNonEmptyString(values: Array<unknown>) {
  return values
    .find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    ?.trim();
}

