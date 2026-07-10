import type { Card, Wallet } from "../../../packages/rewardly-core/src";
import {
  getCardsCollection,
  getLinkedAccountsCollection,
  getUserBenefitStatesCollection,
} from "../db";
import { CARD_OVERRIDES } from "../scrapers/overrides/cards";

export type WalletResolutionInput = {
  userId: string;
  manualCardSlugs?: string[];
  restrictToWallet?: boolean;
};

export type WalletBenefitState = {
  benefitKey: string;
  cardSlug?: string | null;
  cardName?: string | null;
  label?: string | null;
  requiresEnrollment?: boolean;
  enrolled?: boolean;
  usedAt?: string | null;
  remindEnabled?: boolean;
};

export type ResolvedWallet = Wallet & {
  benefitStates: WalletBenefitState[];
};

export async function resolveUserWallet({
  userId,
  manualCardSlugs = [],
  restrictToWallet = true,
}: WalletResolutionInput): Promise<ResolvedWallet> {
  const [allCards, linkedSlugs, benefitStates] = await Promise.all([
    loadCards(),
    loadLinkedCardSlugs(userId),
    loadBenefitStates(userId),
  ]);

  const manualSlugs = manualCardSlugs
    .map((slug) => String(slug || "").trim())
    .filter(Boolean);
  const ownedSlugs = new Set([...linkedSlugs, ...manualSlugs]);

  const cards = restrictToWallet
    ? allCards.filter((card) => ownedSlugs.has(card.slug))
    : allCards;

  return {
    userId,
    cards,
    cardSlugs: cards.map((card) => card.slug),
    source: walletSource(linkedSlugs.length, manualSlugs.length),
    benefitStates,
  };
}

async function loadCards(): Promise<Card[]> {
  const col = await getCardsCollection();
  const rawCards = await col.find({}).toArray();
  return dedupeCards(rawCards.map(applyCardOverride).map(toDomainCard));
}

async function loadLinkedCardSlugs(userId: string) {
  const linkedCol = await getLinkedAccountsCollection();
  const linkedDocs = await linkedCol.find({ userId }).toArray();
  const slugs = new Set<string>();

  linkedDocs.forEach((doc: any) => {
    (doc.accounts || []).forEach((account: any) => {
      const slug = String(account?.mappedCardSlug || "").trim();
      if (slug) slugs.add(slug);
    });
  });

  return Array.from(slugs);
}

async function loadBenefitStates(
  userId: string,
): Promise<WalletBenefitState[]> {
  const col = await getUserBenefitStatesCollection();
  const docs = await col.find({ userId }).toArray();
  return docs.map((doc: any) => ({
    benefitKey: doc.benefitKey,
    cardSlug: doc.cardSlug || null,
    cardName: doc.cardName || null,
    label: doc.label || null,
    requiresEnrollment: !!doc.requiresEnrollment,
    enrolled: !!doc.enrolled,
    usedAt: doc.usedAt ? new Date(doc.usedAt).toISOString() : null,
    remindEnabled: !!doc.remindEnabled,
  }));
}

function applyCardOverride(card: any) {
  const override = card?.slug ? CARD_OVERRIDES[card.slug] : undefined;
  if (!override) return card;
  return {
    ...card,
    name: override.name ?? card.name,
    issuer: override.issuer ?? card.issuer,
    annualFee: override.annualFee ?? card.annualFee,
    sourceUrl: override.sourceUrl ?? card.sourceUrl,
    rewardsByCategory: override.rewardsByCategory ?? card.rewardsByCategory,
    perks: override.perks ?? card.perks,
    signupOffer: override.signupOffer ?? card.signupOffer,
    merchantCredits: override.merchantCredits ?? card.merchantCredits,
    recurringCredits: override.recurringCredits ?? card.recurringCredits,
    benefitsDetail: override.benefitsDetail ?? card.benefitsDetail,
  };
}

function toDomainCard(card: any): Card {
  const slug = String(card?.slug || card?.name || "unknown-card")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return {
    slug,
    name: String(card?.name || slug || "Unknown card"),
    issuer: card?.issuer || null,
    annualFee: Number.isFinite(card?.annualFee) ? Number(card.annualFee) : null,
    perks: Array.isArray(card?.perks) ? card.perks.map(String) : [],
    sourceUrl: card?.sourceUrl || null,
    lastVerified:
      card?.benefitsDetail?.lastScraped || card?.lastScraped || null,
  };
}

function dedupeCards(cards: Card[]) {
  const bySlug = new Map<string, Card>();
  cards.forEach((card) => {
    if (!bySlug.has(card.slug)) bySlug.set(card.slug, card);
  });
  return Array.from(bySlug.values());
}

function walletSource(
  linkedCount: number,
  manualCount: number,
): Wallet["source"] {
  if (linkedCount && manualCount) return "mixed";
  if (linkedCount) return "plaid";
  if (manualCount) return "manual";
  return "empty";
}
