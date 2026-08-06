import { Badge, Card } from "../../../design-system/components";
import type { PlaygroundDecisionHistoryItem } from "./playgroundModel";

type DecisionHistoryProps = {
  history: PlaygroundDecisionHistoryItem[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function DecisionHistory({
  history,
  selectedId,
  onSelect,
}: DecisionHistoryProps) {
  return (
    <Card variant="default" className="decision-history-card">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Recommendation History</p>
        <h3>Session decisions</h3>
      </div>
      <div className="decision-history-list">
        {history.map((item) => (
          <button
            type="button"
            className={`history-item ${item.id === selectedId ? "selected" : ""}`}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <span>Decision {item.sequence}</span>
            <strong>{item.decision.recommendation.cardName}</strong>
            <small>{item.trigger}</small>
            <Badge tone="neutral">
              {item.decision.recommendation.confidence}%
            </Badge>
          </button>
        ))}
      </div>
    </Card>
  );
}
