import {
  benefitRulePrecedence,
  calculateBenefitDecisionConfidence,
  createBenefitVersionSnapshot,
  createDecisionAuditLog,
  loadBenefitRegistry,
} from "../src/services/benefitRegistryService";
import {
  benefitDecisionAccuracyCards as cards,
} from "./fixtures/benefitDecisionAccuracyFixture";

const NOW = new Date("2026-07-24T00:00:00.000Z");

describe("benefitRegistryService", () => {
  test("loads structured benefit definitions with required knowledge fields", () => {
    const registry = loadBenefitRegistry({
      cards: [cards.amexGold, cards.capitalOneVenture],
      now: NOW,
    });
    const groceryRule = registry.rules.find((rule) => /4x on groceries/i.test(rule.label));

    expect(registry).toEqual(
      expect.objectContaining({
        registryId: expect.any(String),
        version: 1,
        generatedAt: NOW.toISOString(),
      }),
    );
    expect(groceryRule).toEqual(
      expect.objectContaining({
        cardIssuer: "American Express",
        cardSlug: "amex-gold",
        rewardProgram: "Membership Rewards",
        rewardMechanism: "points",
        multiplier: 4,
        eligibleCategories: expect.arrayContaining(["groceries"]),
        merchantRestrictions: [],
        purchaseRestrictions: expect.any(Array),
        enrollmentRequired: false,
        activationRequired: false,
        spendingCap: expect.objectContaining({ amountUSD: 25000 }),
        sourceUrl: expect.any(String),
        confidenceScore: 0.95,
        lastVerified: "2026-07-01T00:00:00.000Z",
        version: 1,
      }),
    );
  });

  test("benefit version changes preserve historical rule versions", () => {
    const registry = loadBenefitRegistry({ cards: [cards.capitalOneVenture], now: NOW });
    const previous = registry.rules.find((rule) => /2x on all purchases/i.test(rule.label))!;
    const next = {
      ...previous,
      label: "2.5x on all purchases",
      multiplier: 2.5,
    };

    const snapshot = createBenefitVersionSnapshot({
      previous,
      next,
      changedAt: NOW.toISOString(),
    });

    expect(snapshot.previousRule).toEqual(previous);
    expect(snapshot.previousVersion).toBe(1);
    expect(snapshot.newVersion).toBe(2);
    expect(snapshot.rule).toEqual(expect.objectContaining({ version: 2 }));
  });

  test("expired rules remain versioned in registry but are marked expired", () => {
    const expiredCard = {
      ...cards.capitalOneVenture,
      benefitsDetail: {
        ...cards.capitalOneVenture.benefitsDetail,
        rewardsRotating: [
          {
            start: "2025-10-01T00:00:00.000Z",
            end: "2026-01-01T00:00:00.000Z",
            activationRequired: false,
            categories: [
              {
                keys: ["dining"],
                rate: "9x",
                unit: "miles",
              },
            ],
          },
        ],
      },
    };

    const registry = loadBenefitRegistry({ cards: [expiredCard], now: NOW });
    const expiredRule = registry.rules.find((rule) => /9x on dining/i.test(rule.label));

    expect(expiredRule).toEqual(
      expect.objectContaining({
        verificationStatus: "expired",
        expirationDate: "2026-01-01T00:00:00.000Z",
      }),
    );
  });

  test("conflicting rules expose registry precedence ordering", () => {
    const merchantRule = loadBenefitRegistry({ cards: [cards.bestBuyOfferCard], now: NOW })
      .rules.find((rule) => /\$20 statement credit/i.test(rule.label))!;
    const portalRule = loadBenefitRegistry({ cards: [cards.chaseSapphirePreferred], now: NOW })
      .rules.find((rule) => /5x on issuer_travel_portal/i.test(rule.label))!;
    const categoryRule = loadBenefitRegistry({ cards: [cards.amexGold], now: NOW })
      .rules.find((rule) => /4x on dining/i.test(rule.label))!;
    const baseRule = loadBenefitRegistry({ cards: [cards.capitalOneVenture], now: NOW })
      .rules.find((rule) => /2x on all purchases/i.test(rule.label))!;

    expect([
      benefitRulePrecedence(merchantRule),
      benefitRulePrecedence(portalRule),
      benefitRulePrecedence(categoryRule),
      benefitRulePrecedence(baseRule),
    ]).toEqual([
      "merchant_specific",
      "portal_specific",
      "category",
      "base_earning",
    ]);
  });

  test("confidence calculation combines merchant, benefit, wallet, and freshness signals", () => {
    const high = calculateBenefitDecisionConfidence({
      merchantClassificationConfidence: 0.96,
      benefitConfidence: 0.95,
      walletStateConfidence: 0.9,
      lastVerified: "2026-07-01T00:00:00.000Z",
      now: NOW,
    });
    const low = calculateBenefitDecisionConfidence({
      merchantClassificationConfidence: 0.55,
      benefitConfidence: 0.72,
      walletStateConfidence: 0.4,
      lastVerified: "2024-01-01T00:00:00.000Z",
      now: NOW,
    });

    expect(high).toEqual(
      expect.objectContaining({
        label: "high",
        factors: expect.objectContaining({
          merchantClassificationConfidence: 0.96,
          benefitConfidence: 0.95,
          walletStateConfidence: 0.9,
          dataFreshness: 1,
        }),
      }),
    );
    expect(low.label).toBe("low");
    expect(low.score).toBeLessThan(high.score);
  });

  test("decision audit log captures evaluated, applied, rejected, winning, confidence, and timestamp fields", () => {
    const log = createDecisionAuditLog({
      merchant: "Best Buy",
      classification: {
        category: "general_retail",
        confidence: 0.91,
        source: "merchant_registry",
        evidence: ["domain match"],
        verified: true,
      },
      evaluatedCards: [
        {
          card: { slug: "card-a", name: "Card A" },
          trace: [
            {
              ruleId: "rule-a",
              label: "2x on all purchases",
              applicable: true,
              rejectionReasons: [],
            },
            {
              ruleId: "rule-b",
              label: "Expired offer",
              applicable: false,
              rejectionReasons: ["BENEFIT_EXPIRED"],
            },
          ],
        },
      ],
      winningRuleId: "rule-a",
      confidence: { score: 0.92, label: "high" },
      timestamp: NOW.toISOString(),
    });

    expect(log).toEqual(
      expect.objectContaining({
        decisionId: expect.any(String),
        merchant: "Best Buy",
        appliedRules: ["rule-a"],
        rejectedRules: [
          {
            cardSlug: "card-a",
            ruleId: "rule-b",
            label: "Expired offer",
            reasons: ["BENEFIT_EXPIRED"],
          },
        ],
        winningRule: "rule-a",
        confidence: { score: 0.92, label: "high" },
        timestamp: NOW.toISOString(),
      }),
    );
  });
});
