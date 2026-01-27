import { getDb } from "./db";

type ExpectedCard = {
  slug: string;
  annualFee: number | null;
  rewardsByCategory?: Record<string, number>;
};

const EXPECTED: ExpectedCard[] = [
  {
    slug: "amex-gold",
    annualFee: 325,
    rewardsByCategory: {},
  },
  {
    slug: "amex-platinum",
    annualFee: 895,
    rewardsByCategory: {},
  },
  {
    slug: "chase-sapphire-preferred",
    annualFee: 95,
    rewardsByCategory: { travel: 5, dining: 3, groceries: 3 },
  },
  {
    slug: "chase-freedom-unlimited",
    annualFee: 0,
    rewardsByCategory: { dining: 0.03, travel: 0.05, drugstore: 0.03, other: 0.015 },
  },
  {
    slug: "citi-custom-cash",
    annualFee: 0,
    rewardsByCategory: {
      dining: 0.05,
      groceries: 0.05,
      gas: 0.05,
      transit: 0.05,
      drugstores: 0.05,
      other: 0.01,
    },
  },
  {
    slug: "capital-one-savorone",
    annualFee: 0,
    rewardsByCategory: { dining: 3, entertainment: 3, streaming: 3, groceries: 3, other: 1 },
  },
  {
    slug: "capital-one-venture-x",
    annualFee: 395,
    rewardsByCategory: { travel: 10, other: 2 },
  },
];

const EPS = 0.001;

function approxEqual(a: number, b: number) {
  return Math.abs(a - b) <= EPS;
}

async function main() {
  const db = await getDb();
  const col = db.collection("cards");

  const failures: string[] = [];

  for (const expected of EXPECTED) {
    const card = await col.findOne({ slug: expected.slug });
    if (!card) {
      failures.push(`${expected.slug}: missing from DB`);
      continue;
    }

    if (expected.annualFee !== card.annualFee) {
      failures.push(`${expected.slug}: annualFee expected ${expected.annualFee}, got ${card.annualFee}`);
    }

    const rewards = card.rewardsByCategory || {};
    for (const [cat, val] of Object.entries(expected.rewardsByCategory || {})) {
      const actual = rewards[cat];
      if (typeof actual !== "number") {
        failures.push(`${expected.slug}: missing rewardsByCategory.${cat}`);
        continue;
      }
      if (!approxEqual(actual, val)) {
        failures.push(`${expected.slug}: rewardsByCategory.${cat} expected ${val}, got ${actual}`);
      }
    }
  }

  if (failures.length) {
    console.error("❌ Validation failed:");
    failures.forEach((f) => console.error(`- ${f}`));
    process.exit(1);
  }

  console.log("✅ Validation passed for", EXPECTED.length, "cards");
}

main().catch((err) => {
  console.error("❌ Validation error:", err);
  process.exit(2);
});
