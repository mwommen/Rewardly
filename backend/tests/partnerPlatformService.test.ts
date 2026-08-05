jest.mock("../src/db", () => ({
  getPartnerOrganizationsCollection: jest.fn(),
  getPartnerProjectsCollection: jest.fn(),
  getPartnerApiKeysCollection: jest.fn(),
  getPartnerUsageCollection: jest.fn(),
}));

import {
  getPartnerApiKeysCollection,
  getPartnerOrganizationsCollection,
  getPartnerProjectsCollection,
  getPartnerUsageCollection,
} from "../src/db";
import {
  authenticatePartnerApiKey,
  createPartnerApiKey,
  createPartnerOrganization,
  createPartnerProject,
  getPartnerUsageSummary,
  PartnerAuthError,
  recordPartnerUsage,
  revokePartnerApiKey,
  rotatePartnerApiKey,
} from "../src/services/partnerPlatformService";

const mockedOrganizations = getPartnerOrganizationsCollection as jest.Mock;
const mockedProjects = getPartnerProjectsCollection as jest.Mock;
const mockedApiKeys = getPartnerApiKeysCollection as jest.Mock;
const mockedUsage = getPartnerUsageCollection as jest.Mock;

let organizations: ReturnType<typeof memoryCollection>;
let projects: ReturnType<typeof memoryCollection>;
let apiKeys: ReturnType<typeof memoryCollection>;
let usage: ReturnType<typeof memoryCollection>;

beforeEach(() => {
  organizations = memoryCollection();
  projects = memoryCollection();
  apiKeys = memoryCollection();
  usage = memoryCollection();
  mockedOrganizations.mockResolvedValue(organizations as any);
  mockedProjects.mockResolvedValue(projects as any);
  mockedApiKeys.mockResolvedValue(apiKeys as any);
  mockedUsage.mockResolvedValue(usage as any);
});

describe("partnerPlatformService", () => {
  test("creates organizations, projects, and one-time plaintext API keys", async () => {
    const organization = await createPartnerOrganization({
      displayName: "Acme",
    });
    const project = await createPartnerProject({
      organizationId: organization.organizationId,
      displayName: "Sandbox",
      environment: "sandbox",
    });
    const created = await createPartnerApiKey({
      organizationId: organization.organizationId,
      projectId: project.projectId,
      scopes: ["decision.write", "trust.read"],
    });

    expect(created.plaintextKey).toMatch(/^rw_test_/);
    expect(created.apiKey.keyPreview).toMatch(/^rw_test_\.\.\./);
    expect(apiKeys.docs[0].keyHash).toHaveLength(64);
    expect(JSON.stringify(apiKeys.docs)).not.toContain(created.plaintextKey);
  });

  test("authenticates API keys and attaches tenant context", async () => {
    const { organization, project, plaintextKey } = await seededKey();

    const context = await authenticatePartnerApiKey(
      `Bearer ${plaintextKey}`,
      ["decision.write"],
      "req_1",
      "corr_1",
    );

    expect(context).toMatchObject({
      organizationId: organization.organizationId,
      projectId: project.projectId,
      environment: "sandbox",
      requestId: "req_1",
      correlationId: "corr_1",
    });
    expect(apiKeys.docs[0].lastUsedAt).toBeInstanceOf(Date);
  });

  test("rejects missing, invalid, revoked, expired, and missing-scope keys", async () => {
    await expect(authenticatePartnerApiKey()).rejects.toMatchObject({
      code: "PARTNER_AUTH_REQUIRED",
    });
    await expect(
      authenticatePartnerApiKey("Bearer rw_test_nope"),
    ).rejects.toMatchObject({
      code: "PARTNER_INVALID_KEY",
    });
    const { plaintextKey } = await seededKey({ scopes: ["decision.write"] });
    await expect(
      authenticatePartnerApiKey(`Bearer ${plaintextKey}`, ["admin"]),
    ).rejects.toMatchObject({ code: "PARTNER_SCOPE_REQUIRED" });

    apiKeys.docs[0].expiresAt = new Date(Date.now() - 1000);
    await expect(
      authenticatePartnerApiKey(`Bearer ${plaintextKey}`),
    ).rejects.toMatchObject({
      code: "PARTNER_KEY_EXPIRED",
    });

    apiKeys.docs[0].expiresAt = null;
    await revokePartnerApiKey(apiKeys.docs[0].apiKeyId);
    await expect(
      authenticatePartnerApiKey(`Bearer ${plaintextKey}`),
    ).rejects.toMatchObject({
      code: "PARTNER_KEY_REVOKED",
    });
  });

  test("rotation replaces hash and displays plaintext only once", async () => {
    const { plaintextKey } = await seededKey();
    const oldHash = apiKeys.docs[0].keyHash;
    const rotated = await rotatePartnerApiKey(apiKeys.docs[0].apiKeyId, "ops");

    expect(rotated.plaintextKey).toMatch(/^rw_test_/);
    expect(rotated.plaintextKey).not.toBe(plaintextKey);
    expect(apiKeys.docs[0].keyHash).not.toBe(oldHash);
    await expect(
      authenticatePartnerApiKey(`Bearer ${plaintextKey}`),
    ).rejects.toMatchObject({
      code: "PARTNER_INVALID_KEY",
    });
    await expect(
      authenticatePartnerApiKey(`Bearer ${rotated.plaintextKey}`),
    ).resolves.toBeTruthy();
  });

  test("usage is scoped to organization and project", async () => {
    const first = await seededKey();
    const second = await seededKey({ orgName: "Other", projectName: "Prod" });
    await recordPartnerUsage({
      context: await authenticatePartnerApiKey(`Bearer ${first.plaintextKey}`),
      endpoint: "/api/v1/partner/payment-decisions",
      method: "POST",
      statusCode: 200,
      latencyMs: 12,
      decisionCount: 1,
    });
    await recordPartnerUsage({
      context: await authenticatePartnerApiKey(`Bearer ${second.plaintextKey}`),
      endpoint: "/api/v1/partner/payment-decisions",
      method: "POST",
      statusCode: 500,
      latencyMs: 18,
      errorCount: 1,
    });

    const summary = await getPartnerUsageSummary(
      first.organization.organizationId,
    );

    expect(summary.requestCount).toBe(1);
    expect(summary.decisionCount).toBe(1);
    expect(summary.errorCount).toBe(0);
  });
});

async function seededKey(
  input: {
    orgName?: string;
    projectName?: string;
    scopes?: any[];
  } = {},
) {
  const organization = await createPartnerOrganization({
    displayName: input.orgName || "Acme",
  });
  const project = await createPartnerProject({
    organizationId: organization.organizationId,
    displayName: input.projectName || "Sandbox",
    environment: "sandbox",
  });
  const created = await createPartnerApiKey({
    organizationId: organization.organizationId,
    projectId: project.projectId,
    scopes: input.scopes || ["decision.write", "trust.read", "admin"],
  });
  return { organization, project, plaintextKey: created.plaintextKey };
}

function memoryCollection(seed: any[] = []) {
  const docs = seed.map((doc) => ({ ...doc }));
  return {
    docs,
    findOne: jest.fn(
      async (query: any) => docs.find((doc) => matches(doc, query)) || null,
    ),
    insertOne: jest.fn(async (doc: any) => {
      docs.push(doc);
      return {
        insertedId:
          doc.organizationId ||
          doc.projectId ||
          doc.apiKeyId ||
          doc.usageRecordId ||
          docs.length,
      };
    }),
    updateOne: jest.fn(async (query: any, update: any) => {
      const index = docs.findIndex((doc) => matches(doc, query));
      if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
      docs[index] = { ...docs[index], ...(update.$set || {}) };
      return { matchedCount: 1, modifiedCount: 1 };
    }),
    createIndex: jest.fn(async () => "idx"),
    find: jest.fn((query: any = {}) => {
      const found = docs.filter((doc) => matches(doc, query));
      return { toArray: async () => found };
    }),
  };
}

function matches(doc: any, query: any): boolean {
  return Object.entries(query || {}).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const expression = expected as any;
      if ("$in" in expression) return expression.$in.includes(actual);
      if ("$ne" in expression) return actual !== expression.$ne;
    }
    return actual === expected;
  });
}
