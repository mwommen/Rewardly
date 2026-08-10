import crypto from "crypto";
import type { PaymentDecision } from "../../../packages/rewardly-core/src";
import { getDecisionRuntimeCollection } from "../db";
import {
  decidePayment,
  type PaymentDecisionRequest,
} from "./paymentDecisionService";
import {
  createCanonicalDecisionResponse,
  createDeterministicDecisionId,
  KNOWLEDGE_VERSION,
  BENEFIT_REGISTRY_VERSION,
  MERCHANT_REGISTRY_VERSION,
  RULE_VERSION,
  type CanonicalDecisionLatency,
  type CanonicalDecisionResponse,
} from "./canonicalDecisionResponseService";
import {
  API_VERSION,
  createOrResolveTrustRecord,
  replayDecision,
  type DecisionReplayResult,
  type DecisionTrustRecord,
  type TrustAccessScope,
} from "./trustInfrastructureService";
import { DECISION_ENGINE_VERSION } from "./decisionIntelligenceService";

export const DECISION_RUNTIME_VERSION = "decision-runtime-0.1.0";

export const DECISION_LIFECYCLE_STATES = {
  RECEIVED: "received",
  EVALUATING: "evaluating",
  RECOMMENDED: "recommended",
  PERSISTED: "persisted",
  REPLAYABLE: "replayable",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
  VALIDATED: "validated",
  SUPERSEDED: "superseded",
  ARCHIVED: "archived",
} as const;

export type DecisionLifecycleState =
  (typeof DECISION_LIFECYCLE_STATES)[keyof typeof DECISION_LIFECYCLE_STATES];

export type RuntimeEventType =
  | "DecisionReceived"
  | "MerchantResolved"
  | "WalletLoaded"
  | "BenefitsEvaluated"
  | "ConfidenceCalculated"
  | "RecommendationGenerated"
  | "DecisionPersisted"
  | "DecisionReplayable"
  | "ReplayRequested";

export type DecisionRuntimeEvent = {
  eventId: string;
  decisionId: string;
  type: RuntimeEventType;
  component: string;
  timestamp: string;
  durationMs: number | null;
  metadata: Record<string, unknown>;
};

export type DecisionObject = Omit<CanonicalDecisionResponse, "status"> & {
  id: string;
  requestId: string;
  status: DecisionLifecycleState;
  recommendationStatus: CanonicalDecisionResponse["status"];
  userId: string | null;
  partnerId: string | null;
  decisionPolicy: string;
  runtimeVersion: string;
  apiVersion: string;
  createdAt: string;
  updatedAt: string;
  eventCount: number;
  replayStatus: "replayable" | "not_replayable";
  validationStatus: "pending" | "validated" | "needs_review" | "superseded" | "archived";
  validationId: string | null;
  trustScore: number | null;
  trustScoreLevel: "excellent" | "strong" | "moderate" | "weak" | null;
  validatedAt: string | null;
  history: DecisionRuntimeEvent[];
};

export type CreateDecisionRuntimeInput = {
  normalizedRequest: PaymentDecisionRequest;
  ownerUserId?: string | null;
  partnerId?: string | null;
};

type StoredDecisionRuntime = {
  decisionId: string;
  ownerUserId: string | null;
  partnerId: string | null;
  decision: DecisionObject;
  events: DecisionRuntimeEvent[];
  originalRequest: PaymentDecisionRequest;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
};

const allowedTransitions: Record<DecisionLifecycleState, DecisionLifecycleState[]> =
  {
    received: ["evaluating", "archived"],
    evaluating: ["recommended", "archived"],
    recommended: ["persisted", "validated", "superseded", "archived"],
    persisted: ["replayable", "validated", "superseded", "archived"],
    replayable: ["accepted", "rejected", "expired", "validated", "archived"],
    accepted: ["validated", "archived"],
    rejected: ["archived"],
    expired: ["archived"],
    validated: ["archived"],
    superseded: ["archived"],
    archived: [],
  };

const memoryDecisions = new Map<string, StoredDecisionRuntime>();

export function resetDecisionRuntimeForTests() {
  memoryDecisions.clear();
}

export async function createDecisionRuntime(
  input: CreateDecisionRuntimeInput,
) {
  const startedAt = Date.now();
  const normalizedRequest = { ...input.normalizedRequest };
  const decisionId = createDeterministicDecisionId(normalizedRequest);
  normalizedRequest.userId = decisionId;
  const createdAt = new Date().toISOString();
  const events: DecisionRuntimeEvent[] = [];
  let status: DecisionLifecycleState = DECISION_LIFECYCLE_STATES.RECEIVED;

  recordEvent(events, {
    decisionId,
    type: "DecisionReceived",
    component: "decision_runtime",
    durationMs: 0,
    metadata: {
      merchant: normalizedRequest.merchant,
      amount: normalizedRequest.amount ?? null,
      walletCardCount: normalizedRequest.manualCardSlugs?.length || 0,
    },
  });

  status = transition(status, DECISION_LIFECYCLE_STATES.EVALUATING);
  const engineStartedAt = Date.now();
  const decision = await decidePayment(normalizedRequest);
  const engineCompletedAt = Date.now();

  attachEngineEvents(events, decisionId, decision, normalizedRequest, {
    engineMs: engineCompletedAt - engineStartedAt,
  });
  status = transition(status, DECISION_LIFECYCLE_STATES.RECOMMENDED);

  const evidenceStartedAt = Date.now();
  const trustRecord = await createOrResolveTrustRecord({
    decisionId,
    decision,
    normalizedRequest,
    ownerUserId: input.ownerUserId || null,
    tenantId: null,
  });
  const evidenceCompletedAt = Date.now();
  const latency: CanonicalDecisionLatency = {
    engineMs: engineCompletedAt - engineStartedAt,
    evidenceGenerationMs: evidenceCompletedAt - evidenceStartedAt,
    totalMs: evidenceCompletedAt - startedAt,
  };
  const canonical = createCanonicalDecisionResponse({
    decision,
    normalizedRequest,
    decisionId,
    trustRecord,
    latency,
  });

  status = transition(status, DECISION_LIFECYCLE_STATES.PERSISTED);
  recordEvent(events, {
    decisionId,
    type: "DecisionPersisted",
    component: "decision_runtime",
    durationMs: Date.now() - evidenceStartedAt,
    metadata: {
      trustRecordId: trustRecord.trustRecordId,
      evidenceCount: canonical.evidence.length,
    },
  });
  status = transition(status, DECISION_LIFECYCLE_STATES.REPLAYABLE);
  recordEvent(events, {
    decisionId,
    type: "DecisionReplayable",
    component: "decision_runtime",
    durationMs: null,
    metadata: {
      inputSnapshotId: trustRecord.reproducibility.inputSnapshotId || null,
      replayability: trustRecord.reproducibility.replayability,
    },
  });

  const runtimeDecision = toDecisionObject({
    canonical,
    normalizedRequest,
    status,
    ownerUserId: input.ownerUserId || null,
    partnerId: input.partnerId || null,
    trustRecord,
    events,
    createdAt,
  });
  await persistDecisionRuntime(runtimeDecision, events, normalizedRequest);

  return {
    decision: runtimeDecision,
    engineDecision: decision,
    trustRecord,
  };
}

export async function getDecisionRuntime(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  const stored = await getStoredDecisionRuntime(decisionId, accessScope);
  return stored?.decision || null;
}

export async function getDecisionRuntimeEvents(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  const stored = await getStoredDecisionRuntime(decisionId, accessScope);
  return stored?.events || null;
}

export async function replayDecisionRuntime(
  decisionId: string,
  accessScope?: TrustAccessScope,
): Promise<{
  decisionId: string;
  replay: DecisionReplayResult;
  runtimeEvent: DecisionRuntimeEvent;
}> {
  const stored = await getStoredDecisionRuntime(decisionId, accessScope);
  if (!stored) {
    throw new DecisionRuntimeNotFoundError(decisionId);
  }
  const startedAt = Date.now();
  const replay = await replayDecision(decisionId, accessScope);
  const updatedEvents = [...stored.events];
  const event = recordEvent(updatedEvents, {
    decisionId,
    type: "ReplayRequested",
    component: "decision_runtime",
    durationMs: Date.now() - startedAt,
    metadata: {
      replayId: replay.replayId,
      replayStatus: replay.status,
      replayability: replay.replayability,
    },
  });
  stored.decision = {
    ...stored.decision,
    eventCount: updatedEvents.length,
    history: [...updatedEvents],
    updatedAt: event.timestamp,
  };
  stored.events = updatedEvents;
  stored.updatedAt = new Date(event.timestamp);
  await persistDecisionRuntime(
    stored.decision,
    updatedEvents,
    stored.originalRequest,
  );
  return { decisionId, replay, runtimeEvent: event };
}

export async function attachValidationToDecisionRuntime(
  decisionId: string,
  validation: {
    validationId: string;
    status: DecisionObject["validationStatus"];
    trustScore: number;
    trustScoreLevel: NonNullable<DecisionObject["trustScoreLevel"]>;
    validatedAt: string;
  },
  accessScope?: TrustAccessScope,
) {
  const stored = await getStoredDecisionRuntime(decisionId, accessScope);
  if (!stored) {
    throw new DecisionRuntimeNotFoundError(decisionId);
  }
  stored.decision = {
    ...stored.decision,
    validationStatus: validation.status,
    validationId: validation.validationId,
    trustScore: validation.trustScore,
    trustScoreLevel: validation.trustScoreLevel,
    validatedAt: validation.validatedAt,
    updatedAt: validation.validatedAt,
  };
  stored.updatedAt = new Date(validation.validatedAt);
  await persistDecisionRuntime(
    stored.decision,
    stored.events,
    stored.originalRequest,
  );
  return stored.decision;
}

export class DecisionRuntimeNotFoundError extends Error {
  constructor(public decisionId: string) {
    super(`Decision runtime object was not found for ${decisionId}.`);
  }
}

function attachEngineEvents(
  events: DecisionRuntimeEvent[],
  decisionId: string,
  decision: PaymentDecision,
  normalizedRequest: PaymentDecisionRequest,
  durations: { engineMs: number },
) {
  recordEvent(events, {
    decisionId,
    type: "MerchantResolved",
    component: "merchant_intelligence",
    durationMs: null,
    metadata: {
      merchant: decision.merchant?.name || normalizedRequest.merchant,
      category: decision.merchant?.category || normalizedRequest.category || null,
      confidence: decision.merchant?.confidence ?? null,
    },
  });
  recordEvent(events, {
    decisionId,
    type: "WalletLoaded",
    component: "wallet_service",
    durationMs: null,
    metadata: {
      source: decision.wallet?.source || "request_wallet",
      cardSlugs:
        decision.wallet?.cardSlugs || normalizedRequest.manualCardSlugs || [],
    },
  });
  recordEvent(events, {
    decisionId,
    type: "BenefitsEvaluated",
    component: "decision_engine",
    durationMs: null,
    metadata: {
      alternatives: decision.alternativeCards?.length || 0,
      unlockedBenefits: decision.unlockedBenefits?.length || 0,
      winningRule: decision.winningReason?.type || null,
    },
  });
  recordEvent(events, {
    decisionId,
    type: "ConfidenceCalculated",
    component: "decision_engine",
    durationMs: null,
    metadata: {
      score: decision.confidence?.score ?? null,
      label: decision.confidence?.label ?? null,
    },
  });
  recordEvent(events, {
    decisionId,
    type: "RecommendationGenerated",
    component: "decision_engine",
    durationMs: durations.engineMs,
    metadata: {
      recommendedPaymentMethod:
        decision.recommendedCard?.card.slug || null,
      status: decision.recommendedCard ? "recommended" : "no_recommendation",
    },
  });
}

function toDecisionObject({
  canonical,
  normalizedRequest,
  status,
  ownerUserId,
  partnerId,
  trustRecord,
  events,
  createdAt,
}: {
  canonical: CanonicalDecisionResponse;
  normalizedRequest: PaymentDecisionRequest;
  status: DecisionLifecycleState;
  ownerUserId: string | null;
  partnerId: string | null;
  trustRecord: DecisionTrustRecord;
  events: DecisionRuntimeEvent[];
  createdAt: string;
}): DecisionObject {
  return {
    ...canonical,
    id: canonical.decisionId,
    requestId: canonical.requestId,
    status,
    recommendationStatus: canonical.status,
    userId: ownerUserId,
    partnerId,
    decisionPolicy: trustRecord.provenance.decisionPolicy,
    runtimeVersion: DECISION_RUNTIME_VERSION,
    apiVersion: API_VERSION,
    createdAt,
    updatedAt: createdAt,
    eventCount: events.length,
    replayStatus: canonical.replayAvailable ? "replayable" : "not_replayable",
    validationStatus: "pending",
    validationId: null,
    trustScore: null,
    trustScoreLevel: null,
    validatedAt: null,
    history: [...events],
    decisionEngineVersion: DECISION_ENGINE_VERSION,
    knowledgeVersion: KNOWLEDGE_VERSION,
    merchantRegistryVersion: MERCHANT_REGISTRY_VERSION,
    benefitRegistryVersion: BENEFIT_REGISTRY_VERSION,
    ruleVersion: RULE_VERSION,
    purchaseContext: {
      ...canonical.purchaseContext,
      context: normalizedRequest.context,
    },
  };
}

function transition(
  current: DecisionLifecycleState,
  next: DecisionLifecycleState,
) {
  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Invalid decision lifecycle transition: ${current} -> ${next}`);
  }
  return next;
}

function recordEvent(
  events: DecisionRuntimeEvent[],
  input: Omit<DecisionRuntimeEvent, "eventId" | "timestamp">,
) {
  const timestamp = new Date().toISOString();
  const event: DecisionRuntimeEvent = {
    ...input,
    eventId: stableId("deve", {
      decisionId: input.decisionId,
      type: input.type,
      index: events.length,
      timestamp,
    }),
    timestamp,
  };
  events.push(deepFreeze(event));
  return event;
}

async function persistDecisionRuntime(
  decision: DecisionObject,
  events: DecisionRuntimeEvent[],
  originalRequest: PaymentDecisionRequest,
) {
  const stored: StoredDecisionRuntime = {
    decisionId: decision.decisionId,
    ownerUserId: decision.userId,
    partnerId: decision.partnerId,
    decision: deepFreeze(decision),
    events: deepFreeze([...events]),
    originalRequest: deepFreeze(redactedRuntimeRequest(originalRequest)),
    createdAt: new Date(decision.createdAt),
    updatedAt: new Date(decision.updatedAt),
    schemaVersion: 1,
  };
  if (useMemoryDecisionRuntimeStore()) {
    memoryDecisions.set(stored.decisionId, stored);
    return;
  }
  const collection = await getDecisionRuntimeCollection();
  await collection.updateOne(
    {
      decisionId: stored.decisionId,
      ownerUserId: stored.ownerUserId,
      partnerId: stored.partnerId,
    },
    { $set: stored },
    { upsert: true },
  );
}

async function getStoredDecisionRuntime(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  if (useMemoryDecisionRuntimeStore()) {
    const stored = memoryDecisions.get(decisionId);
    return stored && scopeMatches(stored, accessScope) ? stored : null;
  }
  const collection = await getDecisionRuntimeCollection();
  const stored = await collection.findOne({
    decisionId,
    ...accessQuery(accessScope),
  } as any);
  return (stored as StoredDecisionRuntime | null) || null;
}

function scopeMatches(
  stored: Pick<StoredDecisionRuntime, "ownerUserId" | "partnerId">,
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

function redactedRuntimeRequest(
  request: PaymentDecisionRequest,
): PaymentDecisionRequest {
  return JSON.parse(
    JSON.stringify({
      ...request,
      userId: undefined,
      manualCardSlugs: request.manualCardSlugs || [],
    }),
  );
}

function useMemoryDecisionRuntimeStore() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.REWARDLY_DECISION_RUNTIME_STORE === "memory"
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
