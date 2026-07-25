import { hydratedScenario } from "./scenarioHelpers";

export const portalScenarios = [
  ...[75, 200, 400, 700, 1200, 2000, 3500, 5000].map((amount, index) =>
    hydratedScenario({
      id: `portal-${String(index + 1).padStart(3, "0")}`,
      name: `Portal validation ${index + 1}`,
      tags: ["curated", "portal"],
      wallet: ["chase-sapphire-preferred", "chase-freedom-flex", "capital-one-venture"],
      merchantName: "Chase Travel",
      category: "travel",
      amount,
      channel: "issuer_portal",
      expectedRuleType: "portal",
    }),
  ),
  hydratedScenario({
    id: "portal-direct-booking-001",
    name: "Portal-only rule does not apply to direct booking",
    tags: ["curated", "portal", "channel"],
    wallet: ["chase-sapphire-preferred", "capital-one-venture"],
    merchantName: "Delta",
    category: "travel",
    amount: 400,
    channel: "online",
    expectedRuleType: "category",
  }),
];
