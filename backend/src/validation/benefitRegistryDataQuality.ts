import type { Card } from "../../../packages/rewardly-core/src";
import { loadBenefitRegistry } from "../services/benefitRegistryService";

export type BenefitRegistryDataQualityIssue = {
  severity: "error" | "warning";
  cardSlug?: string;
  ruleId?: string;
  message: string;
};

export function validateBenefitRegistryData(cards: Card[]) {
  const registry = loadBenefitRegistry({
    cards,
    now: new Date("2026-07-24T00:00:00.000Z"),
  });
  const issues: BenefitRegistryDataQualityIssue[] = [];
  const ids = new Set<string>();
  const cardsWithBase = new Set(
    registry.rules.filter((rule) => rule.sourceKind === "reward_flat").map((rule) => rule.cardSlug),
  );
  cards.forEach((card) => {
    if (!cardsWithBase.has(card.slug)) {
      issues.push({
        severity: "error",
        cardSlug: card.slug,
        message: "Card is missing a base-earning rule.",
      });
    }
  });
  registry.rules.forEach((rule) => {
    if (ids.has(rule.id)) {
      issues.push({
        severity: "error",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Duplicate benefit ID.",
      });
    }
    ids.add(rule.id);
    if (rule.effectiveDate && rule.expirationDate && new Date(rule.effectiveDate) > new Date(rule.expirationDate)) {
      issues.push({
        severity: "error",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Invalid effective-date range.",
      });
    }
    if (!rule.sourceUrl || !rule.sourceType) {
      issues.push({
        severity: "warning",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Missing source metadata.",
      });
    }
    if (!rule.lastVerified) {
      issues.push({
        severity: "warning",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Missing verification timestamp.",
      });
    }
    if (!rule.rewardMechanism || rule.rewardMechanism === "unknown") {
      issues.push({
        severity: "warning",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Missing reward unit.",
      });
    }
    if (rule.spendingCap?.amountUSD && !rule.spendingCap.period) {
      issues.push({
        severity: "warning",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Spending cap is missing a period.",
      });
    }
    if (rule.statementCredit?.amountUSD && !rule.statementCredit.period) {
      issues.push({
        severity: "warning",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Statement credit is missing a reset period.",
      });
    }
    if (rule.sourceKind === "reward_category" && !rule.merchantCategory) {
      issues.push({
        severity: "error",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Category rule has no eligible category.",
      });
    }
    if (rule.sourceKind === "merchant_credit" && !rule.specificMerchant && !rule.specificMerchantIds.length) {
      issues.push({
        severity: "error",
        cardSlug: rule.cardSlug,
        ruleId: rule.id,
        message: "Merchant-specific rule has no merchant matcher.",
      });
    }
  });
  return { registry, issues };
}
