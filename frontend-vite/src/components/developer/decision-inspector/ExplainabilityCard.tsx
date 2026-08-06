import { Card } from "../../../design-system/components";

type ExplainabilityCardProps = {
  explanation: string[];
};

export default function ExplainabilityCard({
  explanation,
}: ExplainabilityCardProps) {
  return (
    <Card variant="default" className="inspector-panel explainability-card">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Explainability</p>
        <h3>Natural-language explanation</h3>
      </div>
      <div className="explanation-copy">
        {explanation.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </Card>
  );
}
