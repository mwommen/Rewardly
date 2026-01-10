import type { BenefitsPayload } from "../../models/benefits";

type CardOverride = {
  slug: string;
  name?: string;
  issuer?: string;
  annualFee?: number | null;
  rewardsByCategory?: Record<string, number>;
  perks?: string[];
  benefitsDetail?: BenefitsPayload;
  merchantCredits?: BenefitsPayload["merchantCredits"];
  recurringCredits?: BenefitsPayload["recurringCredits"];
};

export const CARD_OVERRIDES: Record<string, CardOverride> = {
  "amex-gold": {
    slug: "amex-gold",
    name: "American Express Gold Card",
    issuer: "American Express",
    annualFee: 325,
  },
  "amex-platinum": {
    slug: "amex-platinum",
    name: "The Platinum Card® from American Express",
    issuer: "American Express",
    annualFee: 895,
  },
  "chase-sapphire-preferred": {
    slug: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred®",
    issuer: "Chase",
    annualFee: 95,
  },
  "chase-freedom-unlimited": {
    slug: "chase-freedom-unlimited",
    name: "Chase Freedom Unlimited®",
    issuer: "Chase",
    annualFee: 0,
  },
  "citi-custom-cash": {
    slug: "citi-custom-cash",
    name: "Citi Custom Cash®",
    issuer: "Citi",
    annualFee: 0,
  },
  "capital-one-savorone": {
    slug: "capital-one-savorone",
    name: "Capital One SavorOne",
    issuer: "Capital One",
    annualFee: 0,
    rewardsByCategory: {
      dining: 3,
      entertainment: 3,
      streaming: 3,
      groceries: 3,
      other: 1,
    },
    perks: [
      "No annual fee",
      "3% cash back on dining, entertainment, popular streaming services, and grocery stores",
      "1% cash back on all other purchases",
    ],
  },
  "capital-one-venture-x": {
    slug: "capital-one-venture-x",
    name: "Capital One Venture X",
    issuer: "Capital One",
    annualFee: 395,
    rewardsByCategory: {
      travel: 10,
      other: 2,
    },
    recurringCredits: [
      {
        id: "venturex-travel-credit",
        label: "$300 Capital One Travel credit",
        amountUSD: 300,
        period: "year",
        requiresEnrollment: false,
      },
    ],
    perks: [
      "10x miles on hotels and rental cars booked via Capital One Travel",
      "5x miles on flights booked via Capital One Travel",
      "2x miles on all other purchases",
    ],
  },
};
