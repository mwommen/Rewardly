import { useState } from "react";
import { Badge, Card } from "../../../design-system/components";
import type { PlaygroundDecision } from "./playgroundModel";

type RuleTracePanelProps = {
  decision: PlaygroundDecision;
};

const STEP_LABELS: Record<string, string> = {
  "merchant-resolved": "Merchant Resolution",
  "wallet-analyzed": "Wallet Evaluation",
  "reward-rules": "Reward Rule Evaluation",
  "benefit-eligibility": "Benefit Validation",
  enrollment: "Confidence Calculation",
  alternatives: "Alternative Ranking",
  "final-recommendation": "Recommendation Produced",
};

export default function RuleTracePanel({ decision }: RuleTracePanelProps) {
  const [openStep, setOpenStep] = useState(decision.evidence[0]?.id ?? "");

  return (
    <Card variant="default" className="rule-trace-card">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Live Rule Trace</p>
        <h3>Structured execution path</h3>
      </div>
      <div className="rule-trace-list">
        {decision.evidence.map((step) => {
          const expanded = openStep === step.id;
          return (
            <div className="rule-trace-step" key={step.id}>
              <button
                type="button"
                onClick={() => setOpenStep(expanded ? "" : step.id)}
                aria-expanded={expanded}
              >
                <span aria-hidden="true">✓</span>
                <strong>{STEP_LABELS[step.id] ?? step.title}</strong>
                {step.confidence && (
                  <Badge tone="success">{step.confidence}</Badge>
                )}
              </button>
              {expanded && (
                <dl className="evidence-detail-grid">
                  {Object.entries(step.details).map(([key, value]) => (
                    <div key={key}>
                      <dt>{formatLabel(key)}</dt>
                      <dd>
                        {Array.isArray(value)
                          ? value.join(", ")
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}
