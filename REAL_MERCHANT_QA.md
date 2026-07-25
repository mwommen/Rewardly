# Real Merchant QA

Use this matrix for live browser verification. Manual QA confirms real pages expose the signals assumed by deterministic fixtures; it does not replace validation.

For each checkout record:

- Test URL or checkout state
- Expected merchant identity
- Expected merchant family
- Expected category
- Expected channel
- Expected marketplace state
- Expected confidence band
- Expected evidence
- Expected recommendation behavior
- Actual result
- Screenshot or trace reference
- Pass/fail

## Initial Matrix

| Merchant | Expected Identity | Family | Category | Channel | Marketplace | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon | amazon | amazon | online_shopping | online_direct | possible | high | Review/payment only |
| Lululemon | lululemon | - | apparel | online_direct | false | high | Dynamic bag checkout |
| Apple | apple | apple | online_shopping | online_direct | false | high | Payment-entry step |
| Target | target | target | departmentstores | online_direct | false | high | Signed-in payment step |
| Walmart | walmart | walmart | departmentstores | online_direct | false | high | Payment controls visible |
| Best Buy | best-buy | - | online_shopping | online_direct | false | high | Payment controls visible |

Do not record card numbers, addresses, customer names, order numbers, screenshots containing personal information, or full page HTML.
