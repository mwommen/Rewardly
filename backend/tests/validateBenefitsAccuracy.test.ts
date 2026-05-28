import { validateBenefitsAccuracy } from "../src/validateBenefitsAccuracy";

describe("validateBenefitsAccuracy", () => {
  test("passes known expected benefits for key cards", () => {
    const failures = validateBenefitsAccuracy([
      {
        slug: "amex-gold",
        name: "American Express Gold Card",
        issuer: "American Express",
        recurringCredits: [
          { label: "$10 monthly Dining Credit at select partners (up to $120/yr)", amountUSD: 10, period: "month" },
          { label: "$50 Resy Credit semi-annually (up to $100/yr)", amountUSD: 50, period: "semi-annual" },
          { label: "$7 Dunkin' Credit monthly (up to $84/yr)", amountUSD: 7, period: "month" },
          { label: "$10 monthly Uber Cash (up to $120/yr)", amountUSD: 10, period: "month" },
        ],
      },
      {
        slug: "amex-platinum",
        name: "The Platinum Card from American Express",
        issuer: "American Express",
        merchantCredits: [
          { label: "$75 statement credit at lululemon each quarter", amountUSD: 75, period: "quarter" },
          { label: "$50 statement credit at Saks semi-annually", amountUSD: 50, period: "semi-annual" },
        ],
        recurringCredits: [
          { label: "$200 Uber Cash", amountUSD: 200, period: "year" },
          { label: "$120 Uber One membership credit", amountUSD: 120, period: "year" },
          { label: "$209 CLEAR Plus statement credit", amountUSD: 209, period: "year" },
          { label: "$400 Resy dining credit", amountUSD: 400, period: "year" },
          { label: "$300 Digital Entertainment credit", amountUSD: 300, period: "year" },
          { label: "$155 Walmart+ credit", amountUSD: 155, period: "year" },
          { label: "$200 Airline Fee credit", amountUSD: 200, period: "year" },
          { label: "$600 Hotel credit", amountUSD: 600, period: "year" },
        ],
      },
      {
        slug: "capital-one-venture-x",
        name: "Capital One Venture X",
        issuer: "Capital One",
        recurringCredits: [
          { label: "$300 Capital One Travel credit", amountUSD: 300, period: "year" },
          { label: "Up to $100 credit for Global Entry or TSA PreCheck", amountUSD: 100, period: "year" },
        ],
      },
    ]);

    expect(failures).toEqual([]);
  });

  test("flags benefits assigned to the wrong card and referral text as credits", () => {
    const failures = validateBenefitsAccuracy([
      {
        slug: "amex-gold",
        name: "American Express Gold Card",
        issuer: "American Express",
        recurringCredits: [
          { label: "$400 Resy dining credit", amountUSD: 400, period: "year" },
          { label: "$75 statement credit at lululemon each quarter", amountUSD: 75, period: "quarter" },
          { label: "Earn up to $500 cash back per year for each friend who gets a card", amountUSD: 500, period: "year" },
        ],
      },
      {
        slug: "amex-platinum",
        name: "The Platinum Card from American Express",
        issuer: "American Express",
        recurringCredits: [],
      },
      {
        slug: "capital-one-venture-x",
        name: "Capital One Venture X",
        issuer: "Capital One",
        recurringCredits: [],
      },
    ]);

    expect(failures.some((failure) => /unexpected benefit/i.test(failure.reason))).toBe(true);
    expect(failures.some((failure) => /referral copy/i.test(failure.reason))).toBe(true);
    expect(failures.some((failure) => /missing expected benefit/i.test(failure.reason))).toBe(true);
  });
});
