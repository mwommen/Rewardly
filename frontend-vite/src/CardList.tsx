// frontend/src/CardList.tsx
import type { Card } from "./cardModules";
import CardItem from "./CardItem";

interface Props {
  cards: Card[];
  bestCardId?: string;
}

const CardList = ({ cards, bestCardId }: Props) => {
  if (!cards.length) {
    return (
      <div className="empty-state">
        <h3>No cards match your filters yet.</h3>
        <p>Try a different category or clear your search.</p>
      </div>
    );
  }

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
