# Privacy And Compliance

## Data Required

- Organization/environment.
- API key identity.
- Partner external user reference or anonymous decision reference.
- Wallet card slugs/payment method references.
- Merchant/purchase context.
- Optional benefit state and valuation profile.

## Data To Avoid

- Full payment card numbers.
- CVVs.
- Bank credentials.
- SSNs, DOBs.
- Full transaction histories.
- Precise location unless necessary later.
- Sensitive URLs/query params.
- Customer names/emails unless dashboard auth requires them.

## Storage

Store minimized decision audit records, usage records, API key hashes, wallet records if partner opts into persistence, and anonymized product analytics.

## Compliance Boundaries

Avoiding card numbers/payment execution should reduce PCI exposure, but does not eliminate security obligations.

Requires legal review: privacy policy, DPA, state privacy laws, international privacy, financial guidance disclaimers, issuer/card-network terms, data licensing.

Do not claim SOC 2, PCI compliance, fiduciary status, or guaranteed reward outcomes.
