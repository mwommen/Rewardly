jest.mock("../src/db", () => ({
  getPartnerOrganizationsCollection: jest.fn(),
  getPartnerProjectsCollection: jest.fn(),
  getPartnerApiKeysCollection: jest.fn(),
  getPartnerUsageCollection: jest.fn(),
}));

jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

import partnerRouter from "../src/routes/v1/partnerRoutes";
import paymentRouter from "../src/routes/v1/paymentDecisionRoutes";
import {
  getPartnerApiKeysCollection,
  getPartnerOrganizationsCollection,
  getPartnerProjectsCollection,
  getPartnerUsageCollection,
} from "../src/db";
import { decidePayment } from "../src/services/paymentDecisionService";
import { resetTrustInfrastructureForTests } from "../src/services/trustInfrastructureService";

const mockedOrganizations = getPartnerOrganizationsCollection as jest.Mock;
const mockedProjects = getPartnerProjectsCollection as jest.Mock;
const mockedApiKeys = getPartnerApiKeysCollection as jest.Mock;
const mockedUsage = getPartnerUsageCollection as jest.Mock;
const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

let organizations: ReturnType<typeof memoryCollection>;
let projects: ReturnType<typeof memoryCollection>;
let apiKeys: ReturnType<typeof memoryCollection>;
let usage: ReturnType<typeof memoryCollection>;

beforeEach(() => {
  process.env.REWARDLY_PARTNER_ADMIN_TOKEN = "admin-secret";
  resetTrustInfrastructureForTests();
  organizations = memoryCollection();
  projects = memoryCollection();
  apiKeys = memoryCollection();
  usage = memoryCollection();
  mockedOrganizations.mockResolvedValue(organizations as any);
  mockedProjects.mockResolvedValue(projects as any);
  mockedApiKeys.mockResolvedValue(apiKeys as any);
  mockedUsage.mockResolvedValue(usage as any);
  mockedDecidePayment.mockResolvedValue(mockDecision());
});

afterEach(() => {
  delete process.env.REWARDLY_PARTNER_ADMIN_TOKEN;
  jest.clearAllMocks();
});

describe("partnerRoutes", () => {
  test("bootstrap administration requires the configured admin token", async () => {
    const rejected = await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/organizations",
      {
        displayName: "Acme",
      },
    );

    expect(rejected.statusCode).toBe(401);
    expect(rejected.body.error.code).toBe("PARTNER_ADMIN_REQUIRED");

    const accepted = await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/organizations",
      { displayName: "Acme" },
      { "x-rewardly-admin-token": "admin-secret" },
    );

    expect(accepted.statusCode).toBe(201);
    expect(accepted.body.organization.organizationId).toMatch(/^org_/);
  });

  test("creates a one-time plaintext partner key without storing the secret", async () => {
    const seeded = await seedPartner();

    expect(seeded.key.plaintextKey).toMatch(/^rw_test_/);
    expect(JSON.stringify(apiKeys.docs)).not.toContain(seeded.key.plaintextKey);
    expect(apiKeys.docs[0].keyHash).toHaveLength(64);
    expect(apiKeys.docs[0].keyPreview).toMatch(/^rw_test_\.\.\./);
  });

  test("partner payment decisions require a scoped API key and attach tenant metadata", async () => {
    const seeded = await seedPartner();

    const res = await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/payment-decisions",
      {
        merchant: { name: "Amazon", category: "online_retail" },
        purchase: { amount: 142.83, currency: "USD" },
        wallet: { cards: [{ cardId: "capital_one_venture" }] },
      },
      {
        authorization: `Bearer ${seeded.key.plaintextKey}`,
        "x-correlation-id": "corr_partner_test",
      },
    );

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: "Amazon",
        manualCardSlugs: ["capital-one-venture"],
        restrictToWallet: true,
        context: expect.objectContaining({
          tenant: {
            organizationId: seeded.organization.organizationId,
            projectId: seeded.project.projectId,
            environment: "sandbox",
          },
        }),
      }),
    );
    expect(res.body.metadata).toEqual(
      expect.objectContaining({
        correlationId: "corr_partner_test",
        organizationId: seeded.organization.organizationId,
        projectId: seeded.project.projectId,
        environment: "sandbox",
      }),
    );
    expect(res.body.trust).toEqual(
      expect.objectContaining({
        trustRecordId: expect.stringMatching(/^trst_/),
      }),
    );
  });

  test("partner payment decisions reject missing keys and missing scopes", async () => {
    const missing = await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/payment-decisions",
      validDecisionBody(),
    );
    expect(missing.statusCode).toBe(401);
    expect(missing.body.error.code).toBe("PARTNER_AUTH_REQUIRED");

    const seeded = await seedPartner({ scopes: ["trust.read"] });
    const scoped = await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/payment-decisions",
      validDecisionBody(),
      { authorization: `Bearer ${seeded.key.plaintextKey}` },
    );

    expect(scoped.statusCode).toBe(403);
    expect(scoped.body.error.code).toBe("PARTNER_SCOPE_REQUIRED");
  });

  test("revoked partner keys cannot access tenant-scoped APIs", async () => {
    const seeded = await seedPartner();
    const revoked = await invokeRoute(
      partnerRouter,
      "POST",
      `/partner/api-keys/${seeded.key.apiKey.apiKeyId}/revoke`,
      {},
      { "x-rewardly-admin-token": "admin-secret" },
    );

    expect(revoked.statusCode).toBe(200);

    const res = await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/payment-decisions",
      validDecisionBody(),
      { authorization: `Bearer ${seeded.key.plaintextKey}` },
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("PARTNER_KEY_REVOKED");
  });

  test("admin usage endpoint is tenant-scoped", async () => {
    const first = await seedPartner();
    const second = await seedPartner({ orgName: "Other Partner" });

    await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/payment-decisions",
      validDecisionBody(),
      { authorization: `Bearer ${first.key.plaintextKey}` },
    );
    await invokeRoute(
      partnerRouter,
      "POST",
      "/partner/payment-decisions",
      validDecisionBody(),
      { authorization: `Bearer ${second.key.plaintextKey}` },
    );

    const usageResponse = await invokeRoute(
      partnerRouter,
      "GET",
      "/partner/usage",
      undefined,
      { authorization: `Bearer ${first.key.plaintextKey}` },
    );

    expect(usageResponse.statusCode).toBe(200);
    expect(usageResponse.body.usage.organizationId).toBe(
      first.organization.organizationId,
    );
    expect(usageResponse.body.usage.requestCount).toBe(1);
  });

  test("OpenAPI includes partner platform paths and security schemes", async () => {
    const res = await invokeRoute(paymentRouter, "GET", "/openapi.json");

    expect(res.statusCode).toBe(200);
    expect(res.body.paths["/api/v1/partner/payment-decisions"]).toBeTruthy();
    expect(res.body.paths["/api/v1/partner/api-keys"]).toBeTruthy();
    expect(res.body.components.securitySchemes.partnerApiKey).toBeTruthy();
    expect(res.body.components.securitySchemes.partnerAdminToken).toBeTruthy();
  });
});

async function seedPartner(
  input: { orgName?: string; scopes?: string[] } = {},
) {
  const organizationResponse = await invokeRoute(
    partnerRouter,
    "POST",
    "/partner/organizations",
    { displayName: input.orgName || "Acme" },
    { "x-rewardly-admin-token": "admin-secret" },
  );
  const projectResponse = await invokeRoute(
    partnerRouter,
    "POST",
    "/partner/projects",
    {
      organizationId: organizationResponse.body.organization.organizationId,
      displayName: "Sandbox",
      environment: "sandbox",
    },
    { "x-rewardly-admin-token": "admin-secret" },
  );
  const keyResponse = await invokeRoute(
    partnerRouter,
    "POST",
    "/partner/api-keys",
    {
      organizationId: organizationResponse.body.organization.organizationId,
      projectId: projectResponse.body.project.projectId,
      scopes: input.scopes || ["decision.write", "trust.read", "admin"],
    },
    { "x-rewardly-admin-token": "admin-secret" },
  );
  return {
    organization: organizationResponse.body.organization,
    project: projectResponse.body.project,
    key: keyResponse.body,
  };
}

async function invokeRoute(
  router: any,
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>,
) {
  const parsed = new URL(`http://localhost${url}`);
  const finishListeners: Array<() => void> = [];
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: headers || {},
    query: Object.fromEntries(parsed.searchParams.entries()),
    body: body || {},
    params: {},
  };
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      finishListeners.forEach((listener) => listener());
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    on(event: string, listener: () => void) {
      if (event === "finish") finishListeners.push(listener);
      return this;
    },
  };

  await new Promise<void>((resolve, reject) => {
    router.handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

function validDecisionBody() {
  return {
    merchant: { name: "Amazon", category: "online_retail" },
    purchase: { amount: 142.83, currency: "USD" },
    wallet: { cards: [{ cardId: "capital_one_venture" }] },
  };
}

function mockDecision() {
  return {
    recommendedCard: {
      card: {
        slug: "capital-one-venture",
        name: "Capital One Venture Rewards",
        issuer: "Capital One",
      },
      rewardEstimate: {
        label: "Earn 2x Venture Miles on eligible purchases.",
        estimatedValueUSD: 2.86,
      },
    },
    alternativeCards: [],
    merchant: {
      name: "Amazon",
      category: "online_retail",
      confidence: 0.92,
    },
    primaryReason: {
      detail: "Highest verified earning rate among eligible wallet cards.",
    },
    winningReason: {
      type: "base_earning",
      explanation: "Earn 2x Venture Miles on this purchase.",
      estimatedValue: 2.86,
    },
    confidence: { score: 0.91, label: "high" },
    recommendationSummary: "Capital One Venture Rewards has the best value.",
    decisionNarrative: {
      reasonType: "base_earning",
      headline: "Use Capital One Venture Rewards",
      summary: "Earn 2x Venture Miles on this purchase.",
      primaryReason: {
        summary: "Earn 2x Venture Miles on this purchase.",
      },
      supportingReasons: [
        { summary: "Highest verified earning rate among wallet cards." },
      ],
    },
    generatedAt: "2026-08-05T12:00:00.000Z",
  } as any;
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
