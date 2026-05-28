import { useState } from "react";
import { getCardLogoBySlug } from "../lib/cardLogos";

type OfferItem = {
  card: { slug: string; name: string };
  signupOffer?: string | null;
  perks?: string[];
};

type Props = { items: OfferItem[] };

export default function OffersList({ items }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!items?.length) {
    return <div className="offer-empty">No current offers or perks matched this merchant.</div>;
  }

  return (
    <div className="offers-grid">
      {items.map((o) => {
        const cleaned = cleanPerks(o.perks);
        const groups = groupPerks(cleaned);
        const hasGroups = groups.credits.length || groups.rewards.length || groups.protections.length;
        const isOpen = expanded[o.card.slug] || false;
        const maxPreview = 2;
        const credits = isOpen ? groups.credits : groups.credits.slice(0, maxPreview);
        const rewards = isOpen ? groups.rewards : groups.rewards.slice(0, maxPreview);
        const protections = isOpen ? groups.protections : groups.protections.slice(0, maxPreview);
        const totalCount = groups.credits.length + groups.rewards.length + groups.protections.length;
        const shownCount = credits.length + rewards.length + protections.length;
        const logo = getCardLogoBySlug(o.card.slug);

        return (
          <article key={o.card.slug} className="offer-card">
            <header className="offer-header">
              {logo && (
                <img
                  className="offer-logo"
                  src={logo}
                  alt={`${o.card.name} card`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="offer-meta">
                <div className="offer-title">{o.card.name}</div>
                {o.signupOffer && <div className="offer-signup">Signup offer: {truncate(o.signupOffer, 120)}</div>}
              </div>
              <span className="offer-tag">Matched</span>
            </header>

            {hasGroups ? (
              <div className="offer-groups">
                {rewards.length > 0 && <Section title="Rewards" items={rewards} />}
                {credits.length > 0 && <Section title="Credits" items={credits} />}
                {protections.length > 0 && <Section title="Protections" items={protections} />}
              </div>
            ) : (
              <div className="offer-empty">No listed ongoing perks.</div>
            )}

            {totalCount > shownCount && (
              <button
                type="button"
                className="offer-toggle"
                onClick={() => setExpanded((prev) => ({ ...prev, [o.card.slug]: !isOpen }))}
              >
                {isOpen ? "Hide benefits" : "See all benefits"}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="offer-group">
      <div className="offer-group-title">{title}</div>
      <ul className="offer-list">
        {items.map((p, i) => (
          <li key={`${title}-${i}`}>{truncate(p, 120)}</li>
        ))}
      </ul>
    </div>
  );
}

function cleanPerks(perks?: string[]) {
  if (!perks?.length) return [];
  const seen = new Set<string>();
  return perks
    .map((p) => String(p || "").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 6)
    .filter((p) => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function groupPerks(perks: string[]) {
  const credits = [];
  const rewards = [];
  const protections = [];
  for (const p of perks) {
    const low = p.toLowerCase();
    if (/(credit|statement|rebate|offer)/.test(low)) credits.push(p);
    else if (/(x points|x miles|cash back|points|miles|earn)/.test(low)) rewards.push(p);
    else if (/(protection|insurance|warranty|coverage)/.test(low)) protections.push(p);
  }
  return { credits, rewards, protections };
}

function truncate(value: string, max = 120) {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
}
