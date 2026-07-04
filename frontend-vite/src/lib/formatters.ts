const UNLOCK_LABELS = [
  "purchase protection",
  "extended warranty",
  "return protection",
  "active offer",
  "travel protection",
  "dining credit",
  "cell phone insurance",
  "rental car coverage",
];

export function matchTierLabel(tier?: string) {
  if (tier === "exact_benefit") return "Exact benefit match";
  if (tier === "category_match") return "Category match";
  if (tier === "base_rate") return "Base rewards match";
  return "Recommendation";
}

export function confidenceText(confidence?: number, label?: string) {
  if (label) return label;
  if (typeof confidence !== "number") return "Review recommended";
  if (confidence >= 0.8) return "High confidence";
  if (confidence >= 0.55) return "Medium confidence";
  return "Low confidence";
}

export function formatFee(fee?: number) {
  if (typeof fee !== "number") return null;
  return fee === 0 ? "No annual fee" : `$${fee.toLocaleString()} annual fee`;
}

export function formatRewards(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    return "You'll earn the best available rewards";
  }
  if (rate >= 10) return `You'll get about ${rate.toFixed(0)}x value`;
  const formatted = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1);
  return `You'll earn ${formatted}x rewards`;
}

export function rewardChip(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate))
    return "Strong rewards";
  const formatted = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1);
  return `${formatted}x rewards`;
}

export function formatCategory(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeUnlockLabel(value: string) {
  const lower = value.toLowerCase();
  const known = UNLOCK_LABELS.find((label) => lower.includes(label));
  return known ? formatCategory(known) : value;
}
