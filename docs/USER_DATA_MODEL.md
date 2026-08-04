# User Data Model

Rewardly stores user-owned data separately from canonical platform intelligence.

## Users

`rewardlyUsers`

- userId
- email
- displayName
- passwordHash
- passwordSalt
- status
- authProvider
- createdAt
- updatedAt
- deletedAt

## Sessions

`rewardlySessions`

- sessionId
- userId
- accessTokenHash
- refreshTokenHash
- accessTokenExpiresAt
- refreshTokenExpiresAt
- revokedAt
- createdAt
- updatedAt

## Wallets

`userWallets`

- userId
- cardSlugs
- syncRevision
- schemaVersion
- lastModifiedSource
- createdAt
- updatedAt
- deletedAt

## Payment Journey

`paymentJourney`

- paymentId
- userId
- decisionId
- merchant
- amount
- currency
- recommendedCard
- selectedCard
- estimatedValue
- confidence
- notes
- completedAt
- clientIdempotencyKey
- syncRevision
- schemaVersion

## Shopping Plans

`userShoppingPlans`

- planId
- userId
- title
- notes
- status
- currency
- items
- syncRevision
- schemaVersion

## Preferences

`userPreferences`

- userId
- favoriteMerchants
- theme
- defaultCurrency
- onboardingCompleted
- locationEnabled
- syncRevision
- schemaVersion
