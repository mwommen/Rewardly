export type CoverageRequirement = {
  dimension: string;
  branch: string;
  minimumCount: number;
  required: boolean;
  curatedRequired?: boolean;
  rationale: string;
};

const criticalCuratedBranches = new Set([
  "eligibility:expired_rule",
  "eligibility:not_yet_effective_rule",
  "eligibility:missing_activation",
  "eligibility:missing_enrollment",
  "eligibility:exhausted_cap",
  "cap_state:partially_used_cap",
  "ranking_path:exact_value_tie",
  "wallet:wallet_reordered",
  "wallet:winning_card_removed",
  "wallet:irrelevant_card_added",
  "eligibility:incompatible_channel",
  "eligibility:merchant_mismatch",
  "rule_type:rotating_category",
]);

export const recommendationCoverageRequirements: CoverageRequirement[] = [
  req("eligibility", "eligible_rule", 1, "At least one rule must score successfully."),
  req("eligibility", "expired_rule", 1, "Expired benefits must be rejected."),
  req("eligibility", "not_yet_effective_rule", 1, "Future benefits must be rejected."),
  req("eligibility", "missing_activation", 1, "Activation-required benefits must not silently score."),
  req("eligibility", "missing_enrollment", 1, "Enrollment-required benefits must not silently score."),
  req("eligibility", "exhausted_cap", 1, "Exhausted capped rewards must not drive recommendations."),
  req("eligibility", "incompatible_channel", 1, "Portal-only rules must reject incompatible channels."),
  req("eligibility", "merchant_mismatch", 1, "Merchant-specific rules must reject other merchants."),
  req("eligibility", "category_mismatch", 1, "Category rules must reject other categories."),
  req("cap_state", "unused_cap", 1, "Capped rules need an unused-cap scenario."),
  req("cap_state", "partially_used_cap", 1, "Capped rules need partial-cap coverage."),
  req("cap_state", "partial_purchase_over_cap", 1, "Purchases that exceed remaining cap need coverage."),
  req("cap_state", "exhausted_cap", 1, "Cap exhaustion must be deterministic."),
  req("credit_state", "unused_credit", 1, "Statement credit unused state must be covered."),
  req("credit_state", "partially_used_credit", 1, "Statement credit partial state must be covered."),
  req("credit_state", "purchase_below_remaining_credit", 1, "Credit clipping below purchase amount must be covered."),
  req("credit_state", "purchase_above_remaining_credit", 1, "Credit clipping above purchase amount must be covered."),
  req("credit_state", "exhausted_credit", 1, "Exhausted credits must not win."),
  req("rule_type", "base", 2, "Base earning is the fallback path."),
  req("rule_type", "category", 2, "Category rewards are common."),
  req("rule_type", "rotating_category", 1, "Rotating category rewards need explicit branch coverage."),
  req("rule_type", "portal", 1, "Issuer portal rules need coverage."),
  req("rule_type", "statement_credit", 1, "Statement credits need coverage."),
  req("classification", "verified", 1, "Verified merchant mappings need coverage."),
  req("classification", "inferred", 1, "Inferred classifications lower confidence."),
  req("classification", "unknown", 1, "Unknown classification fallback must work."),
  req("classification", "high_confidence", 1, "High confidence branch must be present."),
  req("classification", "medium_confidence", 1, "Medium confidence branch must be present."),
  req("classification", "low_confidence", 1, "Low confidence branch must be present."),
  req("ranking_path", "clear_reward_value_winner", 1, "Normal ranking path must be covered."),
  req("ranking_path", "exact_value_tie", 1, "Exact ties need deterministic coverage."),
  req("ranking_path", "final_deterministic_tie_break", 1, "Final tie-break must be deterministic."),
  req("wallet_size", "one_card_wallet", 1, "Single-card wallets are beta-relevant."),
  req("wallet_size", "two_card_wallet", 1, "Two-card wallets are common."),
  req("wallet_size", "three_or_more_card_wallet", 1, "Multi-card wallets are core."),
  req("wallet", "winning_card_removed", 1, "Metamorphic winner removal must run."),
  req("wallet", "wallet_reordered", 1, "Wallet order independence must run."),
  req("wallet", "irrelevant_card_added", 1, "Irrelevant card addition must run."),
  req("date_boundary", "before_effective", 1, "Future effective-date boundary must be covered."),
  req("date_boundary", "exactly_on_effective", 1, "Effective-date inclusivity must be covered."),
  req("date_boundary", "before_expiration", 1, "Pre-expiration boundary must be covered."),
  req("date_boundary", "expiration_boundary", 1, "Expiration inclusivity must be covered."),
  req("date_boundary", "after_expiration", 1, "Post-expiration rejection must be covered."),
  req("purchase_channel", "online", 1, "Normal online checkout is primary."),
  req("purchase_channel", "issuer_portal", 1, "Issuer portal checkout needs coverage."),
  req("purchase_channel", "incompatible_channel", 1, "Channel mismatch must be covered."),
];

function req(
  dimension: string,
  branch: string,
  minimumCount: number,
  rationale: string,
): CoverageRequirement {
  return {
    dimension,
    branch,
    minimumCount,
    required: true,
    curatedRequired: criticalCuratedBranches.has(`${dimension}:${branch}`),
    rationale,
  };
}
