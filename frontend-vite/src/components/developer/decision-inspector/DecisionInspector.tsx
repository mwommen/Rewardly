import AlternativeComparison from "./AlternativeComparison";
import ConfidenceBreakdown from "./ConfidenceBreakdown";
import DecisionSummaryCard from "./DecisionSummaryCard";
import {
  sampleDecisionInspectorData,
  type DecisionInspectorData,
} from "./decisionInspectorModel";
import EvidenceTimeline from "./EvidenceTimeline";
import ExplainabilityCard from "./ExplainabilityCard";
import JsonViewer from "./JsonViewer";
import ReplayPanel from "./ReplayPanel";
import TrustMetadataCard from "./TrustMetadataCard";

type DecisionInspectorProps = {
  decision?: DecisionInspectorData;
  compactHeading?: boolean;
};

export default function DecisionInspector({
  decision = sampleDecisionInspectorData,
  compactHeading = false,
}: DecisionInspectorProps) {
  return (
    <section
      id="decision-inspector"
      className="decision-inspector"
      aria-labelledby="decision-inspector-title"
    >
      {!compactHeading && (
        <div className="developer-section-head narrow">
          <p className="rw-eyebrow">Decision Inspector</p>
          <h2 id="decision-inspector-title">
            Explain, defend, and reproduce every recommendation.
          </h2>
          <p>
            The inspector shows the evidence, alternatives, confidence factors,
            versions, and raw API contract behind a trusted decision.
          </p>
        </div>
      )}

      <DecisionSummaryCard decision={decision} />

      <div className="inspector-layout">
        <div className="inspector-primary">
          <EvidenceTimeline steps={decision.evidence} />
          <AlternativeComparison alternatives={decision.alternatives} />
          <JsonViewer
            request={decision.api.request}
            response={decision.api.response}
            evidence={decision.api.evidence}
          />
        </div>

        <aside
          className="inspector-secondary"
          aria-label="Decision trust details"
        >
          <ConfidenceBreakdown
            confidence={decision.recommendation.confidence}
            factors={decision.confidenceFactors}
          />
          <TrustMetadataCard metadata={decision.trustMetadata} />
          <ReplayPanel decision={decision} />
          <ExplainabilityCard explanation={decision.explanation} />
        </aside>
      </div>
    </section>
  );
}
