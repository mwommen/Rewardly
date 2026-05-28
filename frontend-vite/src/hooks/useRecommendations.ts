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
  perks?: string[];
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

  const normalizeCard = (raw: any): { slug: string; name: string } => {
    const slug = String(raw?.slug || raw?.card?.slug || "").trim();
    const name = String(raw?.name || raw?.card?.name || slug || "Unknown card").trim();
    return {
      slug: slug || "unknown-card",
      name: name || "Unknown card",
    };
  };

  const toBestCard = (raw: any): BestCard => ({
    card: normalizeCard(raw),
    effectiveRate: typeof raw?.effectiveRate === "number" ? raw.effectiveRate : undefined,
    explainer: raw?.reason || raw?.explainer,
    confidence: typeof raw?.confidence === "number" ? raw.confidence : undefined,
    why: Array.isArray(raw?.why) ? raw.why : [],
    confidenceLabel: typeof raw?.confidenceLabel === "string" ? raw.confidenceLabel : undefined,
    matchTier: raw?.matchTier,
    matchedBenefit: typeof raw?.matchedBenefit === "string" ? raw.matchedBenefit : null,
    lastVerified: typeof raw?.lastVerified === "string" ? raw.lastVerified : null,
    annualFee: typeof raw?.annualFee === "number" ? raw.annualFee : undefined,
  });

  const toOffer = (raw: any): Offer => ({
    card: normalizeCard(raw),
    signupOffer: raw?.signupOffer ?? null,
    perks: Array.isArray(raw?.perks) ? raw.perks : [],
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
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setError(e.message || "Request failed");
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
