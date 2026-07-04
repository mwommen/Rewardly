// frontend/src/CardList.tsx
import type { Card } from "./cardModules";
import { useState } from "react";
import CardItem from "./CardItem";

interface Props {
  cards: Card[];
  bestCardId?: string;
  compareIds?: string[];
  onToggleCompare?: (card: Card) => void;
}

const CardList = ({
  cards,
  bestCardId,
  compareIds = [],
  onToggleCompare,
}: Props) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const chaseBusinessCards = cards.filter((card) =>
    (card.slug || "").startsWith("chase-ink-"),
  );
  const visibleCards = cards.filter(
    (card) => !(card.slug || "").startsWith("chase-ink-"),
  );
  const bestChaseBusiness = chaseBusinessCards.find(
    (card) => card._id === bestCardId,
  );
  const [selectedChaseBusinessSlug, setSelectedChaseBusinessSlug] = useState<
    string | null
  >(bestChaseBusiness?.slug || chaseBusinessCards[0]?.slug || null);
  const selectedChaseBusiness =
    chaseBusinessCards.find(
      (card) => card.slug === selectedChaseBusinessSlug,
    ) || chaseBusinessCards[0];

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
      {selectedChaseBusiness && (
        <div className="card-group">
          <div className="card-group-header">
            <div>
              <h3>Chase Ink Business Cards</h3>
              <p>Pick a card to compare benefits in one view.</p>
            </div>
            <div className="card-group-select">
              <label htmlFor="chase-ink-select">Card</label>
              <select
                id="chase-ink-select"
                value={selectedChaseBusiness.slug}
                onChange={(e) => setSelectedChaseBusinessSlug(e.target.value)}
              >
                {chaseBusinessCards.map((card) => (
                  <option key={card.slug} value={card.slug}>
                    {card.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(() => {
            const key = `chase-ink-group-${selectedChaseBusiness.slug}`;
            const compareKey = getCompareKey(selectedChaseBusiness);
            return (
              <CardItem
                key={key}
                card={selectedChaseBusiness}
                highlight={selectedChaseBusiness._id === bestCardId}
                expanded={expandedKeys.has(key)}
                isCompared={compareIds.includes(compareKey)}
                compareDisabled={
                  !compareIds.includes(compareKey) && compareIds.length >= 3
                }
                onToggleCompare={() => onToggleCompare?.(selectedChaseBusiness)}
                onToggle={() =>
                  setExpandedKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
              />
            );
          })()}
        </div>
      )}

      {visibleCards.map((card, index) => {
        const key = `${card._id || card.slug || card.name || "card"}-${index}`;
        const compareKey = getCompareKey(card);
        return (
          <CardItem
            key={key}
            card={card}
            highlight={card._id === bestCardId}
            expanded={expandedKeys.has(key)}
            isCompared={compareIds.includes(compareKey)}
            compareDisabled={
              !compareIds.includes(compareKey) && compareIds.length >= 3
            }
            onToggleCompare={() => onToggleCompare?.(card)}
            onToggle={() =>
              setExpandedKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
          />
        );
      })}
    </div>
  );
};

export default CardList;

function getCompareKey(card: Card) {
  return card._id || card.slug || card.name;
}
