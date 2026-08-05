export type DecisionPolicy = {
  policyId: string;
  displayName: string;
  objective: string;
  priority: number;
  description: string;
  version: string;
};

export type ContextPreference = {
  preferenceId: string;
  type: string;
  value: string | number | boolean;
  threshold?: number;
  strength: "soft" | "strong";
  source: "user" | "partner" | "default";
};

export type ContextConstraint = {
  constraintId: string;
  type: string;
  value: string | number | boolean;
  severity: "hard" | "soft";
  source: "user" | "partner" | "platform";
};

export type ContextPreferences = {
  userId: string;
  preferences: ContextPreference[];
  constraints: ContextConstraint[];
  decisionPolicy: DecisionPolicy;
  schemaVersion: string;
  syncRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type CanonicalContext = {
  contextId: string;
  schemaVersion: string;
  purchase: Record<string, unknown>;
  user: Record<string, unknown>;
  financialIntent: Record<string, unknown>;
  decisionPolicy: DecisionPolicy;
  normalization: {
    warnings: string[];
    assumptions: string[];
  };
};
