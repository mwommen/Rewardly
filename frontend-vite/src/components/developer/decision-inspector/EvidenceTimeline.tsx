import { useState } from "react";
import { Badge, Card } from "../../../design-system/components";
import type { DecisionInspectorStep } from "./decisionInspectorModel";

type EvidenceTimelineProps = {
  steps: DecisionInspectorStep[];
};

export default function EvidenceTimeline({ steps }: EvidenceTimelineProps) {
  const [openSteps, setOpenSteps] = useState<Set<string>>(
    () => new Set([steps[0]?.id].filter(Boolean)),
  );

  const toggleStep = (id: string) => {
    setOpenSteps((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card variant="default" className="inspector-panel">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Evidence Timeline</p>
        <h3>How Rewardly reached the recommendation</h3>
      </div>
      <div className="evidence-timeline">
        {steps.map((step) => {
          const expanded = openSteps.has(step.id);
          return (
            <div className="evidence-step" key={step.id}>
              <button
                type="button"
                className="evidence-step-button"
                onClick={() => toggleStep(step.id)}
                aria-expanded={expanded}
              >
                <span className="evidence-check" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.summary}</small>
                </span>
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
