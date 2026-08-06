import { Card } from "../../../design-system/components";
import type { PlaygroundDecisionHistoryItem } from "./playgroundModel";

type DecisionComparisonTableProps = {
  decisionA: PlaygroundDecisionHistoryItem;
  decisionB: PlaygroundDecisionHistoryItem;
};

export default function DecisionComparisonTable({
  decisionA,
  decisionB,
}: DecisionComparisonTableProps) {
  const rows = [
    [
      "Recommendation",
      decisionA.decision.recommendation.cardName,
      decisionB.decision.recommendation.cardName,
    ],
    [
      "Confidence",
      `${decisionA.decision.recommendation.confidence}%`,
      `${decisionB.decision.recommendation.confidence}%`,
    ],
    ["Merchant", getMerchantName(decisionA), getMerchantName(decisionB)],
    [
      "Purchase Amount",
      `$${decisionA.purchase.amount}`,
      `$${decisionB.purchase.amount}`,
    ],
    ["Winning Rule", getWinningRule(decisionA), getWinningRule(decisionB)],
    ["Benefits", getBenefit(decisionA), getBenefit(decisionB)],
    [
      "Alternatives",
      `${decisionA.decision.alternatives.length - 1} ranked`,
      `${decisionB.decision.alternatives.length - 1} ranked`,
    ],
  ];

  return (
    <Card variant="default" className="comparison-table-card">
      <div className="inspector-panel-head">
        <p className="rw-eyebrow">Decision Comparison</p>
        <h3>Compare any two decision versions</h3>
      </div>
      <div className="comparison-table" role="table">
        <div role="row" className="comparison-row heading">
          <span>Attribute</span>
          <span>Decision {decisionA.sequence}</span>
          <span>Decision {decisionB.sequence}</span>
        </div>
        {rows.map(([label, aValue, bValue]) => (
          <div role="row" className="comparison-row" key={label}>
            <span>{label}</span>
            <strong>{aValue}</strong>
            <strong>{bValue}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

function getWinningRule(item: PlaygroundDecisionHistoryItem) {
  return String(
    item.decision.evidence.find((step) => step.id === "reward-rules")?.details
      .winningRule ?? "Eligible reward rule",
  );
}

function getBenefit(item: PlaygroundDecisionHistoryItem) {
  return String(
    item.decision.evidence.find((step) => step.id === "benefit-eligibility")
      ?.details.eligibleBenefit ?? "Eligible benefit",
  );
}

function getMerchantName(item: PlaygroundDecisionHistoryItem) {
  return String(
    item.decision.evidence.find((step) => step.id === "merchant-resolved")
      ?.details.canonicalMerchant ?? item.purchase.merchantId,
  );
}
