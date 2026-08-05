import crypto from "crypto";
import {
  getUserPreferencesCollection,
  type UserPreferencesRecord,
} from "../db";

export const CONTEXT_SCHEMA_VERSION = "2026-08-05.1";
export const DECISION_POLICY_SCHEMA_VERSION = "2026-08-05.1";
export const PREFERENCES_SCHEMA_VERSION = "2026-08-05.1";

export type FinancialDecisionIntent =
  | "everyday_spending"
  | "travel"
  | "business"
  | "gift"
  | "emergency"
  | "reimbursable"
  | "subscription"
  | "home_improvement"
  | "unknown";

export type DecisionPolicyObjective =
  | "cash_back"
  | "travel_rewards"
  | "simplicity"
  | "purchase_protection"
  | "elite_status"
  | "lowest_cost"
  | "debt_avoidance"
  | "business_compliance"
  | "balanced";

export type CanonicalDecisionPolicy = {
  policyId: string;
  displayName: string;
  objective: DecisionPolicyObjective;
  priority: number;
  description: string;
  version: string;
};

export type CanonicalPreference = {
  preferenceId: string;
  type:
    | "prefer_issuer"
    | "avoid_card_type"
    | "avoid_annual_fee"
    | "prefer_reward_type"
    | "avoid_foreign_transaction_fee"
    | "prioritize_status"
    | "minimize_complexity";
  value: string | number | boolean;
  threshold?: number;
  strength: "soft" | "strong";
  source: "user" | "partner" | "default";
};

export type CanonicalConstraint = {
  constraintId: string;
  type:
    | "never_finance"
    | "no_personal_card_for_business"
    | "exclude_expired_benefits"
    | "exclude_inactive_cards"
    | "exclude_suspended_cards"
    | "partner_policy";
  value: string | number | boolean;
  severity: "hard" | "soft";
  source: "user" | "partner" | "platform";
};

export type CanonicalContext = {
  contextId: string;
  schemaVersion: string;
  purchase: {
    merchant: string | null;
    category: string | null;
    amount: number | null;
    currency: "USD";
    channel:
      | "online"
      | "in_store"
      | "mobile_app"
      | "subscription"
      | "marketplace"
      | "unknown";
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
    timestamp: string;
  };
  user: {
    walletCardSlugs: string[];
    preferences: CanonicalPreference[];
    constraints: CanonicalConstraint[];
    historySignals: string[];
  };
  financialIntent: {
    type: FinancialDecisionIntent;
    confidence: number;
    source: "user" | "inferred" | "default";
  };
  decisionPolicy: CanonicalDecisionPolicy;
  normalization: {
    warnings: string[];
    assumptions: string[];
  };
};

export type ContextValidationResult = {
  valid: boolean;
  context?: CanonicalContext;
  errors: Array<{ code: string; message: string; field?: string }>;
  warnings: string[];
};

export const DECISION_POLICIES: CanonicalDecisionPolicy[] = [
  {
    policyId: "balanced",
    displayName: "Balanced outcome",
    objective: "balanced",
    priority: 50,
    description:
      "Balance reward value, confidence, simplicity, and useful protections.",
    version: DECISION_POLICY_SCHEMA_VERSION,
  },
  {
    policyId: "maximize-cash-back",
    displayName: "Maximize cash back",
    objective: "cash_back",
    priority: 70,
    description:
      "Prefer the strongest cash-equivalent value when confidence is sufficient.",
    version: DECISION_POLICY_SCHEMA_VERSION,
  },
  {
    policyId: "maximize-travel-rewards",
    displayName: "Maximize travel rewards",
    objective: "travel_rewards",
    priority: 70,
    description: "Prefer transferable points, miles, and travel-aligned value.",
    version: DECISION_POLICY_SCHEMA_VERSION,
  },
  {
    policyId: "minimize-complexity",
    displayName: "Minimize complexity",
    objective: "simplicity",
    priority: 80,
    description:
      "Prefer simple, low-effort recommendations when value is close.",
    version: DECISION_POLICY_SCHEMA_VERSION,
  },
  {
    policyId: "debt-avoidance",
    displayName: "Avoid debt",
    objective: "debt_avoidance",
    priority: 100,
    description:
      "Avoid recommendations that encourage financing or unnecessary credit use.",
    version: DECISION_POLICY_SCHEMA_VERSION,
  },
];

export function normalizeDecisionContext(input: any): ContextValidationResult {
  const errors: ContextValidationResult["errors"] = [];
  const warnings: string[] = [];
  const purchase = input?.purchase || {};
  const amount =
    purchase.amount === undefined || purchase.amount === null
      ? null
      : Number(purchase.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    errors.push({
      code: "INVALID_CONTEXT",
      message: "purchase.amount must be a positive number when supplied.",
      field: "purchase.amount",
    });
  }
  const currency = cleanString(purchase.currency).toUpperCase() || "USD";
  if (currency !== "USD") {
    errors.push({
      code: "UNSUPPORTED_CONTEXT",
      message: "Context currently supports USD purchases only.",
      field: "purchase.currency",
    });
  }

  const policy = policyFor(input?.decisionPolicy || input?.policy);
  const preferences = normalizePreferences(input?.preferences || []);
  const constraints = normalizeConstraints(input?.constraints || []);
  const intent = normalizeIntent(input?.financialIntent || input?.intent);
  const walletCardSlugs = normalizeWalletCards(
    input?.wallet?.cards || input?.walletCardSlugs,
  );

  if (!cleanString(purchase.merchant || input?.merchant?.name)) {
    warnings.push("purchase merchant was not supplied in context.");
  }
  if (!walletCardSlugs.length) {
    warnings.push("context wallet scope is empty.");
  }

  if (errors.length) return { valid: false, errors, warnings };

  const context: CanonicalContext = {
    contextId: stableContextId({
      purchase,
      policy: policy.policyId,
      preferences,
      constraints,
      intent,
      walletCardSlugs,
    }),
    schemaVersion: CONTEXT_SCHEMA_VERSION,
    purchase: {
      merchant: cleanString(purchase.merchant || input?.merchant?.name) || null,
      category:
        cleanString(purchase.category || input?.merchant?.category) || null,
      amount,
      currency: "USD",
      channel: normalizeChannel(purchase.channel || input?.channel),
      location: normalizeLocation(purchase.location || input?.location),
      timestamp:
        parseTimestamp(purchase.timestamp || input?.timestamp) ||
        new Date().toISOString(),
    },
    user: {
      walletCardSlugs,
      preferences,
      constraints,
      historySignals: normalizeStringArray(input?.historySignals).slice(0, 20),
    },
    financialIntent: intent,
    decisionPolicy: policy,
    normalization: {
      warnings,
      assumptions: [
        "Context is normalized by Rewardly before decision infrastructure consumes it.",
        "Preferences and constraints are inputs to decision policy, not standalone recommendation logic.",
      ],
    },
  };
  return { valid: true, context, errors: [], warnings };
}

export async function getUserContext(userId: string) {
  const preferences = await getContextPreferences(userId);
  return normalizeDecisionContext({
    preferences: preferences.preferences,
    constraints: preferences.constraints,
    decisionPolicy: preferences.decisionPolicy,
    walletCardSlugs: [],
  }).context!;
}

export async function getContextPreferences(userId: string) {
  const collection = await getUserPreferencesCollection();
  const now = new Date();
  const existing = await collection.findOne({
    userId,
    deletedAt: { $in: [null, undefined] },
  } as any);
  const preferences = normalizePreferences(
    (existing as any)?.contextPreferences || [],
  );
  const constraints = normalizeConstraints(
    (existing as any)?.contextConstraints || [],
  );
  const decisionPolicy = policyFor(
    (existing as any)?.decisionPolicy || "balanced",
  );
  if (existing) {
    return publicContextPreferences(
      existing,
      preferences,
      constraints,
      decisionPolicy,
    );
  }
  const record: Partial<UserPreferencesRecord> & Record<string, unknown> = {
    userId,
    favoriteMerchants: [],
    theme: "system",
    defaultCurrency: "USD",
    onboardingCompleted: false,
    locationEnabled: false,
    contextPreferences: preferences,
    contextConstraints: constraints,
    decisionPolicy,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    syncRevision: 0,
    deletedAt: null,
  };
  await collection.insertOne(record as UserPreferencesRecord);
  return publicContextPreferences(
    record,
    preferences,
    constraints,
    decisionPolicy,
  );
}

export async function updateContextPreferences(userId: string, body: any) {
  const current = await getContextPreferences(userId);
  const preferences = Array.isArray(body?.preferences)
    ? normalizePreferences(body.preferences)
    : current.preferences;
  const constraints = Array.isArray(body?.constraints)
    ? normalizeConstraints(body.constraints)
    : current.constraints;
  const decisionPolicy =
    body?.decisionPolicy !== undefined
      ? policyFor(body.decisionPolicy)
      : current.decisionPolicy;
  const now = new Date();
  const collection = await getUserPreferencesCollection();
  await collection.updateOne(
    { userId },
    {
      $set: {
        contextPreferences: preferences,
        contextConstraints: constraints,
        decisionPolicy,
        updatedAt: now,
        syncRevision: (current.syncRevision || 0) + 1,
        schemaVersion: 1,
        deletedAt: null,
      },
      $setOnInsert: {
        userId,
        favoriteMerchants: [],
        theme: "system",
        defaultCurrency: "USD",
        onboardingCompleted: false,
        locationEnabled: false,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return {
    ...current,
    preferences,
    constraints,
    decisionPolicy,
    updatedAt: now.toISOString(),
    syncRevision: (current.syncRevision || 0) + 1,
  };
}

function publicContextPreferences(
  record: Partial<UserPreferencesRecord> & Record<string, unknown>,
  preferences: CanonicalPreference[],
  constraints: CanonicalConstraint[],
  decisionPolicy: CanonicalDecisionPolicy,
) {
  return {
    userId: String(record.userId || ""),
    preferences,
    constraints,
    decisionPolicy,
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    syncRevision: Number(record.syncRevision || 0),
    createdAt: dateString(record.createdAt) || new Date().toISOString(),
    updatedAt: dateString(record.updatedAt) || new Date().toISOString(),
  };
}

function normalizePreferences(input: unknown): CanonicalPreference[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => normalizePreference(item, index))
    .filter(Boolean)
    .slice(0, 50) as CanonicalPreference[];
}

function normalizePreference(
  input: any,
  index: number,
): CanonicalPreference | null {
  const type = normalizePreferenceType(input?.type);
  if (!type) return null;
  const value = scalarValue(input?.value);
  if (value === null) return null;
  return {
    preferenceId:
      cleanString(input?.preferenceId) || `pref_${index + 1}_${type}`,
    type,
    value,
    threshold: finiteNumber(input?.threshold),
    strength: input?.strength === "strong" ? "strong" : "soft",
    source: ["user", "partner", "default"].includes(input?.source)
      ? input.source
      : "user",
  };
}

function normalizeConstraints(input: unknown): CanonicalConstraint[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => normalizeConstraint(item, index))
    .filter(Boolean)
    .slice(0, 50) as CanonicalConstraint[];
}

function normalizeConstraint(
  input: any,
  index: number,
): CanonicalConstraint | null {
  const type = normalizeConstraintType(input?.type);
  if (!type) return null;
  return {
    constraintId:
      cleanString(input?.constraintId) || `cons_${index + 1}_${type}`,
    type,
    value: scalarValue(input?.value) ?? true,
    severity: input?.severity === "soft" ? "soft" : "hard",
    source: ["user", "partner", "platform"].includes(input?.source)
      ? input.source
      : "user",
  };
}

function normalizeIntent(input: any): CanonicalContext["financialIntent"] {
  const raw = cleanString(typeof input === "string" ? input : input?.type)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const allowed: FinancialDecisionIntent[] = [
    "everyday_spending",
    "travel",
    "business",
    "gift",
    "emergency",
    "reimbursable",
    "subscription",
    "home_improvement",
    "unknown",
  ];
  const type = allowed.includes(raw as FinancialDecisionIntent)
    ? (raw as FinancialDecisionIntent)
    : "unknown";
  return {
    type,
    confidence:
      finiteNumber(input?.confidence) ?? (type === "unknown" ? 0.4 : 0.9),
    source: ["user", "inferred", "default"].includes(input?.source)
      ? input.source
      : type === "unknown"
        ? "default"
        : "user",
  };
}

function policyFor(input: unknown): CanonicalDecisionPolicy {
  const requested = cleanString(
    typeof input === "string"
      ? input
      : (input as any)?.policyId || (input as any)?.objective,
  )
    .toLowerCase()
    .replace(/_/g, "-");
  const match = DECISION_POLICIES.find(
    (policy) =>
      policy.policyId === requested ||
      policy.objective.replace(/_/g, "-") === requested,
  );
  return match || DECISION_POLICIES[0];
}

function normalizePreferenceType(
  value: unknown,
): CanonicalPreference["type"] | null {
  const normalized = cleanString(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, CanonicalPreference["type"]> = {
    prefer_issuer: "prefer_issuer",
    avoid_card_type: "avoid_card_type",
    avoid_business_cards: "avoid_card_type",
    avoid_annual_fee: "avoid_annual_fee",
    prefer_reward_type: "prefer_reward_type",
    prefer_transferable_points: "prefer_reward_type",
    avoid_foreign_transaction_fee: "avoid_foreign_transaction_fee",
    prioritize_status: "prioritize_status",
    minimize_complexity: "minimize_complexity",
  };
  return aliases[normalized] || null;
}

function normalizeConstraintType(
  value: unknown,
): CanonicalConstraint["type"] | null {
  const normalized = cleanString(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, CanonicalConstraint["type"]> = {
    never_finance: "never_finance",
    no_personal_card_for_business: "no_personal_card_for_business",
    exclude_expired_benefits: "exclude_expired_benefits",
    exclude_inactive_cards: "exclude_inactive_cards",
    exclude_suspended_cards: "exclude_suspended_cards",
    partner_policy: "partner_policy",
  };
  return aliases[normalized] || null;
}

function normalizeWalletCards(input: unknown) {
  const values = Array.isArray(input)
    ? input.map((item: any) => item?.cardId || item?.cardSlug || item)
    : [];
  return Array.from(
    new Set(
      values
        .map((value) => cleanString(value).toLowerCase().replace(/_/g, "-"))
        .filter(Boolean),
    ),
  ).slice(0, 100);
}

function normalizeChannel(
  value: unknown,
): CanonicalContext["purchase"]["channel"] {
  const normalized = cleanString(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    [
      "online",
      "in_store",
      "mobile_app",
      "subscription",
      "marketplace",
    ].includes(normalized)
  ) {
    return normalized as CanonicalContext["purchase"]["channel"];
  }
  return "unknown";
}

function normalizeLocation(input: any) {
  if (!input || typeof input !== "object") return undefined;
  const location = {
    country: cleanString(input.country).toUpperCase() || undefined,
    region: cleanString(input.region).toUpperCase() || undefined,
    city: cleanString(input.city) || undefined,
  };
  return location.country || location.region || location.city
    ? location
    : undefined;
}

function parseTimestamp(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function scalarValue(value: unknown) {
  if (typeof value === "string") return cleanString(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return null;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeStringArray(input: unknown) {
  return Array.isArray(input) ? input.map(cleanString).filter(Boolean) : [];
}

function cleanString(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function dateString(value: unknown) {
  return value instanceof Date
    ? value.toISOString()
    : typeof value === "string"
      ? value
      : null;
}

function stableContextId(value: unknown) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 24);
  return `ctx_${hash}`;
}
