import type { BenefitsPayload } from "../../models/benefits";

type CardOverride = {
  slug: string;
  name?: string;
  issuer?: string;
  annualFee?: number | null;
  apr?: string | null;
  sourceUrl?: string;
  sourceType?: BenefitsPayload["sourceType"];
  lastVerified?: string;
  productionEligible?: boolean;
  rewardsByCategory?: Record<string, number>;
  perks?: string[];
  signupOffer?: string | null;
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
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/platinum/",
    merchantCredits: [
      {
        id: "amex-platinum-lululemon-credit",
        label: "$75 statement credit at lululemon each quarter (up to $300/yr)",
        amountUSD: 75,
        period: "quarter",
        capPerPeriodUSD: 75,
        eligibleWhen: { merchantPatterns: ["lululemon", "lulu lemon", "lululemon.com"] },
        requiresEnrollment: true,
        sourceUrl: "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
        enrollmentUrl: "https://global.americanexpress.com/card-benefits/detail/lululemon/platinum",
        confidence: 0.95,
      },
      {
        id: "amex-platinum-saks-credit",
        label: "$50 statement credit at Saks semi-annually (up to $100/yr)",
        amountUSD: 50,
        period: "semi-annual",
        capPerPeriodUSD: 50,
        eligibleWhen: { merchantPatterns: ["saks", "saks fifth avenue", "saks.com"] },
        requiresEnrollment: true,
        sourceUrl: "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
        enrollmentUrl: "https://global.americanexpress.com/card-benefits/detail/shopsakswithplatinum/platinum",
        confidence: 0.95,
      },
    ],
  },
  "amex-green-card": {
    slug: "amex-green-card",
    name: "American Express Green Card",
    issuer: "American Express",
    annualFee: 150,
    rewardsByCategory: {
      travel: 3,
      dining: 3,
      other: 1,
    },
    perks: [
      "3x points on travel",
      "3x points on dining",
      "1x points on all other purchases",
    ],
  },
  "amex-everyday-preferred": {
    slug: "amex-everyday-preferred",
    name: "Amex EveryDay® Preferred Credit Card",
    issuer: "American Express",
    annualFee: 95,
    rewardsByCategory: {
      groceries: 3,
      gas: 2,
      other: 1,
    },
    perks: [
      "3x points at U.S. supermarkets (up to $6,000 per year)",
      "2x points at U.S. gas stations",
      "1x points on other purchases",
    ],
  },
  "amex-everyday": {
    slug: "amex-everyday",
    name: "Amex EveryDay® Credit Card",
    issuer: "American Express",
    annualFee: 0,
    rewardsByCategory: {
      groceries: 2,
      other: 1,
    },
    perks: [
      "2x points at U.S. supermarkets (up to $6,000 per year)",
      "1x points on other purchases",
    ],
  },
  "chase-sapphire-preferred": {
    slug: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred®",
    issuer: "Chase",
    annualFee: 95,
  },
  "chase-sapphire-reserve": {
    slug: "chase-sapphire-reserve",
    name: "Chase Sapphire Reserve®",
    issuer: "Chase",
    annualFee: 795,
    rewardsByCategory: {
      travel: 4,
      dining: 3,
      default: 1,
    },
    perks: [
      "8x points on travel booked through Chase Travel",
      "4x points on flights and hotels booked direct",
      "3x points on dining worldwide",
    ],
  },
  "chase-freedom-flex": {
    slug: "chase-freedom-flex",
    name: "Chase Freedom Flex®",
    issuer: "Chase",
    annualFee: 0,
    rewardsByCategory: {
      travel: 5,
      dining: 3,
      drugstore: 3,
      default: 1,
    },
    perks: [
      "5% cash back on up to $1,500 in combined purchases in quarterly bonus categories (activation required)",
      "5% cash back on travel purchased through Chase Travel",
      "3% cash back on dining and drugstores",
      "1% cash back on all other purchases",
    ],
  },
  "chase-ink-cash": {
    slug: "chase-ink-cash",
    name: "Ink Business Cash® Credit Card",
    issuer: "Chase",
    annualFee: 0,
    rewardsByCategory: {
      office_supply: 5,
      internet: 5,
      cable: 5,
      phone: 5,
      gas: 2,
      dining: 2,
      default: 1,
    },
    perks: [
      "5% cash back on the first $25,000 per year at office supply stores and on internet, cable and phone services",
      "2% cash back on the first $25,000 per year at gas stations and restaurants",
      "1% cash back on all other purchases",
    ],
  },
  "chase-ink-unlimited": {
    slug: "chase-ink-unlimited",
    name: "Ink Business Unlimited® Credit Card",
    issuer: "Chase",
    annualFee: 0,
    rewardsByCategory: {
      default: 1.5,
    },
    perks: ["Unlimited 1.5% cash back on every purchase"],
  },
  "chase-ink-preferred": {
    slug: "chase-ink-preferred",
    name: "Ink Business Preferred® Credit Card",
    issuer: "Chase",
    annualFee: 95,
    rewardsByCategory: {
      travel: 3,
      shipping: 3,
      advertising: 3,
      internet: 3,
      cable: 3,
      phone: 3,
      default: 1,
    },
    perks: [
      "3x points on the first $150,000 per year on travel, shipping, advertising, and internet/cable/phone services",
      "1x points on all other purchases",
    ],
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
    apr: "28.99% variable",
    signupOffer: null,
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
    apr: "19.49%–28.49% variable",
    signupOffer: "75,000 bonus miles",
    rewardsByCategory: {
      travel: 10,
      other: 2,
    },
    merchantCredits: [],
    recurringCredits: [
      {
        id: "venturex-travel-credit",
        label: "$300 Capital One Travel credit",
        amountUSD: 300,
        period: "year",
        requiresEnrollment: false,
      },
      {
        id: "venturex-global-entry-credit",
        label: "Up to $100 credit for Global Entry or TSA PreCheck",
        amountUSD: 100,
        period: "year",
        requiresEnrollment: false,
      },
    ],
    perks: [
      "10x miles on hotels and rental cars booked via Capital One Travel",
      "5x miles on flights booked via Capital One Travel",
      "2x miles on all other purchases",
      "10,000 miles anniversary bonus",
    ],
  },
  "capital-one-venture": {
    slug: "capital-one-venture",
    name: "Capital One Venture Rewards",
    issuer: "Capital One",
    annualFee: 95,
    apr: "19.49%–28.49% variable",
    signupOffer: "75,000 bonus miles after $4,000 in purchases within 3 months",
    rewardsByCategory: {
      other: 2,
    },
    perks: ["2x miles on every purchase", "$250 Capital One Travel credit (one-time)"],
  },
  "capital-one-ventureone": {
    slug: "capital-one-ventureone",
    name: "Capital One VentureOne Rewards",
    issuer: "Capital One",
    annualFee: 0,
    apr: "0% intro APR for 15 months; 18.49%–28.49% variable after",
    signupOffer: "20,000 bonus miles",
    rewardsByCategory: {
      other: 1.25,
    },
    perks: ["1.25x miles on every purchase"],
  },
  "capital-one-quicksilver": {
    slug: "capital-one-quicksilver",
    name: "Capital One Quicksilver Rewards",
    issuer: "Capital One",
    annualFee: 0,
    apr: "0% intro APR for 15 months; 18.49%–28.49% variable after",
    signupOffer: "$200 cash bonus",
    rewardsByCategory: {
      other: 1.5,
    },
    perks: ["1.5% cash back on every purchase"],
  },
  "capital-one-savor": {
    slug: "capital-one-savor",
    name: "Capital One Savor Rewards",
    issuer: "Capital One",
    annualFee: 95,
    apr: "0% intro APR for 12 months; 18.49%–28.49% variable after",
    signupOffer: "$200 cash bonus",
    rewardsByCategory: {
      groceries: 3,
      dining: 3,
      entertainment: 3,
      other: 1,
    },
    perks: [
      "3% cash back at grocery stores, on dining and entertainment",
      "1% cash back on all other purchases",
    ],
  },
  "blue-business-plus-credit-card-amex": {
    slug: "blue-business-plus-credit-card-amex",
    name: "Blue Business® Plus Credit Card",
    issuer: "American Express",
    annualFee: 0,
    apr: "0% intro on purchases for 12 months; then variable 16.74%–26.74%",
    signupOffer: "15,000 Membership Rewards® points after $3,000 in purchases within 3 months",
    rewardsByCategory: {
      other: 2,
    },
    perks: [
      "2X Membership Rewards points on the first $50,000 in eligible purchases per calendar year, then 1X thereafter",
      "No annual fee",
      "0% intro APR on purchases for 12 months (then variable APR)",
    ],
  },
  "boa-customized-cash-rewards": {
    slug: "boa-customized-cash-rewards",
    name: "Bank of America® Customized Cash Rewards",
    issuer: "Bank of America",
    annualFee: 0,
    rewardsByCategory: {
      chosen_category: 3,
      groceries: 2,
      wholesale_clubs: 2,
      other: 1,
    },
    perks: [
      "3% cash back in a category of your choice",
      "2% cash back at grocery stores and wholesale clubs",
      "1% cash back on all other purchases",
      "3% and 2% cash back categories are capped at $2,500 per quarter in combined purchases",
    ],
  },
  "boa-unlimited-cash-rewards": {
    slug: "boa-unlimited-cash-rewards",
    name: "Bank of America® Unlimited Cash Rewards",
    issuer: "Bank of America",
    annualFee: 0,
    rewardsByCategory: {
      other: 1.5,
    },
    perks: ["1.5% cash back on all purchases"],
  },
  "boa-bankamericard": {
    slug: "boa-bankamericard",
    name: "BankAmericard®",
    issuer: "Bank of America",
    annualFee: 0,
    rewardsByCategory: {},
    perks: ["Low intro APR offer (see terms)", "No annual fee"],
  },
  "boa-travel-rewards": {
    slug: "boa-travel-rewards",
    name: "Bank of America® Travel Rewards",
    issuer: "Bank of America",
    annualFee: 0,
    rewardsByCategory: {
      travel_portal: 3,
      other: 1.5,
    },
    perks: [
      "3 points per $1 spent on travel booked through the Bank of America Travel Center",
      "1.5 points per $1 spent on all other purchases",
      "Redeem points for travel or dining statement credits",
      "No foreign transaction fees",
    ],
  },
  "usbank-smartly": {
    slug: "usbank-smartly",
    name: "U.S. Bank Smartly™ Visa Signature® Card",
    issuer: "U.S. Bank",
    annualFee: 0,
    rewardsByCategory: {
      other: 2,
    },
    perks: [
      "Unlimited 2% cash back on every purchase",
      "Up to 2.5% cash back with qualifying balances of $10,000–$49,999",
      "Up to 3% cash back with qualifying balances of $50,000–$99,999",
      "Up to 4% cash back with qualifying balances of $100,000+",
    ],
  },
  "usbank-shield": {
    slug: "usbank-shield",
    name: "U.S. Bank Shield™ Visa® Card",
    issuer: "U.S. Bank",
    annualFee: 0,
    rewardsByCategory: {
      travel_portal: 4,
    },
    perks: [
      "0% intro APR on purchases and balance transfers for 24 billing cycles",
      "4% cash back on prepaid air, hotel and car reservations booked directly in the Travel Center",
      "$20 annual statement credit after 11 consecutive months of purchases",
      "No annual fee",
    ],
  },
  "usbank-split": {
    slug: "usbank-split",
    name: "Split™ World Mastercard®",
    issuer: "U.S. Bank",
    annualFee: 0,
    rewardsByCategory: {},
    perks: [
      "No interest for 3-month payment plans",
      "No annual fee",
    ],
  },
  "usbank-cash-plus": {
    slug: "usbank-cash-plus",
    name: "U.S. Bank Cash+® Visa Signature® Card",
    issuer: "U.S. Bank",
    annualFee: 0,
    rewardsByCategory: {
      chosen_category: 5,
      travel_portal: 5,
      chosen_category_secondary: 2,
      other: 1,
    },
    perks: [
      "5% cash back on the first $2,000 in combined purchases each quarter in two categories you choose",
      "5% cash back on prepaid air, hotel and car reservations booked directly in the Travel Center",
      "2% cash back on one everyday category you choose each quarter",
      "1% cash back on all other eligible purchases",
      "No annual fee",
    ],
  },
  "usbank-altitude-go": {
    slug: "usbank-altitude-go",
    name: "U.S. Bank Altitude® Go Visa Signature® Card",
    issuer: "U.S. Bank",
    annualFee: 0,
    rewardsByCategory: {
      dining: 4,
      groceries: 2,
      gas: 2,
      streaming: 2,
      other: 1,
    },
    perks: [
      "4X points on dining, takeout and restaurant delivery on the first $2,000 each quarter",
      "2X points at grocery stores and gas stations/EV charging stations",
      "2X points on streaming services",
      "1X point on all other eligible purchases",
      "$15 annual statement credit for eligible streaming services",
      "No annual fee",
    ],
  },
};
