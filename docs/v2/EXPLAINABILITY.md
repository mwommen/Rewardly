# Explainability

## Layers

Layer 1 user summary: "This card offers the highest estimated reward value for this dining purchase."

Layer 2 supporting reasons:

- Merchant classified as dining.
- Card earns elevated rewards on dining.
- Next-best eligible card earns lower estimated value.

Layer 3 developer trace:

- Merchant normalization result.
- Applied rule ID/version.
- Reward calculation.
- Alternative scores.
- Confidence factors.

Layer 4 internal audit:

- Full normalized input, rejected rules, warnings, engine/data versions, replay references.

## Defaults

Default API response should include layer 1, concise layer 2, confidence, warnings, and safe applied-rule summary.

Test environment can expose richer trace. Internal support can access full audit subject to tenant and privacy controls.

## Integrity Rule

Every displayed explanation must be generated from the actual winning rule. If narrative generation references a non-winning benefit, replace it with rule-derived fallback.
