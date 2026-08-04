# Domain Model

## Core Terms

- Partner organization: company integrating Rewardly.
- Environment: `test` or `live` data boundary under an organization.
- API credential: hashed secret allowing API access to one environment.
- End user: partner-controlled customer reference.
- Wallet: collection of payment methods eligible for a decision.
- Payment method: user-owned card or future eligible instrument.
- Card product: canonical card definition, independent of ownership.
- Reward rule: earning rule such as 4x dining or 2x base.
- Benefit: credit, protection, perk, offer, or reward capability.
- Benefit definition: global versioned rule.
- Benefit state: user-specific enrollment, activation, usage, remaining value.
- Merchant identity: canonical merchant record.
- Merchant category: classification used for eligibility.
- Purchase context: amount, currency, channel, merchant, MCC, item/category evidence.
- Valuation profile: assumptions for converting rewards to cash-equivalent value.
- Decision: full evaluated result.
- Recommendation: primary chosen payment method inside a decision.
- Candidate: evaluated payment method.
- Explanation: user/developer-facing reason output.
- Confidence: quality of evidence, not calibrated probability.
- Warning: explicit uncertainty or limitation.
- Decision event: analytics/lifecycle event.
- Feedback: partner/user signal about result usefulness.
- Usage record: metering record for operations/billing.

## Clarifications

- Card product is not an owned card.
- Reward rule is not always a benefit; benefits can include credits/protections.
- Merchant identity is not the same as reward category.
- Estimated value is not guaranteed savings.
- Customer user is not a Rewardly dashboard user.
