# Confidence Contract

Confidence describes decision trust quality. It is not estimated financial value.

## Contract

```ts
type DecisionConfidence = {
  overall: number;
  level: "high" | "medium" | "low";
  components: {
    merchantResolution?: number | "unavailable";
    walletCompleteness?: number | "unavailable";
    ruleFreshness?: number | "unavailable";
    benefitEligibility?: number | "unavailable";
    contextCompleteness?: number | "unavailable";
  };
  explanation: string;
};
```

## Rules

- Scores must be finite and between 0 and 1.
- Missing components must be marked unavailable rather than fabricated.
- Low confidence should produce warnings when material.
- Confidence is normalized from existing decision intelligence. Trust Infrastructure does not create a separate scoring algorithm.
