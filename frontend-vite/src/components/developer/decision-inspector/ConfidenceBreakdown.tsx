import { Badge, Card } from "../../../design-system/components";
import type { ConfidenceFactor } from "./decisionInspectorModel";

type ConfidenceBreakdownProps = {
  confidence: number;
  factors: ConfidenceFactor[];
};

export default function ConfidenceBreakdown({
  confidence,
  factors,
}: ConfidenceBreakdownProps) {
  return (
    <Card variant="default" className="inspector-panel confidence-panel">
      <div className="confidence-score">
        <span>Confidence</span>
        <strong>{confidence}%</strong>
      </div>
      <div className="confidence-factor-list">
        {factors.map((factor) => (
          <div className="confidence-factor" key={factor.label}>
            <div>
              <strong>{factor.label}</strong>
              <p>{factor.detail}</p>
            </div>
            <Badge tone={factor.level === "High" ? "success" : "warning"}>
              {factor.level}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
