export type RecommendationAnalyticsEventType =
  | "extension_installed"
  | "wallet_created"
  | "card_added"
  | "card_removed"
  | "wallet_empty"
  | "checkout_detected"
  | "merchant_classified"
  | "recommendation_requested"
  | "recommendation_generated"
  | "recommendation_acknowledged"
  | "popup_displayed"
  | "popup_hidden"
  | "popup_dismissed"
  | "continue_checkout_clicked"
  | "details_opened"
  | "retry_clicked"
  | "recommendation_failed"
  | "recommendation_timeout"
  | "extension_communication_failed";

export type RecommendationConfidenceBand =
  | "Excellent Match"
  | "High Confidence"
  | "Good Match"
  | "General Recommendation"
  | "Limited Confidence";

export type RecommendationAnalyticsEvent = {
  eventId: string;
  sessionId: string;
  installationId: string;
  userId: string | null;
  source: "chrome_extension" | "website" | "backend" | "unknown";
  timestamp: string;
  expiresAt: string;
  eventType: RecommendationAnalyticsEventType;
  merchantName: string | null;
  merchantCategory: string | null;
  checkoutStage: string | null;
  confidenceBand: RecommendationConfidenceBand | null;
  recommendationLatencyMs: number | null;
  popupLatencyMs: number | null;
  merchantClassificationLatencyMs: number | null;
  estimatedRewardValueUSD: number | null;
  advantageOverRunnerUpUSD: number | null;
  rewardType: string | null;
  extensionVersion: string | null;
  recommendationEngineVersion: string | null;
  merchantRegistryVersion: string | null;
  browserFamily: string | null;
  operatingSystem: string | null;
  analyticsProcessingMs: number;
  errorType: string | null;
  errorCode: string | null;
  hasRecommendation: boolean | null;
  popupVisible: boolean | null;
  walletCardCount: number | null;
};

export type RecommendationAnalyticsStore = {
  insertEvent(event: RecommendationAnalyticsEvent): Promise<void>;
  listEvents(since?: Date): Promise<RecommendationAnalyticsEvent[]>;
  cleanupExpired(now?: Date): Promise<number>;
};

export type RecommendationAnalyticsInput = {
  installationId?: string;
  userId?: string | null;
  source?: string;
  event?: string;
  eventType?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

export class AnalyticsPrivacyError extends Error {
  constructor(message = "Analytics event failed privacy validation") {
    super(message);
    this.name = "AnalyticsPrivacyError";
  }
}

const DEFAULT_RETENTION_DAYS = 30;
const MAX_EVENTS_FOR_DASHBOARD = 5000;
const EVENT_MAP: Record<string, RecommendationAnalyticsEventType> = {
  extension_installed: "extension_installed",
  wallet_created: "wallet_created",
  card_added: "card_added",
  card_removed: "card_removed",
  wallet_empty: "wallet_empty",
  checkout_detected: "checkout_detected",
  merchant_detected: "merchant_classified",
  merchant_classified: "merchant_classified",
  recommendation_requested: "recommendation_requested",
  recommendation_generated: "recommendation_generated",
  recommendation_acknowledged: "recommendation_acknowledged",
  recommendation_displayed: "recommendation_generated",
  popup_visible: "popup_displayed",
  popup_displayed: "popup_displayed",
  popup_hidden: "popup_hidden",
  recommendation_dismissed: "popup_dismissed",
  popup_dismissed: "popup_dismissed",
  continue_checkout_clicked: "continue_checkout_clicked",
  details_opened: "details_opened",
  retry_clicked: "retry_clicked",
  recommendation_failed: "recommendation_failed",
  recommendation_timeout: "recommendation_timeout",
  merchant_detection_error: "recommendation_failed",
  extension_communication_failed: "extension_communication_failed",
};

const CONFIDENCE_BANDS: RecommendationConfidenceBand[] = [
  "Excellent Match",
  "High Confidence",
  "Good Match",
  "General Recommendation",
  "Limited Confidence",
];

export class RecommendationAnalyticsService {
  private readonly health = createEmptyAnalyticsHealth();

  constructor(
    private readonly store: RecommendationAnalyticsStore,
    private readonly options: { retentionDays?: number; now?: () => Date } = {},
  ) {}

  async record(input: RecommendationAnalyticsInput) {
    const startedAt = performanceNow();
    try {
      const eventType = normalizeEventType(input.eventType || input.event);
      if (!eventType) {
        throw new Error("Unsupported analytics event type");
      }
      const metadata = sanitizeMetadata(input.metadata || {});
      const installationId = stringField(input.installationId) || stringField(metadata.installationId);
      if (!installationId && !stringField(input.userId)) {
        throw new Error("Anonymous installation id is required");
      }
      const now = this.options.now?.() || new Date();
      const timestamp = safeTimestamp(input.timestamp, now);
      const event: RecommendationAnalyticsEvent = {
        eventId: stableId("analytics", [
          eventType,
          installationId,
          stringField(input.userId),
          metadata.sessionId,
          timestamp,
          metadata.merchant,
        ]),
        sessionId:
          stringField(input.sessionId) ||
          stringField(metadata.sessionId) ||
          sessionIdFor(installationId || stringField(input.userId) || "anonymous", metadata, timestamp),
        installationId: installationId || "server-user",
        userId: stringField(input.userId) || null,
        source: sourceFor(input.source),
        timestamp,
        expiresAt: addDays(timestamp, this.options.retentionDays ?? DEFAULT_RETENTION_DAYS),
        eventType,
        merchantName: merchantNameFor(metadata),
        merchantCategory: stringField(metadata.category) || stringField(metadata.merchantCategory) || null,
        checkoutStage: stringField(metadata.stage) || stringField(metadata.checkoutStage) || null,
        confidenceBand: confidenceBandFor(metadata),
        recommendationLatencyMs: numberField(metadata.recommendationLatencyMs),
        popupLatencyMs: numberField(metadata.popupLatencyMs),
        merchantClassificationLatencyMs: numberField(metadata.merchantClassificationLatencyMs),
        estimatedRewardValueUSD: centsField(metadata.estimatedRewardValueUSD),
        advantageOverRunnerUpUSD: centsField(metadata.advantageOverRunnerUpUSD),
        rewardType: rewardTypeFor(metadata),
        extensionVersion: versionField(metadata.extensionVersion),
        recommendationEngineVersion: versionField(metadata.recommendationEngineVersion),
        merchantRegistryVersion: versionField(metadata.merchantRegistryVersion),
        browserFamily: technicalLabel(metadata.browserFamily),
        operatingSystem: technicalLabel(metadata.operatingSystem),
        analyticsProcessingMs: 0,
        errorType: stringField(metadata.errorType),
        errorCode: stringField(metadata.errorCode),
        hasRecommendation: booleanField(metadata.hasRecommendation),
        popupVisible: booleanField(metadata.popupVisible),
        walletCardCount: integerField(metadata.walletCardCount),
      };
      event.analyticsProcessingMs = Math.max(0, Math.round((performanceNow() - startedAt) * 100) / 100);
      validatePrivacy(event);
      try {
        await this.store.insertEvent(event);
      } catch (error) {
        this.health.failedWrites += 1;
        throw error;
      }
      this.health.eventsReceived += 1;
      this.health.lastEventProcessingMs = event.analyticsProcessingMs;
      this.health.eventProcessingP95Ms = percentile(
        [...this.health.recentEventProcessingMs, event.analyticsProcessingMs],
        95,
      );
      this.health.recentEventProcessingMs = [...this.health.recentEventProcessingMs, event.analyticsProcessingMs].slice(-100);
      return event;
    } catch (error) {
      if (!(error instanceof Error) || !/insert|write|database|mongo/i.test(error.message)) {
        this.health.eventsRejected += 1;
      }
      if (error instanceof AnalyticsPrivacyError) this.health.privacyValidationFailures += 1;
      throw error;
    }
  }

  async cleanupExpired(now = this.options.now?.() || new Date()) {
    const startedAt = performanceNow();
    const deleted = await this.store.cleanupExpired(now);
    this.health.lastCleanupDurationMs = Math.max(0, Math.round((performanceNow() - startedAt) * 100) / 100);
    return deleted;
  }

  async summary(since = this.daysAgo(7)) {
    const events = await this.listRecent(since, "summary");
    const today = dateKey(this.options.now?.() || new Date());
    const weekStart = this.daysAgo(7);
    const recommendationsToday = events.filter(
      (event) => event.eventType === "recommendation_generated" && dateKey(new Date(event.timestamp)) === today,
    ).length;
    const recommendationsThisWeek = events.filter(
      (event) => event.eventType === "recommendation_generated" && new Date(event.timestamp) >= weekStart,
    ).length;
    const generated = countType(events, "recommendation_generated");
    const displayed = countType(events, "popup_displayed");
    const dismissed = countType(events, "popup_dismissed");
    return {
      activeBetaUsers: new Set(events.map((event) => event.installationId)).size,
      recommendationsToday,
      recommendationsThisWeek,
      recommendationSuccessRate: rate(generated, countType(events, "recommendation_requested")),
      popupDisplayRate: rate(displayed, generated),
      popupDismissalRate: rate(dismissed, displayed),
      detailsOpenRate: rate(countType(events, "details_opened"), displayed),
      averageRecommendationLatencyMs: average(events.map((event) => event.recommendationLatencyMs)),
      averagePopupLatencyMs: average(events.map((event) => event.popupLatencyMs)),
      timeToFirstRecommendationMs: timeToFirstRecommendation(events),
      analyticsProcessingP95Ms: percentile(events.map((event) => event.analyticsProcessingMs), 95),
      eventCount: events.length,
    };
  }

  async funnel(since = this.daysAgo(7)) {
    const events = await this.listRecent(since, "funnel");
    const stages: Array<{ eventType: RecommendationAnalyticsEventType; label: string }> = [
      { eventType: "extension_installed", label: "Extension Installed" },
      { eventType: "checkout_detected", label: "Checkout Detected" },
      { eventType: "merchant_classified", label: "Merchant Classified" },
      { eventType: "recommendation_requested", label: "Recommendation Requested" },
      { eventType: "recommendation_generated", label: "Recommendation Generated" },
      { eventType: "popup_displayed", label: "Popup Displayed" },
      { eventType: "recommendation_acknowledged", label: "Recommendation Acknowledged" },
      { eventType: "details_opened", label: "Details Viewed" },
      { eventType: "popup_dismissed", label: "Popup Dismissed" },
    ];
    return stages.map((stage, index) => {
      const count = countType(events, stage.eventType);
      const previousCount = index === 0 ? count : countType(events, stages[index - 1].eventType);
      return {
        ...stage,
        count,
        conversionFromPrevious: index === 0 ? 1 : rate(count, previousCount),
      };
    });
  }

  async merchants(since = this.daysAgo(7)) {
    const events = await this.listRecent(since, "merchants");
    const byMerchant = new Map<string, RecommendationAnalyticsEvent[]>();
    for (const event of events) {
      const key = event.merchantName || "Unknown merchant";
      byMerchant.set(key, [...(byMerchant.get(key) || []), event]);
    }
    return Array.from(byMerchant.entries())
      .map(([merchantName, merchantEvents]) => merchantHealthFor(merchantName, merchantEvents))
      .sort((a, b) => b.recommendationsGenerated - a.recommendationsGenerated || b.recommendationFailures - a.recommendationFailures);
  }

  async confidence(since = this.daysAgo(7)) {
    const events = await this.listRecent(since, "confidence");
    const recommendationEvents = events.filter((event) => event.eventType === "recommendation_generated");
    return CONFIDENCE_BANDS.map((band) => {
      const count = recommendationEvents.filter((event) => event.confidenceBand === band).length;
      return {
        confidenceBand: band,
        count,
        share: rate(count, recommendationEvents.length),
      };
    });
  }

  async errors(since = this.daysAgo(7)) {
    const events = await this.listRecent(since, "errors");
    const errorEvents = events.filter((event) =>
      ["recommendation_failed", "recommendation_timeout", "extension_communication_failed"].includes(event.eventType),
    );
    const byType = new Map<string, number>();
    for (const event of errorEvents) {
      const key = event.errorType || event.errorCode || event.eventType;
      byType.set(key, (byType.get(key) || 0) + 1);
    }
    return {
      total: errorEvents.length,
      apiFailures: errorEvents.filter((event) => event.errorType === "decision_request_failed").length,
      timeoutRate: rate(countType(events, "recommendation_timeout"), events.length),
      classificationFailures: errorEvents.filter((event) => event.errorType === "merchant_missing").length,
      extensionFailures: countType(events, "extension_communication_failed"),
      byType: Array.from(byType.entries()).map(([errorType, count]) => ({ errorType, count })),
    };
  }

  async recommendationValue(since = this.daysAgo(7)) {
    const events = await this.listRecent(since, "recommendationValue");
    const recommendations = events.filter((event) => event.eventType === "recommendation_generated");
    const rewardTypes = new Map<string, number>();
    for (const event of recommendations) {
      if (event.rewardType) rewardTypes.set(event.rewardType, (rewardTypes.get(event.rewardType) || 0) + 1);
    }
    const valueBuckets = [
      { label: "$0", min: 0, max: 0 },
      { label: "$0.01-$1", min: 0.01, max: 1 },
      { label: "$1-$5", min: 1.01, max: 5 },
      { label: "$5-$10", min: 5.01, max: 10 },
      { label: "$10+", min: 10.01, max: Number.POSITIVE_INFINITY },
    ];
    return {
      recommendationCount: recommendations.length,
      averageEstimatedRewardsDisplayedUSD: average(recommendations.map((event) => event.estimatedRewardValueUSD)),
      averageAdvantageOverSecondBestUSD: average(recommendations.map((event) => event.advantageOverRunnerUpUSD)),
      mostCommonRewardType: mostCommon(rewardTypes),
      rewardTypeDistribution: Array.from(rewardTypes.entries()).map(([rewardType, count]) => ({
        rewardType,
        count,
        share: rate(count, recommendations.length),
      })),
      valueDistribution: valueBuckets.map((bucket) => {
        const count = recommendations.filter((event) => {
          const value = event.estimatedRewardValueUSD;
          return typeof value === "number" && value >= bucket.min && value <= bucket.max;
        }).length;
        return { bucket: bucket.label, count, share: rate(count, recommendations.length) };
      }),
    };
  }

  async healthStatus(since = this.daysAgo(7)) {
    const events = await this.listRecent(since, "health");
    return {
      eventsReceived: this.health.eventsReceived,
      eventsRejected: this.health.eventsRejected,
      privacyValidationFailures: this.health.privacyValidationFailures,
      failedWrites: this.health.failedWrites,
      lastCleanupDurationMs: this.health.lastCleanupDurationMs,
      lastDashboardQueryLatencyMs: this.health.lastDashboardQueryLatencyMs,
      dashboardQueryP95Ms: percentile(this.health.recentDashboardQueryMs, 95),
      lastEventProcessingMs: this.health.lastEventProcessingMs,
      eventProcessingP95Ms: this.health.eventProcessingP95Ms,
      storedEventCountSample: events.length,
      analyticsErrorRate: rate(this.health.eventsRejected + this.health.failedWrites, this.health.eventsReceived + this.health.eventsRejected),
    };
  }

  private async listRecent(since: Date, _queryName = "dashboard") {
    const startedAt = performanceNow();
    try {
      const events = await this.store.listEvents(since);
      const latency = Math.max(0, Math.round((performanceNow() - startedAt) * 100) / 100);
      this.health.lastDashboardQueryLatencyMs = latency;
      this.health.recentDashboardQueryMs = [...this.health.recentDashboardQueryMs, latency].slice(-100);
      return events
      .slice(0, MAX_EVENTS_FOR_DASHBOARD)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw error;
    }
  }

  private daysAgo(days: number) {
    const current = this.options.now?.() || new Date();
    const date = new Date(current.getTime());
    date.setUTCDate(date.getUTCDate() - days);
    return date;
  }
}

export function createMongoRecommendationAnalyticsStore(collection: any): RecommendationAnalyticsStore {
  return {
    async insertEvent(event) {
      await collection.insertOne({ ...event, createdAt: new Date(event.timestamp), expiresAt: new Date(event.expiresAt) });
    },
    async listEvents(since) {
      const query = since ? { timestamp: { $gte: since.toISOString() } } : {};
      const cursor = collection.find(query).sort?.({ timestamp: -1 }).limit?.(MAX_EVENTS_FOR_DASHBOARD);
      const rows = cursor?.toArray ? await cursor.toArray() : await collection.find(query).toArray();
      return rows.map(normalizeStoredEvent).filter(Boolean);
    },
    async cleanupExpired(now = new Date()) {
      const result = await collection.deleteMany({ expiresAt: { $lte: now } });
      return result.deletedCount || 0;
    },
  };
}

export function createMemoryRecommendationAnalyticsStore(initial: RecommendationAnalyticsEvent[] = []): RecommendationAnalyticsStore & { events: RecommendationAnalyticsEvent[] } {
  const events = [...initial];
  return {
    events,
    async insertEvent(event) {
      events.push(event);
    },
    async listEvents(since) {
      return events.filter((event) => !since || new Date(event.timestamp) >= since);
    },
    async cleanupExpired(now = new Date()) {
      const before = events.length;
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (new Date(events[index].expiresAt) <= now) events.splice(index, 1);
      }
      return before - events.length;
    },
  };
}

function normalizeEventType(value?: string): RecommendationAnalyticsEventType | null {
  const key = String(value || "").trim();
  return EVENT_MAP[key] || null;
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const allowedKeys = [
    "sessionId",
    "merchant",
    "merchantName",
    "category",
    "merchantCategory",
    "stage",
    "checkoutStage",
    "confidenceBand",
    "confidenceLabel",
    "recommendationLatencyMs",
    "popupLatencyMs",
    "merchantClassificationLatencyMs",
    "estimatedRewardValueUSD",
    "advantageOverRunnerUpUSD",
    "rewardType",
    "extensionVersion",
    "recommendationEngineVersion",
    "merchantRegistryVersion",
    "browserFamily",
    "operatingSystem",
    "errorType",
    "errorCode",
    "hasRecommendation",
    "popupVisible",
    "walletCardCount",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    const value = metadata[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (containsSensitiveValue(String(value))) {
        throw new AnalyticsPrivacyError(`Analytics metadata contains sensitive value for ${key}`);
      }
      out[key] = value;
    }
  }
  return out;
}

function validatePrivacy(event: RecommendationAnalyticsEvent) {
  const serialized = JSON.stringify(event);
  if (containsSensitiveValue(serialized)) {
    throw new AnalyticsPrivacyError();
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

function merchantNameFor(metadata: Record<string, unknown>) {
  const value = stringField(metadata.merchantName) || stringField(metadata.merchant);
  if (!value) return null;
  if (/unknown/i.test(value)) return "Unknown merchant";
  return value.slice(0, 80);
}

function confidenceBandFor(metadata: Record<string, unknown>): RecommendationConfidenceBand | null {
  const raw = stringField(metadata.confidenceBand) || stringField(metadata.confidenceLabel);
  if (!raw) return null;
  const match = CONFIDENCE_BANDS.find((band) => band.toLowerCase() === raw.toLowerCase());
  if (match) return match;
  if (/excellent/i.test(raw)) return "Excellent Match";
  if (/high/i.test(raw)) return "High Confidence";
  if (/good|medium/i.test(raw)) return "Good Match";
  if (/general|low/i.test(raw)) return "General Recommendation";
  return "Limited Confidence";
}

function normalizeStoredEvent(row: any): RecommendationAnalyticsEvent | null {
  if (!row || !row.eventType) return null;
  return {
    ...row,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : new Date(row.timestamp || row.createdAt).toISOString(),
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : new Date(row.expiresAt).toISOString(),
  } as RecommendationAnalyticsEvent;
}

function sessionIdFor(identity: string, metadata: Record<string, unknown>, timestamp: string) {
  return stableId("session", [
    identity,
    merchantNameFor(metadata) || "unknown",
    stringField(metadata.stage) || "unknown",
    timestamp.slice(0, 10),
  ]);
}

function sourceFor(value?: string) {
  if (value === "chrome_extension" || value === "website" || value === "backend") return value;
  return "unknown";
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function centsField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

function rewardTypeFor(metadata: Record<string, unknown>) {
  const value = stringField(metadata.rewardType);
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z_ -]/g, "").trim().replace(/\s+/g, "_");
  if (
    [
      "cash_back",
      "points",
      "miles",
      "statement_credit",
      "portal_credit",
      "benefit",
      "unknown",
    ].includes(normalized)
  ) {
    return normalized;
  }
  return "unknown";
}

function versionField(value: unknown) {
  const text = stringField(value);
  if (!text) return null;
  return /^[a-z0-9._+-]{1,40}$/i.test(text) ? text : null;
}

function technicalLabel(value: unknown) {
  const text = stringField(value);
  if (!text) return null;
  return text.replace(/[^a-z0-9 ._-]/gi, "").slice(0, 60) || null;
}

function integerField(value: unknown) {
  const number = numberField(value);
  return number === null ? null : Math.round(number);
}

function booleanField(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function safeTimestamp(value: unknown, fallback: Date) {
  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}

function addDays(iso: string, days: number) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function countType(events: RecommendationAnalyticsEvent[], eventType: RecommendationAnalyticsEventType) {
  return events.filter((event) => event.eventType === eventType).length;
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 100) / 100;
}

function percentile(values: Array<number | null>, p: number) {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return 0;
  const index = Math.min(usable.length - 1, Math.ceil((p / 100) * usable.length) - 1);
  return usable[index];
}

function confidenceAverage(events: RecommendationAnalyticsEvent[]) {
  const values = events
    .map((event) => event.confidenceBand)
    .filter(Boolean)
    .map((band) => CONFIDENCE_BANDS.length - CONFIDENCE_BANDS.indexOf(band as RecommendationConfidenceBand));
  return average(values);
}

function confidenceScore(events: RecommendationAnalyticsEvent[]) {
  const values = events
    .map((event) => event.confidenceBand)
    .filter(Boolean)
    .map((band) => {
      const index = CONFIDENCE_BANDS.indexOf(band as RecommendationConfidenceBand);
      if (index < 0) return null;
      return 1 - index / (CONFIDENCE_BANDS.length - 1);
    })
    .filter((value): value is number => typeof value === "number");
  return average(values);
}

function merchantHealthFor(merchantName: string, merchantEvents: RecommendationAnalyticsEvent[]) {
  const recommendationsGenerated = countType(merchantEvents, "recommendation_generated");
  const requests = countType(merchantEvents, "recommendation_requested");
  const recommendationFailures = merchantEvents.filter((event) =>
    ["recommendation_failed", "recommendation_timeout", "extension_communication_failed"].includes(event.eventType),
  ).length;
  const successRate = rate(
    recommendationsGenerated,
    Math.max(requests, recommendationsGenerated + recommendationFailures),
  );
  const unknownMerchantRate = merchantName === "Unknown merchant" ? 1 : 0;
  const averageConfidenceScore = confidenceScore(merchantEvents);
  const averageRecommendationLatencyMs = average(merchantEvents.map((event) => event.recommendationLatencyMs));
  const extensionFailures = countType(merchantEvents, "extension_communication_failed");
  const failureRate = rate(recommendationFailures, merchantEvents.length);
  const latencyPenalty = Math.min(0.25, averageRecommendationLatencyMs / 10000);
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (successRate * 0.35 +
          (1 - unknownMerchantRate) * 0.2 +
          averageConfidenceScore * 0.2 +
          (1 - failureRate) * 0.15 +
          (1 - Math.min(1, extensionFailures / Math.max(1, merchantEvents.length))) * 0.05 +
          (1 - latencyPenalty) * 0.05) *
          100,
      ),
    ),
  );
  return {
    merchantName,
    healthScore,
    recommendationsGenerated,
    recommendationSuccessRate: successRate,
    popupSuccessRate: rate(countType(merchantEvents, "popup_displayed"), recommendationsGenerated),
    unknownMerchantRate,
    recommendationFailures,
    extensionCommunicationFailures: extensionFailures,
    averageConfidence: confidenceAverage(merchantEvents),
    averageConfidenceScore,
    averageRecommendationLatencyMs,
  };
}

function timeToFirstRecommendation(events: RecommendationAnalyticsEvent[]) {
  const installs = events.filter((event) => event.eventType === "extension_installed");
  const durations: number[] = [];
  for (const install of installs) {
    const firstRecommendation = events
      .filter(
        (event) =>
          event.installationId === install.installationId &&
          event.eventType === "recommendation_generated" &&
          new Date(event.timestamp) >= new Date(install.timestamp),
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    if (firstRecommendation) {
      durations.push(new Date(firstRecommendation.timestamp).getTime() - new Date(install.timestamp).getTime());
    }
  }
  return durations.length ? Math.round(average(durations)) : null;
}

function mostCommon(values: Map<string, number>) {
  let winner: { value: string; count: number } | null = null;
  for (const [value, count] of values.entries()) {
    if (!winner || count > winner.count) winner = { value, count };
  }
  return winner?.value || null;
}

function createEmptyAnalyticsHealth() {
  return {
    eventsReceived: 0,
    eventsRejected: 0,
    privacyValidationFailures: 0,
    failedWrites: 0,
    lastCleanupDurationMs: 0,
    lastDashboardQueryLatencyMs: 0,
    recentDashboardQueryMs: [] as number[],
    lastEventProcessingMs: 0,
    eventProcessingP95Ms: 0,
    recentEventProcessingMs: [] as number[],
  };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function performanceNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function stableId(prefix: string, parts: Array<unknown>) {
  const seed = parts.map((part) => String(part || "")).join("|");
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16)}`;
}
