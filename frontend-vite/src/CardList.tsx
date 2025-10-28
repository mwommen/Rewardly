// frontend/src/CardList.tsx
import React from "react";
import type { Card } from "./cardModules";
import CardItem from "./CardItem";

interface Props {
  cards: Card[];
  bestCardId?: string;
}

const CardList: React.FC<Props> = ({ cards, bestCardId }) => {
  return (
    <div className="card-list">
      {cards.map((card) => (
        <CardItem
          key={card._id}
          card={card}
          highlight={card._id === bestCardId}
        />
      ))}
    </div>
  );
};

export default CardList;
