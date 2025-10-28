import { UpdateFilter } from "mongodb";
import { getCardsCollection } from "./src/db";

async function run() {
  const col = await getCardsCollection();

  const docs = [
    {
      slug: "amex-gold",
      name: "American Express® Gold",
      rewardsByCategory: { default: 1, groceries: 4, apparel: 3, online_shopping: 2 },
      perks: ["$10 dining credit (select partners)"],
    },
    {
      slug: "csp",
      name: "Chase Sapphire Preferred",
      rewardsByCategory: { default: 1, online_shopping: 2, groceries: 1, apparel: 2 },
      perks: ["Primary rental CDW"],
    },
    {
      slug: "chase-freedom",
      name: "Chase Freedom",
      rewardsByCategory: { default: 1.5, online_shopping: 3, apparel: 3 },
      perks: ["Rotating 5% categories (enroll)"],
    },
    {
      slug: "custom-cash",
      name: "Citi Custom Cash",
      rewardsByCategory: { default: 1, groceries: 5, online_shopping: 2 },
      perks: ["5% on top category (up to cap)"],
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
