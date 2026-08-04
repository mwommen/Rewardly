# Account Deletion

Rewardly supports private-beta account deletion through:

`DELETE /api/v1/me/account`

## Deletion Behavior

- User record is soft-deleted.
- Email and auth-provider IDs are anonymized to release active-account
  uniqueness safely.
- Active sessions are revoked.
- Wallet is soft-deleted.
- Payment Journey entries are soft-deleted.
- Shopping plans are soft-deleted.
- Preferences are soft-deleted.

## User Warning

The mobile Settings screen warns that deletion permanently removes cloud wallet,
payment journey, shopping plans, preferences, and active sessions.

## Recreating an Account

Deleted users may create a new account with the same email. The old account
remains soft-deleted for audit/retention purposes, but it no longer owns the
email uniqueness constraint.

## Future Work

Before public launch, add email confirmation, delayed deletion recovery, export
before deletion, and retention-policy review.
