# Initial Customer Profile

## Segment Scoring

Scale: 1 low, 5 high.

| Segment | Problem severity | Integration feasibility | Wallet access | Sales speed | Regulatory complexity | WTP | Explainability need | Strategic fit | Founder access | Score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Personal-finance apps | 4 | 4 | 4 | 4 | 3 | 4 | 5 | 5 | 4 | 37 |
| AI financial assistants | 4 | 4 | 3 | 4 | 3 | 4 | 5 | 5 | 4 | 36 |
| Credit-card recommendation sites | 3 | 4 | 2 | 4 | 2 | 3 | 4 | 4 | 4 | 30 |
| Travel apps | 3 | 3 | 2 | 3 | 2 | 3 | 4 | 4 | 3 | 27 |
| Digital wallets | 5 | 2 | 5 | 2 | 4 | 5 | 5 | 5 | 2 | 35 |
| Neobanks | 4 | 2 | 4 | 2 | 5 | 4 | 5 | 4 | 2 | 32 |
| Employee financial wellness | 3 | 3 | 2 | 3 | 3 | 3 | 4 | 3 | 3 | 27 |
| Expense management | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 29 |
| Loyalty startups | 3 | 4 | 2 | 4 | 2 | 3 | 3 | 4 | 4 | 29 |
| Banking-as-a-service customers | 4 | 2 | 4 | 2 | 5 | 4 | 5 | 4 | 2 | 32 |

## Primary Initial Segment

Consumer personal-finance applications and AI financial assistants.

Rationale: they can integrate fastest, already care about user financial outcomes, need explainable recommendations, and are reachable by founder-led outbound.

## Secondary Segment

Credit-card recommendation and rewards websites that want to improve ongoing card utility after acquisition.

## Deferred Segment

Large banks/card issuers. They are strategically attractive but too slow for the first design-partner motion.

## Personas

| Persona | Role | Objective | Concerns | Evidence needed |
| --- | --- | --- | --- | --- |
| Founder/CEO | Economic buyer | Differentiation and retention | Is this a feature or company? | Demo, ROI hypothesis, pilot terms |
| Head/VP Product | Product champion | Add payment guidance fast | UX trust, low-confidence behavior | API response examples, sandbox |
| CTO/Staff engineer | Technical buyer | Integrate safely | API stability, data model, latency | Docs, tests, error model |
| Compliance/risk | Approver | Avoid financial/legal exposure | Claims, data, audit | Privacy model, disclaimers |
| Data/product analyst | Daily user | Monitor quality | Metrics and logs | Decision reports, unknown-rate metrics |

## Jobs To Be Done

Functional: when a user is about to pay, recommend the best owned payment method.
Product: add differentiated wallet intelligence without building the rule engine.
Trust: explain why the recommendation is safe to show.
Operational: find low-confidence or disputed decisions.
Commercial: improve engagement, retention, or estimated value delivered.
