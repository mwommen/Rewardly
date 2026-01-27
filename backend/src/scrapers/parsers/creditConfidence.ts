import type { BenefitsPayload } from "./index";

function boostItems<T extends { confidence?: number }>(items: T[] | undefined, min: number): T[] | undefined {
  if (!items?.length) return items;
  return items.map((item) => ({
    ...item,
    confidence: Math.max(item.confidence ?? 0, min),
  }));
}

export function withMinCreditConfidence(payload: BenefitsPayload, min: number): BenefitsPayload {
  return {
    ...payload,
    merchantCredits: boostItems(payload.merchantCredits, min),
    recurringCredits: boostItems(payload.recurringCredits, min),
  };
}
