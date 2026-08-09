import type { DecisionInspectorData } from "../decision-inspector/decisionInspectorModel";
import { API_BASE } from "../../../lib/api";

export type ScenarioId = "retail" | "travel" | "dining" | "hotel" | "online";

export type PlaygroundScenario = {
  id: ScenarioId;
  title: string;
  icon: string;
  description: string;
  status: "available" | "soon";
};

export type PlaygroundMerchant = {
  id: string;
  name: string;
  category: string;
};

export type PlaygroundCard = {
  id: string;
  name: string;
  enabled: boolean;
};

export type PlaygroundPurchase = {
  merchantId: string;
  amount: string;
  currency: "USD";
};

export type PurchaseType = "in_store" | "online" | "travel" | "dining";

export type PlaygroundPurchaseContext = {
  purchaseType: PurchaseType;
  businessExpense: boolean;
  subscription: boolean;
  largePurchase: boolean;
};

export type PlaygroundDecision = DecisionInspectorData;

export type PlaygroundDecisionRequest = {
  merchant: {
    name: string;
    category?: string;
  };
  purchase: {
    amount: number;
    currency: "USD";
  };
  wallet: {
    cards: Array<{ cardId: string }>;
  };
  context: PlaygroundPurchaseContext;
};

export type CanonicalDecisionResponse = {
  decisionId: string;
  requestId?: string;
  status: "recommended" | "no_recommendation";
  recommendedPaymentMethod?: {
    cardId: string;
    displayName: string;
  } | null;
  recommendation?: {
    paymentMethodId: string | null;
    displayName: string | null;
    estimatedValue: number | null;
    currency: "USD";
    winningRule: string | null;
  };
  confidence: number;
  confidenceLabel?: "high" | "medium" | "low";
  decisionConfidence?: {
    score: number;
    label: "high" | "medium" | "low";
  };
  confidenceFactors?: Array<{
    name: string;
    level: "high" | "medium" | "low";
    score: number | null;
    explanation: string;
  }>;
  alternatives?: Array<{
    paymentMethodId: string;
    displayName: string;
    rank: number;
    estimatedValue: number | null;
    confidence: number | null;
    reasonNotSelected: string;
    supportingEvidence: string[];
  }>;
  explanation: {
    summary: string;
    factors: string[];
  };
  evidence?: Array<{
    evidenceId: string;
    type: string;
    source: string;
    statement: string;
    effect: string;
    confidence: number | null;
    version?: string | null;
  }>;
  warnings?: Array<{
    code: string;
    severity: string;
    message: string;
    userAction?: string;
  }>;
  merchant?: {
    name: string;
    category: string | null;
    confidence: number | null;
  };
  walletSnapshot?: {
    source: string;
    cardSlugs: string[];
    evaluatedCardCount: number;
  };
  purchaseContext?: {
    amount: number | null;
    currency: "USD";
    checkoutStage?: string | null;
    context?: unknown;
  };
  ruleVersion?: string;
  merchantRegistryVersion?: string;
  benefitRegistryVersion?: string;
  knowledgeVersion?: string;
  decisionEngineVersion?: string;
  generatedAt?: string;
  latency?: {
    merchantResolutionMs: number | null;
    engineMs: number;
    evidenceGenerationMs: number;
    totalMs: number;
  };
  replayAvailable?: boolean;
};

export type PlaygroundDecisionChange = {
  label: string;
  before: string;
  after: string;
  explanation: string;
};

export type PlaygroundDecisionHistoryItem = {
  id: string;
  sequence: number;
  trigger: string;
  decision: PlaygroundDecision;
  purchase: PlaygroundPurchase;
  context: PlaygroundPurchaseContext;
  wallet: PlaygroundCard[];
  changes: PlaygroundDecisionChange[];
};

export const PLAYGROUND_SCENARIOS: PlaygroundScenario[] = [
  {
    id: "retail",
    title: "Retail Purchase",
    icon: "🛒",
    description: "Start with a common checkout decision.",
    status: "available",
  },
  {
    id: "travel",
    title: "Travel Booking",
    icon: "✈️",
    description: "Compare rewards and travel protections.",
    status: "soon",
  },
  {
    id: "dining",
    title: "Dining Purchase",
    icon: "🍽️",
    description: "Evaluate category bonuses and card benefits.",
    status: "soon",
  },
  {
    id: "hotel",
    title: "Hotel Stay",
    icon: "🏨",
    description: "Inspect lodging benefits and reward rules.",
    status: "soon",
  },
  {
    id: "online",
    title: "Online Shopping",
    icon: "🛍️",
    description: "Understand protections for online purchases.",
    status: "soon",
  },
];

export const PLAYGROUND_MERCHANTS: PlaygroundMerchant[] = [
  { id: "target", name: "Target", category: "general_retail" },
  { id: "amazon", name: "Amazon", category: "online_retail" },
  { id: "walmart", name: "Walmart", category: "general_retail" },
  { id: "costco", name: "Costco", category: "warehouse_club" },
  { id: "starbucks", name: "Starbucks", category: "dining" },
  { id: "best_buy", name: "Best Buy", category: "electronics" },
];

export const DEFAULT_PLAYGROUND_WALLET: PlaygroundCard[] = [
  { id: "amex_gold", name: "Amex Gold", enabled: true },
  {
    id: "chase_sapphire_preferred",
    name: "Chase Sapphire Preferred",
    enabled: true,
  },
  { id: "capital_one_venture_x", name: "Capital One Venture X", enabled: true },
];

export const DEFAULT_PLAYGROUND_CONTEXT: PlaygroundPurchaseContext = {
  purchaseType: "in_store",
  businessExpense: false,
  subscription: false,
  largePurchase: false,
};

export function createPlaygroundDecisionRequest(
  purchase: PlaygroundPurchase,
  wallet: PlaygroundCard[],
  context: PlaygroundPurchaseContext,
): PlaygroundDecisionRequest {
  const merchant =
    PLAYGROUND_MERCHANTS.find((item) => item.id === purchase.merchantId) ??
    PLAYGROUND_MERCHANTS[0];
  return {
    merchant: {
      name: merchant.name,
      category: merchant.category,
    },
    purchase: {
      amount: Number(purchase.amount) || 0,
      currency: purchase.currency,
    },
    wallet: {
      cards: wallet
        .filter((card) => card.enabled)
        .map((card) => ({ cardId: card.id })),
    },
    context,
  };
}

export async function executePlaygroundDecision(
  request: PlaygroundDecisionRequest,
  signal?: AbortSignal,
): Promise<PlaygroundDecision> {
  const response = await fetch(`${API_BASE}/api/v1/payment-decisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || "Rewardly could not generate a decision.",
    );
  }
  return toPlaygroundDecision(payload as CanonicalDecisionResponse, request);
}

export function toPlaygroundDecision(
  response: CanonicalDecisionResponse,
  request: PlaygroundDecisionRequest,
): PlaygroundDecision {
  const recommendationName =
    response.recommendation?.displayName ||
    response.recommendedPaymentMethod?.displayName ||
    "Recommendation unavailable";
  const confidenceScore = Math.round(
    (response.decisionConfidence?.score ?? response.confidence ?? 0) * 100,
  );
  const confidenceLabel = toInspectorConfidence(
    response.decisionConfidence?.label || response.confidenceLabel,
  );
  const evidence = response.evidence?.length
    ? response.evidence.map((item) => ({
        id: item.evidenceId,
        title: formatEvidenceType(item.type),
        status: "complete" as const,
        summary: item.statement,
        confidence: toInspectorConfidenceLevel(item.confidence),
        details: {
          source: item.source,
          effect: item.effect,
          confidence:
            typeof item.confidence === "number"
              ? `${Math.round(item.confidence * 100)}%`
              : "Unavailable",
          version: item.version || "Current",
        },
      }))
    : [
        {
          id: "decision-generated",
          title: "Decision generated",
          status: "complete" as const,
          summary: response.explanation.summary,
          confidence: confidenceLabel,
          details: {
            source: "Decision Engine",
            status: response.status,
          },
        },
      ];

  return {
    decisionId: response.decisionId,
    timestamp: response.generatedAt || new Date().toISOString(),
    apiVersion: "v1",
    engineVersion: response.decisionEngineVersion || "decision-engine",
    decisionType: "payment_decision",
    recommendation: {
      cardName: recommendationName,
      confidence: confidenceScore,
      confidenceLabel,
      summary: response.explanation.summary,
    },
    evidence,
    alternatives: (response.alternatives || []).map((alternative) => ({
      cardName: alternative.displayName,
      result: "Not Selected",
      estimatedValue:
        typeof alternative.estimatedValue === "number"
          ? `$${alternative.estimatedValue.toFixed(2)}`
          : "Lower",
      confidence: toInspectorConfidenceLevel(alternative.confidence),
      reason: alternative.reasonNotSelected,
    })),
    confidenceFactors: (response.confidenceFactors || []).map((factor) => ({
      label: factor.name,
      level: toInspectorConfidence(factor.level),
      detail: factor.explanation,
    })),
    trustMetadata: {
      decisionVersion: response.ruleVersion || "current",
      knowledgeVersion: response.knowledgeVersion || "current",
      merchantRegistryVersion: response.merchantRegistryVersion || "current",
      benefitRegistryVersion: response.benefitRegistryVersion || "current",
      rulesVersion: response.ruleVersion || "current",
      replayAvailable: response.replayAvailable ?? true,
    },
    api: {
      request,
      response,
      evidence: {
        evidence: response.evidence || [],
        warnings: response.warnings || [],
        latency: response.latency || null,
        versions: {
          ruleVersion: response.ruleVersion,
          merchantRegistryVersion: response.merchantRegistryVersion,
          benefitRegistryVersion: response.benefitRegistryVersion,
          knowledgeVersion: response.knowledgeVersion,
          decisionEngineVersion: response.decisionEngineVersion,
        },
      },
    },
    explanation: [
      response.explanation.summary,
      ...(response.explanation.factors || []),
      ...(response.warnings || []).map((warning) => warning.message),
    ].filter(Boolean),
  };
}

const CARD_SIGNAL: Record<
  string,
  {
    rate: number;
    program: string;
    protection: string;
    confidence: "High" | "Medium";
  }
> = {
  amex_gold: {
    rate: 4,
    program: "Membership Rewards",
    protection: "Purchase Protection",
    confidence: "High",
  },
  chase_sapphire_preferred: {
    rate: 3,
    program: "Ultimate Rewards",
    protection: "Extended Warranty",
    confidence: "High",
  },
  capital_one_venture_x: {
    rate: 2,
    program: "Venture Miles",
    protection: "Purchase protections",
    confidence: "Medium",
  },
};

export function createPlaygroundDecision(
  purchase: PlaygroundPurchase,
  wallet: PlaygroundCard[],
  context: PlaygroundPurchaseContext = DEFAULT_PLAYGROUND_CONTEXT,
): PlaygroundDecision {
  const merchant =
    PLAYGROUND_MERCHANTS.find((item) => item.id === purchase.merchantId) ??
    PLAYGROUND_MERCHANTS[0];
  const enabledCards = wallet.filter((card) => card.enabled);
  const evaluatedCards = enabledCards.length
    ? enabledCards
    : wallet.slice(0, 1);
  const amount = Number(purchase.amount) || 0;
  const winner = selectWinner(merchant, evaluatedCards, context, amount);
  const winnerSignal =
    CARD_SIGNAL[winner.id] ?? CARD_SIGNAL.capital_one_venture_x;
  const estimatedValue = Math.max(amount * winnerSignal.rate * 0.01, 0);
  const confidence = calculateConfidence(merchant, context, amount);
  const winningRule = getWinningRule(merchant, winner, context, amount);
  const winningBenefit = getWinningBenefit(merchant, context, amount);
  const decisionId = `dec_play_${merchant.id}_${Math.round(amount * 100)}_${context.purchaseType}`;

  const alternatives = evaluatedCards.map((card) => {
    const signal = CARD_SIGNAL[card.id] ?? CARD_SIGNAL.capital_one_venture_x;
    const isWinner = card.id === winner.id;
    return {
      cardName: card.name,
      result: isWinner ? "Winner" : "Not Selected",
      estimatedValue: isWinner
        ? "Highest"
        : `${signal.rate}x ${signal.program}`,
      confidence: signal.confidence,
      reason: isWinner
        ? "Best confidence-adjusted value for this purchase context."
        : `${winner.name} produced a stronger estimated outcome for ${merchant.name}.`,
    } as const;
  });

  return {
    decisionId,
    timestamp: new Date().toISOString(),
    apiVersion: "v1",
    engineVersion: "decision-engine-0.1.0",
    decisionType: "payment_decision",
    recommendation: {
      cardName: winner.name,
      confidence,
      confidenceLabel: confidence >= 92 ? "High" : "Medium",
      summary: `Highest confidence-adjusted financial outcome for a ${merchant.name} ${formatPurchaseType(context.purchaseType)} purchase based on the enabled wallet cards.`,
    },
    evidence: [
      {
        id: "merchant-resolved",
        title: "Merchant resolved",
        status: "complete",
        summary: merchant.name,
        confidence: "High",
        details: {
          canonicalMerchant: merchant.name,
          category: merchant.category,
          purchaseType: formatPurchaseType(context.purchaseType),
          source: "Playground merchant fixture",
        },
      },
      {
        id: "wallet-analyzed",
        title: "Wallet analyzed",
        status: "complete",
        summary: `${evaluatedCards.length} payment methods evaluated`,
        confidence: "High",
        details: {
          evaluatedCards: evaluatedCards.map((card) => card.name),
          excludedCards: wallet.length - evaluatedCards.length,
          walletSource: "Developer playground wallet",
        },
      },
      {
        id: "reward-rules",
        title: "Reward rules evaluated",
        status: "complete",
        summary: `${evaluatedCards.length * 4} rules considered`,
        confidence: "High",
        details: {
          winningRule,
          rejectedRules: Math.max(evaluatedCards.length * 4 - 1, 0),
          precedence: "Eligible earning rule beat lower-value alternatives",
        },
      },
      {
        id: "benefit-eligibility",
        title: "Benefit eligibility verified",
        status: "complete",
        summary: `${winningBenefit} available`,
        confidence: "High",
        details: {
          eligibleBenefit: winningBenefit,
          requirement: "Pay with the recommended card",
          limitations: "Coverage depends on issuer terms",
        },
      },
      {
        id: "enrollment",
        title: "Enrollment requirements checked",
        status: "complete",
        summary: "No enrollment required",
        confidence: "High",
        details: {
          enrollmentRequired: false,
          activationRequired: false,
          businessExpense: context.businessExpense,
          subscription: context.subscription,
          largePurchase: context.largePurchase,
          walletStateEffect: "No negative adjustment",
        },
      },
      {
        id: "alternatives",
        title: "Alternatives compared",
        status: "complete",
        summary: `${Math.max(evaluatedCards.length - 1, 0)} alternatives ranked`,
        confidence: "High",
        details: {
          runnerUp:
            alternatives.find(
              (alternative) => alternative.result === "Not Selected",
            )?.cardName ?? "No runner-up",
          comparisonBasis: "Confidence-adjusted estimated value",
        },
      },
      {
        id: "final-recommendation",
        title: "Final recommendation produced",
        status: "complete",
        summary: `${winner.name} selected`,
        confidence: "High",
        details: {
          recommendation: winner.name,
          confidence: `${confidence}%`,
          replayable: true,
        },
      },
    ],
    alternatives,
    confidenceFactors: [
      {
        label: "Merchant certainty",
        level: "High",
        detail: `${merchant.name} was selected from playground merchant data.`,
      },
      {
        label: "Wallet completeness",
        level: "High",
        detail: `${evaluatedCards.length} enabled wallet cards were evaluated.`,
      },
      {
        label: "Benefit certainty",
        level: "High",
        detail: "The winning rule came from structured sample benefit data.",
      },
      {
        label: "Rule freshness",
        level: "High",
        detail: "Playground data is pinned for deterministic replay.",
      },
      {
        label: "Available purchase context",
        level: context.purchaseType === "in_store" ? "Medium" : "High",
        detail: `Merchant, amount, and ${formatPurchaseType(context.purchaseType)} context were available.`,
      },
    ],
    trustMetadata: {
      decisionVersion: "2026.08.06",
      knowledgeVersion: "playground_knowledge_001",
      merchantRegistryVersion: "playground_merchants_001",
      benefitRegistryVersion: "playground_benefits_001",
      rulesVersion: "playground_rules_001",
      replayAvailable: true,
    },
    api: {
      request: {
        merchant: {
          name: merchant.name,
          category: merchant.category,
        },
        purchase: {
          amount,
          currency: purchase.currency,
          context: {
            purchaseType: context.purchaseType,
            businessExpense: context.businessExpense,
            subscription: context.subscription,
            largePurchase: context.largePurchase,
          },
        },
        wallet: {
          cards: evaluatedCards.map((card) => ({ cardId: card.id })),
        },
        preferences: {
          maximizeRewards: true,
        },
      },
      response: {
        decisionId,
        recommendedPaymentMethod: {
          cardId: winner.id,
          displayName: winner.name,
        },
        reason: "Highest confidence-adjusted financial outcome.",
        estimatedValue: Number(estimatedValue.toFixed(2)),
        currency: purchase.currency,
        confidence: confidence / 100,
        decisionSummary: `${winner.name} was selected because it produced the highest confidence-adjusted value from this wallet and purchase context.`,
      },
      evidence: {
        merchantResolved: true,
        walletCardsEvaluated: evaluatedCards.length,
        rewardRulesConsidered: evaluatedCards.length * 4,
        winningRule,
        winningBenefit,
        purchaseContext: context,
        alternativesCompared: Math.max(evaluatedCards.length - 1, 0),
        replayAvailable: true,
        versions: {
          knowledge: "playground_knowledge_001",
          merchantRegistry: "playground_merchants_001",
          benefitRegistry: "playground_benefits_001",
          rules: "playground_rules_001",
        },
      },
    },
    explanation: [
      `Rewardly selected ${winner.name} because it produced the highest confidence-adjusted financial outcome from the enabled wallet.`,
      `${merchant.name} was confidently identified.`,
      `${winningRule} was the strongest eligible rule.`,
      `${winningBenefit} applies when the user pays with this card.`,
      "No enrollment requirements were detected.",
      "Alternative cards were evaluated but produced lower expected value.",
    ],
  };
}

function selectWinner(
  merchant: PlaygroundMerchant,
  cards: PlaygroundCard[],
  context: PlaygroundPurchaseContext,
  amount: number,
): PlaygroundCard {
  const amexGold = cards.find((card) => card.id === "amex_gold");
  const ventureX = cards.find((card) => card.id === "capital_one_venture_x");
  const chase = cards.find((card) => card.id === "chase_sapphire_preferred");

  if (merchant.id === "starbucks" && amexGold) return amexGold;
  if (context.purchaseType === "travel" && chase) return chase;
  if (context.purchaseType === "online" && ventureX) return ventureX;
  if (context.businessExpense && ventureX) return ventureX;
  if ((context.largePurchase || amount >= 1000) && chase) return chase;
  if (merchant.id === "amazon" && ventureX) return ventureX;
  if (merchant.id === "best_buy" && chase) return chase;
  return amexGold ?? chase ?? ventureX ?? cards[0];
}

function calculateConfidence(
  merchant: PlaygroundMerchant,
  context: PlaygroundPurchaseContext,
  amount: number,
) {
  let confidence = 96;
  if (merchant.id === "amazon") confidence -= 5;
  if (context.purchaseType === "online") confidence -= 3;
  if (context.purchaseType === "travel") confidence -= 4;
  if (context.businessExpense) confidence -= 2;
  if (context.subscription) confidence -= 3;
  if (context.largePurchase || amount >= 1000) confidence -= 4;
  if (merchant.id === "starbucks") confidence += 1;
  return Math.max(86, Math.min(98, confidence));
}

function getWinningRule(
  merchant: PlaygroundMerchant,
  winner: PlaygroundCard,
  context: PlaygroundPurchaseContext,
  amount: number,
) {
  const signal = CARD_SIGNAL[winner.id] ?? CARD_SIGNAL.capital_one_venture_x;
  if (context.purchaseType === "travel")
    return "Travel rewards and protections";
  if (context.purchaseType === "online") return "Online purchase rewards";
  if (context.businessExpense) return "Business expense simplicity";
  if (context.largePurchase || amount >= 1000)
    return "Large purchase protection";
  if (merchant.id === "starbucks") return "Dining rewards";
  return `${signal.rate}x ${signal.program}`;
}

function getWinningBenefit(
  merchant: PlaygroundMerchant,
  context: PlaygroundPurchaseContext,
  amount: number,
) {
  if (context.purchaseType === "travel") return "Travel Insurance";
  if (context.subscription) return "Recurring payment tracking";
  if (context.largePurchase || amount >= 1000) return "Purchase Protection";
  if (merchant.id === "best_buy") return "Extended Warranty";
  return "Purchase Protection";
}

export function formatPurchaseType(value: PurchaseType) {
  return value.replace("_", " ");
}

export function getDecisionChangeSummary(
  previous: PlaygroundDecisionHistoryItem | null,
  nextDecision: PlaygroundDecision,
  purchase: PlaygroundPurchase,
  context: PlaygroundPurchaseContext,
  wallet: PlaygroundCard[],
): PlaygroundDecisionChange[] {
  if (!previous) {
    return [
      {
        label: "Initial decision",
        before: "No prior decision",
        after: nextDecision.recommendation.cardName,
        explanation:
          "Rewardly evaluated the starting merchant, purchase, and wallet.",
      },
    ];
  }

  const changes: PlaygroundDecisionChange[] = [];
  const previousMerchant = PLAYGROUND_MERCHANTS.find(
    (merchant) => merchant.id === previous.purchase.merchantId,
  );
  const nextMerchant = PLAYGROUND_MERCHANTS.find(
    (merchant) => merchant.id === purchase.merchantId,
  );

  if (previous.purchase.merchantId !== purchase.merchantId) {
    changes.push({
      label: "Merchant",
      before: previousMerchant?.name ?? previous.purchase.merchantId,
      after: nextMerchant?.name ?? purchase.merchantId,
      explanation:
        "Merchant context changed, so eligible reward rules were reevaluated.",
    });
  }

  if (previous.purchase.amount !== purchase.amount) {
    changes.push({
      label: "Purchase Amount",
      before: `$${previous.purchase.amount}`,
      after: `$${purchase.amount}`,
      explanation:
        Number(purchase.amount) >= 1000
          ? "Large-purchase protections became more important."
          : "Estimated value was recalculated using the updated purchase amount.",
    });
  }

  if (previous.context.purchaseType !== context.purchaseType) {
    changes.push({
      label: "Purchase Type",
      before: formatPurchaseType(previous.context.purchaseType),
      after: formatPurchaseType(context.purchaseType),
      explanation:
        "Purchase type changed which rules and benefits were eligible.",
    });
  }

  for (const key of [
    "businessExpense",
    "subscription",
    "largePurchase",
  ] as const) {
    if (previous.context[key] !== context[key]) {
      changes.push({
        label: formatBooleanContextLabel(key),
        before: previous.context[key] ? "On" : "Off",
        after: context[key] ? "On" : "Off",
        explanation: `${formatBooleanContextLabel(key)} changed the decision context.`,
      });
    }
  }

  const previousEnabled = previous.wallet
    .filter((card) => card.enabled)
    .map((card) => card.id)
    .join(",");
  const nextEnabled = wallet
    .filter((card) => card.enabled)
    .map((card) => card.id)
    .join(",");
  if (previousEnabled !== nextEnabled) {
    changes.push({
      label: "Wallet",
      before: `${previous.wallet.filter((card) => card.enabled).length} cards enabled`,
      after: `${wallet.filter((card) => card.enabled).length} cards enabled`,
      explanation:
        "Rewardly only evaluated cards currently enabled in the wallet.",
    });
  }

  if (
    previous.decision.recommendation.cardName !==
    nextDecision.recommendation.cardName
  ) {
    changes.push({
      label: "Recommendation",
      before: previous.decision.recommendation.cardName,
      after: nextDecision.recommendation.cardName,
      explanation:
        "A different card produced the strongest confidence-adjusted outcome.",
    });
  }

  if (
    previous.decision.recommendation.confidence !==
    nextDecision.recommendation.confidence
  ) {
    changes.push({
      label: "Confidence",
      before: `${previous.decision.recommendation.confidence}%`,
      after: `${nextDecision.recommendation.confidence}%`,
      explanation:
        "Confidence moved because available context and rule certainty changed.",
    });
  }

  return changes.length
    ? changes
    : [
        {
          label: "No material change",
          before: previous.decision.recommendation.cardName,
          after: nextDecision.recommendation.cardName,
          explanation:
            "Inputs changed without changing the winning recommendation.",
        },
      ];
}

function toInspectorConfidence(
  value: string | undefined,
): "High" | "Medium" | "Low" {
  if (value === "high" || value === "High") return "High";
  if (value === "medium" || value === "Medium") return "Medium";
  return "Low";
}

function toInspectorConfidenceLevel(value: number | null | undefined) {
  if (typeof value !== "number") return "Medium" as const;
  if (value >= 0.8) return "High" as const;
  if (value >= 0.58) return "Medium" as const;
  return "Low" as const;
}

function formatEvidenceType(type: string) {
  return type
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBooleanContextLabel(
  key: "businessExpense" | "subscription" | "largePurchase",
) {
  return {
    businessExpense: "Business Expense",
    subscription: "Subscription",
    largePurchase: "Large Purchase",
  }[key];
}
