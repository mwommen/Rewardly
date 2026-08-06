import { Button, Card } from "../../../design-system/components";
import type { PlaygroundCard } from "./playgroundModel";

type WalletConfiguratorProps = {
  cards: PlaygroundCard[];
  onChange: (cards: PlaygroundCard[]) => void;
  compact?: boolean;
};

export default function WalletConfigurator({
  cards,
  onChange,
  compact = false,
}: WalletConfiguratorProps) {
  const toggleCard = (cardId: string) => {
    const next = cards.map((card) =>
      card.id === cardId ? { ...card, enabled: !card.enabled } : card,
    );
    onChange(ensureAtLeastOneEnabled(next, cards));
  };

  const moveCard = (cardId: string, direction: -1 | 1) => {
    const index = cards.findIndex((card) => card.id === cardId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= cards.length) return;

    const next = [...cards];
    const [card] = next.splice(index, 1);
    next.splice(targetIndex, 0, card);
    onChange(next);
  };

  return (
    <div className={`wallet-configurator ${compact ? "compact" : ""}`.trim()}>
      {cards.map((card, index) => (
        <Card
          variant={card.enabled ? "subtle" : "flat"}
          className={`playground-wallet-card ${card.enabled ? "enabled" : ""}`}
          key={card.id}
        >
          <div>
            <strong>{card.name}</strong>
            <span>{card.enabled ? "Enabled" : "Disabled"}</span>
          </div>
          <div className="wallet-card-actions">
            <Button
              variant="ghost"
              aria-label={`Move ${card.name} earlier`}
              disabled={index === 0}
              onClick={() => moveCard(card.id, -1)}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              aria-label={`Move ${card.name} later`}
              disabled={index === cards.length - 1}
              onClick={() => moveCard(card.id, 1)}
            >
              ↓
            </Button>
            <Button variant="secondary" onClick={() => toggleCard(card.id)}>
              {card.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </Card>
      ))}
      <p className="wallet-configurator-note">
        Rewardly only evaluates enabled cards in this wallet.
      </p>
    </div>
  );
}

function ensureAtLeastOneEnabled(
  next: PlaygroundCard[],
  previous: PlaygroundCard[],
) {
  return next.some((card) => card.enabled) ? next : previous;
}
