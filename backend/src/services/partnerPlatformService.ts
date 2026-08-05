import crypto from "crypto";
import {
  getPartnerApiKeysCollection,
  getPartnerOrganizationsCollection,
  getPartnerProjectsCollection,
  getPartnerUsageCollection,
  type PartnerApiKey,
  type PartnerOrganization,
  type PartnerProject,
} from "../db";
import { recordOperationalEvent } from "./privacyLogService";

export const PARTNER_PLATFORM_SCHEMA_VERSION = 1;
export const PARTNER_API_KEY_BYTES = 32;
export const PARTNER_API_KEY_SCOPES = [
  "decision.read",
  "decision.write",
  "wallet.read",
  "trust.read",
  "admin",
] as const;

export type PartnerApiKeyScope = (typeof PARTNER_API_KEY_SCOPES)[number];

export type PartnerContext = {
  organizationId: string;
  projectId: string;
  environment: PartnerProject["environment"];
  apiKeyId: string;
  scopes: PartnerApiKeyScope[];
  requestId: string;
  correlationId: string;
};

export class PartnerAuthError extends Error {
  constructor(
    public status: number,
    public code:
      | "PARTNER_AUTH_REQUIRED"
      | "PARTNER_INVALID_KEY"
      | "PARTNER_KEY_REVOKED"
      | "PARTNER_KEY_EXPIRED"
      | "PARTNER_ORGANIZATION_INACTIVE"
      | "PARTNER_PROJECT_INACTIVE"
      | "PARTNER_SCOPE_REQUIRED"
      | "PARTNER_RATE_LIMITED"
      | "PARTNER_VALIDATION_ERROR",
    message: string,
    public retryable = false,
    public details?: unknown,
  ) {
    super(message);
  }
}

type CreateOrganizationInput = {
  displayName: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdBy?: string | null;
};

type CreateProjectInput = {
  organizationId: string;
  displayName: string;
  environment?: PartnerProject["environment"];
  configuration?: Record<string, string | number | boolean | null>;
  createdBy?: string | null;
};

type CreateApiKeyInput = {
  organizationId: string;
  projectId: string;
  scopes?: PartnerApiKeyScope[];
  environment?: PartnerProject["environment"];
  expiresAt?: string | Date | null;
  metadata?: Record<string, string | number | boolean | null>;
  createdBy?: string | null;
};

const partnerRateWindows = new Map<
  string,
  { count: number; resetAt: number }
>();

export async function createPartnerOrganization(
  input: CreateOrganizationInput,
) {
  const displayName = cleanString(input.displayName, 160);
  if (!displayName) {
    throw new PartnerAuthError(
      400,
      "PARTNER_VALIDATION_ERROR",
      "organization displayName is required.",
    );
  }
  const now = new Date();
  const organization: PartnerOrganization = {
    organizationId: `org_${crypto.randomUUID()}`,
    displayName,
    status: "active",
    metadata: sanitizeMetadata(input.metadata),
    createdAt: now,
    updatedAt: now,
    createdBy: cleanString(input.createdBy, 160) || null,
    schemaVersion: PARTNER_PLATFORM_SCHEMA_VERSION,
  };
  await (await getPartnerOrganizationsCollection()).insertOne(organization);
  return publicOrganization(organization);
}

export async function createPartnerProject(input: CreateProjectInput) {
  const organization = await getActiveOrganization(input.organizationId);
  const displayName = cleanString(input.displayName, 160);
  if (!displayName) {
    throw new PartnerAuthError(
      400,
      "PARTNER_VALIDATION_ERROR",
      "project displayName is required.",
    );
  }
  const now = new Date();
  const project: PartnerProject = {
    projectId: `prj_${crypto.randomUUID()}`,
    organizationId: organization.organizationId,
    displayName,
    environment: normalizeEnvironment(input.environment),
    status: "active",
    configuration: sanitizeMetadata(input.configuration),
    createdAt: now,
    updatedAt: now,
    createdBy: cleanString(input.createdBy, 160) || null,
    schemaVersion: PARTNER_PLATFORM_SCHEMA_VERSION,
  };
  await (await getPartnerProjectsCollection()).insertOne(project);
  return publicProject(project);
}

export async function createPartnerApiKey(input: CreateApiKeyInput) {
  const project = await getActiveProject(input.organizationId, input.projectId);
  const environment = input.environment
    ? normalizeEnvironment(input.environment)
    : project.environment;
  const plaintextKey = generateApiKey(environment);
  const now = new Date();
  const apiKey: PartnerApiKey = {
    apiKeyId: `key_${crypto.randomUUID()}`,
    organizationId: project.organizationId,
    projectId: project.projectId,
    environment,
    keyPrefix: environment === "live" ? "rw_live" : "rw_test",
    keyHash: hashApiKey(plaintextKey),
    keyPreview: previewKey(plaintextKey),
    scopes: normalizeScopes(input.scopes),
    status: "active",
    metadata: sanitizeMetadata(input.metadata),
    createdAt: now,
    updatedAt: now,
    createdBy: cleanString(input.createdBy, 160) || null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    revokedAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    schemaVersion: PARTNER_PLATFORM_SCHEMA_VERSION,
  };
  await (await getPartnerApiKeysCollection()).insertOne(apiKey);
  return {
    apiKey: publicApiKey(apiKey),
    plaintextKey,
  };
}

export async function rotatePartnerApiKey(
  apiKeyId: string,
  actor?: string | null,
) {
  const collection = await getPartnerApiKeysCollection();
  const existing = await collection.findOne({ apiKeyId });
  if (!existing) {
    throw new PartnerAuthError(
      404,
      "PARTNER_INVALID_KEY",
      "API key not found.",
    );
  }
  const plaintextKey = generateApiKey(existing.environment);
  const now = new Date();
  await collection.updateOne(
    { apiKeyId },
    {
      $set: {
        keyHash: hashApiKey(plaintextKey),
        keyPreview: previewKey(plaintextKey),
        updatedAt: now,
        lastRotatedAt: now,
        status: "active",
        revokedAt: null,
        metadata: {
          ...(existing.metadata || {}),
          rotatedBy: cleanString(actor, 160) || null,
        },
      },
    },
  );
  return {
    apiKey: publicApiKey({
      ...existing,
      keyHash: hashApiKey(plaintextKey),
      keyPreview: previewKey(plaintextKey),
      updatedAt: now,
      lastRotatedAt: now,
      status: "active",
      revokedAt: null,
    }),
    plaintextKey,
  };
}

export async function revokePartnerApiKey(apiKeyId: string) {
  const now = new Date();
  const result = await (
    await getPartnerApiKeysCollection()
  ).updateOne(
    { apiKeyId },
    { $set: { status: "revoked", revokedAt: now, updatedAt: now } },
  );
  return { revoked: result.matchedCount > 0 };
}

export async function authenticatePartnerApiKey(
  authorizationHeader?: string,
  requiredScopes: PartnerApiKeyScope[] = [],
  requestId = createPartnerRequestId(),
  correlationId = requestId,
): Promise<PartnerContext> {
  const plaintextKey = extractApiKey(authorizationHeader);
  if (!plaintextKey) {
    throw new PartnerAuthError(
      401,
      "PARTNER_AUTH_REQUIRED",
      "A Rewardly API key is required.",
    );
  }
  const collection = await getPartnerApiKeysCollection();
  const apiKey = await collection.findOne({
    keyHash: hashApiKey(plaintextKey),
  });
  if (!apiKey) {
    recordOperationalEvent({
      event: "partner.auth_failed",
      requestId,
      metadata: {
        reason: "key_not_found",
        keyPreview: previewKey(plaintextKey),
      },
    });
    throw new PartnerAuthError(
      401,
      "PARTNER_INVALID_KEY",
      "API key is invalid.",
    );
  }
  validateApiKeyState(apiKey);
  validateScopes(apiKey.scopes as PartnerApiKeyScope[], requiredScopes);
  const [organization, project] = await Promise.all([
    getActiveOrganization(apiKey.organizationId),
    getActiveProject(apiKey.organizationId, apiKey.projectId),
  ]);
  await collection.updateOne(
    { apiKeyId: apiKey.apiKeyId },
    { $set: { lastUsedAt: new Date(), updatedAt: new Date() } },
  );
  return {
    organizationId: organization.organizationId,
    projectId: project.projectId,
    environment: apiKey.environment,
    apiKeyId: apiKey.apiKeyId,
    scopes: apiKey.scopes as PartnerApiKeyScope[],
    requestId,
    correlationId,
  };
}

export function checkPartnerRateLimit(
  context: PartnerContext,
  bucket:
    "production" | "sandbox" | "replay" | "admin" | "health" = "production",
) {
  const limits = partnerRateLimitFor(context.environment, bucket);
  const now = Date.now();
  const keys = [
    `org:${context.organizationId}:${bucket}`,
    `project:${context.projectId}:${bucket}`,
    `key:${context.apiKeyId}:${bucket}`,
  ];
  for (const key of keys) {
    const current = partnerRateWindows.get(key);
    if (!current || current.resetAt <= now) {
      partnerRateWindows.set(key, {
        count: 1,
        resetAt: now + limits.windowMs,
      });
      continue;
    }
    current.count += 1;
    if (current.count > limits.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetAt - now) / 1000),
        ),
      };
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordPartnerUsage(input: {
  context: PartnerContext;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  decisionCount?: number;
  replayCount?: number;
  errorCount?: number;
  rateLimitViolationCount?: number;
}) {
  const record = {
    usageRecordId: `usg_${crypto.randomUUID()}`,
    organizationId: input.context.organizationId,
    projectId: input.context.projectId,
    environment: input.context.environment,
    apiKeyId: input.context.apiKeyId,
    requestId: input.context.requestId,
    correlationId: input.context.correlationId,
    endpoint: input.endpoint,
    method: input.method,
    statusCode: input.statusCode,
    requestCount: 1,
    decisionCount: input.decisionCount || 0,
    replayCount: input.replayCount || 0,
    errorCount: input.errorCount || 0,
    rateLimitViolationCount: input.rateLimitViolationCount || 0,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    createdAt: new Date(),
    schemaVersion: PARTNER_PLATFORM_SCHEMA_VERSION,
  };
  await (await getPartnerUsageCollection()).insertOne(record);
  return record;
}

export async function getPartnerUsageSummary(
  organizationId: string,
  projectId?: string,
) {
  const query = {
    organizationId,
    ...(projectId ? { projectId } : {}),
  };
  const records = await (
    await getPartnerUsageCollection()
  )
    .find(query)
    .toArray();
  return {
    organizationId,
    projectId: projectId || null,
    requestCount: sum(records, "requestCount"),
    decisionCount: sum(records, "decisionCount"),
    replayCount: sum(records, "replayCount"),
    errorCount: sum(records, "errorCount"),
    rateLimitViolationCount: sum(records, "rateLimitViolationCount"),
    averageLatencyMs: records.length
      ? Math.round(sum(records, "latencyMs") / records.length)
      : 0,
  };
}

export async function ensurePartnerPlatformIndexes() {
  const [organizations, projects, apiKeys, usage] = await Promise.all([
    getPartnerOrganizationsCollection(),
    getPartnerProjectsCollection(),
    getPartnerApiKeysCollection(),
    getPartnerUsageCollection(),
  ]);
  await Promise.all([
    organizations.createIndex({ organizationId: 1 }, { unique: true }),
    organizations.createIndex({ status: 1, createdAt: -1 }),
    projects.createIndex({ projectId: 1 }, { unique: true }),
    projects.createIndex({ organizationId: 1, environment: 1, status: 1 }),
    apiKeys.createIndex({ apiKeyId: 1 }, { unique: true }),
    apiKeys.createIndex({ keyHash: 1 }, { unique: true }),
    apiKeys.createIndex({ organizationId: 1, projectId: 1, status: 1 }),
    usage.createIndex({ organizationId: 1, projectId: 1, createdAt: -1 }),
    usage.createIndex({ apiKeyId: 1, createdAt: -1 }),
  ]);
}

export function publicOrganization(organization: PartnerOrganization) {
  return {
    organizationId: organization.organizationId,
    displayName: organization.displayName,
    status: organization.status,
    metadata: organization.metadata,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    schemaVersion: organization.schemaVersion,
  };
}

export function publicProject(project: PartnerProject) {
  return {
    projectId: project.projectId,
    organizationId: project.organizationId,
    displayName: project.displayName,
    environment: project.environment,
    status: project.status,
    configuration: project.configuration,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    schemaVersion: project.schemaVersion,
  };
}

export function publicApiKey(apiKey: PartnerApiKey) {
  return {
    apiKeyId: apiKey.apiKeyId,
    organizationId: apiKey.organizationId,
    projectId: apiKey.projectId,
    environment: apiKey.environment,
    keyPrefix: apiKey.keyPrefix,
    keyPreview: apiKey.keyPreview,
    scopes: apiKey.scopes,
    status: apiKey.status,
    metadata: apiKey.metadata,
    createdAt: apiKey.createdAt.toISOString(),
    updatedAt: apiKey.updatedAt.toISOString(),
    createdBy: apiKey.createdBy || null,
    expiresAt: apiKey.expiresAt?.toISOString() || null,
    revokedAt: apiKey.revokedAt?.toISOString() || null,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
    lastRotatedAt: apiKey.lastRotatedAt?.toISOString() || null,
    schemaVersion: apiKey.schemaVersion,
  };
}

async function getActiveOrganization(organizationId: string) {
  const organization = await (
    await getPartnerOrganizationsCollection()
  ).findOne({
    organizationId,
  });
  if (!organization || organization.status === "deleted") {
    throw new PartnerAuthError(
      401,
      "PARTNER_ORGANIZATION_INACTIVE",
      "Organization is unavailable.",
    );
  }
  if (organization.status === "suspended") {
    throw new PartnerAuthError(
      403,
      "PARTNER_ORGANIZATION_INACTIVE",
      "Organization is suspended.",
    );
  }
  return organization;
}

async function getActiveProject(organizationId: string, projectId: string) {
  const project = await (
    await getPartnerProjectsCollection()
  ).findOne({
    organizationId,
    projectId,
  });
  if (!project || project.status === "deleted") {
    throw new PartnerAuthError(
      401,
      "PARTNER_PROJECT_INACTIVE",
      "Project is unavailable.",
    );
  }
  if (project.status === "suspended") {
    throw new PartnerAuthError(
      403,
      "PARTNER_PROJECT_INACTIVE",
      "Project is suspended.",
    );
  }
  return project;
}

function validateApiKeyState(apiKey: PartnerApiKey) {
  if (apiKey.status === "revoked") {
    throw new PartnerAuthError(
      401,
      "PARTNER_KEY_REVOKED",
      "API key is revoked.",
    );
  }
  if (
    apiKey.status === "expired" ||
    (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now())
  ) {
    throw new PartnerAuthError(401, "PARTNER_KEY_EXPIRED", "API key expired.");
  }
}

function validateScopes(
  scopes: PartnerApiKeyScope[],
  required: PartnerApiKeyScope[],
) {
  if (!required.length || scopes.includes("admin")) return;
  const missing = required.filter((scope) => !scopes.includes(scope));
  if (missing.length) {
    throw new PartnerAuthError(
      403,
      "PARTNER_SCOPE_REQUIRED",
      "API key does not have the required scope.",
      false,
      { requiredScopes: missing },
    );
  }
}

function normalizeScopes(scopes: unknown): PartnerApiKeyScope[] {
  const requested = Array.isArray(scopes)
    ? scopes.map(String)
    : ["decision.write", "trust.read"];
  const normalized = requested.filter((scope): scope is PartnerApiKeyScope =>
    (PARTNER_API_KEY_SCOPES as readonly string[]).includes(scope),
  );
  return Array.from(
    new Set(normalized.length ? normalized : ["decision.write"]),
  );
}

function normalizeEnvironment(value: unknown): PartnerProject["environment"] {
  const normalized = cleanString(value, 40).toLowerCase();
  if (normalized === "live" || normalized === "production") return "live";
  if (normalized === "sandbox") return "sandbox";
  if (normalized === "development" || normalized === "dev")
    return "development";
  return "test";
}

function generateApiKey(environment: PartnerProject["environment"]) {
  const prefix = environment === "live" ? "rw_live" : "rw_test";
  return `${prefix}_${crypto.randomBytes(PARTNER_API_KEY_BYTES).toString("base64url")}`;
}

export function hashApiKey(value: string) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function previewKey(value: string) {
  const parts = value.split("_");
  return `${parts[0]}_${parts[1]}_...${value.slice(-6)}`;
}

function extractApiKey(authorizationHeader?: string) {
  const header = String(authorizationHeader || "").trim();
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  const raw = header.match(/^ApiKey\s+(.+)$/i)?.[1]?.trim();
  return raw || "";
}

function partnerRateLimitFor(
  environment: PartnerProject["environment"],
  bucket: "production" | "sandbox" | "replay" | "admin" | "health",
) {
  const defaultLimit =
    bucket === "replay"
      ? 20
      : bucket === "admin"
        ? 60
        : environment === "live"
          ? 300
          : 120;
  const defaultWindowMs = 60_000;
  const prefix = `REWARDLY_PARTNER_RATE_LIMIT_${bucket.toUpperCase()}`;
  return {
    limit: positiveInt(process.env[`${prefix}_COUNT`], defaultLimit),
    windowMs: positiveInt(process.env[`${prefix}_WINDOW_MS`], defaultWindowMs),
  };
}

function createPartnerRequestId() {
  return `req_${crypto.randomUUID()}`;
}

function sanitizeMetadata(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input).slice(0, 50)) {
    const cleanKey = cleanString(key, 80);
    if (!cleanKey || /token|secret|password|key/i.test(cleanKey)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      output[cleanKey] =
        typeof value === "string" ? cleanString(value, 500) : value;
    }
  }
  return output;
}

function cleanString(value: unknown, maxLength = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sum(records: any[], key: string) {
  return records.reduce((total, record) => total + Number(record[key] || 0), 0);
}
