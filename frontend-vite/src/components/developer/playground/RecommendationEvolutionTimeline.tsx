import { Badge, Card } from "../../../design-system/components";
import type { PlaygroundDecisionHistoryItem } from "./playgroundModel";

type RecommendationEvolutionTimelineProps = {
  history: PlaygroundDecisionHistoryItem[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function RecommendationEvolutionTimeline({
  history,
  selectedId,
  onSelect,
}: RecommendationEvolutionTimelineProps) {
  return (
    <Card variant="hero" className="evolution-timeline-card">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Decision Evolution</p>
        <h3>Every input change creates an explainable version</h3>
      </div>
      <div className="evolution-timeline">
        {history.map((item) => (
          <button
            type="button"
            className={`evolution-node ${item.id === selectedId ? "selected" : ""}`}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <span>Decision {item.sequence}</span>
            <strong>{item.decision.recommendation.cardName}</strong>
            <small>{item.trigger}</small>
            <Badge tone="success">
              {item.decision.recommendation.confidence}%
            </Badge>
          </button>
        ))}
      </div>
    </Card>
  );
}
