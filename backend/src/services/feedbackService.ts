import {
  listMerchantIntelligence,
  resolveMerchantIntelligence,
} from "./merchantIntelligenceService";

export type FeedbackType =
  | "recommendation_helpful"
  | "recommendation_not_helpful"
  | "merchant_support_request";

export type FeedbackReason =
  | "wrong_card_recommended"
  | "wrong_merchant_detected"
  | "recommendation_too_late"
  | "recommendation_confusing"
  | "reward_estimate_incorrect"
  | "other";

export type FeedbackEvent = {
  feedbackId: string;
  type: FeedbackType;
  sessionId: string | null;
  installationId: string;
  merchantName: string | null;
  normalizedMerchantName: string | null;
  merchantDomain: string | null;
  merchantCategory: string | null;
  merchantSupported: boolean;
  confidenceBand: string | null;
  recommendedCardName: string | null;
  reason: FeedbackReason | null;
  comment: string | null;
  extensionVersion: string | null;
  createdAt: string;
};

export type FeedbackInput = {
  type?: string;
  sessionId?: string | null;
  installationId?: string | null;
  merchantName?: string | null;
  merchantDomain?: string | null;
  merchantCategory?: string | null;
  confidenceBand?: string | null;
  recommendedCardName?: string | null;
  reason?: string | null;
  comment?: string | null;
  extensionVersion?: string | null;
  createdAt?: string;
};

export type FeedbackStore = {
  insertEvent(event: FeedbackEvent): Promise<void>;
  listEvents(): Promise<FeedbackEvent[]>;
};

export class FeedbackPrivacyError extends Error {
  constructor(message = "Feedback failed privacy validation") {
    super(message);
    this.name = "FeedbackPrivacyError";
  }
}

const FEEDBACK_REASONS: FeedbackReason[] = [
  "wrong_card_recommended",
  "wrong_merchant_detected",
  "recommendation_too_late",
  "recommendation_confusing",
  "reward_estimate_incorrect",
  "other",
];

export class FeedbackService {
  constructor(private readonly store: FeedbackStore) {}

  async record(input: FeedbackInput) {
    const type = normalizeFeedbackType(input.type);
    if (!type) throw new Error("Unsupported feedback type");
    const installationId = safeText(input.installationId, 80);
    if (!installationId) throw new Error("Anonymous installation id is required");

    const comment = sanitizeComment(input.comment);
    const reason = normalizeReason(input.reason);
    if (type === "recommendation_not_helpful" && !reason) {
      throw new Error("Negative feedback reason is required");
    }
    if (reason === "other" && input.comment && !comment) {
      throw new FeedbackPrivacyError();
    }

    const merchantName = safeText(input.merchantName, 100);
    const merchantDomain = normalizeDomain(input.merchantDomain);
    const resolved = resolveFeedbackMerchant({
      merchantName,
      merchantDomain,
      merchantCategory: input.merchantCategory,
    });
    const createdAt = safeTimestamp(input.createdAt);
    const event: FeedbackEvent = {
      feedbackId: stableId("feedback", [
        type,
        installationId,
        input.sessionId,
        resolved.normalizedMerchantName,
        reason,
        createdAt,
      ]),
      type,
      sessionId: safeText(input.sessionId, 120),
      installationId,
      merchantName,
      normalizedMerchantName: resolved.normalizedMerchantName,
      merchantDomain,
      merchantCategory: resolved.merchantCategory,
      merchantSupported: resolved.supported,
      confidenceBand: safeText(input.confidenceBand, 80),
      recommendedCardName: safeText(input.recommendedCardName, 100),
      reason: type === "recommendation_helpful" ? null : reason,
      comment: reason === "other" ? comment : null,
      extensionVersion: versionField(input.extensionVersion),
      createdAt,
    };

    validatePrivacy(event);
    await this.store.insertEvent(event);
    return event;
  }

  async summary() {
    const events = await this.store.listEvents();
    const recommendationFeedback = events.filter((event) =>
      ["recommendation_helpful", "recommendation_not_helpful"].includes(event.type),
    );
    const helpful = countType(events, "recommendation_helpful");
    const notHelpful = countType(events, "recommendation_not_helpful");
    const merchantRequests = countType(events, "merchant_support_request");
    return {
      totalFeedback: events.length,
      recommendationFeedback: recommendationFeedback.length,
      helpfulCount: helpful,
      notHelpfulCount: notHelpful,
      helpfulRate: rate(helpful, helpful + notHelpful),
      notHelpfulRate: rate(notHelpful, helpful + notHelpful),
      merchantRequests,
      mostCommonIssue: mostCommonIssue(events),
      confidenceVsFeedback: confidenceVsFeedback(events),
    };
  }

  async merchants() {
    const events = await this.store.listEvents();
    const registry = listMerchantIntelligence();
    const byCategory = new Map<string, number>();
    for (const merchant of registry) {
      const category = merchant.category || "other";
      byCategory.set(category, (byCategory.get(category) || 0) + 1);
    }
    return {
      supportedMerchants: registry
        .filter((merchant) => merchant.active)
        .map((merchant) => ({
          merchantId: merchant.merchantId,
          merchant: merchant.displayName,
          category: merchant.category,
          healthScore: Math.round((merchant.confidence || 0) * 100),
        })),
      totalMerchants: registry.length,
      coverageByCategory: Array.from(byCategory.entries()).map(([category, count]) => ({
        category,
        count,
      })),
      requestedMerchants: requestedMerchants(events),
    };
  }

  async trends() {
    const events = await this.store.listEvents();
    return {
      issues: issueCounts(events),
      merchantRequests: requestedMerchants(events).slice(0, 10),
      confidenceVsFeedback: confidenceVsFeedback(events),
      dailyFeedback: dailyFeedback(events),
    };
  }
}

export function createMongoFeedbackStore(collection: any): FeedbackStore {
  return {
    async insertEvent(event) {
      await collection.insertOne({ ...event, createdAt: new Date(event.createdAt) });
    },
    async listEvents() {
      const rows = await collection.find({}).sort?.({ createdAt: -1 }).limit?.(5000).toArray();
      return (rows || []).map(normalizeStoredFeedback).filter(Boolean);
    },
  };
}

export function createMemoryFeedbackStore(initial: FeedbackEvent[] = []): FeedbackStore & { events: FeedbackEvent[] } {
  const events = [...initial];
  return {
    events,
    async insertEvent(event) {
      events.push(event);
    },
    async listEvents() {
      return events.slice();
    },
  };
}

function resolveFeedbackMerchant(input: {
  merchantName: string | null;
  merchantDomain: string | null;
  merchantCategory?: string | null;
}) {
  const resolved = resolveMerchantIntelligence({
    merchant: input.merchantName || undefined,
    hostname: input.merchantDomain || undefined,
  });
  const strongSupportedMatch =
    !!resolved?.merchant &&
    resolved.confidence >= 0.9 &&
    !["category_inference", "weak_fuzzy", "unknown"].includes(resolved.matchingStrategy);
  const merchant = strongSupportedMatch ? resolved?.merchant || null : null;
  const normalizedMerchantName =
    merchant?.displayName ||
    normalizeMerchantLabel(input.merchantName || input.merchantDomain || "Unknown merchant");
  return {
    normalizedMerchantName,
    merchantCategory:
      merchant?.category || safeText(input.merchantCategory, 80) || null,
    supported: !!merchant?.active,
  };
}

function normalizeFeedbackType(value?: string): FeedbackType | null {
  if (value === "recommendation_helpful" || value === "recommendation_not_helpful" || value === "merchant_support_request") {
    return value;
  }
  return null;
}

function normalizeReason(value?: string | null): FeedbackReason | null {
  if (!value) return null;
  return FEEDBACK_REASONS.includes(value as FeedbackReason)
    ? (value as FeedbackReason)
    : null;
}

function sanitizeComment(value?: string | null) {
  const text = safeText(value, 250);
  if (!text) return null;
  if (containsSensitiveValue(text)) throw new FeedbackPrivacyError();
  return text;
}

function validatePrivacy(event: FeedbackEvent) {
  if (containsSensitiveValue(JSON.stringify(event))) {
    throw new FeedbackPrivacyError();
  }
}

function containsSensitiveValue(value: string) {
  return (
    /\b(?:\d[ -]?){12,19}\b/.test(value) ||
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ||
    /\b(?:token|cookie|session_secret|authorization|bearer)\b/i.test(value) ||
    /\b\d{3}[-.]\d{3}[-.]\d{4}\b/.test(value) ||
    /\b(?:street|avenue|apt|suite|zipcode|zip code|billing address|shipping address)\b/i.test(value) ||
    /\b(?:order total|purchase amount|subtotal|cart total|checkout total)\b/i.test(value) ||
    /\b(?:order id|order number|order #|confirmation number|transaction id|payment id)\b/i.test(value) ||
    /https?:\/\/\S+\?\S+/i.test(value)
  );
}

function requestedMerchants(events: FeedbackEvent[]) {
  const grouped = new Map<string, FeedbackEvent[]>();
  for (const event of events.filter((item) => item.type === "merchant_support_request")) {
    const key = event.normalizedMerchantName || "Unknown merchant";
    grouped.set(key, [...(grouped.get(key) || []), event]);
  }
  return Array.from(grouped.entries())
    .map(([merchant, merchantEvents]) => ({
      merchant,
      requestCount: merchantEvents.length,
      firstRequest: merchantEvents
        .map((event) => event.createdAt)
        .sort()[0],
      mostRecentRequest: merchantEvents
        .map((event) => event.createdAt)
        .sort()
        .reverse()[0],
      category: merchantEvents.find((event) => event.merchantCategory)?.merchantCategory || null,
      domain: merchantEvents.find((event) => event.merchantDomain)?.merchantDomain || null,
    }))
    .sort((a, b) => b.requestCount - a.requestCount || a.merchant.localeCompare(b.merchant));
}

function issueCounts(events: FeedbackEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!event.reason) continue;
    counts.set(event.reason, (counts.get(event.reason) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

function mostCommonIssue(events: FeedbackEvent[]) {
  return issueCounts(events)[0]?.reason || null;
}

function confidenceVsFeedback(events: FeedbackEvent[]) {
  const grouped = new Map<string, FeedbackEvent[]>();
  for (const event of events.filter((item) =>
    ["recommendation_helpful", "recommendation_not_helpful"].includes(item.type),
  )) {
    const key = event.confidenceBand || "Unknown";
    grouped.set(key, [...(grouped.get(key) || []), event]);
  }
  return Array.from(grouped.entries()).map(([confidenceBand, items]) => {
    const helpful = items.filter((event) => event.type === "recommendation_helpful").length;
    const notHelpful = items.filter((event) => event.type === "recommendation_not_helpful").length;
    return {
      confidenceBand,
      helpful,
      notHelpful,
      helpfulRate: rate(helpful, helpful + notHelpful),
    };
  });
}

function dailyFeedback(events: FeedbackEvent[]) {
  const grouped = new Map<string, number>();
  for (const event of events) {
    const day = event.createdAt.slice(0, 10);
    grouped.set(day, (grouped.get(day) || 0) + 1);
  }
  return Array.from(grouped.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function countType(events: FeedbackEvent[], type: FeedbackType) {
  return events.filter((event) => event.type === type).length;
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

function normalizeMerchantLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/^www\./, "")
    .replace(/\b(?:grocery|store|shop|market|online)\b/g, "")
    .replace(/joe'?s/g, "joes")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown merchant";
}

function normalizeDomain(value?: string | null) {
  const text = safeText(value, 120);
  if (!text) return null;
  try {
    return new URL(text.includes("://") ? text : `https://${text}`).hostname.replace(/^www\./, "");
  } catch {
    return text.replace(/^www\./, "");
  }
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function versionField(value: unknown) {
  const text = safeText(value, 40);
  return text && /^[a-z0-9._+-]+$/i.test(text) ? text : null;
}

function safeTimestamp(value?: string) {
  if (value) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function normalizeStoredFeedback(row: any): FeedbackEvent | null {
  if (!row || !row.type || !row.feedbackId) return null;
  return {
    ...row,
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : new Date(row.createdAt).toISOString(),
  } as FeedbackEvent;
}

function stableId(prefix: string, parts: Array<unknown>) {
  const seed = parts.map((part) => String(part || "")).join("|");
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16)}`;
}
