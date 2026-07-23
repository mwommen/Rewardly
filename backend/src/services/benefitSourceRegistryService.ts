import type { BenefitSourceRecord, SourceHealthStatus } from "./benefitPipelineTypes";

const NOW = "2026-07-22T00:00:00.000Z";

export const BENEFIT_SOURCE_REGISTRY: BenefitSourceRecord[] = [
  {
    sourceId: "src:amex-platinum:benefits",
    cardSlug: "amex-platinum",
    issuer: "American Express",
    sourceUrl: "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
    sourceType: "issuer_benefit_page",
    priority: 1,
    expectedUpdateFrequency: "monthly",
    parserStrategy: "html",
    status: "active",
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown",
  },
  {
    sourceId: "src:amex-platinum:terms",
    cardSlug: "amex-platinum",
    issuer: "American Express",
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/card-application/apply/prospect/terms/platinum-card/25330-10-0",
    sourceType: "issuer_terms",
    priority: 2,
    expectedUpdateFrequency: "quarterly",
    parserStrategy: "html",
    status: "active",
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown",
  },
  {
    sourceId: "src:amex-platinum:rewards",
    cardSlug: "amex-platinum",
    issuer: "American Express",
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/platinum/",
    sourceType: "issuer_reward_page",
    priority: 3,
    expectedUpdateFrequency: "monthly",
    parserStrategy: "html",
    status: "active",
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown",
  },
  {
    sourceId: "src:amex-platinum:benefit-guide",
    cardSlug: "amex-platinum",
    issuer: "American Express",
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/features-benefits/policies/",
    sourceType: "pdf_benefit_guide",
    priority: 4,
    expectedUpdateFrequency: "quarterly",
    parserStrategy: "pdf",
    status: "active",
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown",
  },
  {
    sourceId: "src:amex-membership-rewards:info",
    cardSlug: "amex-platinum",
    issuer: "American Express",
    sourceUrl: "https://www.americanexpress.com/en-us/rewards/membership-rewards/",
    sourceType: "issuer_reward_page",
    priority: 5,
    expectedUpdateFrequency: "monthly",
    parserStrategy: "html",
    status: "active",
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown",
  },
  {
    sourceId: "src:amex-gold:benefits",
    cardSlug: "amex-gold",
    issuer: "American Express",
    sourceUrl: "https://www.americanexpress.com/en-us/benefits/gold-card/",
    sourceType: "issuer_benefit_page",
    priority: 6,
    expectedUpdateFrequency: "monthly",
    parserStrategy: "html",
    status: "active",
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown",
  },
  {
    sourceId: "src:capital-one-venture-x:rewards",
    cardSlug: "capital-one-venture-x",
    issuer: "Capital One",
    sourceUrl: "https://www.capitalone.com/credit-cards/venture-x/",
    sourceType: "issuer_reward_page",
    priority: 1,
    expectedUpdateFrequency: "monthly",
    parserStrategy: "structured_json",
    status: "active",
    firstDiscoveredAt: NOW,
    lastCheckedAt: null,
    lastSuccessfulExtractionAt: null,
    lastObservedChangeAt: null,
    checksum: null,
    healthStatus: "unknown",
  },
];

export function listBenefitSources() {
  return BENEFIT_SOURCE_REGISTRY.slice().sort((a, b) => a.priority - b.priority);
}

export function getBenefitSource(sourceId: string) {
  return listBenefitSources().find((source) => source.sourceId === sourceId) || null;
}

export function sourcesForCard(cardSlug: string) {
  const normalized = normalize(cardSlug);
  return listBenefitSources().filter((source) => normalize(source.cardSlug) === normalized);
}

export function updateSourceHealth(
  source: BenefitSourceRecord,
  healthStatus: SourceHealthStatus,
  checkedAt = new Date().toISOString(),
): BenefitSourceRecord {
  return {
    ...source,
    healthStatus,
    lastCheckedAt: checkedAt,
  };
}

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}
