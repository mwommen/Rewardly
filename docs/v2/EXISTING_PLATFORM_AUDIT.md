# Existing Platform Audit

## Scope

Confirmed from repository: Rewardly is a monorepo-style project with a TypeScript/Express backend, React/Vite frontend, Chrome extension, shared `packages/rewardly-core`, deterministic validation suites, production packaging scripts, docs, and private-beta qualification workflow.

## Codebase Map

```text
Merchant Context
      ↓
Merchant Detection / Merchant Intelligence
      ↓
Purchase Context Normalization
      ↓
Wallet Resolution
      ↓
Benefit Registry and Wallet Benefit State
      ↓
Reward Rule Evaluation and Precedence
      ↓
Candidate Scoring
      ↓
Winner and Runner-Up Selection
      ↓
Explanation, Confidence, Warning, Audit
      ↓
Decision Response
      ↓
Analytics and Feedback
```

## Subsystem Classification

| Subsystem | Current purpose | Consumers | Quality / coverage | Coupling | Security notes | B2B relevance | Action | Migration risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PaymentDecisionService` | Orchestrates merchant, wallet, recommendation, purchase, explanation, audit | Decision route, extension | Good service tests | Coupled to consumer userId and current routes | Dev fallback user exists in nonproduction | Core | Wrap behind new interface | Medium |
| `WalletDecisionEngine` | Scores owned wallet cards using registry rules | Recommendation services/tests | Strong tests and traces | Backend-internal | Wallet-first enforced | Core IP | Preserve with hardening | Low |
| `recommendationService` | Legacy/catalog recommendation APIs | Website, backend tests | Broad tests | Older merchant/category assumptions | Can score full catalog when allowed | Useful but needs facade | Refactor/wrap | Medium |
| Benefit Registry | Canonicalizes card benefits, precedence, confidence, audit log | Wallet engine | Strong coverage | Loads from card docs | Source confidence/freshness modeled | Core data platform | Preserve and move toward package | Low |
| Benefit pipeline/versioning | Extraction, review, promotion, versioning | CLI/docs/tests | Mature for internal ops | Backend scripts | Needs source licensing review | Important ops | Preserve with hardening | Medium |
| Card catalog | Card data and reward rules | Engine, wallet validation | Fixture/quality tests | Stored in Mongo/card documents | Data provenance risk | Core data | Preserve with governance | Medium |
| Wallet intelligence | User benefit state, usage, resets, events | Wallet engine | Good unit tests | Consumer userId model | Tenant boundary missing | Important | Migrate to tenant model | Medium |
| Merchant intelligence | Registry, resolver, confidence, trace | Payment service | Strong validation suite | Some extension signal inputs | Input sanitization needed for API | Core differentiator | Promote to platform service | Low |
| Checkout detection | Detects payment moment in browser | Extension/reference | Strong fixture tests | Chrome-specific DOM assumptions | Page data minimization critical | Reference only | Preserve as reference adapter | Low |
| Purchase intelligence | Normalizes cart/purchase context | Payment service | Tests present | Checkout extraction assumptions | Avoid sensitive item capture by default | Useful optional input | Wrap | Medium |
| Explanation/confidence | Generates decision explanations and warnings | Payment service/popup | Tests present | Some consumer language | Must expose stable public trace | Core | Refactor public/private layers | Medium |
| Decision audit logs | Persist decision evidence | Payment service | Basic coverage | Storage path currently internal | Must be tenant scoped and minimized | Core | Harden | Medium |
| Beta auth | Invite, session token, extension connection | Website/extension | Good tests | Consumer beta identity | Not partner API auth | Reference only | Preserve isolated | Low |
| API routes | Cards, recommendations, decisions, analytics, feedback, beta | Frontend/extension | Route tests | Mixed dev/prod routes | Production gating exists but must be audited | Needs new `/v1` facade | Build new facade | Medium |
| Analytics | Product telemetry and dashboards | Extension/backend | Privacy tests | Consumer events | Must become org/environment scoped | Useful | Generalize | Medium |
| Feedback | Recommendation feedback and merchant requests | Popup/backend | Privacy tests | Consumer popup semantics | Good minimization | Useful | Generalize | Low |
| React/Vite frontend | Consumer onboarding/wallet/search | Users/demo | Build/lint only | Consumer UX | `.env.local` exists locally, not for commit | Sandbox candidate | Rebuild as sandbox/dashboard | Medium |
| Chrome extension | Real-time checkout popup | Internal/beta users | Syntax and manual QA | Chrome/payment DOM | Host permissions and tokens sensitive | Reference integration | Preserve as reference client | Low |
| `rewardly-core` | Shared checkout/merchant/payment domain | Extension/backend | TypeScript build | Small package | Good extraction seed | Package seed | Expand boundary | Medium |
| Validation framework | Recommendation scenarios, invariants, mutation smoke | Backend CI/docs | Strong | Backend-only | No PII | Major trust asset | Preserve and adapt to API | Low |
| Qualification suite | Private beta readiness reports | Founder/CI | Recently hardened | Some contract checks | Report redaction and ZIP scan | Useful release gate | Preserve | Low |
| Deployment files | Render/Vercel/package scripts | Beta deploy | Docs and scripts | Consumer paths | Need tenant env vars | Rework | Medium |
| Dev/demo routes | QA, scrape, Plaid sandbox, user benefits | Internal | Tests/source | Production gated | Must never expose live | Internal only | Keep gated/deprecate | Low |

## Consumer Assumptions Found

Confirmed from repository:

- Single implicit product context and no organization/environment tenant boundary.
- Consumer `userId` and beta sessions drive wallet access.
- Extension pairing and Chrome storage are primary auth paths.
- `manualCardSlugs` and development fallback users exist for local/dev behavior.
- Public routes and docs still reference consumer website, extension, demo, and local testing.
- Analytics and feedback events are extension/product focused, not partner scoped.
- Checkout detection is Chrome DOM oriented.
- API paths are internal `/api/...`, not external `/v1`.

## Highest-Risk Areas For V2

- Tenant isolation does not exist yet.
- Partner API-key auth is separate work; beta auth should not be reused.
- External API errors are not yet stable/versioned.
- Decision audit persistence needs tenant scope and retention policy.
- Card and benefit data licensing/provenance need operational review.
- `server.ts` starts a listener on import, complicating runtime route tests and API modularity.

## Recommendation

Preserve the engine and intelligence layers. Add a new B2B API facade and tenant/auth boundary around them. Do not let extension, consumer signup, or beta-session assumptions define V2 contracts.
