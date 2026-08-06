import type {
  PlaygroundCard,
  PlaygroundDecision,
  PlaygroundDecisionHistoryItem,
  PlaygroundPurchase,
  PlaygroundPurchaseContext,
} from "./playgroundModel";
import { getDecisionChangeSummary } from "./playgroundModel";

export function createHistoryItem({
  sequence,
  trigger,
  decision,
  purchase,
  context,
  wallet,
  previous,
}: {
  sequence: number;
  trigger: string;
  decision: PlaygroundDecision;
  purchase: PlaygroundPurchase;
  context: PlaygroundPurchaseContext;
  wallet: PlaygroundCard[];
  previous: PlaygroundDecisionHistoryItem | null;
}): PlaygroundDecisionHistoryItem {
  return {
    id: `${decision.decisionId}_${sequence}`,
    sequence,
    trigger,
    decision,
    purchase: { ...purchase },
    context: { ...context },
    wallet: wallet.map((card) => ({ ...card })),
    changes: getDecisionChangeSummary(
      previous,
      decision,
      purchase,
      context,
      wallet,
    ),
  };
}

export function getChangeTrigger(
  previous: PlaygroundDecisionHistoryItem | null,
  purchase: PlaygroundPurchase,
  context: PlaygroundPurchaseContext,
  wallet: PlaygroundCard[],
) {
  if (!previous) return "Initial decision";
  if (previous.purchase.merchantId !== purchase.merchantId)
    return "Merchant changed";
  if (previous.purchase.amount !== purchase.amount)
    return "Purchase amount changed";
  if (previous.context.purchaseType !== context.purchaseType)
    return "Purchase type changed";
  if (previous.context.businessExpense !== context.businessExpense)
    return "Business expense changed";
  if (previous.context.subscription !== context.subscription)
    return "Subscription changed";
  if (previous.context.largePurchase !== context.largePurchase)
    return "Large purchase changed";

  const previousWallet = previous.wallet
    .map((card) => `${card.id}:${card.enabled}`)
    .join("|");
  const nextWallet = wallet
    .map((card) => `${card.id}:${card.enabled}`)
    .join("|");
  if (previousWallet !== nextWallet) return "Wallet changed";

  return "Decision refreshed";
}
