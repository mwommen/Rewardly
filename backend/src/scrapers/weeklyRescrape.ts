import type { Collection, UpdateFilter } from "mongodb";
import { getDb } from "../db";
import type { BenefitsPayload, MerchantCredit, RecurringCredit, RotatingWindow } from "../models/benefits";
import { hashBenefits, scrapeCardUrl } from "./scrapeCard";
import { cleanPerksForStorage } from "./benefitsQuality";

type StoredCard = {
  slug: string;
  name?: string;
  issuer?: string | null;
  annualFee?: number | null;
  apr?: string | null;
  rewardsByCategory?: Record<string, number>;
  benefitsDetail?: BenefitsPayload;
  rewardsRotating?: RotatingWindow[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  perks?: string[];
  signupOffer?: string | null;
  sourceUrl?: string;
  confidence?: number;
  lastScraped?: string;
};

type BenefitsHistoryEntry = {
  slug: string;
  scrapedAt: string;
  sourceUrl?: string;
  benefits: BenefitsPayload;
  hash: string;
};

const DEFAULT_DAYS = 7;

function daysAgo(date: string | undefined) {
  if (!date) return Infinity;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

async function main() {
  const force = process.argv.includes("--force");
  const daysArgIndex = process.argv.indexOf("--days");
  const days =
    daysArgIndex >= 0 ? Number(process.argv[daysArgIndex + 1]) || DEFAULT_DAYS : DEFAULT_DAYS;

  const db = await getDb();
  const col: Collection<StoredCard> = db.collection<StoredCard>("cards");
  const cards = await col
    .find({ sourceUrl: { $exists: true } })
    .project({ slug: 1, sourceUrl: 1, lastScraped: 1 })
    .toArray();

  const targets = cards.filter((card) => force || daysAgo(card.lastScraped) >= days);

  console.log("🔁 Weekly rescrape");
  console.log("Targets:", targets.length, "of", cards.length, "cards");

  for (const card of targets) {
    const url = String(card.sourceUrl || "");
    const slug = String(card.slug || "");
    if (!url || !slug) continue;

    console.log(`➡️  Scraping ${slug}`);
    const res = await scrapeCardUrl(url, slug);
    if (!res) {
      console.warn(`⚠️  Failed: ${slug}`);
      continue;
    }

    const existing = await col.findOne({ slug });

    const merged: StoredCard = {
      ...(existing || {}),
      ...(res || {}),
      rewardsByCategory:
        res?.rewardsByCategory && Object.keys(res.rewardsByCategory).length
          ? res.rewardsByCategory
          : existing?.rewardsByCategory || {},
      rewardsRotating:
        (res as any).rewardsRotating?.length ? (res as any).rewardsRotating : existing?.rewardsRotating || [],
      merchantCredits:
        (res as any).merchantCredits?.length ? (res as any).merchantCredits : existing?.merchantCredits || [],
      recurringCredits:
        (res as any).recurringCredits?.length ? (res as any).recurringCredits : existing?.recurringCredits || [],
      perks: res?.perks && res.perks.length ? cleanPerksForStorage(res.perks) : existing?.perks || [],
      signupOffer: res?.signupOffer ?? existing?.signupOffer ?? null,
      apr: res?.apr ?? existing?.apr ?? null,
      issuer: res?.issuer ?? existing?.issuer ?? null,
      benefitsDetail: res?.benefitsDetail ?? existing?.benefitsDetail,
      lastScraped: res?.lastScraped ?? existing?.lastScraped ?? new Date().toISOString(),
      confidence:
        typeof res?.confidence === "number"
          ? res.confidence
          : typeof existing?.confidence === "number"
          ? existing.confidence
          : 0,
      sourceUrl: res?.sourceUrl ?? existing?.sourceUrl ?? url,
      slug,
    };

    await col.updateOne({ slug }, { $set: merged } as UpdateFilter<StoredCard>, { upsert: true });

    if (res?.benefitsDetail) {
      const historyCol: Collection<BenefitsHistoryEntry> =
        db.collection<BenefitsHistoryEntry>("benefits_history");
      const hash = hashBenefits(res.benefitsDetail);
      const last = await historyCol.find({ slug }).sort({ scrapedAt: -1 }).limit(1).toArray();
      if (!last[0] || last[0].hash !== hash) {
        await historyCol.insertOne({
          slug,
          scrapedAt: res.benefitsDetail.lastScraped || new Date().toISOString(),
          sourceUrl: res.sourceUrl ?? url,
          benefits: res.benefitsDetail,
          hash,
        });
        console.log(`🧾 History saved for ${slug}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
