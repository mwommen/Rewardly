import { cleanCreditsForStorage, cleanPerksForStorage } from "../src/scrapers/benefitsQuality";

describe("benefitsQuality", () => {
  test("dedupes and trims long perks for storage", () => {
    const longLine =
      "Earn 5x points on travel purchases booked through the issuer portal with additional qualifying merchant terms and annual cap details that make the original line excessively long for storage and display in the current system.";

    const cleaned = cleanPerksForStorage([
      "No annual fee",
      "No annual fee",
      longLine,
    ]);

    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]).toBe("No annual fee");
    expect(cleaned[1].length).toBeLessThanOrEqual(220);
  });

  test("dedupes credits by normalized label, amount, and period", () => {
    const cleaned = cleanCreditsForStorage([
      { label: "$200 Uber Cash (annual; monthly accrual)", amountUSD: 200, period: "year" },
      { label: "$200   Uber Cash (annual; monthly accrual)", amountUSD: 200, period: "year" },
      { label: "$120 Uber One membership credit (per year)", amountUSD: 120, period: "year" },
    ]);

    expect(cleaned).toHaveLength(2);
    expect(cleaned[0].label).toBe("$200 Uber Cash (annual; monthly accrual)");
    expect(cleaned[1].label).toBe("$120 Uber One membership credit (per year)");
  });

  test("dedupes trademark variants of the same credit", () => {
    const cleaned = cleanCreditsForStorage([
      { label: "$50 Annual Chase TravelSM Hotel Credit", amountUSD: 50, period: "year" },
      { label: "$50 Annual Chase Travel Hotel Credit", amountUSD: 50, period: "year" },
    ]);

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].label).toBe("$50 Annual Chase Travel Hotel Credit");
  });

  test("drops escaped JSON fragments", () => {
    const cleaned = cleanPerksForStorage([
      '"],["^ ","id","feeCreditTSA","text","Fee Credit for Global Entry or TSA Precheck \\u0026#174;"',
      "Global Entry or TSA PreCheck credit",
    ]);

    expect(cleaned).toEqual(["Global Entry or TSA PreCheck credit"]);
  });

  test("dedupes trademark variants of the same perk", () => {
    const cleaned = cleanPerksForStorage([
      "5% cash back on travel purchased through Chase TravelSM",
      "5% cash back on travel purchased through Chase Travel",
    ]);

    expect(cleaned).toEqual(["5% cash back on travel purchased through Chase Travel"]);
  });
});
