import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/api";

type BestCard = {
  card: { slug: string; name: string };
  effectiveRate?: number;
  explainer?: string;
  confidence?: number;
  why?: string[];
  confidenceLabel?: string;
  matchTier?: "exact_benefit" | "category_match" | "base_rate";
  matchedBenefit?: string | null;
  lastVerified?: string | null;
  annualFee?: number;
};

type Offer = {
  card: { slug: string; name: string };
  signupOffer?: string | null;
  perks: string[];
};

type RecommendationRaw = {
  slug?: unknown;
  name?: unknown;
  card?: {
    slug?: unknown;
    name?: unknown;
  };
  effectiveRate?: unknown;
  reason?: unknown;
  explainer?: unknown;
  confidence?: unknown;
  why?: unknown;
  confidenceLabel?: unknown;
  matchTier?: unknown;
  matchedBenefit?: unknown;
  lastVerified?: unknown;
  annualFee?: unknown;
  signupOffer?: unknown;
  perks?: unknown;
};

export type QueryInputs = {
  merchant?: string;
  domain?: string;
  amount?: number;
  mcc?: string;
  limit?: number;
};

export function useRecommendations(inputs: QueryInputs) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topPick, setTopPick] = useState<BestCard | null>(null);
  const [otherBest, setOtherBest] = useState<BestCard[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const buildParams = (params: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
    return sp;
  };

  const normalizeCard = (raw: RecommendationRaw): { slug: string; name: string } => {
    const slug = String(raw?.slug || raw?.card?.slug || "").trim();
    const name = String(raw?.name || raw?.card?.name || slug || "Unknown card").trim();
    return {
      slug: slug || "unknown-card",
      name: name || "Unknown card",
    };
  };

  const toBestCard = (raw: RecommendationRaw): BestCard => ({
    card: normalizeCard(raw),
    effectiveRate: typeof raw?.effectiveRate === "number" ? raw.effectiveRate : undefined,
    explainer:
      typeof raw?.reason === "string"
        ? raw.reason
        : typeof raw?.explainer === "string"
        ? raw.explainer
        : undefined,
    confidence: typeof raw?.confidence === "number" ? raw.confidence : undefined,
    why: Array.isArray(raw?.why) ? raw.why.map(String) : [],
    confidenceLabel: typeof raw?.confidenceLabel === "string" ? raw.confidenceLabel : undefined,
    matchTier:
      raw?.matchTier === "exact_benefit" || raw?.matchTier === "category_match" || raw?.matchTier === "base_rate"
        ? raw.matchTier
        : undefined,
    matchedBenefit: typeof raw?.matchedBenefit === "string" ? raw.matchedBenefit : null,
    lastVerified: typeof raw?.lastVerified === "string" ? raw.lastVerified : null,
    annualFee: typeof raw?.annualFee === "number" ? raw.annualFee : undefined,
  });

  const toOffer = (raw: RecommendationRaw): Offer => ({
    card: normalizeCard(raw),
    signupOffer: typeof raw?.signupOffer === "string" ? raw.signupOffer : null,
    perks: Array.isArray(raw?.perks) ? raw.perks.map(String) : [],
  });

  const fetchAll = async () => {
    const trimmedMerchant = inputs.merchant?.trim();
    if (!trimmedMerchant) {
      abortRef.current?.abort();
      setLoading(false);
      setError(null);
      setTopPick(null);
      setOtherBest([]);
      setOffers([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const { domain, amount, mcc, limit = 5 } = inputs;

      // ---- /best ----
      const bestFields = [
        "slug",
        "name",
        "effectiveRate",
        "confidence",
        "confidenceLabel",
        "matchTier",
        "matchedBenefit",
        "why",
        "lastVerified",
        "annualFee",
        "reason",
      ].join(",");
      const bestParams = buildParams({ merchant: trimmedMerchant, domain, amount, mcc, limit, fields: bestFields });
      const bestUrl = `${API_BASE}/api/recommendations/best?${bestParams.toString()}`;

      // ---- /offers ----
      const offersFields = ["slug", "name", "signupOffer", "perks"].join(",");
      const offersParams = buildParams({ merchant: trimmedMerchant, domain, amount, mcc, fields: offersFields });
      const offersUrl = `${API_BASE}/api/recommendations/offers?${offersParams.toString()}`;

      const [bestRes, offersRes] = await Promise.all([
        fetch(bestUrl, { signal: controller.signal }),
        fetch(offersUrl, { signal: controller.signal }),
      ]);

      if (!bestRes.ok) throw new Error(`best HTTP ${bestRes.status}`);
      if (!offersRes.ok) throw new Error(`offers HTTP ${offersRes.status}`);

      const bestJson = await bestRes.json();
      const offersJson = await offersRes.json();

      const bestListRaw = Array.isArray(bestJson?.recommendations) ? bestJson.recommendations : [];
      const normalizedBest = bestListRaw.map(toBestCard);
      const [first, ...rest] = normalizedBest;

      const offersRaw = Array.isArray(offersJson?.offers) ? offersJson.offers : [];
      const normalizedOffers = offersRaw.map(toOffer);

      setTopPick(first ?? null);
      setOtherBest(rest);
      setOffers(normalizedOffers);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Request failed");
      setTopPick(null);
      setOtherBest([]);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.merchant, inputs.domain, inputs.amount, inputs.mcc, inputs.limit]);

  return { loading, error, topPick, otherBest, offers, refetch: fetchAll };
}
