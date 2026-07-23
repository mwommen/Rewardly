import { UpdateFilter } from "mongodb";
import { getCardsCollection } from "./src/db";

async function run() {
  const col = await getCardsCollection();

  const docs = [
    {
      slug: "amex-gold",
      name: "American Express® Gold Card",
      issuer: "American Express",
      annualFee: 325,
      sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
      rewardsByCategory: { dining: 4, groceries: 4, travel: 3, default: 1 },
      perks: [
        "4x points at restaurants worldwide",
        "4x points at U.S. supermarkets on up to $25,000 per year, then 1x",
        "3x points on flights booked directly with airlines or on amextravel.com",
        "2x points on prepaid hotels booked on amextravel.com",
      ],
    },
    {
      slug: "amex-platinum",
      name: "The Platinum Card® from American Express",
      issuer: "American Express",
      annualFee: 895,
      sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/platinum/",
      sourceType: "issuer_official",
      lastVerified: "2026-07-01T00:00:00.000Z",
      productionEligible: true,
      rewardsByCategory: { travel: 5, default: 1 },
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
      recurringCredits: [
        {
          id: "amex-platinum-uber-cash",
          label: "$200 Uber Cash",
          amountUSD: 200,
          period: "year",
          partner: "Uber",
          requiresEnrollment: true,
          sourceUrl: "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
          enrollmentUrl: "https://global.americanexpress.com/card-benefits/detail/uber-cash/platinum",
          confidence: 0.9,
        },
      ],
      perks: [
        "5x points on flights booked directly with airlines or through American Express Travel",
        "5x points on prepaid hotels booked on amextravel.com",
      ],
    },
    {
      slug: "chase-sapphire-preferred",
      name: "Chase Sapphire Preferred®",
      issuer: "Chase",
      sourceUrl: "https://creditcards.chase.com/rewards-credit-cards/chase-sapphire-preferred",
      rewardsByCategory: { travel: 5, dining: 3, groceries: 3, streaming: 3, default: 1 },
      perks: [
        "5x total points on travel purchased through Chase Travel",
        "3x points on dining, online grocery purchases, and select streaming services",
        "2x points on other travel purchases",
      ],
    },
    {
      slug: "chase-freedom-unlimited",
      name: "Chase Freedom Unlimited®",
      issuer: "Chase",
      sourceUrl: "https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited",
      rewardsByCategory: { travel: 5, dining: 3, drugstore: 3, default: 1.5 },
      perks: [
        "5% cash back on travel purchased through Chase Travel",
        "3% cash back on dining and drugstore purchases",
        "1.5% cash back on all other purchases",
      ],
    },
    {
      slug: "citi-custom-cash",
      name: "Citi Custom Cash® Card",
      issuer: "Citi",
      annualFee: 0,
      sourceUrl: "https://www.citi.com/credit-cards/citi-custom-cash-credit-card",
      rewardsByCategory: {
        dining: 5,
        gas: 5,
        groceries: 5,
        travel: 5,
        transit: 5,
        streaming: 5,
        drugstore: 5,
        home_improvement: 5,
        fitness: 5,
        entertainment: 5,
        default: 1,
      },
      perks: [
        "5% cash back on your top eligible spend category each billing cycle (up to $500), then 1%",
        "Eligible categories include restaurants, gas, grocery, select travel, select transit, streaming, drugstores, home improvement, fitness clubs, and live entertainment",
      ],
    },
    {
      slug: "citi-double-cash",
      name: "Citi Double Cash® Card",
      issuer: "Citi",
      annualFee: 0,
      sourceUrl: "https://www.citi.com/citi/cards/credit-cards/double-cash",
      rewardsByCategory: { default: 2 },
      perks: [
        "2% cash back on all purchases: 1% when you buy and 1% as you pay.",
      ],
    },
    {
      slug: "citi-premier",
      name: "Citi Premier® Card",
      issuer: "Citi",
      annualFee: 95,
      sourceUrl: "https://www.citi.com/credit-cards/citi-premier-card",
      rewardsByCategory: { travel: 3, dining: 3, gas: 3, groceries: 3, entertainment: 3, default: 1 },
      perks: [
        "3x points at restaurants, supermarkets, gas stations, hotels, and air travel.",
        "Points are redeemable for travel and gift cards.",
      ],
    },
    {
      slug: "discover-it-cash-back",
      name: "Discover it® Cash Back",
      issuer: "Discover",
      annualFee: 0,
      sourceUrl: "https://www.discover.com/credit-cards/cash-back/it-card/",
      rewardsByCategory: { default: 1, groceries: 5, gas: 5, restaurants: 5, streaming: 5 },
      perks: [
        "5% cash back on rotating quarterly categories when activated; 1% on all other purchases.",
      ],
    },
    {
      slug: "discover-it-student",
      name: "Discover it® Student Cash Back",
      issuer: "Discover",
      annualFee: 0,
      sourceUrl: "https://www.discover.com/credit-cards/student/it-student-cash-back/",
      rewardsByCategory: { default: 1, groceries: 5, gas: 5, restaurants: 5 },
      perks: [
        "5% cash back on rotating quarterly categories when activated; 1% on all other purchases.",
      ],
    },
    {
      slug: "capital-one-savorone",
      name: "Capital One SavorOne",
      issuer: "Capital One",
      sourceUrl: "https://www.capitalone.com/credit-cards/savorone/",
      rewardsByCategory: { dining: 3, entertainment: 3, streaming: 3, groceries: 3, default: 1 },
      perks: [
        "3% cash back at grocery stores, on dining, entertainment and popular streaming services",
        "1% cash back on all other purchases",
      ],
    },
    {
      slug: "capital-one-venture-x",
      name: "Capital One Venture X",
      issuer: "Capital One",
      annualFee: 395,
      sourceUrl: "https://www.capitalone.com/credit-cards/venture-x/",
      sourceType: "issuer_official",
      lastVerified: "2026-07-01T00:00:00.000Z",
      productionEligible: true,
      rewardsByCategory: { travel: 10, default: 2 },
      recurringCredits: [
        {
          id: "venturex-travel-credit",
          label: "$300 Capital One Travel credit",
          amountUSD: 300,
          period: "year",
          partner: "Capital One Travel",
          requiresEnrollment: false,
          sourceUrl: "https://www.capitalone.com/credit-cards/venture-x/",
        },
      ],
      perks: [
        "10x miles on hotels and rental cars booked through Capital One Travel",
        "5x miles on flights and vacation rentals booked through Capital One Travel",
        "2x miles on all other purchases",
      ],
    },
    {
      slug: "generic-credit",
      name: "Your Linked Credit Card",
      rewardsByCategory: { default: 1 },
      perks: [],
    },
  ];

  const ops = docs.map((d) => ({
    updateOne: {
      filter: { slug: d.slug },
      update: ({ $set: d } as unknown) as UpdateFilter<any>,
      upsert: true,
    },
  }));

  const result = await col.bulkWrite(ops);
  console.log("Seed complete:", {
    matched: result.matchedCount,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  });
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
