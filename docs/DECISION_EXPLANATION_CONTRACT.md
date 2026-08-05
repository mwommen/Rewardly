# Decision Explanation Contract

Decision explanations are public, structured, and safe to render in mobile, web, extension, AI assistant, and partner experiences.

## Contract

```ts
type DecisionExplanation = {
  headline: string;
  summary: string;
  primaryReason: {
    code: string;
    message: string;
  };
  supportingReasons: Array<{
    code: string;
    message: string;
  }>;
  tradeoffs: Array<{
    code: string;
    message: string;
    impact?: string;
  }>;
};
```

## Rules

- Explanations must be derived from the canonical decision output.
- Explanations must not claim benefits or rules that did not contribute.
- Explanations must not expose internal debugging output.
- Explanations must not use vague AI wording.
- Reason codes are stable public API values.

## Public Reason Codes

See `docs/DECISION_REASON_CODES.md`.
