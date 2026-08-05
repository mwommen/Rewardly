export type ContextCardKind =
  | "wallet_empty"
  | "nearby_smart_pay"
  | "shopping_plan"
  | "wallet_coach"
  | "recent_decision"
  | "weekly_progress"
  | "smart_pay";

export type ContextCardAction =
  | "add_card"
  | "open_smart_pay"
  | "open_smart_pay_merchant"
  | "open_planning"
  | "open_plan"
  | "open_wallet_coach"
  | "open_journey"
  | "open_payment";

export type PersonalContextCard = {
  id: string;
  kind: ContextCardKind;
  title: string;
  explanation: string;
  primaryActionLabel: string;
  primaryAction: ContextCardAction;
  secondaryActionLabel?: string;
  secondaryAction?: ContextCardAction;
  icon: string;
  priority: number;
  expiresAt?: string;
  metadata?: {
    merchantName?: string;
    merchantCategory?: string;
    distanceMiles?: number;
    accuracy?: string;
    recommendedCard?: string;
    planId?: string;
    paymentId?: string;
    opportunityId?: string;
    valueLabel?: string;
  };
};

export type DailyBriefing = {
  headline: string;
  subheadline: string;
  cards: PersonalContextCard[];
  emptyState: PersonalContextCard;
  generatedAt: string;
};
