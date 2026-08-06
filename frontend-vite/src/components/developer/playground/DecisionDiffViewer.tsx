import { Card } from "../../../design-system/components";
import type { PlaygroundDecisionHistoryItem } from "./playgroundModel";

type DecisionDiffViewerProps = {
  decision: PlaygroundDecisionHistoryItem;
};

export default function DecisionDiffViewer({
  decision,
}: DecisionDiffViewerProps) {
  return (
    <Card variant="subtle" className="decision-diff-card">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">What Changed?</p>
        <h3>{decision.trigger}</h3>
      </div>
      <div className="decision-diff-list">
        {decision.changes.map((change) => (
          <div
            className="decision-diff-item"
            key={`${change.label}-${change.after}`}
          >
            <span>{change.label}</span>
            <div className="decision-diff-values">
              <strong>{change.before}</strong>
              <em aria-hidden="true">→</em>
              <strong>{change.after}</strong>
            </div>
            <p>{change.explanation}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
