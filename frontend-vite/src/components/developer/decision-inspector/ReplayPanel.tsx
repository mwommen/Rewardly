import { useState } from "react";
import { Badge, Button, Card } from "../../../design-system/components";
import type { DecisionInspectorData } from "./decisionInspectorModel";

type ReplayPanelProps = {
  decision: DecisionInspectorData;
};

export default function ReplayPanel({ decision }: ReplayPanelProps) {
  const [status, setStatus] = useState<"idle" | "replayed">("idle");

  return (
    <Card variant="subtle" className="inspector-panel replay-panel">
      <div>
        <p className="rw-eyebrow">Replay</p>
        <h3>Reproduce the exact decision</h3>
        <p>
          Replay will use the original request and pinned decision versions.
          This demo simulates the workflow until live replay is connected.
        </p>
      </div>
      <div className="replay-actions">
        <Button variant="primary" onClick={() => setStatus("replayed")}>
          Replay Decision
        </Button>
        {status === "replayed" && (
          <Badge tone="success">Replayed {decision.decisionId}</Badge>
        )}
      </div>
    </Card>
  );
}
