// backend/src/utils/valuation.ts

export const POINT_VALUATION_USD: Record<string, number> = {
  amex: 0.015,     // Membership Rewards baseline
  chase: 0.015,    // Ultimate Rewards baseline
  citi:  0.01,     // ThankYou Points baseline
  discover: 0.01,
  other: 0.01
};

export function toCashEquivalent(
  unit: "cash" | "points" | "miles" | undefined,
  rate: number,
  issuer: string | undefined
): number {
  if (!unit || unit === "cash") {
    // 'rate' is already a decimal percent (e.g., 0.03) or we'll handle pct conversion elsewhere
    return rate;
  }

  // Normalize issuer to lowercase to match POINT_VALUATION_USD keys
  const key = (issuer ?? "other").toLowerCase();
  const v = POINT_VALUATION_USD[key] ?? POINT_VALUATION_USD.other;

  // Treat points/miles as a multiplier; convert using issuer valuation
  // e.g., 3x * $0.015 = 0.045 (4.5%)
  return rate * v;
}
