import type { ScenarioCatalog } from "../recommendationScenario.types";
import type { ReferenceBenefit, ReferenceCard } from "./referenceBenefit.types";

const SOURCE_DATE = "2026-07-01T00:00:00.000Z";

export function adaptCatalogToReference(catalog: ScenarioCatalog): Record<string, ReferenceCard> {
  return Object.fromEntries(
    Object.values(catalog).map((card: any) => [card.slug, adaptCardToReference(card)]),
  );
}

export function adaptCardToReference(card: any): ReferenceCard {
  const detail = card.benefitsDetail || {};
  const base = {
    cardSlug: card.slug,
    cardName: card.name,
    issuer: card.issuer || "unknown",
    confidence: Number(detail.confidence ?? 0.95),
    source: detail.sourceUrl || card.sourceUrl || "fixture",
    lastVerified: detail.lastVerified || SOURCE_DATE,
  };
  const benefits: ReferenceBenefit[] = [];

  for (const entry of array(detail.rewardsByCategory)) {
    const keys = array(entry.keys).map(normalizeCategory);
    const idKeys = keys.map((key) => key.replace(/_/g, "-"));
    benefits.push({
      ...base,
      id: `${card.slug}:reward:${idKeys.join("-")}:${rateId(entry.rate)}`,
      ruleType: portalCategory(keys[0]) ? "portal" : "category",
      rewardCurrency: rewardCurrency(entry.unit, entry.rate),
      rate: parseRate(entry.rate),
      rateUnit: String(entry.rate || "").includes("%") ? "percent" : "x",
      categories: keys,
      merchants: array(entry.eligibleWhen?.merchantPatterns).map(normalize),
      channels: normalizeChannels(entry.eligibleWhen?.channels),
      enrollmentRequired: Boolean(entry.requiresEnrollment),
      activationRequired: Boolean(entry.activationRequired),
      capAmountUSD: numberOrNull(entry.capPerPeriodUSD),
      creditAmountUSD: null,
      effectiveDate: entry.start || null,
      expirationDate: entry.end || null,
      precedence: portalCategory(keys[0]) ? 3 : 2,
    });
  }

  for (const entry of array(detail.rewardsFlat)) {
    benefits.push({
      ...base,
      id: `${card.slug}:flat:${rateId(entry.rate)}`,
      ruleType: "base",
      rewardCurrency: rewardCurrency(entry.unit, entry.rate),
      rate: parseRate(entry.rate),
      rateUnit: String(entry.rate || "").includes("%") ? "percent" : "x",
      categories: ["all_purchases"],
      merchants: [],
      channels: ["any"],
      enrollmentRequired: false,
      activationRequired: false,
      capAmountUSD: null,
      creditAmountUSD: null,
      effectiveDate: null,
      expirationDate: null,
      precedence: 1,
    });
  }

  for (const rotation of array(detail.rewardsRotating)) {
    for (const category of array(rotation.categories)) {
      const keys = array(category.keys).map(normalizeCategory);
      benefits.push({
        ...base,
        id: `${card.slug}:rotating:${keys.join("-")}:${rateId(category.rate)}`,
        ruleType: "category",
        rewardCurrency: rewardCurrency(category.unit, category.rate),
        rate: parseRate(category.rate),
        rateUnit: String(category.rate || "").includes("%") ? "percent" : "x",
        categories: keys,
        merchants: [],
        channels: ["any"],
        enrollmentRequired: Boolean(rotation.requiresEnrollment),
        activationRequired: Boolean(rotation.activationRequired),
        capAmountUSD: numberOrNull(category.capPerPeriodUSD),
        creditAmountUSD: null,
        effectiveDate: rotation.start || null,
        expirationDate: rotation.end || null,
        precedence: 2,
      });
    }
  }

  for (const entry of [...array(detail.merchantCredits), ...array(detail.recurringCredits)]) {
    const merchants = array(entry.eligibleWhen?.merchantPatterns).map(normalize);
    benefits.push({
      ...base,
      id: `${card.slug}:${detail.merchantCredits?.includes?.(entry) ? "merchant-credit" : "recurring-credit"}:${entry.id || normalize(entry.label)}`,
      ruleType: "statement_credit",
      rewardCurrency: "statement_credit",
      rate: Number(entry.amountUSD || 0),
      rateUnit: "credit",
      categories: [],
      merchants,
      channels: normalizeChannels(entry.eligibleWhen?.channels),
      enrollmentRequired: Boolean(entry.requiresEnrollment),
      activationRequired: Boolean(entry.activationRequired),
      capAmountUSD: null,
      creditAmountUSD: numberOrNull(entry.amountUSD),
      effectiveDate: entry.start || null,
      expirationDate: entry.end || null,
      precedence: 4,
    });
  }

  return { slug: card.slug, name: card.name, issuer: card.issuer || "unknown", benefits };
}

export function normalizeCategory(value: unknown) {
  return normalize(value).replace(/\s+/g, "_");
}

export function normalize(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeChannels(value: unknown): ReferenceBenefit["channels"] {
  const channels = array(value).map((item) => normalizeCategory(item)) as ReferenceBenefit["channels"];
  return channels.length ? channels : ["any"];
}

function rewardCurrency(unit: unknown, rate: unknown): ReferenceBenefit["rewardCurrency"] {
  if (String(unit || "").toLowerCase().includes("cash") || String(rate || "").includes("%")) return "cash";
  if (String(unit || "").toLowerCase().includes("mile")) return "miles";
  return "points";
}

function parseRate(value: unknown) {
  const match = String(value || "").match(/([\d.]+)/);
  return match ? Number(match[1]) : 0;
}

function rateId(value: unknown) {
  return String(value || "").replace("%", "").replace(/\s+/g, "").toLowerCase();
}

function portalCategory(value: unknown) {
  return /portal|issuer_travel_portal|travel_portal/i.test(String(value || ""));
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function array<T = any>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}
