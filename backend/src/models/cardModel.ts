// backend/src/models/cardModel.ts
import { ObjectId } from "mongodb";

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
  perks: string[];
  lastUpdated?: string;
}
