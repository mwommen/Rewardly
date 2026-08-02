# Risk Register

| Risk | Type | Probability | Impact | Early warning | Mitigation | Owner | MVP relevance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Weak willingness to pay | Product | Medium | High | Praise but no integration | Paid pilot criteria | Founder | High |
| Feature vs company | Product | Medium | High | Buyers see as small feature | Focus infrastructure + audit + data ops | Founder | High |
| Unclear buyer | Commercial | Medium | High | Calls lack owner | Narrow ICP | Founder | High |
| Incomplete card coverage | Data | High | High | Unknown-card rate high | Start narrow supported set | Engineering | High |
| Stale rules | Data | Medium | High | Disputed decisions | Versioning/review cadence | Ops | High |
| Merchant ambiguity | Data | High | Medium | Low-confidence rate high | Warnings + partner evidence | Engineering | High |
| Valuation disagreement | Data | Medium | Medium | Partner disputes value | Versioned valuation profiles | Product | Medium |
| Data licensing | Legal | Unknown | High | Source questions | Legal review | Founder | High |
| Consumer assumptions | Technical | High | High | API leaks userId/dev paths | New facade/tenant tests | Engineering | High |
| Tenant leakage | Security | Medium | Critical | Cross-org test failure | Mandatory org/env scope | Engineering | Critical |
| API instability | Technical | Medium | High | Frequent contract changes | `/v1` schema and changelog | Engineering | High |
| Financial advice perception | Legal | Medium | High | Customer legal concern | Disclaimers/legal counsel | Founder | High |
| Enterprise security demands | Commercial | Medium | Medium | Long questionnaires | Start with smaller partners | Founder | Medium |
| Operational burden | Technical | Medium | Medium | Manual data review overload | Narrow catalog and tooling | Engineering | Medium |
| Hosted reliability | Technical | Medium | High | Slow/failed decisions | Observability and targets | Engineering | High |
