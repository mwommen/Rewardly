import { Badge } from "../design-system/components";
import type { BestCard } from "../hooks/useRecommendations";
import { confidenceText, matchTierLabel } from "../lib/formatters";

export type DebugState = {
  domain: string;
  amount: string;
  mcc: string;
};

type AdvancedInputsProps = {
  debug: DebugState;
  open: boolean;
  topPick: BestCard | null;
  onChange: (debug: DebugState) => void;
  onOpenChange: (open: boolean) => void;
};

export default function AdvancedInputs({
  debug,
  open,
  topPick,
  onChange,
  onOpenChange,
}: AdvancedInputsProps) {
  return (
    <details
      className="debug-panel"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary>Advanced inputs</summary>
      <p>Optional: used for testing domain, amount, and MCC.</p>
      <div className="debug-grid">
        <label>
          Domain
          <input
            value={debug.domain}
            onChange={(event) =>
              onChange({ ...debug, domain: event.target.value })
            }
            placeholder="lululemon.com"
          />
        </label>
        <label>
          Amount
          <input
            value={debug.amount}
            onChange={(event) =>
              onChange({ ...debug, amount: event.target.value })
            }
            placeholder="84.24"
            inputMode="decimal"
          />
        </label>
        <label>
          MCC
          <input
            value={debug.mcc}
            onChange={(event) =>
              onChange({ ...debug, mcc: event.target.value })
            }
            placeholder="5651"
          />
        </label>
      </div>
      {topPick && (
        <div className="debug-result">
          <span>Recommendation logic</span>
          <Badge tone="neutral">
            {confidenceText(topPick.confidence, topPick.confidenceLabel)}
          </Badge>
          <Badge tone="neutral">{matchTierLabel(topPick.matchTier)}</Badge>
          {typeof topPick.confidence === "number" && (
            <Badge tone="neutral">
              {Math.round(topPick.confidence * 100)}% confidence
            </Badge>
          )}
        </div>
      )}
    </details>
  );
}
