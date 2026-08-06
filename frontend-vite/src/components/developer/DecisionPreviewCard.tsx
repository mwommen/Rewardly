import { Badge, Button, Card } from "../../design-system/components";

type DecisionPreviewCardProps = {
  compact?: boolean;
  onInspect?: () => void;
};

const WALLET = ["Amex Gold", "Chase Sapphire Preferred", "Venture X"];

export default function DecisionPreviewCard({
  compact = false,
  onInspect,
}: DecisionPreviewCardProps) {
  return (
    <Card
      variant="hero"
      className={`decision-preview-card ${compact ? "compact" : ""}`.trim()}
    >
      <div className="decision-preview-topline">
        <Badge tone="success">Replay Available</Badge>
        <span>2 alternatives evaluated</span>
      </div>

      <div className="decision-preview-main">
        <div>
          <span className="decision-label">Recommendation</span>
          <h2>Amex Gold</h2>
          <p>Highest confidence-adjusted value.</p>
        </div>
        <div className="confidence-ring" aria-label="Confidence 96 percent">
          <strong>96%</strong>
          <span>confidence</span>
        </div>
      </div>

      <div className="decision-preview-grid">
        <DecisionFact label="Merchant" value="Target" />
        <DecisionFact label="Purchase" value="$146.00" />
        <DecisionFact label="Evidence" value="6 factors evaluated" />
      </div>

      <div className="decision-wallet" aria-label="Wallet cards">
        <span>Wallet</span>
        <div>
          {WALLET.map((card) => (
            <Badge tone="neutral" key={card}>
              {card}
            </Badge>
          ))}
        </div>
      </div>

      {onInspect && (
        <Button
          className="decision-inspect-button"
          variant="secondary"
          onClick={onInspect}
        >
          Inspect Decision
        </Button>
      )}
    </Card>
  );
}

function DecisionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="decision-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
