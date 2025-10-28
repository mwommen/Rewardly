// frontend/src/cardModules.ts

export interface CardBenefits {
  [key: string]: number; // category or merchant -> points multiplier
}

export interface Card {
  _id?: string; // backend ID
  name: string;
  issuer: string;
  type?: "Cashback" | "Travel" | "Rewards";
  annualFee: number;
  apr: string;
  benefits: CardBenefits;
  perks: string[];
  lastUpdated: string;
}
