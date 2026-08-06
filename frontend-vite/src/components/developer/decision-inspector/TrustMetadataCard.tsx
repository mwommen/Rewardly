import { Badge, Card } from "../../../design-system/components";
import type { TrustMetadata } from "./decisionInspectorModel";

type TrustMetadataCardProps = {
  metadata: TrustMetadata;
};

export default function TrustMetadataCard({
  metadata,
}: TrustMetadataCardProps) {
  return (
    <Card variant="subtle" className="inspector-panel trust-metadata-card">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Trust Metadata</p>
        <h3>Versions used to reproduce this decision</h3>
      </div>
      <dl className="trust-metadata-grid">
        <MetaItem label="Decision Version" value={metadata.decisionVersion} />
        <MetaItem label="Knowledge Version" value={metadata.knowledgeVersion} />
        <MetaItem
          label="Merchant Registry Version"
          value={metadata.merchantRegistryVersion}
        />
        <MetaItem
          label="Benefit Registry Version"
          value={metadata.benefitRegistryVersion}
        />
        <MetaItem label="Rules Version" value={metadata.rulesVersion} />
        <div>
          <dt>Replay Available</dt>
          <dd>
            <Badge tone={metadata.replayAvailable ? "success" : "warning"}>
              {metadata.replayAvailable ? "Yes" : "No"}
            </Badge>
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
