export function merchantConfidenceBand(score: number) {
  if (!Number.isFinite(score) || score <= 0) return "unknown";
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

export function boundedMerchantConfidence(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}
