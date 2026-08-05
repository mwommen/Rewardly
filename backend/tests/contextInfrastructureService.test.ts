jest.mock("../src/db", () => ({
  getUserPreferencesCollection: jest.fn(),
}));

import { getUserPreferencesCollection } from "../src/db";
import {
  DECISION_POLICIES,
  getContextPreferences,
  normalizeDecisionContext,
  updateContextPreferences,
} from "../src/services/contextInfrastructureService";

const mockedPreferencesCollection =
  getUserPreferencesCollection as jest.MockedFunction<
    typeof getUserPreferencesCollection
  >;

beforeEach(() => {
  mockedPreferencesCollection.mockResolvedValue(memoryCollection() as any);
});

describe("contextInfrastructureService", () => {
  test("normalizes purchase, intent, policy, preferences, and constraints", () => {
    const result = normalizeDecisionContext({
      purchase: {
        merchant: " Amazon ",
        category: "online_retail",
        amount: "142.83",
        currency: "usd",
        channel: "Mobile App",
        location: { country: "us", region: "wa" },
      },
      financialIntent: { type: "travel", confidence: 0.86 },
      decisionPolicy: "maximize-travel-rewards",
      wallet: { cards: [{ cardId: "amex_gold" }, { cardId: "amex-gold" }] },
      preferences: [
        {
          type: "prefer_transferable_points",
          value: "membership_rewards",
          strength: "strong",
        },
      ],
      constraints: [{ type: "never_finance", value: true }],
    });

    expect(result.valid).toBe(true);
    expect(result.context).toMatchObject({
      purchase: {
        merchant: "Amazon",
        amount: 142.83,
        currency: "USD",
        channel: "mobile_app",
      },
      financialIntent: { type: "travel" },
      decisionPolicy: { policyId: "maximize-travel-rewards" },
    });
    expect(result.context?.user.walletCardSlugs).toEqual(["amex-gold"]);
    expect(result.context?.user.preferences[0].type).toBe("prefer_reward_type");
    expect(result.context?.user.constraints[0].type).toBe("never_finance");
  });

  test("rejects unsupported context currency without throwing", () => {
    const result = normalizeDecisionContext({
      purchase: { merchant: "Amazon", amount: 10, currency: "EUR" },
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({
        code: "UNSUPPORTED_CONTEXT",
        field: "purchase.currency",
      }),
    );
  });

  test("persists canonical context preferences in existing user preferences", async () => {
    const collection = memoryCollection();
    mockedPreferencesCollection.mockResolvedValue(collection as any);

    const updated = await updateContextPreferences("usr_1", {
      decisionPolicy: "minimize-complexity",
      preferences: [{ type: "avoid_business_cards", value: true }],
      constraints: [{ type: "exclude_suspended_cards", value: true }],
    });
    const fetched = await getContextPreferences("usr_1");

    expect(updated.decisionPolicy.policyId).toBe("minimize-complexity");
    expect(fetched.preferences[0].type).toBe("avoid_card_type");
    expect(fetched.constraints[0].type).toBe("exclude_suspended_cards");
  });

  test("decision policies are deterministic and versioned", () => {
    expect(DECISION_POLICIES.map((policy) => policy.policyId)).toEqual([
      "balanced",
      "maximize-cash-back",
      "maximize-travel-rewards",
      "minimize-complexity",
      "debt-avoidance",
    ]);
    expect(DECISION_POLICIES.every((policy) => policy.version)).toBe(true);
  });
});

function memoryCollection(seed: any[] = []) {
  const docs = seed.map((doc) => ({ ...doc }));
  return {
    docs,
    findOne: jest.fn(
      async (query: any) => docs.find((doc) => matches(doc, query)) || null,
    ),
    insertOne: jest.fn(async (doc: any) => {
      docs.push(doc);
      return { insertedId: doc.userId || docs.length };
    }),
    updateOne: jest.fn(async (query: any, update: any, options: any = {}) => {
      const index = docs.findIndex((doc) => matches(doc, query));
      if (index === -1) {
        if (!options.upsert) return { matchedCount: 0, modifiedCount: 0 };
        docs.push({
          ...query,
          ...(update.$setOnInsert || {}),
          ...(update.$set || {}),
        });
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      docs[index] = { ...docs[index], ...(update.$set || {}) };
      return { matchedCount: 1, modifiedCount: 1 };
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
