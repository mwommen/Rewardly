import { useEffect, useRef, useState } from "react";

type BestCard = {
  card: { slug: string; name: string };
  effectiveRate?: number;
  explainer?: string;
  confidence?: number;
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
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";
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

  const fetchAll = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const { merchant, domain, amount, mcc, limit = 5 } = inputs;

      // ---- /best ----
      const bestFields = [
        "top.card.slug",
        "top.card.name",
        "top.effectiveRate",
        "top.explainer",
        "top.confidence",
        "all.card.slug",
        "all.card.name",
        "all.effectiveRate",
      ].join(",");
      const bestParams = buildParams({ merchant, domain, amount, mcc, limit, fields: bestFields });
      const bestUrl = `${API_BASE}/api/recommendations/best?${bestParams.toString()}`;

      // ---- /offers ----
      const offersFields = ["offers.card.slug", "offers.card.name", "offers.signupOffer", "offers.perks"].join(",");
      const offersParams = buildParams({ merchant, domain, amount, mcc, fields: offersFields });
      const offersUrl = `${API_BASE}/api/recommendations/offers?${offersParams.toString()}`;

      const [bestRes, offersRes] = await Promise.all([
        fetch(bestUrl, { signal: controller.signal }),
        fetch(offersUrl, { signal: controller.signal }),
      ]);

      if (!bestRes.ok) throw new Error(`best HTTP ${bestRes.status}`);
      if (!offersRes.ok) throw new Error(`offers HTTP ${offersRes.status}`);

      const bestJson = await bestRes.json();
      const offersJson = await offersRes.json();

      const top = bestJson?.top?.[0] ?? null;
      const others = (bestJson?.all || []).filter((b: BestCard) =>
        top ? b.card.slug !== top.card.slug : true
      );
      const offersList = offersJson?.offers ?? offersJson?.all ?? offersJson?.top ?? [];

      setTopPick(top);
      setOtherBest(others);
      setOffers(offersList);
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
