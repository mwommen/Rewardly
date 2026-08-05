import crypto from "crypto";
import type { PaymentDecision } from "../../../packages/rewardly-core/src";
import {
  decidePayment,
  type PaymentDecisionRequest,
} from "./paymentDecisionService";
import {
  DECISION_ENGINE_VERSION,
  DECISION_EXPLANATION_VERSION,
  type DecisionExplanation as InternalDecisionExplanation,
  type DecisionEvidenceItem as InternalDecisionEvidenceItem,
} from "./decisionIntelligenceService";
import {
  getDecisionInputSnapshotsCollection,
  getDecisionTrustRecordsCollection,
} from "../db";

export const TRUST_RECORD_SCHEMA_VERSION = "2026-08-05.1";
export const EXPLANATION_SCHEMA_VERSION = "2026-08-05.1";
export const SCORING_POLICY_VERSION = "wallet-first-scoring-v1";
export const API_VERSION = "v1";
export const MAX_PUBLIC_EVIDENCE_ITEMS = 40;
export const MAX_PUBLIC_ALTERNATIVES = 3;

export type DecisionTrustStatus = "complete" | "partial" | "unavailable";
export type DecisionReplayability =
  "replayable" | "partially_replayable" | "not_replayable";
export type DecisionWarningSeverity = "info" | "caution" | "critical";
export type DecisionEvidenceEffect =
  "supports" | "limits" | "excludes" | "informational";

export type DecisionExplanation = {
  headline: string;
  summary: string;
  primaryReason: {
    code: string;
    message: string;
  };
  supportingReasons: Array<{
    code: string;
    message: string;
  }>;
  tradeoffs: Array<{
    code: string;
    message: string;
    impact?: string;
  }>;
};

export type DecisionEvidenceItem = {
  evidenceId: string;
  type: string;
  source: string;
  sourceReference?: string;
  statement: string;
  effect: DecisionEvidenceEffect;
  subjectId?: string;
  ruleId?: string;
  value?: number | string | boolean;
  unit?: string;
  version?: string;
  effectiveAt?: string;
  expiresAt?: string;
  confidence?: number;
};

export type DecisionAlternative = {
  paymentMethodId: string;
  displayName: string;
  rank: number;
  estimatedValue?: number | null;
  confidence?: number;
  reasonNotSelected: {
    code: string;
    message: string;
  };
  tradeoffs: string[];
};

export type DecisionWarning = {
  code: string;
  severity: DecisionWarningSeverity;
  message: string;
  userAction?: string;
};

export type DecisionAssumption = {
  code: string;
  statement: string;
  source: "user" | "platform" | "inferred" | "default";
  confidence: number;
};

export type DecisionConfidence = {
  overall: number;
  level: "high" | "medium" | "low";
  components: {
    merchantResolution?: number | "unavailable";
    walletCompleteness?: number | "unavailable";
    ruleFreshness?: number | "unavailable";
    benefitEligibility?: number | "unavailable";
    contextCompleteness?: number | "unavailable";
  };
  explanation: string;
};

export type DecisionTrustRecord = {
  trustRecordId: string;
  decisionId: string;
  decisionType: "payment_decision";
  status: DecisionTrustStatus;
  recommendation: {
    paymentMethodId: string | null;
    displayName: string | null;
    summary: string;
  };
  explanation: DecisionExplanation;
  evidence: DecisionEvidenceItem[];
  alternatives: DecisionAlternative[];
  warnings: DecisionWarning[];
  assumptions: DecisionAssumption[];
  confidence: DecisionConfidence;
  versions: {
    apiVersion: string;
    decisionEngineVersion: string;
    scoringPolicyVersion: string;
    merchantRegistryVersion?: string;
    benefitRegistryVersion?: string;
    cardCatalogVersion?: string;
    explanationSchemaVersion: string;
    trustRecordSchemaVersion: string;
  };
  reproducibility: {
    replayable: boolean;
    replayability: DecisionReplayability;
    replayLimitations: string[];
    inputSnapshotId?: string;
    policySnapshotId?: string;
    missingDependencies: string[];
  };
  provenance: {
    commercialBiasApplied: false;
    dataSources: string[];
    decisionPolicy: string;
    evaluationTimestamp: string;
  };
  timestamps: {
    decisionCreatedAt: string;
    trustRecordCreatedAt: string;
  };
};

export type DecisionInputSnapshot = {
  inputSnapshotId: string;
  decisionId: string;
  normalizedRequest: PaymentDecisionRequest;
  originalRecommendationId: string | null;
  originalDisplayName: string | null;
  retainedFields: Array<{
    field: string;
    reason: string;
  }>;
  createdAt: string;
};

export type DecisionReplayResult = {
  decisionId: string;
  replayId: string;
  status: "matched" | "mismatched" | "not_replayable";
  replayability: DecisionReplayability;
  replayQualityExplanation: string;
  originalRecommendationId?: string | null;
  replayedRecommendationId?: string | null;
  differences: Array<{
    field: string;
    original: unknown;
    replayed: unknown;
  }>;
  versionsUsed: Record<string, string>;
  missingDependencies: string[];
  replayedAt: string;
};

export type CreateTrustRecordInput = {
  decisionId: string;
  decision: PaymentDecision;
  normalizedRequest: PaymentDecisionRequest;
  ownerUserId?: string | null;
  tenantId?: string | null;
};

type StoredTrustRecord = {
  trustRecordId: string;
  decisionId: string;
  ownerUserId: string | null;
  tenantId: string | null;
  trustRecord: DecisionTrustRecord;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
};

type StoredInputSnapshot = {
  inputSnapshotId: string;
  decisionId: string;
  ownerUserId: string | null;
  tenantId: string | null;
  snapshot: DecisionInputSnapshot;
  retainedFields: DecisionInputSnapshot["retainedFields"];
  createdAt: Date;
  schemaVersion: number;
};

export type TrustAccessScope = {
  ownerUserId?: string | null;
  tenantId?: string | null;
};

const memoryTrustRecords = new Map<string, StoredTrustRecord>();
const memoryTrustRecordByDecisionId = new Map<string, string>();
const memoryInputSnapshots = new Map<string, StoredInputSnapshot>();

export function resetTrustInfrastructureForTests() {
  memoryTrustRecords.clear();
  memoryTrustRecordByDecisionId.clear();
  memoryInputSnapshots.clear();
}

export async function ensureTrustInfrastructureIndexes() {
  if (useMemoryTrustStore()) return;
  const [records, snapshots] = await Promise.all([
    getDecisionTrustRecordsCollection(),
    getDecisionInputSnapshotsCollection(),
  ]);
  await Promise.all([
    records.createIndex(
      { decisionId: 1, ownerUserId: 1, tenantId: 1 },
      { unique: true },
    ),
    records.createIndex({ trustRecordId: 1 }, { unique: true }),
    records.createIndex({ ownerUserId: 1, createdAt: -1 }),
    records.createIndex({ tenantId: 1, createdAt: -1 }),
    snapshots.createIndex(
      { inputSnapshotId: 1, ownerUserId: 1, tenantId: 1 },
      { unique: true },
    ),
    snapshots.createIndex({ decisionId: 1, ownerUserId: 1, tenantId: 1 }),
  ]);
}

export async function createOrResolveTrustRecord(
  input: CreateTrustRecordInput,
) {
  const accessScope = accessScopeFor(input);
  const existing = await getStoredTrustRecordByDecisionId(
    input.decisionId,
    accessScope,
  );
  if (existing) return existing;

  const createdAt = new Date().toISOString();
  const snapshot = createInputSnapshot(input, createdAt);
  await persistInputSnapshot(snapshot, input);

  const explanation = buildPublicExplanation(input.decision);
  const evidence = buildPublicEvidence(input.decision)
    .sort(compareEvidence)
    .slice(0, MAX_PUBLIC_EVIDENCE_ITEMS);
  const confidence = buildPublicConfidence(input.decision);
  const warnings = buildPublicWarnings(input.decision, confidence, snapshot);
  const assumptions = buildPublicAssumptions(
    input.normalizedRequest,
    input.decision,
  );
  const alternatives = buildPublicAlternatives(input.decision).slice(
    0,
    MAX_PUBLIC_ALTERNATIVES,
  );
  const status: DecisionTrustStatus =
    evidence.length && explanation.summary ? "complete" : "partial";
  const trustRecordId = stableId("trst", {
    decisionId: input.decisionId,
    snapshotId: snapshot.inputSnapshotId,
    selected: recommendedPaymentMethodId(input.decision),
  });
  const record: DecisionTrustRecord = deepFreeze({
    trustRecordId,
    decisionId: input.decisionId,
    decisionType: "payment_decision",
    status,
    recommendation: {
      paymentMethodId: recommendedPaymentMethodId(input.decision),
      displayName: recommendedPaymentDisplayName(input.decision),
      summary:
        input.decision.recommendationSummary ||
        explanation.summary ||
        "Rewardly evaluated this wallet for the purchase.",
    },
    explanation,
    evidence,
    alternatives,
    warnings,
    assumptions,
    confidence,
    versions: {
      apiVersion: API_VERSION,
      decisionEngineVersion: DECISION_ENGINE_VERSION,
      scoringPolicyVersion: SCORING_POLICY_VERSION,
      merchantRegistryVersion: merchantVersion(input.decision),
      benefitRegistryVersion: benefitVersion(input.decision),
      cardCatalogVersion: "card-catalog-v1",
      explanationSchemaVersion: EXPLANATION_SCHEMA_VERSION,
      trustRecordSchemaVersion: TRUST_RECORD_SCHEMA_VERSION,
    },
    reproducibility: {
      replayable: true,
      replayability: "replayable",
      replayLimitations: [],
      inputSnapshotId: snapshot.inputSnapshotId,
      policySnapshotId: stableId("policy", {
        decisionEngineVersion: DECISION_ENGINE_VERSION,
        scoringPolicyVersion: SCORING_POLICY_VERSION,
        commercialBiasApplied: false,
      }),
      missingDependencies: [],
    },
    provenance: {
      commercialBiasApplied: false,
      dataSources: Array.from(
        new Set(evidence.map((item) => item.source)),
      ).sort(),
      decisionPolicy: "Wallet-first unbiased payment decision policy.",
      evaluationTimestamp: input.decision.generatedAt || createdAt,
    },
    timestamps: {
      decisionCreatedAt: input.decision.generatedAt || createdAt,
      trustRecordCreatedAt: createdAt,
    },
  });

  await persistTrustRecord(record, input);
  return record;
}

export async function getTrustRecordByDecisionId(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  return getStoredTrustRecordByDecisionId(decisionId, accessScope);
}

export async function getTrustRecordById(
  trustRecordId: string,
  accessScope?: TrustAccessScope,
) {
  const stored = await getStoredTrustRecordByTrustRecordId(
    trustRecordId,
    accessScope,
  );
  return stored;
}

export async function getDecisionEvidence(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  return (
    (await getTrustRecordByDecisionId(decisionId, accessScope))?.evidence ||
    null
  );
}

export async function getDecisionExplanation(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  return (
    (await getTrustRecordByDecisionId(decisionId, accessScope))?.explanation ||
    null
  );
}

export async function getDecisionAlternatives(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  return (
    (await getTrustRecordByDecisionId(decisionId, accessScope))?.alternatives ||
    null
  );
}

export function trustReferenceFor(record: DecisionTrustRecord) {
  return {
    trustRecordId: record.trustRecordId,
    status: record.status,
    evidenceUrl: `/api/v1/decisions/${record.decisionId}/evidence`,
    trustUrl: `/api/v1/decisions/${record.decisionId}/trust`,
    replayable: record.reproducibility.replayable,
  };
}

export async function replayDecision(
  decisionId: string,
  accessScope?: TrustAccessScope,
): Promise<DecisionReplayResult> {
  const record = await getTrustRecordByDecisionId(decisionId, accessScope);
  const replayedAt = new Date().toISOString();
  const replayId = stableId("rply", { decisionId, replayedAt });
  if (!record?.reproducibility.inputSnapshotId) {
    return {
      decisionId,
      replayId,
      status: "not_replayable",
      replayability: "not_replayable",
      replayQualityExplanation:
        "Rewardly cannot replay this decision because the input snapshot is missing.",
      differences: [],
      versionsUsed: {},
      missingDependencies: ["input_snapshot"],
      replayedAt,
    };
  }
  const snapshot = await getInputSnapshot(
    record.reproducibility.inputSnapshotId,
    accessScope,
  );
  if (!snapshot) {
    return {
      decisionId,
      replayId,
      status: "not_replayable",
      replayability: "not_replayable",
      replayQualityExplanation:
        "Rewardly cannot replay this decision because the immutable input snapshot is unavailable.",
      originalRecommendationId: record.recommendation.paymentMethodId,
      differences: [],
      versionsUsed: record.versions,
      missingDependencies: ["input_snapshot"],
      replayedAt,
    };
  }

  const replayedDecision = await decidePayment(snapshot.normalizedRequest);
  const replayedRecommendationId = recommendedPaymentMethodId(replayedDecision);
  const differences = compareReplayFields({
    originalRecommendationId: snapshot.originalRecommendationId,
    replayedRecommendationId,
    originalDisplayName: snapshot.originalDisplayName,
    replayedDisplayName: recommendedPaymentDisplayName(replayedDecision),
  });

  return {
    decisionId,
    replayId,
    status: differences.length ? "mismatched" : "matched",
    replayability: replayabilityFor(record),
    replayQualityExplanation: replayQualityExplanationFor(record),
    originalRecommendationId: snapshot.originalRecommendationId,
    replayedRecommendationId,
    differences,
    versionsUsed: record.versions,
    missingDependencies: [],
    replayedAt,
  };
}

export function formatDecisionSummary(record: DecisionTrustRecord) {
  return record.explanation.headline || record.recommendation.summary;
}

export function groupEvidenceByType(items: DecisionEvidenceItem[]) {
  return items.reduce<Record<string, DecisionEvidenceItem[]>>(
    (groups, item) => {
      groups[item.type] = groups[item.type] || [];
      groups[item.type].push(item);
      return groups;
    },
    {},
  );
}

export function getCriticalWarnings(record: DecisionTrustRecord) {
  return record.warnings.filter((warning) => warning.severity === "critical");
}

export function getTopAlternatives(record: DecisionTrustRecord, count = 2) {
  return record.alternatives.slice(0, Math.max(0, count));
}

export function formatConfidenceLabel(confidence: DecisionConfidence) {
  if (confidence.level === "high") return "High confidence";
  if (confidence.level === "medium") return "Medium confidence";
  return "Low confidence";
}

function createInputSnapshot(input: CreateTrustRecordInput, createdAt: string) {
  const snapshot: DecisionInputSnapshot = {
    inputSnapshotId: stableId("snap", {
      decisionId: input.decisionId,
      request: redactedDecisionRequest(input.normalizedRequest),
    }),
    decisionId: input.decisionId,
    normalizedRequest: redactedDecisionRequest(input.normalizedRequest),
    originalRecommendationId: recommendedPaymentMethodId(input.decision),
    originalDisplayName: recommendedPaymentDisplayName(input.decision),
    retainedFields: retainedSnapshotFields(),
    createdAt,
  };
  return deepFreeze(snapshot);
}

async function persistTrustRecord(
  record: DecisionTrustRecord,
  input: CreateTrustRecordInput,
) {
  const stored: StoredTrustRecord = {
    trustRecordId: record.trustRecordId,
    decisionId: record.decisionId,
    ownerUserId: input.ownerUserId || null,
    tenantId: input.tenantId || null,
    trustRecord: record,
    createdAt: new Date(record.timestamps.trustRecordCreatedAt),
    updatedAt: new Date(record.timestamps.trustRecordCreatedAt),
    schemaVersion: 1,
  };
  if (useMemoryTrustStore()) {
    memoryTrustRecords.set(stored.trustRecordId, stored);
    memoryTrustRecordByDecisionId.set(stored.decisionId, stored.trustRecordId);
    return;
  }
  const collection = await getDecisionTrustRecordsCollection();
  await collection.updateOne(
    {
      decisionId: stored.decisionId,
      ownerUserId: stored.ownerUserId,
      tenantId: stored.tenantId,
    },
    { $setOnInsert: stored },
    { upsert: true },
  );
}

async function persistInputSnapshot(
  snapshot: DecisionInputSnapshot,
  input: CreateTrustRecordInput,
) {
  const stored: StoredInputSnapshot = {
    inputSnapshotId: snapshot.inputSnapshotId,
    decisionId: snapshot.decisionId,
    ownerUserId: input.ownerUserId || null,
    tenantId: input.tenantId || null,
    snapshot,
    retainedFields: snapshot.retainedFields,
    createdAt: new Date(snapshot.createdAt),
    schemaVersion: 1,
  };
  if (useMemoryTrustStore()) {
    memoryInputSnapshots.set(stored.inputSnapshotId, stored);
    return;
  }
  const collection = await getDecisionInputSnapshotsCollection();
  await collection.updateOne(
    {
      inputSnapshotId: stored.inputSnapshotId,
      ownerUserId: stored.ownerUserId,
      tenantId: stored.tenantId,
    },
    { $setOnInsert: stored },
    { upsert: true },
  );
}

async function getStoredTrustRecordByDecisionId(
  decisionId: string,
  accessScope?: TrustAccessScope,
) {
  if (useMemoryTrustStore()) {
    const trustRecordId = memoryTrustRecordByDecisionId.get(decisionId);
    const stored = trustRecordId ? memoryTrustRecords.get(trustRecordId) : null;
    return stored && scopeMatches(stored, accessScope)
      ? stored.trustRecord
      : null;
  }
  const collection = await getDecisionTrustRecordsCollection();
  const stored = await collection.findOne({
    decisionId,
    ...accessQuery(accessScope),
  } as any);
  return (stored?.trustRecord as DecisionTrustRecord | undefined) || null;
}

async function getStoredTrustRecordByTrustRecordId(
  trustRecordId: string,
  accessScope?: TrustAccessScope,
) {
  if (useMemoryTrustStore()) {
    const stored = memoryTrustRecords.get(trustRecordId);
    return stored && scopeMatches(stored, accessScope)
      ? stored.trustRecord
      : null;
  }
  const collection = await getDecisionTrustRecordsCollection();
  const stored = await collection.findOne({
    trustRecordId,
    ...accessQuery(accessScope),
  } as any);
  return (stored?.trustRecord as DecisionTrustRecord | undefined) || null;
}

async function getInputSnapshot(
  inputSnapshotId: string,
  accessScope?: TrustAccessScope,
) {
  if (useMemoryTrustStore()) {
    const stored = memoryInputSnapshots.get(inputSnapshotId);
    return stored && scopeMatches(stored, accessScope) ? stored.snapshot : null;
  }
  const collection = await getDecisionInputSnapshotsCollection();
  const stored = await collection.findOne({
    inputSnapshotId,
    ...accessQuery(accessScope),
  } as any);
  return (stored?.snapshot as DecisionInputSnapshot | undefined) || null;
}

function accessScopeFor(input: CreateTrustRecordInput): TrustAccessScope {
  return {
    ownerUserId: input.ownerUserId || null,
    tenantId: input.tenantId || null,
  };
}

function accessQuery(accessScope?: TrustAccessScope) {
  if (!accessScope) return {};
  return {
    ownerUserId: accessScope.ownerUserId || null,
    tenantId: accessScope.tenantId || null,
  };
}

function scopeMatches(
  stored: Pick<StoredTrustRecord, "ownerUserId" | "tenantId">,
  accessScope?: TrustAccessScope,
) {
  if (!accessScope) return true;
  return (
    (accessScope.ownerUserId || null) === stored.ownerUserId &&
    (accessScope.tenantId || null) === stored.tenantId
  );
}

function useMemoryTrustStore() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.REWARDLY_TRUST_STORE === "memory"
  );
}

function retainedSnapshotFields() {
  return [
    {
      field: "merchant.name",
      reason: "Required to re-run deterministic merchant resolution.",
    },
    {
      field: "merchant.category",
      reason: "Required to reproduce category-based scoring inputs.",
    },
    {
      field: "merchant.domain",
      reason: "Required when domain evidence influenced merchant resolution.",
    },
    {
      field: "amount",
      reason: "Required to reproduce estimated value calculations.",
    },
    {
      field: "currency",
      reason: "Required to preserve supported purchase currency.",
    },
    {
      field: "manualCardSlugs",
      reason: "Required to preserve the wallet card scope evaluated.",
    },
    {
      field: "purchaseContext",
      reason:
        "Limited checkout context retained only when it influenced purchase classification.",
    },
  ];
}

function replayabilityFor(record: DecisionTrustRecord): DecisionReplayability {
  if (!record.reproducibility.inputSnapshotId) return "not_replayable";
  if (record.reproducibility.missingDependencies.length) {
    return "partially_replayable";
  }
  return record.reproducibility.replayability || "replayable";
}

function replayQualityExplanationFor(record: DecisionTrustRecord) {
  const replayability = replayabilityFor(record);
  if (replayability === "replayable") {
    return "Rewardly replayed this decision from its immutable input snapshot and current registered policy versions.";
  }
  if (replayability === "partially_replayable") {
    return `Rewardly replayed this decision with limitations: ${record.reproducibility.missingDependencies.join(", ")}.`;
  }
  return "Rewardly cannot replay this decision because required replay dependencies are missing.";
}

function redactedDecisionRequest(
  request: PaymentDecisionRequest,
): PaymentDecisionRequest {
  return JSON.parse(
    JSON.stringify({
      ...request,
      userId: undefined,
      manualCardSlugs: request.manualCardSlugs || [],
      purchaseContext: request.purchaseContext
        ? {
            surface: request.purchaseContext.surface,
            amount: request.purchaseContext.amount,
            currency: request.purchaseContext.currency,
            checkoutDetected: request.purchaseContext.checkoutDetected,
            checkoutStage: request.purchaseContext.checkoutStage,
          }
        : undefined,
    }),
  );
}

function buildPublicExplanation(
  decision: PaymentDecision,
): DecisionExplanation {
  const internal = decision.decisionExplanation as
    InternalDecisionExplanation | undefined;
  const narrative = decision.decisionNarrative;
  const primaryMessage =
    narrative?.primaryReason?.summary ||
    decision.primaryReason?.detail ||
    decision.winningReason?.explanation ||
    decision.recommendationSummary ||
    "Rewardly evaluated the eligible cards in this wallet.";
  const headline =
    narrative?.headline ||
    (decision.recommendedCard
      ? `Use ${decision.recommendedCard.card.name}`
      : "No wallet recommendation available");
  return {
    headline,
    summary:
      narrative?.summary || decision.recommendationSummary || primaryMessage,
    primaryReason: {
      code: reasonCodeFor(decision),
      message: primaryMessage,
    },
    supportingReasons: Array.from(
      new Set([
        ...(narrative?.supportingReasons || []).map((reason) => reason.summary),
        ...flattenInternalEvidence(internal?.evidence.scoring || []).slice(
          0,
          3,
        ),
      ]),
    )
      .filter(Boolean)
      .map((message) => ({
        code: "SUPPORTING_EVIDENCE",
        message,
      })),
    tradeoffs: (internal?.alternativeCards || [])
      .slice(0, 2)
      .map((alternative) => ({
        code: "ALTERNATIVE_LOWER_VALUE",
        message: `${alternative.cardName} was considered but not selected.`,
        impact: alternative.whyItLost,
      })),
  };
}

function buildPublicEvidence(
  decision: PaymentDecision,
): DecisionEvidenceItem[] {
  const internal = decision.decisionExplanation as
    InternalDecisionExplanation | undefined;
  const items: DecisionEvidenceItem[] = [];
  if (decision.recommendedCard) {
    items.push(
      publicEvidence({
        type: "WALLET_OWNERSHIP",
        source: "wallet_service",
        statement: `${decision.recommendedCard.card.name} is in the evaluated wallet.`,
        effect: "supports",
        subjectId: decision.recommendedCard.card.slug,
        confidence: 1,
      }),
    );
  }
  if (decision.merchant?.name) {
    items.push(
      publicEvidence({
        type: "MERCHANT_MATCH",
        source: "merchant_intelligence",
        statement: `Rewardly resolved the merchant as ${decision.merchant.name}.`,
        effect: "supports",
        subjectId: decision.merchant.name,
        confidence: normalizeConfidence(decision.merchant.confidence),
      }),
    );
  }
  if (decision.merchant?.category) {
    items.push(
      publicEvidence({
        type: "CATEGORY_MATCH",
        source: "merchant_intelligence",
        statement: `Purchase category: ${decision.merchant.category}.`,
        effect: "supports",
        subjectId: decision.merchant.category,
        confidence: normalizeConfidence(decision.merchant.confidence),
      }),
    );
  }
  if (decision.winningReason?.type) {
    items.push(
      publicEvidence({
        type: evidenceTypeForWinningReason(decision.winningReason.type),
        source: "decision_engine",
        statement:
          decision.winningReason.explanation ||
          decision.primaryReason?.detail ||
          "Winning rule supported the selected payment method.",
        effect: "supports",
        ruleId: String(decision.winningReason.type),
        value: finiteValue(decision.winningReason.estimatedValue),
        unit: "USD",
        confidence: normalizeConfidence(decision.confidence.score),
      }),
    );
  }
  if (decision.recommendedCard?.rewardEstimate?.label) {
    items.push(
      publicEvidence({
        type: "BASE_REWARD_RULE",
        source: "benefit_registry",
        statement: decision.recommendedCard.rewardEstimate.label,
        effect: "supports",
        subjectId: decision.recommendedCard.card.slug,
        confidence: normalizeConfidence(decision.confidence.score),
      }),
    );
  }
  for (const [group, groupItems] of Object.entries(internal?.evidence || {})) {
    for (const item of groupItems as InternalDecisionEvidenceItem[]) {
      items.push(fromInternalEvidence(group, item, decision));
    }
  }
  return dedupeEvidence(items).filter((item) => item.statement.trim());
}

function buildPublicAlternatives(
  decision: PaymentDecision,
): DecisionAlternative[] {
  const internal = decision.decisionExplanation as
    InternalDecisionExplanation | undefined;
  const alternatives = internal?.alternativeCards?.length
    ? internal.alternativeCards.map((item, index) => ({
        paymentMethodId: item.cardId,
        displayName: item.cardName,
        rank: index + 2,
        estimatedValue: item.estimatedValueUSD,
        confidence: normalizeConfidence(item.confidence),
        reasonNotSelected: {
          code: reasonNotSelectedCode(item.whyItLost),
          message: item.whyItLost,
        },
        tradeoffs: [item.whyItLost],
      }))
    : (decision.alternativeCards || []).map((item: any, index: number) => ({
        paymentMethodId:
          item.card?.slug || item.slug || `alternative-${index + 1}`,
        displayName: item.card?.name || item.name || `Alternative ${index + 1}`,
        rank: index + 2,
        estimatedValue: item.rewardEstimate?.estimatedValueUSD ?? null,
        confidence: normalizeConfidence(item.confidence?.score),
        reasonNotSelected: {
          code: "LOWER_RANKED_ALTERNATIVE",
          message:
            "Ranked below the selected card by the canonical Decision Engine.",
        },
        tradeoffs: [
          "Ranked below the selected card by the canonical Decision Engine.",
        ],
      }));
  const winner = recommendedPaymentMethodId(decision);
  return alternatives.filter((item) => item.paymentMethodId !== winner);
}

function buildPublicWarnings(
  decision: PaymentDecision,
  confidence: DecisionConfidence,
  snapshot: DecisionInputSnapshot,
): DecisionWarning[] {
  const internal = decision.decisionExplanation as
    InternalDecisionExplanation | undefined;
  const warnings: DecisionWarning[] = (internal?.warnings || []).map(
    (warning) => ({
      code: warning.code,
      severity: mapWarningSeverity(warning.severity),
      message: warning.message,
    }),
  );
  if (confidence.level === "low") {
    warnings.push({
      code: "LOW_CONFIDENCE",
      severity: "caution",
      message: "Rewardly has limited confidence in this decision.",
      userAction:
        "Review the explanation before relying on this recommendation.",
    });
  }
  if (!Number.isFinite(Number(snapshot.normalizedRequest.amount))) {
    warnings.push({
      code: "PURCHASE_AMOUNT_UNAVAILABLE",
      severity: "caution",
      message: "Purchase amount was unavailable or estimated.",
    });
  }
  return dedupeByCode(warnings);
}

function buildPublicAssumptions(
  request: PaymentDecisionRequest,
  decision: PaymentDecision,
): DecisionAssumption[] {
  const assumptions: DecisionAssumption[] = [
    {
      code: "USER_WALLET_SCOPE",
      statement: "Rewardly only evaluated cards supplied in the user's wallet.",
      source: "user",
      confidence: 1,
    },
    {
      code: "COMMERCIAL_BIAS_DISABLED",
      statement: "No sponsored or affiliate weighting was applied.",
      source: "platform",
      confidence: 1,
    },
  ];
  if (request.category) {
    assumptions.push({
      code: "PURCHASE_CATEGORY_PROVIDED",
      statement: `Purchase category was provided as ${request.category}.`,
      source: "user",
      confidence: 0.9,
    });
  } else if (decision.merchant?.category) {
    assumptions.push({
      code: "PURCHASE_CATEGORY_INFERRED",
      statement: `Purchase category was inferred as ${decision.merchant.category}.`,
      source: "inferred",
      confidence: normalizeConfidence(decision.merchant.confidence) ?? 0.5,
    });
  }
  return assumptions;
}

function buildPublicConfidence(decision: PaymentDecision): DecisionConfidence {
  const internal = decision.decisionExplanation as
    InternalDecisionExplanation | undefined;
  const internalConfidence = internal?.recommendationConfidence;
  const overall =
    normalizeConfidence(
      internalConfidence?.overall ?? decision.confidence.score,
    ) ?? 0;
  const level = overall >= 0.8 ? "high" : overall >= 0.58 ? "medium" : "low";
  return {
    overall,
    level,
    components: {
      merchantResolution:
        normalizeConfidence(
          internalConfidence?.components.merchantResolution,
        ) ?? "unavailable",
      walletCompleteness:
        normalizeConfidence(internalConfidence?.components.walletState) ??
        "unavailable",
      ruleFreshness:
        normalizeConfidence(internalConfidence?.components.dataFreshness) ??
        "unavailable",
      benefitEligibility:
        normalizeConfidence(
          internalConfidence?.components.benefitVerification,
        ) ?? "unavailable",
      contextCompleteness:
        normalizeConfidence(internalConfidence?.components.matchQuality) ??
        "unavailable",
    },
    explanation:
      internalConfidence?.reasons?.join(", ") ||
      `Rewardly confidence is ${level} based on available decision evidence.`,
  };
}

function fromInternalEvidence(
  group: string,
  item: InternalDecisionEvidenceItem,
  decision: PaymentDecision,
): DecisionEvidenceItem {
  return publicEvidence({
    type: evidenceTypeForInternal(group, item.type),
    source: item.source || group,
    sourceReference:
      typeof item.source === "string" && /^https?:\/\//.test(item.source)
        ? item.source
        : undefined,
    statement: `${item.label}: ${safeEvidenceValue(item.value)}`,
    effect: effectForInternalEvidence(item.type),
    subjectId: recommendedPaymentMethodId(decision) || undefined,
    ruleId: typeof item.type === "string" ? item.type : undefined,
    value: scalarEvidenceValue(item.value),
    confidence: normalizeConfidence(item.confidence),
  });
}

function publicEvidence(input: Omit<DecisionEvidenceItem, "evidenceId">) {
  const evidenceId = stableId("evd", input);
  return {
    evidenceId,
    ...input,
  };
}

function recommendedPaymentMethodId(decision: PaymentDecision) {
  return decision.recommendedCard?.card.slug || null;
}

function recommendedPaymentDisplayName(decision: PaymentDecision) {
  return decision.recommendedCard?.card.name || null;
}

function reasonCodeFor(decision: PaymentDecision) {
  const type = String(
    decision.decisionNarrative?.reasonType ||
      decision.winningReason?.type ||
      "",
  );
  if (
    type === "merchant_bonus" ||
    type === "merchant_specific" ||
    type === "merchant_reward" ||
    type === "merchant_offer" ||
    type === "merchant_credit"
  )
    return "MERCHANT_RULE_WON";
  if (
    type === "category_bonus" ||
    type === "category_match" ||
    type === "category_reward" ||
    type === "rotating_category"
  )
    return "CATEGORY_RULE_WON";
  if (type === "statement_credit") return "STATEMENT_CREDIT_WON";
  if (
    type === "base_earning" ||
    type === "base_rate" ||
    type === "catch_all_reward" ||
    type === "fallback"
  )
    return "BASE_REWARD_RULE_WON";
  if (!decision.recommendedCard) return "NO_ELIGIBLE_RECOMMENDATION";
  return "HIGHEST_CONFIDENCE_ADJUSTED_VALUE";
}

function evidenceTypeForWinningReason(type: string) {
  if (/merchant/i.test(type)) return "BONUS_REWARD_RULE";
  if (/category/i.test(type)) return "CATEGORY_MATCH";
  if (/credit|offer/i.test(type)) return "OFFER_ELIGIBILITY";
  if (/base/i.test(type)) return "BASE_REWARD_RULE";
  return "DECISION_POLICY";
}

function evidenceTypeForInternal(group: string, type: string) {
  if (/wallet/i.test(group) || /wallet/i.test(type)) return "WALLET_OWNERSHIP";
  if (/merchant/i.test(group) || /merchant/i.test(type))
    return "MERCHANT_MATCH";
  if (/benefit|rule/i.test(group) || /benefit|rule/i.test(type))
    return "BENEFIT_ELIGIBILITY";
  if (/confidence/i.test(group) || /freshness/i.test(type))
    return "DATA_FRESHNESS";
  if (/scoring|rate|value/i.test(group) || /rate|value|tier/i.test(type))
    return "DECISION_POLICY";
  return "DECISION_POLICY";
}

function effectForInternalEvidence(type: string): DecisionEvidenceEffect {
  if (/missing|unknown|low|stale/i.test(type)) return "limits";
  if (/excluded|expired|exhausted/i.test(type)) return "excludes";
  if (/confidence|freshness/i.test(type)) return "informational";
  return "supports";
}

function reasonNotSelectedCode(message: string) {
  if (/lower estimated value/i.test(message)) return "LOWER_ESTIMATED_VALUE";
  if (/lower rewards rate/i.test(message)) return "LOWER_REWARD_RATE";
  if (/lower recommendation confidence/i.test(message))
    return "LOWER_CONFIDENCE";
  return "LOWER_RANKED_ALTERNATIVE";
}

function merchantVersion(decision: PaymentDecision) {
  return (decision.merchant as any)?.merchantId
    ? "merchant-registry-v1"
    : undefined;
}

function benefitVersion(decision: PaymentDecision) {
  return (decision.recommendedCard as any)?.matchedBenefit?.id ||
    (decision.decisionExplanation as InternalDecisionExplanation | undefined)
      ?.selectedBenefitId
    ? "benefit-registry-v1"
    : undefined;
}

function compareReplayFields(input: {
  originalRecommendationId: string | null;
  replayedRecommendationId: string | null;
  originalDisplayName: string | null;
  replayedDisplayName: string | null;
}) {
  const differences: DecisionReplayResult["differences"] = [];
  if (input.originalRecommendationId !== input.replayedRecommendationId) {
    differences.push({
      field: "recommendedPaymentMethod.cardId",
      original: input.originalRecommendationId,
      replayed: input.replayedRecommendationId,
    });
  }
  if (input.originalDisplayName !== input.replayedDisplayName) {
    differences.push({
      field: "recommendedPaymentMethod.displayName",
      original: input.originalDisplayName,
      replayed: input.replayedDisplayName,
    });
  }
  return differences;
}

function flattenInternalEvidence(items: InternalDecisionEvidenceItem[]) {
  return items
    .map(
      (item) =>
        `${item.label}${item.value === undefined ? "" : `: ${safeEvidenceValue(item.value)}`}`,
    )
    .filter((value) => value.trim());
}

function safeEvidenceValue(value: unknown): string {
  if (value === undefined || value === null) return "unavailable";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value))
    return value.map((item) => safeEvidenceValue(item)).join(", ");
  return "[structured evidence]";
}

function scalarEvidenceValue(value: unknown) {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function finiteValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function mapWarningSeverity(severity: string): DecisionWarningSeverity {
  if (severity === "high") return "critical";
  if (severity === "medium") return "caution";
  return "info";
}

function compareEvidence(a: DecisionEvidenceItem, b: DecisionEvidenceItem) {
  return (
    evidenceTypeRank(a.type) - evidenceTypeRank(b.type) ||
    a.evidenceId.localeCompare(b.evidenceId)
  );
}

function evidenceTypeRank(type: string) {
  const order = [
    "WALLET_OWNERSHIP",
    "MERCHANT_MATCH",
    "CATEGORY_MATCH",
    "BASE_REWARD_RULE",
    "BONUS_REWARD_RULE",
    "BENEFIT_ELIGIBILITY",
    "OFFER_ELIGIBILITY",
    "DECISION_POLICY",
    "ALTERNATIVE_COMPARISON",
    "DATA_FRESHNESS",
    "RULE_VERSION",
  ];
  const index = order.indexOf(type);
  return index >= 0 ? index : order.length;
}

function dedupeEvidence(items: DecisionEvidenceItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.source}:${item.statement}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
