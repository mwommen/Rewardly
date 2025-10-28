// frontend/src/CardItem.tsx
import React from "react";
import type { Card } from "./cardModules";
import "./CardList.css";

interface Props {
  card: Card;
  highlight?: boolean;
}

const CardItem: React.FC<Props> = ({ card, highlight = false }) => {
  return (
    <div className={`card-item ${highlight ? "highlight" : ""}`}>
      {highlight && <div className="badge">Best Card</div>}

      <h2 className="card-name">{card.name}</h2>
      <p className="card-type">{card.issuer} - {card.type}</p>
      <p className="card-fee">Annual Fee: ${card.annualFee} | APR: {card.apr}</p>

      <div className="benefits">
        <h3>Benefits</h3>
        <ul>
          {Object.entries(card.benefits).map(([category, multiplier], i) => (
            <li key={i}>
              <span className="category-icon">{getCategoryIcon(category)}</span>
              <strong>{category.charAt(0).toUpperCase() + category.slice(1)}:</strong> {multiplier}x points
            </li>
          ))}
        </ul>
      </div>

      <div className="perks">
        <h3>Perks</h3>
        <ul>
          {card.perks.map((perk, i) => (
            <li key={i}>{perk}</li>
          ))}
        </ul>
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
