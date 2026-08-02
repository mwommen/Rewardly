# Merchant Intelligence Strategy

## Inputs

Merchant context may include name, domain, URL, MCC, partner category, country, channel, checkout metadata, and known Rewardly merchant ID.

## Precedence

1. Verified Rewardly merchant ID.
2. Trusted partner merchant ID mapped to Rewardly.
3. Domain/checkout domain.
4. MCC from issuer/network/partner.
5. Partner category.
6. Merchant name/descriptor.
7. Weak fuzzy inference.

## Separation

Merchant identity, merchant category, reward eligibility, and confidence are separate outputs. A name match alone should not imply reward eligibility.

## Ambiguity

Return lower confidence and warnings for marketplaces, mixed merchants, travel portals, delivery platforms, and weak fuzzy matches.

## Existing Asset

Confirmed from repository: merchant registry, candidate resolver, confidence scorer, context resolver, decision input adapter, trace sanitizer, and validation tests exist under backend services.

## MVP

Use existing merchant intelligence behind API facade. Accept partner-provided MCC/category as evidence, not absolute truth.
