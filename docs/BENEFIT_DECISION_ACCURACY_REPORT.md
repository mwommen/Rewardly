# Benefit Decision Accuracy Report

Date: 2026-07-24

## Scope

This sprint proves that Rewardly can recommend the best card from a supplied user wallet using realistic structured benefit records from major issuers.

No merchant-specific recommendation code was added. Merchant-specific credits remain structured benefit data.

## Fixture Set

Controlled production-like cards:

- American Express Gold Card
- Chase Sapphire Preferred
- Chase Freedom Flex
- Capital One Venture Rewards
- Citi Custom Cash
- Citi Double Cash
- Wells Fargo Autograph
- Wells Fargo Active Cash
- Bank Offer Card fixture for structured statement-credit behavior

Structured rule coverage:

- base earning
- dining
- groceries
- travel
- issuer travel portals
- gas
- drugstores
- streaming
- online retail/general retail
- rotating categories
- statement credits
- spending caps
- enrollment and activation requirements
- effective and expiration dates

## Accuracy Results

| Scenario | Expected Winner | Actual Winner | Winning Rule | Runner-Up | Confidence | Pass | Assumptions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dining | amex-gold | amex-gold | 4x on dining | chase-sapphire-preferred | high | PASS | Membership Rewards uses Rewardly default valuation. |
| Grocery | amex-gold | amex-gold | 4x on groceries | citi-custom-cash | high | PASS | Amex and Citi grocery caps have remaining spend. |
| General retail | capital-one-venture | capital-one-venture | 2x on all purchases | wells-fargo-active-cash | high | PASS | Equal value resolves deterministically. |
| Airline direct | chase-sapphire-preferred | chase-sapphire-preferred | 2x on travel | wells-fargo-autograph | high | PASS | Chase and Wells Fargo points use different default valuations. |
| Issuer travel portal | chase-sapphire-preferred | chase-sapphire-preferred | 5x on issuer_travel_portal | chase-freedom-flex | high | PASS | Purchase is classified as issuer travel portal. |
| Streaming | chase-sapphire-preferred | chase-sapphire-preferred | 3x on streaming | wells-fargo-autograph | high | PASS | Streaming classification is verified. |
| Drugstore | chase-freedom-flex | chase-freedom-flex | 3% on drugstores | capital-one-venture | high | PASS | Drugstore rule is category data. |
| Rotating category active | chase-freedom-flex | chase-freedom-flex | 5% on gas | capital-one-venture | high | PASS | Quarterly gas category is activated and has remaining cap. |
| Rotating category not activated | capital-one-venture | capital-one-venture | 2x on all purchases | chase-freedom-flex | high | PASS | Unactivated rotating category cannot influence recommendation. |
| Statement credit remaining | bestbuy-offer-card | bestbuy-offer-card | $20 statement credit at Best Buy | capital-one-venture | high | PASS | Enrollment complete and credit has $20 remaining. |
| Statement credit exhausted | capital-one-venture | capital-one-venture | 2x on all purchases | bestbuy-offer-card | high | PASS | Exhausted credit cannot influence recommendation. |
| Unknown merchant | capital-one-venture | capital-one-venture | 2x on all purchases | chase-sapphire-preferred | high | PASS | Unknown merchant uses verified base earning only. |
| Ambiguous merchant | amex-gold | amex-gold | 4x on dining | capital-one-venture | low | PASS | Inferred category lowers confidence and copy avoids verified language. |
| Points versus cash | amex-gold | amex-gold | 4x on groceries | citi-custom-cash | high | PASS | Points and cash are compared by estimated cash-equivalent value. |
| Equal estimated value | capital-one-venture | capital-one-venture | 2x on all purchases | wells-fargo-active-cash | high | PASS | Equal estimated value resolves deterministically. |
| Missing wallet state | capital-one-venture | capital-one-venture | 2x on all purchases | amex-gold | high | PASS | State-required Amex grocery cap is rejected when wallet state is missing. |

## Explanation Example

Dining scenario popup explanation:

```text
Merchant classified as Dining. American Express Gold Card earns 4x Membership Rewards. Chase Sapphire Preferred earns 3x Ultimate Rewards. American Express Gold Card provides the highest verified reward for Starbucks.
```

Ambiguous merchant explanation:

```text
Merchant appears to be Dining based on inferred. American Express Gold Card earns 4x Membership Rewards. Capital One Venture Rewards earns 2x Venture Miles. American Express Gold Card provides the highest verified reward for Cafe Market.
```

## Trace Guarantees

For every owned card, the decision trace includes:

- applicable rule
- rejected rules
- rejection reasons
- earning rate
- estimated reward quantity
- estimated cash-equivalent value
- confidence
- wallet-state effect
- valuation source and value

The trace only includes cards in the supplied user wallet.

## Currency Comparison

Direct earning-rate comparison is used only when owned cards share a comparable reward unit.

When points, miles, and cash are compared, Rewardly uses estimated cash-equivalent value and returns:

- valuation source
- reward currency
- value per unit
- explanation that the winner is based on estimated value

Current test valuations use Rewardly default valuation:

- American Express Membership Rewards: `$0.015`
- Chase Ultimate Rewards: `$0.015`
- Capital One Venture Miles: `$0.010`
- generic points/miles: `$0.010`
- cash back and statement credits: face value

## Validation

- `npm test -- --runTestsByPath tests/benefitDecisionAccuracy.test.ts`: PASS, 23/23 tests.
- No merchant-specific recommendation code was introduced.
