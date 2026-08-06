import { Badge, Card } from "../../../design-system/components";
import type { DecisionInspectorData } from "./decisionInspectorModel";

type DecisionSummaryCardProps = {
  decision: DecisionInspectorData;
};

export default function DecisionSummaryCard({
  decision,
}: DecisionSummaryCardProps) {
  const createdAt = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(decision.timestamp));

  return (
    <Card variant="hero" className="inspector-summary-card">
      <div className="inspector-summary-main">
        <div>
          <span className="decision-label">Recommendation</span>
          <h2>{decision.recommendation.cardName}</h2>
          <p>{decision.recommendation.summary}</p>
        </div>
        <div className="inspector-confidence-block">
          <strong>{decision.recommendation.confidence}%</strong>
          <Badge tone="success">
            {decision.recommendation.confidenceLabel} Confidence
          </Badge>
        </div>
      </div>

      <dl className="inspector-meta-grid">
        <MetaItem label="Decision ID" value={decision.decisionId} />
        <MetaItem label="Timestamp" value={createdAt} />
        <MetaItem label="API Version" value={decision.apiVersion} />
        <MetaItem label="Engine Version" value={decision.engineVersion} />
      </dl>
    </Card>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
