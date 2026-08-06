import { Button, Card } from "../../../design-system/components";

type DecisionRunnerProps = {
  onRun: () => void;
  hasDecision: boolean;
};

export default function DecisionRunner({
  onRun,
  hasDecision,
}: DecisionRunnerProps) {
  return (
    <Card variant="hero" className="decision-runner">
      <div>
        <p className="rw-eyebrow">Run Decision</p>
        <h3>
          {hasDecision
            ? "Generate another trusted decision."
            : "Generate your first trusted financial decision."}
        </h3>
        <p>
          Rewardly evaluates the merchant, purchase, wallet, evidence, and
          alternatives as one decision contract.
        </p>
      </div>
      <Button variant="primary" onClick={onRun}>
        Generate Trusted Decision
      </Button>
    </Card>
  );
}
