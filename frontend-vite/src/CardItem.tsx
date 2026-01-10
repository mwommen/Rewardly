// frontend/src/CardItem.tsx
import type { Card } from "./cardModules";
import "./CardList.css";

interface Props {
  card: Card;
  highlight?: boolean;
}

const CardItem = ({ card, highlight = false }: Props) => {
  const benefitSource = Object.keys(card.benefits || {}).length
    ? card.benefits
    : (card.rewardsByCategory || {});
  const benefits = Object.entries(benefitSource || {});
  const merchantCredits = filterCredits(card.merchantCredits || []);
  const recurringCredits = filterCredits(card.recurringCredits || []);
  const annualFee = Number.isFinite(card.annualFee) ? `$${card.annualFee}` : "—";
  const apr = card.apr ? `${card.apr}` : "—";

  return (
    <div className={`card-item ${highlight ? "highlight" : ""}`}>
      {highlight && <div className="badge">Top Pick</div>}

      <div className="card-header">
        <div>
          <h2 className="card-name">{card.name}</h2>
          <p className="card-type">{card.issuer || "Issuer"} · {card.type || "Rewards"}</p>
        </div>
        <div className="card-meta">
          <span>Annual Fee</span>
          <strong>{annualFee}</strong>
          <span>APR</span>
          <strong>{apr}</strong>
        </div>
      </div>

      <div className="benefits">
        <h3>Benefits</h3>
        {benefits.length ? (
          <ul>
            {benefits.map(([category, multiplier], i) => (
              <li key={i}>
                <span className="category-icon">{getCategoryIcon(category)}</span>
                <strong>{category.charAt(0).toUpperCase() + category.slice(1)}:</strong>{" "}
                {formatRewardValue(multiplier)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No structured rewards parsed yet.</p>
        )}
      </div>

      <div className="credits">
        <h3>Credits</h3>
        {merchantCredits.length || recurringCredits.length ? (
          <ul>
            {merchantCredits.map((credit) => (
              <li key={credit.id}>
                <strong>{credit.label}</strong>
                <span>{formatCredit(credit.amountUSD, credit.period)}</span>
                {credit.requiresEnrollment && <em>Enrollment required</em>}
              </li>
            ))}
            {recurringCredits.map((credit) => (
              <li key={credit.id}>
                <strong>{credit.label}</strong>
                <span>{formatCredit(credit.amountUSD, credit.period)}</span>
                {credit.requiresEnrollment && <em>Enrollment required</em>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No credits parsed yet.</p>
        )}
      </div>

      <div className="perks">
        <h3>Perks</h3>
        {card.perks.length ? (
          <ul>
            {card.perks.map((perk, i) => (
              <li key={i}>{perk}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">Add perks as they are detected.</p>
        )}
      </div>
    </div>
  );
};

// Example category icons
const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case "groceries": return "🛒";
    case "travel": return "✈️";
    case "electronics": return "💻";
    case "dining": return "🍽️";
    default: return "💳";
  }
};

const formatCredit = (amountUSD: number, period: string) => {
  const amount = Number.isFinite(amountUSD) ? `$${amountUSD}` : "$—";
  const per =
    period === "month" ? "per month" :
    period === "quarter" ? "per quarter" :
    period === "semi-annual" ? "per half-year" :
    "per year";
  return `${amount} ${per}`;
};

const filterCredits = <
  T extends { label: string; amountUSD: number; period: string; confidence?: number }
>(credits: T[]) => {
  const seen = new Set<string>();
  return credits.filter((credit) => {
    const label = (credit.label || "").trim();
    if (!label || label.length > 160) return false;
    if (/[<>]/.test(label) || /https?:\/\//i.test(label)) return false;
    if (!Number.isFinite(credit.amountUSD) || credit.amountUSD < 10 || credit.amountUSD > 1000) {
      return false;
    }
    if (credit.confidence != null && credit.confidence < 0.7) return false;
    if (!/(credit|statement|cash|reimburse|membership)/i.test(label)) return false;
    const key = `${label}|${credit.amountUSD}|${credit.period}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatRewardValue = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 1) return `${Math.round(value * 100)}% back`;
  return `${value}x points`;
};

export default CardItem;
