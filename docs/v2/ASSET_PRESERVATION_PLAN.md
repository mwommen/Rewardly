# Asset Preservation Plan

## Principle

Do not rewrite valuable decision technology. Wrap it, test it, and move it behind stable interfaces while removing consumer assumptions at the edges.

| Asset | Core IP? | B2B-ready? | Consumer assumptions | Multi-partner support | Stable contract? | Should move package? | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PaymentDecisionService | Yes | Partially | userId, `/api`, extension payloads | No | Internal only | Eventually | Wrap first |
| Wallet Decision Engine | Yes | Mostly | Card type shape from current catalog | Needs tenant context outside engine | Internal types | Yes | Preserve |
| Recommendation scoring | Yes | Mostly | Some legacy category inputs | Engine can support | Internal | Yes | Preserve with compatibility tests |
| Rule precedence | Yes | Yes | None material | Yes | Internal | Yes | Preserve |
| Benefit Registry | Yes | Partially | Card-doc loading | Not tenant-specific | Internal | Yes | Preserve/harden |
| Benefit versioning | Yes | Partially | Internal ops only | Can support | Internal | Maybe | Preserve |
| Card catalog | Yes | Partially | US consumer cards | Needs source governance | Data contract not stable | Maybe | Preserve with ops |
| Merchant normalization | Yes | Mostly | Some checkout signal inputs | Yes | Internal | Yes | Promote |
| Merchant detection | No/adapter | Reference | Chrome/DOM | Not platform core | N/A | Keep in core/reference | Reference client |
| Explanation engine | Yes | Partially | Consumer copy | Needs public/private layers | Internal | Yes | Refactor |
| Confidence scoring | Yes | Mostly | Labels may be consumer | Yes | Internal | Yes | Preserve |
| Audit logs | Yes | Partially | No org/env | Needs tenant scope | Internal | No | Harden |
| Deterministic tests | Yes | Yes | Fixture data | Yes | Test artifact | No | Preserve |
| Generated scenarios | Yes | Yes | None material | Yes | Test artifact | No | Preserve |
| Authentication | No | No | Consumer beta | No | Internal | No | Isolate |
| Wallet persistence | Useful | No | Consumer userId | No | Internal | No | Migrate |
| Analytics | Useful | No | Extension events | No | Internal | No | Generalize |
| Feedback | Useful | Partially | Popup reasons | Needs org/env | Internal | No | Generalize |
| Production deployment | Necessary | Partially | Consumer services | Needs API env | N/A | No | Rework |
| Extension | Demo asset | No | Consumer checkout | N/A | N/A | No | Reference integration |
| Website | Demo asset | No | Consumer onboarding | N/A | N/A | No | Convert/rebuild as sandbox |

## Package Candidates

Strategic recommendation:

- `packages/decision-engine`
- `packages/benefit-registry`
- `packages/merchant-intelligence`
- `packages/api-contracts`
- `packages/validation-scenarios`

Do not physically move code in this blueprint sprint.
