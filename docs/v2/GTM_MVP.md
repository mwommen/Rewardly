# Go-To-Market MVP

## MVP Capability Decisions

| Capability | Classification | Reason |
| --- | --- | --- |
| Partner organization model | Launch requirement | Tenant isolation |
| Test/live environments | Launch requirement | Safe integration |
| API-key auth | Launch requirement | External API access |
| `/v1/payment-decisions` | Launch requirement | Core product |
| Customer-defined user refs | Launch requirement | Partner owns users |
| Inline wallet input | Launch requirement | Fastest integration |
| Persisted wallets | Design-partner requirement | Useful after first integration |
| Merchant/purchase context | Launch requirement | Decision needs context |
| One recommendation | Launch requirement | Product thesis |
| Alternatives | Launch requirement | Explain winner/runner-up |
| Estimated reward value | Launch requirement | Value communication |
| Incremental value | Design-partner requirement | ROI proof |
| Confidence and warnings | Launch requirement | Safe uncertainty |
| Applied-rule trace | Launch requirement in test env | Trust/debug |
| Idempotency | Launch requirement | Reliable API semantics |
| Usage tracking | Launch requirement | Operations/billing prep |
| Request logs | Design-partner requirement | Support |
| Developer docs | Launch requirement | Integration speed |
| Interactive sandbox | Design-partner requirement | Sales and integration |
| Example integration | Design-partner requirement | Demonstrate value |
| Partner dashboard | Design-partner requirement, minimal | Key/log visibility |
| Key rotation | Launch requirement | Security |
| Decision replay | Design-partner requirement | Debugging |
| Feedback endpoint | Design-partner requirement | Quality loop |
| Billing automation | Post-MVP | Not needed for first pilots |
| Webhooks | Post-MVP | Not core first call |
| SDKs | Post-MVP | Docs/cURL first |

## Non-Goals

No public consumer launch, mobile app, automatic location tracking, full Plaid integration, bank credential storage, full transaction ingestion, card application marketplace, cashback affiliate network, offer activation, payment execution, enterprise SSO, international support, AI-generated reward rules, or guaranteed issuer outcomes.
