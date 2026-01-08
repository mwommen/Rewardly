// backend/src/models/cardModel.ts
import { ObjectId } from "mongodb";
import type { BenefitsPayload } from "./benefits";

export interface CardBenefits {
  [key: string]: number;
}

export interface Card {
  _id?: ObjectId; // MongoDB ID
  name: string;
  issuer?: string;
  type?: "Cashback" | "Travel" | "Rewards";
  annualFee?: number;
  apr?: string;
  benefits: CardBenefits;
  benefitsDetail?: BenefitsPayload;
  perks: string[];
  lastUpdated?: string;
}
