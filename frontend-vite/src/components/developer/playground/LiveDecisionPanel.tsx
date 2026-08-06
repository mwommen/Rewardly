import { Badge, Card } from "../../../design-system/components";
import type { PlaygroundDecision } from "./playgroundModel";

type LiveDecisionPanelProps = {
  decision: PlaygroundDecision;
};

export default function LiveDecisionPanel({
  decision,
}: LiveDecisionPanelProps) {
  const winningRule = String(
    decision.evidence.find((step) => step.id === "reward-rules")?.details
      .winningRule ?? "Eligible reward rule",
  );

  return (
    <Card variant="hero" className="live-decision-panel">
      <div className="live-decision-topline">
        <Badge tone="success">Live Decision</Badge>
        <span>{decision.decisionId}</span>
      </div>
      <div className="live-decision-main">
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
      <div className="live-decision-evidence">
        <span>Winning Rule</span>
        <strong>{winningRule}</strong>
      </div>
      <div className="playground-result-facts">
        <ResultFact
          label="Evidence"
          value={`${decision.evidence.length} steps`}
        />
        <ResultFact
          label="Alternatives"
          value={`${Math.max(decision.alternatives.length - 1, 0)} ranked`}
        />
        <ResultFact
          label="Replay"
          value={decision.trustMetadata.replayAvailable ? "Available" : "No"}
        />
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
