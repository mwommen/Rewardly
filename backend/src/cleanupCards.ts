// backend/src/cleanupCards.ts
import { ObjectId } from "mongodb";
import { getCardsCollection } from "./db";

type CardDoc = {
  _id: ObjectId;
  slug?: string;
  name?: string;
  issuer?: string;
  annualFee?: number | null;
  rewardsByCategory?: Record<string, number>;
  perks?: string[];
  merchantCredits?: { amountUSD?: number }[];
  recurringCredits?: { amountUSD?: number }[];
  sourceUrl?: string;
  confidence?: number;
};

const isPlaceholder = (card: CardDoc) => {
  const name = (card.name || "").toLowerCase();
  const slug = (card.slug || "").toLowerCase();
  return (
    name.includes("unknown") ||
    name.includes("linked credit card") ||
    slug === "unknown-card"
  );
};

const scoreCard = (card: CardDoc) => {
  const rewardsCount = Object.keys(card.rewardsByCategory || {}).length;
  const perksCount = card.perks?.length || 0;
  const merchantCredits = card.merchantCredits?.length || 0;
  const recurringCredits = card.recurringCredits?.length || 0;
  const hasSource = card.sourceUrl ? 1 : 0;
  const hasIssuer = card.issuer ? 1 : 0;
  const confidence = typeof card.confidence === "number" ? card.confidence : 0;
  return (
    rewardsCount * 3 +
    perksCount * 2 +
    (merchantCredits + recurringCredits) * 2 +
    hasSource * 2 +
    hasIssuer +
    confidence
  );
};

const normalizeKey = (card: CardDoc) =>
  (card.slug || card.name || "").trim().toLowerCase();

async function main() {
  const apply = process.argv.includes("--apply");
  const col = await getCardsCollection();
  const cards = (await col.find({}).toArray()) as CardDoc[];

  const byKey = new Map<string, CardDoc[]>();
  for (const card of cards) {
    const key = normalizeKey(card);
    if (!key) continue;
    const list = byKey.get(key) || [];
    list.push(card);
    byKey.set(key, list);
  }

  const toRemove: ObjectId[] = [];
  const removedPlaceholders: CardDoc[] = [];
  const deduped: Array<{ key: string; keep: CardDoc; remove: CardDoc[] }> = [];

  for (const card of cards) {
    if (isPlaceholder(card)) {
      removedPlaceholders.push(card);
      toRemove.push(card._id);
    }
  }

  for (const [key, list] of byKey) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => scoreCard(b) - scoreCard(a));
    const keep = sorted[0];
    const remove = sorted.slice(1);
    deduped.push({ key, keep, remove });
    remove.forEach((card) => toRemove.push(card._id));
  }

  console.log("🧹 Cleanup summary");
  console.log("Total cards:", cards.length);
  console.log("Placeholders:", removedPlaceholders.length);
  console.log("Duplicate groups:", deduped.length);
  console.log("Total removals:", toRemove.length);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete duplicates/placeholders.");
    return;
  }

  if (toRemove.length) {
    await col.deleteMany({ _id: { $in: toRemove } });
    console.log("✅ Removed", toRemove.length, "cards.");
  } else {
    console.log("✅ Nothing to remove.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
