import { Badge, Button, Card } from "../../../design-system/components";
import type { PlaygroundDecision } from "./playgroundModel";

type PlaygroundResultsProps = {
  decision: PlaygroundDecision | null;
  onInspect: () => void;
  onReplay: () => void;
};

export default function PlaygroundResults({
  decision,
  onInspect,
  onReplay,
}: PlaygroundResultsProps) {
  if (!decision) {
    return (
      <Card variant="subtle" className="playground-empty-state">
        <div className="playground-empty-mark" aria-hidden="true">
          ◇
        </div>
        <h3>Generate your first trusted financial decision.</h3>
        <p>
          Choose the retail scenario, confirm the purchase and wallet, then run
          the decision.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="hero" className="playground-result-card">
      <div className="playground-result-head">
        <div>
          <span className="decision-label">Recommendation</span>
          <h3>{decision.recommendation.cardName}</h3>
          <p>{decision.recommendation.summary}</p>
        </div>
        <div className="playground-result-confidence">
          <strong>{decision.recommendation.confidence}%</strong>
          <Badge tone="success">
            {decision.recommendation.confidenceLabel}
          </Badge>
        </div>
      </div>
      <div className="playground-result-facts">
        <ResultFact
          label="Evidence"
          value={`${decision.evidence.length} steps`}
        />
        <ResultFact
          label="Alternatives"
          value={`${Math.max(decision.alternatives.length - 1, 0)} evaluated`}
        />
        <ResultFact
          label="Replay"
          value={
            decision.trustMetadata.replayAvailable ? "Available" : "Unavailable"
          }
        />
      </div>
      <div className="playground-result-actions">
        <Button variant="primary" onClick={onInspect}>
          Open Decision Inspector
        </Button>
        <Button variant="secondary" onClick={onReplay}>
          Replay Decision
        </Button>
      </div>
    </Card>
  );
}

function ResultFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="decision-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
