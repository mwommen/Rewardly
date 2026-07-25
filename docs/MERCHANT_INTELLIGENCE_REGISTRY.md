# Merchant Intelligence Registry

Registry version: `2026.07.sprint7`

Canonical records live in `backend/src/services/merchantIntelligenceService.ts`.

Each record includes merchant identity, merchant family, domains, checkout domains, aliases, billing descriptors, MCCs, category nodes, purchase metadata, relationships, confidence metadata, and validation category.

Supported Sprint 7 merchants include:

- Amazon
- Whole Foods Market
- Amazon Fresh
- Prime Video
- Audible
- Target
- Walmart
- Costco
- Best Buy
- Apple
- Nike
- Home Depot
- Lowe's
- DoorDash
- Uber
- Uber Eats
- Starbucks
- Delta
- United
- Southwest
- Marriott
- Hilton
- Airbnb
- Expedia
- Booking.com
- Lululemon

Alias matching is normalized by case, whitespace, punctuation, and token boundaries. Substring matches such as `apple` inside `pineapple` and deceptive suffix domains such as `amazon.com.attacker.example` are rejected.
