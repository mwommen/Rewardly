# Preferences

Context preferences represent user or partner preference inputs.

They are not recommendation logic.

## Supported Preference Types

- `prefer_issuer`
- `avoid_card_type`
- `avoid_annual_fee`
- `prefer_reward_type`
- `avoid_foreign_transaction_fee`
- `prioritize_status`
- `minimize_complexity`

## Preference Shape

```json
{
  "preferenceId": "pref_1_prefer_reward_type",
  "type": "prefer_reward_type",
  "value": "transferable_points",
  "strength": "soft",
  "source": "user"
}
```

## Constraints

Constraints are stronger than preferences.

Supported constraint types:

- `never_finance`
- `no_personal_card_for_business`
- `exclude_expired_benefits`
- `exclude_inactive_cards`
- `exclude_suspended_cards`
- `partner_policy`

Hard constraints should be treated as explicit boundaries by future decision policies.
