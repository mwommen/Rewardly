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
        {metadata.lifecycleStatus && (
          <MetaItem
            label="Lifecycle Status"
            value={formatMetadataValue(metadata.lifecycleStatus)}
          />
        )}
        {metadata.runtimeVersion && (
          <MetaItem label="Runtime Version" value={metadata.runtimeVersion} />
        )}
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
        {metadata.replayStatus && (
          <MetaItem
            label="Replay Status"
            value={formatMetadataValue(metadata.replayStatus)}
          />
        )}
        {typeof metadata.eventCount === "number" && (
          <MetaItem label="Event Count" value={String(metadata.eventCount)} />
        )}
        {metadata.validationStatus && (
          <MetaItem
            label="Validation Status"
            value={formatMetadataValue(metadata.validationStatus)}
          />
        )}
        {typeof metadata.trustScore === "number" && (
          <MetaItem label="Trust Score" value={`${metadata.trustScore}/100`} />
        )}
        {metadata.trustScoreLevel && (
          <MetaItem
            label="Trust Level"
            value={formatMetadataValue(metadata.trustScoreLevel)}
          />
        )}
        {metadata.validatedAt && (
          <MetaItem
            label="Validated At"
            value={new Date(metadata.validatedAt).toLocaleString()}
          />
        )}
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

function formatMetadataValue(value: string) {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
