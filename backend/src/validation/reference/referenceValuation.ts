import type { ReferenceBenefit } from "./referenceBenefit.types";

const POINT_VALUES: Record<string, number> = {
  "american express": 0.015,
  chase: 0.015,
  citi: 0.01,
  "capital one": 0.01,
  "wells fargo": 0.01,
};

export function referenceValuePerUnit(benefit: Pick<ReferenceBenefit, "issuer" | "rewardCurrency">) {
  if (benefit.rewardCurrency === "cash" || benefit.rewardCurrency === "statement_credit") return 1;
  return POINT_VALUES[benefit.issuer.toLowerCase()] ?? 0.01;
}

export function referenceRound(value: number, digits = 2) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
