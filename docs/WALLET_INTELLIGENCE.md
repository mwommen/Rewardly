# Wallet Intelligence Engine

Ticket 005 adds user-specific benefit state to Rewardly.

Rewardly already understands cards, merchants, and benefits. Wallet intelligence adds the missing dimension: whether this specific user can still use this specific benefit right now.

## Architecture

Core implementation:

- `backend/src/services/walletIntelligenceService.ts`
- `backend/src/services/walletIntelligenceFixture.ts`
- `backend/src/walletIntelligenceCli.ts`

Integration points:

- `backend/src/services/walletService.ts`
- `backend/src/services/paymentDecisionService.ts`
- `backend/src/services/recommendationService.ts`

The recommendation engine now consumes canonical wallet benefit state internally. The public recommendation API shape remains unchanged.

## Wallet State Model

`CanonicalWalletBenefitState` represents a user's relationship to a benefit.

Fields include:

- `walletBenefitStateId`
- `userId`
- `cardId`
- `cardSlug`
- `benefitId`
- `issuer`
- `status`
- `enrollmentStatus`
- `activationStatus`
- `benefitState`
- `remainingValue`
- `remainingSpendCap`
- `remainingUses`
- `cycleValueLimit`
- `cycleSpendLimit`
- `cycleUsageLimit`
- `cycleFrequency`
- `cycleStartsAt`
- `cycleEndsAt`
- `currentSpend`
- `benefitUsageCount`
- `currentCycle`
- `historicalCycles`
- `lastUsed`
- `effectiveDate`
- `resetDate`
- `expirationDate`
- `lastObserved`
- `lastVerified`
- `confidence`
- `confidenceSource`
- `notes`
- `events`
- `createdAt`
- `updatedAt`
- `version`
- `legacyBenefitAliases`
- `ambiguousLegacyMapping`

Legacy `benefitKey/enrolled/usedAt` records are still supported and are canonicalized during wallet loading.

## Lifecycle

Supported lifecycle states:

- `unknown`
- `available`
- `enrollment_required`
- `activation_required`
- `active`
- `partially_used`
- `exhausted`
- `expired`
- `disabled`
- `removed`
- `suspended`

Explicit terminal states are preserved: `expired`, `disabled`, `removed`, and `suspended`.

Other lifecycle states are inferred from enrollment, activation, cycle entitlement, and remaining usage:

- Full entitlement remaining: `available` or `active`
- Less than full entitlement but more than zero remaining: `partially_used`
- Zero remaining value, spend cap, or uses for a tracked entitlement: `exhausted`
- Enrollment and activation requirements take precedence over available usage

This prevents a full $10 monthly credit from being marked partially used just because `remainingValue` is positive.

## Usage Tracking

Wallet state supports:

- cycle value limit
- cycle spend limit
- cycle usage limit
- cycle frequency
- remaining value
- remaining uses
- remaining spend cap
- current spend
- usage count
- current cycle
- historical cycles
- last used timestamp
- reset date

This covers monthly credits, quarterly categories, annual travel credits, spending caps, and future issuer-synchronized usage.

Cycle limits represent entitlement. Remaining values represent current availability.

Examples:

- `$10 / $10` remaining: available or active
- `$6 / $10` remaining: partially used
- `$0 / $10` remaining: exhausted

## Recommendation Integration

Recommendation scoring now checks wallet state before scoring a benefit.

Rules:

- Exhausted benefits do not influence recommendations.
- Expired, disabled, removed, and suspended benefits do not influence recommendations.
- Enrollment-required benefits are not treated as active unless the user is enrolled.
- Activation-required benefits are not treated as active unless activated.
- Partially used statement credits only contribute remaining value.
- Spending-capped reward benefits are split across remaining cap and base earn. For example, a $100 purchase with a 5% bonus, 1% base earn, and $20 cap remaining scores as 5% on $20 plus 1% on $80.
- Recommendation requests are read-only. Usage is not decremented during scoring.

Wallet state requirement policy:

- `state_not_required`: uncapped flat rewards
- `state_optional`: ordinary uncapped category rewards without known usage limits
- `state_required`: statement credits, annual/monthly credits, enrollment-required benefits, activation-required benefits, spending-capped rewards, rotating categories, and usage-limited benefits

In strict production scoring, a `state_required` benefit with no wallet state is rejected with `WALLET_STATE_REQUIRED`. Compatibility mode may preserve legacy fallback behavior explicitly.

## Confidence Model

Wallet state includes a confidence score and source.

Sources:

- `issuer_verified`
- `user_verified`
- `imported`
- `estimated`
- `unknown`

Current default confidence:

- Issuer verified: `0.98`
- User verified: `0.90`
- Imported: `0.78`
- Estimated: `0.62`
- Unknown: `0.40`

Strict production scoring does not allow an `unknown` confidence source to authorize a state-required benefit. Estimated states may be used conditionally but must not be presented as issuer-verified.

## Wallet Events

Events preserve history:

- `benefit_enrolled`
- `benefit_activated`
- `credit_used`
- `credit_exhausted`
- `cycle_reset`
- `benefit_expired`
- `benefit_removed`
- `benefit_restored`
- `usage_recorded`

Events are modeled now so future sync providers can append history without changing recommendation logic.

Usage mutation is handled through a repository/service boundary:

- `getState(userId, benefitId)`
- `listStates(userId)`
- `saveState(state, expectedVersion)`
- `appendEvent(stateId, event)`
- `applyUsageUpdate(stateId, updater, idempotencyKey)`
- `resetCycle(stateId)`

The fixture repository is in-memory. It supports optimistic version checks and duplicate idempotency-key rejection so future database-backed implementations can preserve the same contract.

## Future Sync Providers

Provider interfaces exist for:

- issuer APIs
- Plaid
- user confirmations
- manual edits
- receipt analysis
- email parsing

No live provider integration is implemented in this ticket.

## Reset Behavior

`resetWalletBenefitCycle()` demonstrates deterministic cycle rollover:

1. Current spend and usage count move into historical cycles.
2. Remaining value resets from `cycleValueLimit`.
3. Remaining spend cap resets from `cycleSpendLimit`.
4. Remaining uses resets from `cycleUsageLimit`.
5. Current usage resets to zero.
6. A `cycle_reset` event is recorded.
7. Repeating the same reset is idempotent.

## Developer Commands

Run from `backend/`:

```bash
npm run wallet:audit
npm run wallet:benefits
npm run wallet:usage
npm run wallet:confidence
npm run wallet:reset-demo
npm run wallet:simulate-usage
```

All commands use fixtures.

`wallet:audit` reports missing benefit IDs, missing cycle limits, contradictory lifecycle values, negative values, values above cycle limits, ambiguous legacy mappings, low-confidence states, and overdue resets.

## Known Limitations

- Wallet state persistence is compatible with the existing collection but not fully migrated.
- The repository abstraction is currently in-memory for fixtures and tests.
- No issuer synchronization is implemented.
- No Plaid enrichment is implemented.
- No UI changes are included.
- Receipt and email providers are interfaces only.
- Reset jobs are demonstrated with fixtures, not scheduled.

## Future Work

- Persist richer wallet state from the extension/onboarding flow.
- Add scheduled reset jobs.
- Add reviewer/admin tools for state inspection.
- Add issuer/Plaid adapters when reliable sources are available.
- Add user confirmation flows for uncertain wallet state.
