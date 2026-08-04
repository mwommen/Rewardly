import type { MerchantSuggestion, WalletCard } from "@/types/rewardly";

export const demoWallet: WalletCard[] = [
  {
    cardId: "capital-one-venture",
    displayName: "Capital One Venture Rewards",
    issuer: "Capital One",
    annualFee: 95,
    rewardProgram: "Venture Miles",
    nickname: "Everyday miles"
  },
  {
    cardId: "amex-gold",
    displayName: "American Express Gold Card",
    issuer: "American Express",
    annualFee: 250,
    rewardProgram: "Membership Rewards",
    nickname: "Dining and groceries"
  },
  {
    cardId: "chase-sapphire-preferred",
    displayName: "Chase Sapphire Preferred",
    issuer: "Chase",
    annualFee: 95,
    rewardProgram: "Ultimate Rewards",
    nickname: "Travel card"
  }
];

export const demoMerchants: MerchantSuggestion[] = [
  { name: "Target", category: "general_retail", domain: "target.com" },
  { name: "Delta", category: "travel", domain: "delta.com" },
  { name: "Starbucks", category: "restaurants", domain: "starbucks.com" }
];
