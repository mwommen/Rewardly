import { Badge, Card } from "../../../design-system/components";
import type { DecisionAlternative } from "./decisionInspectorModel";

type AlternativeComparisonProps = {
  alternatives: DecisionAlternative[];
};

export default function AlternativeComparison({
  alternatives,
}: AlternativeComparisonProps) {
  return (
    <Card variant="default" className="inspector-panel">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Alternatives</p>
        <h3>Every evaluated option is explainable</h3>
      </div>
      <div className="alternative-list">
        {alternatives.map((alternative) => (
          <div
            className={`inspector-alternative ${
              alternative.result === "Winner" ? "winner" : ""
            }`.trim()}
            key={alternative.cardName}
          >
            <div>
              <strong>{alternative.cardName}</strong>
              <p>{alternative.reason}</p>
            </div>
            <div className="alternative-metrics">
              <Badge
                tone={alternative.result === "Winner" ? "success" : "neutral"}
              >
                {alternative.result}
              </Badge>
              <span>{alternative.estimatedValue} value</span>
              <span>{alternative.confidence} confidence</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
