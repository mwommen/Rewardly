export type ConfidenceLevel = "High" | "Medium" | "Low";

export type DecisionInspectorStep = {
  id: string;
  title: string;
  status: "complete" | "warning";
  summary: string;
  confidence?: ConfidenceLevel;
  details: Record<string, string | number | boolean | string[]>;
};

export type DecisionAlternative = {
  cardName: string;
  result: "Winner" | "Not Selected";
  estimatedValue: string;
  confidence: ConfidenceLevel;
  reason: string;
};

export type ConfidenceFactor = {
  label: string;
  level: ConfidenceLevel;
  detail: string;
};

export type TrustMetadata = {
  decisionVersion: string;
  lifecycleStatus?: string;
  runtimeVersion?: string;
  knowledgeVersion: string;
  merchantRegistryVersion: string;
  benefitRegistryVersion: string;
  rulesVersion: string;
  replayAvailable: boolean;
  replayStatus?: string;
  eventCount?: number;
  validationStatus?: string;
  validationId?: string | null;
  trustScore?: number | null;
  trustScoreLevel?: string | null;
  validatedAt?: string | null;
};

export type DecisionInspectorData = {
  decisionId: string;
  timestamp: string;
  apiVersion: string;
  engineVersion: string;
  decisionType: "payment_decision";
  recommendation: {
    cardName: string;
    confidence: number;
    confidenceLabel: ConfidenceLevel;
    summary: string;
  };
  evidence: DecisionInspectorStep[];
  alternatives: DecisionAlternative[];
  confidenceFactors: ConfidenceFactor[];
  trustMetadata: TrustMetadata;
  api: {
    request: Record<string, unknown>;
    response: Record<string, unknown>;
    evidence: Record<string, unknown>;
  };
  explanation: string[];
};

export const sampleDecisionInspectorData: DecisionInspectorData = {
  decisionId: "dec_7Kf92aB18Tq4",
  timestamp: "2026-08-06T18:03:21.000Z",
  apiVersion: "v1",
  engineVersion: "decision-engine-0.1.0",
  decisionType: "payment_decision",
  recommendation: {
    cardName: "Amex Gold",
    confidence: 96,
    confidenceLabel: "High",
    summary:
      "Highest confidence-adjusted financial outcome based on the user's wallet, purchase context, and eligible card benefits.",
  },
  evidence: [
    {
      id: "merchant-resolved",
      title: "Merchant resolved",
      status: "complete",
      summary: "Target",
      confidence: "High",
      details: {
        canonicalMerchant: "Target",
        category: "General Retail",
        source: "Merchant registry alias and checkout context",
      },
    },
    {
      id: "wallet-analyzed",
      title: "Wallet analyzed",
      status: "complete",
      summary: "3 payment methods evaluated",
      confidence: "High",
      details: {
        evaluatedCards: ["Amex Gold", "Chase Sapphire Preferred", "Venture X"],
        excludedCards: 0,
        walletSource: "Developer sandbox wallet",
      },
    },
    {
      id: "reward-rules",
      title: "Reward rules evaluated",
      status: "complete",
      summary: "12 rules considered",
      confidence: "High",
      details: {
        winningRule: "4x Membership Rewards on eligible U.S. supermarket spend",
        rejectedRules: 11,
        precedence: "Category rule beat base earning rules",
      },
    },
    {
      id: "benefit-eligibility",
      title: "Benefit eligibility verified",
      status: "complete",
      summary: "Purchase protection available",
      confidence: "High",
      details: {
        eligibleBenefit: "Purchase Protection",
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
        walletStateEffect: "No negative adjustment",
      },
    },
    {
      id: "alternatives",
      title: "Alternatives compared",
      status: "complete",
      summary: "2 alternatives ranked",
      confidence: "High",
      details: {
        runnerUp: "Chase Sapphire Preferred",
        thirdOption: "Venture X",
        comparisonBasis: "Confidence-adjusted estimated value",
      },
    },
    {
      id: "final-recommendation",
      title: "Final recommendation produced",
      status: "complete",
      summary: "Amex Gold selected",
      confidence: "High",
      details: {
        recommendation: "Amex Gold",
        confidence: "96%",
        replayable: true,
      },
    },
  ],
  alternatives: [
    {
      cardName: "Amex Gold",
      result: "Winner",
      estimatedValue: "Highest",
      confidence: "High",
      reason: "Best confidence-adjusted value for this purchase context.",
    },
    {
      cardName: "Chase Sapphire Preferred",
      result: "Not Selected",
      estimatedValue: "Lower",
      confidence: "High",
      reason: "Lower estimated value than the winning eligible rule.",
    },
    {
      cardName: "Capital One Venture X",
      result: "Not Selected",
      estimatedValue: "Lower",
      confidence: "Medium",
      reason: "Strong catch-all rewards, but purchase protections were weaker.",
    },
  ],
  confidenceFactors: [
    {
      label: "Merchant certainty",
      level: "High",
      detail: "Target was resolved through canonical merchant data.",
    },
    {
      label: "Wallet completeness",
      level: "High",
      detail: "All sandbox wallet cards were evaluated.",
    },
    {
      label: "Benefit certainty",
      level: "High",
      detail: "The winning rule came from structured benefit data.",
    },
    {
      label: "Rule freshness",
      level: "High",
      detail: "Benefit registry version is current for this sample.",
    },
    {
      label: "Available purchase context",
      level: "Medium",
      detail: "Merchant and amount were available; line-item context was not.",
    },
  ],
  trustMetadata: {
    decisionVersion: "2026.08.06",
    lifecycleStatus: "replayable",
    runtimeVersion: "decision-runtime-0.1.0",
    knowledgeVersion: "knowledge_2026_08",
    merchantRegistryVersion: "merchant_registry_004",
    benefitRegistryVersion: "benefit_registry_011",
    rulesVersion: "rules_0.7.2",
    replayAvailable: true,
    replayStatus: "replayable",
    eventCount: 8,
    validationStatus: "validated",
    validationId: "val_sample",
    trustScore: 94,
    trustScoreLevel: "excellent",
    validatedAt: "2026-08-06T18:03:22.000Z",
  },
  api: {
    request: {
      merchant: {
        name: "Target",
        category: "general_retail",
      },
      purchase: {
        amount: 146,
        currency: "USD",
      },
      wallet: {
        cards: [
          { cardId: "amex_gold" },
          { cardId: "chase_sapphire_preferred" },
          { cardId: "capital_one_venture_x" },
        ],
      },
      preferences: {
        maximizeRewards: true,
      },
    },
    response: {
      decisionId: "dec_7Kf92aB18Tq4",
      recommendedPaymentMethod: {
        cardId: "amex_gold",
        displayName: "Amex Gold",
      },
      reason: "Highest confidence-adjusted financial outcome.",
      estimatedValue: 5.84,
      currency: "USD",
      confidence: 0.96,
      decisionSummary:
        "Amex Gold was selected because it produced the highest confidence-adjusted value from this wallet and purchase context.",
    },
    evidence: {
      merchantResolved: true,
      walletCardsEvaluated: 3,
      rewardRulesConsidered: 12,
      alternativesCompared: 2,
      replayAvailable: true,
      versions: {
        knowledge: "knowledge_2026_08",
        merchantRegistry: "merchant_registry_004",
        benefitRegistry: "benefit_registry_011",
        rules: "rules_0.7.2",
      },
    },
  },
  explanation: [
    "Rewardly selected Amex Gold because it produced the highest confidence-adjusted financial outcome from the user's wallet.",
    "Target was confidently identified.",
    "Eligible reward rules were available.",
    "Purchase protection applies.",
    "No enrollment requirements were detected.",
    "Alternative cards were evaluated but produced lower expected value.",
  ],
};
