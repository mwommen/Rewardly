import crypto from "crypto";
import type { Card } from "../../../packages/rewardly-core/src";
import {
  canonicalizeCardBenefits,
  scoreBenefitFreshness,
  type CanonicalBenefitRecord,
} from "./benefitIntelligenceService";
import type { CanonicalWalletBenefitState } from "./walletIntelligenceService";

export type BenefitRulePrecedence =
  | "merchant_specific"
  | "portal_specific"
  | "category"
  | "base_earning";

export type BenefitRegistryRule = CanonicalBenefitRecord & {
  registryRuleId: string;
  precedence: BenefitRulePrecedence;
  rewardProgram: string;
  eligibleCategories: string[];
  merchantRestrictions: string[];
  purchaseRestrictions: string[];
  registryVersion: number;
};

export type BenefitRegistry = {
  registryId: string;
  version: number;
  generatedAt: string;
  rules: BenefitRegistryRule[];
};

export type BenefitRegistryDecisionAuditLog = {
  decisionId: string;
  merchant: string;
  classification: {
    category: string | null;
    confidence: number;
    source: string;
    evidence: string[];
    verified: boolean;
  };
  evaluatedCards: Array<{
    cardSlug: string;
    cardName: string;
    appliedRules: string[];
    rejectedRules: Array<{
      ruleId: string;
      label: string;
      reasons: string[];
    }>;
  }>;
  appliedRules: string[];
  rejectedRules: Array<{
    cardSlug: string;
    ruleId: string;
    label: string;
    reasons: string[];
  }>;
  winningRule: string | null;
  confidence: {
    score: number;
    label: string;
  };
  timestamp: string;
};

const BENEFIT_REGISTRY_VERSION = 1;

export function loadBenefitRegistry(input: {
  cards: Card[];
  now?: Date;
  version?: number;
}): BenefitRegistry {
  const generatedAt = (input.now || new Date()).toISOString();
  const version = input.version || BENEFIT_REGISTRY_VERSION;
  const rules = input.cards.flatMap((card) =>
    canonicalizeCardBenefits(card, { now: input.now }).map((benefit) =>
      toRegistryRule(benefit, card, version),
    ),
  );
  return {
    registryId: stableId("benefit-registry", rules.map((rule) => rule.registryRuleId)),
    version,
    generatedAt,
    rules,
  };
}

export function createBenefitVersionSnapshot(input: {
  previous?: BenefitRegistryRule | null;
  next: BenefitRegistryRule;
  changedAt?: string;
}) {
  return {
    benefitId: input.next.id,
    previousVersion: input.previous?.version ?? null,
    newVersion: input.previous ? input.previous.version + 1 : input.next.version,
    previousRule: input.previous || null,
    rule: {
      ...input.next,
      version: input.previous ? input.previous.version + 1 : input.next.version,
    },
    changedAt: input.changedAt || new Date().toISOString(),
  };
}

export function benefitRulePrecedence(rule: Pick<BenefitRegistryRule, "sourceKind" | "merchantCategory" | "specificMerchant" | "specificMerchantIds">): BenefitRulePrecedence {
  if (rule.specificMerchant || rule.specificMerchantIds.length) return "merchant_specific";
  if (
    rule.sourceKind === "reward_category" &&
    /portal|issuer_travel_portal|travel_portal/i.test(String(rule.merchantCategory || ""))
  ) {
    return "portal_specific";
  }
  if (rule.sourceKind === "reward_flat") return "base_earning";
  return "category";
}

export function benefitRulePrecedenceWeight(precedence: BenefitRulePrecedence) {
  if (precedence === "merchant_specific") return 4;
  if (precedence === "portal_specific") return 3;
  if (precedence === "category") return 2;
  return 1;
}

export function calculateBenefitDecisionConfidence(input: {
  merchantClassificationConfidence: number;
  benefitConfidence: number;
  walletStateConfidence: number;
  lastVerified?: string | null;
  now?: Date;
}) {
  const freshness = scoreBenefitFreshness(input.lastVerified, input.now || new Date());
  const score =
    input.merchantClassificationConfidence * 0.3 +
    input.benefitConfidence * 0.35 +
    input.walletStateConfidence * 0.2 +
    freshness * 0.15;
  return {
    score: round(score, 2),
    label:
      score >= 0.85
        ? "high"
        : score >= 0.7
          ? "medium"
          : "low",
    factors: {
      merchantClassificationConfidence: round(input.merchantClassificationConfidence, 2),
      benefitConfidence: round(input.benefitConfidence, 2),
      walletStateConfidence: round(input.walletStateConfidence, 2),
      dataFreshness: round(freshness, 2),
    },
  };
}

export function createDecisionAuditLog(input: {
  merchant: string;
  classification: BenefitRegistryDecisionAuditLog["classification"];
  evaluatedCards: Array<{
    card: { slug: string; name: string };
    trace: Array<{
      ruleId: string;
      label: string;
      applicable: boolean;
      rejectionReasons: string[];
    }>;
  }>;
  winningRuleId?: string | null;
  confidence: {
    score: number;
    label: string;
  };
  timestamp?: string;
}): BenefitRegistryDecisionAuditLog {
  const timestamp = input.timestamp || new Date().toISOString();
  const evaluatedCards = input.evaluatedCards.map((cardScore) => ({
    cardSlug: cardScore.card.slug,
    cardName: cardScore.card.name,
    appliedRules: cardScore.trace
      .filter((rule) => rule.applicable)
      .map((rule) => rule.ruleId),
    rejectedRules: cardScore.trace
      .filter((rule) => !rule.applicable)
      .map((rule) => ({
        ruleId: rule.ruleId,
        label: rule.label,
        reasons: rule.rejectionReasons,
      })),
  }));
  const rejectedRules = evaluatedCards.flatMap((cardScore) =>
    cardScore.rejectedRules.map((rule) => ({
      cardSlug: cardScore.cardSlug,
      ...rule,
    })),
  );
  const appliedRules = evaluatedCards.flatMap((cardScore) => cardScore.appliedRules);
  return {
    decisionId: stableId("decision", [
      input.merchant,
      input.winningRuleId || "",
      timestamp,
      ...appliedRules,
    ]),
    merchant: input.merchant,
    classification: input.classification,
    evaluatedCards,
    appliedRules,
    rejectedRules,
    winningRule: input.winningRuleId || null,
    confidence: input.confidence,
    timestamp,
  };
}

function toRegistryRule(
  benefit: CanonicalBenefitRecord,
  card: Card,
  registryVersion: number,
): BenefitRegistryRule {
  const merchantRestrictions = [
    benefit.specificMerchant,
    ...benefit.specificMerchantIds,
  ].filter(Boolean) as string[];
  const eligibleCategories = [
    benefit.merchantCategory,
    ...(benefit.sourceKind === "reward_flat" ? ["all purchases"] : []),
  ].filter(Boolean) as string[];
  return {
    ...benefit,
    registryRuleId: `${benefit.cardSlug}:${benefit.sourceKind}:${benefit.id}:v${benefit.version}`,
    precedence: benefitRulePrecedence(benefit),
    rewardProgram: rewardProgramFor(card, benefit),
    eligibleCategories,
    merchantRestrictions,
    purchaseRestrictions: [
      ...benefit.eligiblePurchaseChannels.map((channel) => `channel:${channel}`),
      ...benefit.redemptionLimitations,
      ...benefit.exclusions,
      ...benefit.geographicRestrictions,
    ],
    registryVersion,
  };
}

function rewardProgramFor(card: Card, benefit: CanonicalBenefitRecord) {
  if (benefit.rewardMechanism === "miles") {
    return /venture/i.test(card.name) ? "Venture Miles" : "miles";
  }
  if (benefit.rewardMechanism === "points") {
    return /amex|american express/i.test(card.issuer || card.name)
      ? "Membership Rewards"
      : /chase/i.test(card.issuer || card.name)
        ? "Ultimate Rewards"
        : "points";
  }
  if (benefit.rewardMechanism === "cash_back") return "cash back";
  return "statement credit";
}

function stableId(prefix: string, parts: unknown[]) {
  const hash = crypto
    .createHash("sha1")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${hash}`;
}

function round(value: number, digits = 4) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
