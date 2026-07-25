import type { ReferenceCandidate } from "./referenceBenefit.types";

export function rankReferenceCandidates(candidates: ReferenceCandidate[]) {
  return [...candidates].sort(compareReferenceCandidates);
}

export function compareReferenceCandidates(a: ReferenceCandidate, b: ReferenceCandidate) {
  const nearTie =
    Math.max(a.estimatedValueUSD, b.estimatedValueUSD) >= 10 &&
    Math.abs(b.estimatedValueUSD - a.estimatedValueUSD) <= 0.011;
  if (!nearTie && b.estimatedValueUSD !== a.estimatedValueUSD) {
    return b.estimatedValueUSD - a.estimatedValueUSD;
  }
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  if (b.precedence !== a.precedence) return b.precedence - a.precedence;
  return a.cardName.localeCompare(b.cardName);
}
