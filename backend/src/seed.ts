import { connectDB } from "./db";
import { Collection } from "mongodb";

interface CardBenefits {
  [key: string]: number;
}

interface Card {
  name: string;
  benefits: CardBenefits;
  perks: string[];
}

const cards: Card[] = [
  {
    name: "SuperPoints Card",
    benefits: { clothes: 2, groceries: 1, electronics: 3, target: 5 },
    perks: ["Purchase Protection", "Extended Warranty"],
  },
  {
    name: "ShopSaver Card",
    benefits: { clothes: 5, electronics: 3, walmart: 4 },
    perks: ["Price Protection", "Extended Warranty"],
  },
  {
    name: "Everyday Rewards",
    benefits: { clothes: 1, groceries: 2, amazon: 3 },
    perks: ["Cashback on Dining", "Travel Insurance"],
  },
];

async function seedDB(): Promise<void> {
  const db = await connectDB();
  const cardsCollection: Collection<Card> = db.collection<Card>("cards");

  await cardsCollection.deleteMany({}); // remove old data
  const result = await cardsCollection.insertMany(cards);

  console.log(`Inserted ${result.insertedCount} cards.`);
}

seedDB()
  .then(() => console.log("Seeding completed."))
  .catch((err) => console.error("Error seeding DB:", err));
