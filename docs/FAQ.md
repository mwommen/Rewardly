# Rewardly FAQ

## Is the public API a new recommendation engine?

No. The API is a stable wrapper around the existing `PaymentDecisionService`.

## Does V1 support non-USD purchases?

No. V1 accepts only `USD`.

## Does the API require real credit card numbers?

No. Developers pass card IDs such as `capital-one-venture` or `amex-gold`.

## Can I run Rewardly without MongoDB?

Yes, use sandbox mode:

```bash
REWARDLY_SANDBOX_MODE=true REWARDLY_DISABLE_REQUEST_ANALYTICS=true npm --prefix backend run dev
```

## Does sandbox mode change recommendation logic?

No. It only changes data loading so predefined catalog data can hydrate wallet cards without external services.

## Where is the OpenAPI document?

`GET /api/v1/openapi.json`

## Where is the Postman collection?

`docs/postman/rewardly-public-api.postman_collection.json`
