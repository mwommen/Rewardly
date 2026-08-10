import { Router } from "express";
import { CARD_OVERRIDES } from "../../../scrapers/overrides/cards";

const router = Router();

router.get("/card-catalog", (_req, res) => {
  const cards = Object.values(CARD_OVERRIDES)
    .map((card: any) => ({
      cardId: card.slug,
      displayName: card.name,
      issuer: card.issuer || null,
      annualFee: Number.isFinite(card.annualFee) ? card.annualFee : null,
      rewardProgram: rewardProgramForCatalogCard(card),
    }))
    .filter((card) => card.cardId && card.displayName)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  res.json({ cards });
});

export default router;

function rewardProgramForCatalogCard(card: any) {
  const text =
    `${card.name || ""} ${(card.perks || []).join(" ")}`.toLowerCase();
  if (/venture/.test(text)) return "Venture Miles";
  if (/membership rewards|amex|american express/.test(text))
    return "Membership Rewards";
  if (/ultimate rewards|chase/.test(text)) return "Ultimate Rewards";
  if (/thankyou|citi/.test(text)) return "ThankYou Points";
  if (/cash/.test(text)) return "Cash Back";
  return null;
}
