import type { Card as WalletCard } from "../cardModules";
import { formatCategory } from "./formatters";

export const WALLET_FALLBACKS = [
  "amex-platinum",
  "amex-gold",
  "chase-sapphire-preferred",
  "capital-one-venture-x",
];

export function topRewards(card: WalletCard) {
  const rewards = card.rewardsByCategory || card.benefits || {};
  return Object.entries(rewards)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([category, value]) => `${value}x ${formatCategory(category)}`);
}

export function walletSections(card: WalletCard) {
  const credits = [
    ...(card.merchantCredits || []),
    ...(card.recurringCredits || []),
  ];
  const perks = card.perks || [];
  const rewards = topRewards(card);
  const protections = perks
    .filter((perk) => /protection|insurance|warranty|coverage/i.test(perk))
    .slice(0, 3);
  const travel = perks
    .filter((perk) => /travel|lounge|hotel|flight|rental|trip/i.test(perk))
    .slice(0, 3);

  return [
    { title: "Best for", items: topRewards(card).slice(0, 2) },
    { title: "Rewards", items: rewards },
    {
      title: "Benefits",
      items: perks
        .filter((perk) => !protections.includes(perk) && !travel.includes(perk))
        .slice(0, 3),
    },
    { title: "Protections", items: protections },
    {
      title: "Credits",
      items: credits
        .slice(0, 3)
        .map((credit) => `$${credit.amountUSD} ${credit.label}`),
    },
    { title: "Offers", items: card.signupOffer ? [card.signupOffer] : [] },
    { title: "Travel perks", items: travel },
  ].filter((section) => section.items.length);
}
