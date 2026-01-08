// frontend/src/CardItem.tsx
import type { Card } from "./cardModules";
import "./CardList.css";

interface Props {
  card: Card;
  highlight?: boolean;
}

const CardItem = ({ card, highlight = false }: Props) => {
  const benefits = Object.entries(card.benefits || {});
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
                <strong>{category.charAt(0).toUpperCase() + category.slice(1)}:</strong> {multiplier}x points
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No structured rewards parsed yet.</p>
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

export default CardItem;
