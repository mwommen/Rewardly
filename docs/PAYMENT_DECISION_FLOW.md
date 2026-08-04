# Payment Decision Flow

Rewardly answers one question: which card should this wallet use for this purchase?

## Flow

1. Merchant and purchase information arrive from the client.
2. Card IDs are normalized.
3. Rewardly resolves only the cards supplied in the wallet.
4. Merchant Intelligence classifies merchant identity and category.
5. Wallet Intelligence evaluates benefit state where available.
6. Benefit and reward rules are scored.
7. The winning rule is passed into the narrative layer.
8. The public response adapter returns a compact recommendation.

## Wallet-First Guarantee

When `restrictToWallet` is true, Rewardly does not recommend cards outside the supplied wallet. The public V1 API always uses wallet-restricted decisions.

## Error Philosophy

Public errors are stable and non-technical. Internal stack traces are never returned.
