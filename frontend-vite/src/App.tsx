// frontend/src/App.tsx
import { useEffect, useMemo, useState } from "react";
import type { Card } from "./cardModules";
import { getBenefitLogo } from "./lib/benefitLogos";
import { getCardLogo } from "./lib/cardLogos";
import { getApplyUrl } from "./lib/applyLinks";
import { getEnrollmentLink } from "./lib/enrollmentLinks";
import { API_BASE } from "./lib/api";
import MapLinkedAccounts from "./MapLinkedAccounts";
import PlaidLinkButton from "./PlaidLinkButton";
import { useRecommendations } from "./hooks/useRecommendations";
import "./App.css";

type UserBenefitState = {
  benefitKey: string;
  cardSlug?: string | null;
  cardName?: string | null;
  label?: string | null;
  period?: string | null;
  amountUSD?: number | null;
  requiresEnrollment?: boolean;
  enrolled?: boolean;
  enrolledAt?: string | null;
  usedAt?: string | null;
  remindEnabled?: boolean;
  updatedAt?: string | null;
};

type WalletRecommendedCard = {
  slug: string;
  name: string;
  issuer?: string | null;
  annualFee?: number | null;
  reason?: string;
};

type WalletSummaryApi = {
  totalCredits: number;
  unusedCredits: number;
  enrolledCredits: number;
  remindersEnabled: number;
  openValue: number;
  missingCategories: string[];
  topMissedCredits: Array<{ label: string; cardName: string; amountUSD: number }>;
  recommendedNextCard?: WalletRecommendedCard;
  linkedCardSlugs: string[];
  walletHealthScore: number;
} | null;

type CreditItem = {
  benefitKey: string;
  cardSlug?: string | null;
  cardName: string;
  cardIssuer?: string | null;
  cardSourceUrl?: string | null;
  cardLogo?: string | null;
  benefitLogo?: string | null;
  label: string;
  amountUSD: number;
  period: string;
  periodRaw?: string;
  typeLabel: string;
  requiresEnrollment?: boolean;
  enrollmentLabel?: string;
  enrollmentLink?: { url: string; ctaLabel: string } | null;
  verificationLabel?: string;
  expiresAt?: string | null;
  benefitState?: UserBenefitState | null;
  usedThisPeriod?: boolean;
};

function App() {
  type QaSummary = {
    status: "ready_for_runtime_qa" | "needs_attention" | string;
    cards: {
      total: number;
      validationFailureCount: number;
      cardsWithIssues: number;
      suspiciousBenefitCount: number;
    };
    linkedAccounts: {
      totalDocs: number;
      totalAccounts: number;
      creditAccounts: number;
      mappedCards: number;
      unresolvedMappings: number;
    };
    samples: {
      validationFailures?: Array<{ slug?: string; reason?: string }>;
      suspiciousBenefits?: Array<{
        example?: string;
        suspicionScore?: number;
        reasons?: string[];
        issuers?: string[];
      }>;
      cardIssues?: Array<{ slug?: string; issuer?: string; reasons?: string[] }>;
    };
  };

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [userId] = useState<string>(() => {
    return localStorage.getItem("cco_user_id") || "devUser";
  });
  const [activeMode, setActiveMode] = useState<"use" | "apply">("use");
  const [merchantForm, setMerchantForm] = useState({
    merchant: "",
    domain: "",
    amount: "",
    mcc: "",
  });
  const [merchantSubmitted, setMerchantSubmitted] = useState(merchantForm);
  const [scoreRange, setScoreRange] = useState("good");
  const [feeComfort, setFeeComfort] = useState("low");
  const [travelFocus, setTravelFocus] = useState("balanced");
  const [monthlyBudget, setMonthlyBudget] = useState("1500");
  const [incomeRange, setIncomeRange] = useState("50-100k");
  const [carryBalance, setCarryBalance] = useState("no");
  const [businessOwner, setBusinessOwner] = useState("no");
  const [travelFrequency, setTravelFrequency] = useState("moderate");
  const [applyRequested, setApplyRequested] = useState(false);
  const [applyResults, setApplyResults] = useState<Array<{ card: Card; reason: string; signals: string[] }>>([]);
  const [linkedCardSlugs, setLinkedCardSlugs] = useState<string[]>([]);
  const [manualCardSlugs, setManualCardSlugs] = useState<string[]>([]);
  const [showManualLink, setShowManualLink] = useState(false);
  const [allCardsSearch, setAllCardsSearch] = useState("");
  const [allCardsIssuer, setAllCardsIssuer] = useState("all");
  const [linkedRefresh, setLinkedRefresh] = useState(0);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);
  const [walletRecommendation, setWalletRecommendation] = useState<{
    bestCard: Card | null;
    reason?: { text?: string; matches?: string[]; credits?: Array<{ label: string; requiresEnrollment?: boolean }> } | null;
    candidates: Array<{ card: Card; reason?: { text?: string; matches?: string[]; credits?: Array<{ label: string; requiresEnrollment?: boolean }> } | null }>;
    note?: string;
  } | null>(null);
  const [walletRecommendationLoading, setWalletRecommendationLoading] = useState(false);
  const [walletRecommendationError, setWalletRecommendationError] = useState<string | null>(null);
  const [qaSummary, setQaSummary] = useState<QaSummary | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [showQaPanel, setShowQaPanel] = useState(false);
  const [benefitStates, setBenefitStates] = useState<Record<string, UserBenefitState>>({});
  const [savingBenefitKeys, setSavingBenefitKeys] = useState<string[]>([]);
  const [benefitStateError, setBenefitStateError] = useState<string | null>(null);
  const [walletSummaryApi, setWalletSummaryApi] = useState<WalletSummaryApi>(null);
  const [walletSummaryLoading, setWalletSummaryLoading] = useState(false);
  const [walletSummaryError, setWalletSummaryError] = useState<string | null>(null);
  const [benefitFilter, setBenefitFilter] = useState<"all" | "unused" | "enrolled" | "reminders" | "upcoming">("all");
  const [benefitSearch, setBenefitSearch] = useState("");

  // Fetch all cards from backend
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/cards`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch cards");
        return res.json();
      })
      .then((data) => {
        // Support both shapes: {cards:[...]} or [...]
        const arr = Array.isArray(data) ? data : (data.cards ?? []);
        setCards(arr);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load cards");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem("cco_user_id", userId);
  }, [userId]);

  useEffect(() => {
    const stored = localStorage.getItem("cco_manual_cards");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setManualCardSlugs(parsed.filter(Boolean));
      } catch {}
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/plaid/linked-accounts?userId=${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load linked accounts");
        return res.json();
      })
      .then((data) => {
        const linkedDocs = Array.isArray(data?.linked) ? data.linked : [];
        const slugs = linkedDocs
          .flatMap((doc: any) => doc?.accounts || [])
          .map((acct: any) => String(acct?.mappedCardSlug || "").trim())
          .filter(Boolean);
        setLinkedCardSlugs(Array.from(new Set(slugs)));
      })
      .catch(() => {
        setLinkedCardSlugs([]);
      });
  }, [userId, linkedRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/user-benefits?userId=${encodeURIComponent(userId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load saved benefit state");
        const next = Object.fromEntries(
          (Array.isArray(data?.states) ? data.states : []).map((state: UserBenefitState) => [state.benefitKey, state])
        );
        setBenefitStates(next);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [userId]);

  useEffect(() => {
    const controller = new AbortController();
    setWalletSummaryLoading(true);
    setWalletSummaryError(null);

    const params = new URLSearchParams({ userId });
    if (manualCardSlugs.length) {
      params.set("manualCardSlugs", manualCardSlugs.join(","));
    }

    fetch(`${API_BASE}/api/user-benefits/summary?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load wallet summary");
        setWalletSummaryApi(data);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setWalletSummaryError(err?.message || "Failed to load wallet summary");
      })
      .finally(() => {
        setWalletSummaryLoading(false);
      });

    return () => controller.abort();
  }, [userId, manualCardSlugs, linkedRefresh, benefitStates]);

  useEffect(() => {
    const controller = new AbortController();
    setQaLoading(true);
    setQaError(null);

    fetch(`${API_BASE}/api/qa/summary?userId=${encodeURIComponent(userId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load QA summary");
        setQaSummary(data);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setQaSummary(null);
        setQaError(err?.message || "Failed to load QA summary");
      })
      .finally(() => {
        setQaLoading(false);
      });

    return () => controller.abort();
  }, [linkedRefresh, userId]);

  const merchantQuery = useMemo(() => {
    const amt = merchantSubmitted.amount.trim() ? Number(merchantSubmitted.amount) : undefined;
    return {
      merchant: merchantSubmitted.merchant || undefined,
      domain: merchantSubmitted.domain || undefined,
      amount: Number.isFinite(amt!) ? amt : undefined,
      mcc: merchantSubmitted.mcc || undefined,
      limit: 5,
    };
  }, [merchantSubmitted]);

  const curatedSuggestions = [
    { label: "lululemon", type: "merchant" },
    { label: "dunkin", type: "merchant" },
    { label: "saks", type: "merchant" },
    { label: "resy", type: "merchant" },
    { label: "uber", type: "merchant" },
    { label: "doordash", type: "merchant" },
    { label: "travel", type: "category" },
    { label: "dining", type: "category" },
    { label: "groceries", type: "category" },
    { label: "gas", type: "category" },
    { label: "streaming", type: "category" },
  ];
  const suggestionChips = useMemo(() => {
    const seen = new Set<string>();
    return curatedSuggestions.filter((item) => {
      const key = item.label.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const {
    loading: merchantLoading,
    error: merchantError,
    topPick,
    otherBest,
    offers,
  } = useRecommendations(merchantQuery);

  const combinedLinkedSlugs = Array.from(new Set([...linkedCardSlugs, ...manualCardSlugs]));
  useEffect(() => {
    const merchant = merchantSubmitted.merchant.trim();
    if (!merchant || combinedLinkedSlugs.length === 0) {
      setWalletRecommendation(null);
      setWalletRecommendationLoading(false);
      setWalletRecommendationError(null);
      return;
    }

    const controller = new AbortController();
    setWalletRecommendationLoading(true);
    setWalletRecommendationError(null);

    fetch(`${API_BASE}/api/cards/best-card-for-merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant,
        userId,
        restrictToLinked: true,
        manualCardSlugs,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load wallet recommendation");
        setWalletRecommendation({
          bestCard: data?.bestCard || null,
          reason: data?.reason || null,
          candidates: Array.isArray(data?.candidates) ? data.candidates : [],
          note: typeof data?.note === "string" ? data.note : undefined,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setWalletRecommendation(null);
        setWalletRecommendationError(err?.message || "Failed to load wallet recommendation");
      })
      .finally(() => {
        setWalletRecommendationLoading(false);
      });

    return () => controller.abort();
  }, [manualCardSlugs, combinedLinkedSlugs.length, merchantSubmitted.merchant, userId]);
  const linkedCards = combinedLinkedSlugs.length
    ? cards.filter((card) => card.slug && combinedLinkedSlugs.includes(card.slug))
    : [];
  const creditItems = collectCredits(linkedCards, benefitStates);
  const upcomingCredits = collectUpcomingCredits(creditItems);

  const walletSummary = useMemo(() => {
    const total = creditItems.length;
    const totalValue = creditItems.reduce((sum, credit) => sum + (credit.amountUSD || 0), 0);
    const usedCount = creditItems.filter((credit) => credit.usedThisPeriod).length;
    const enrolledCount = creditItems.filter((credit) => credit.benefitState?.enrolled).length;
    const reminderCount = creditItems.filter((credit) => credit.benefitState?.remindEnabled).length;
    const availableCount = creditItems.filter((credit) => !credit.usedThisPeriod).length;
    const upcomingCount = upcomingCredits.length;
    return { total, totalValue, usedCount, enrolledCount, reminderCount, availableCount, upcomingCount };
  }, [creditItems, upcomingCredits]);

  const walletHealth = useMemo(() => {
    const unusedItems = creditItems.filter((credit) => !credit.usedThisPeriod);
    const unwarnedCount = unusedItems.filter((credit) => !credit.benefitState?.remindEnabled).length;
    const missedCount = unusedItems.length;
    const score = Math.max(35, Math.min(100, 90 - missedCount * 4 - unwarnedCount * 2));
    const topMissed = unusedItems
      .slice()
      .sort((a, b) => (b.amountUSD || 0) - (a.amountUSD || 0))
      .slice(0, 3)
      .map((credit) => ({ label: credit.label, cardName: credit.cardName, amountUSD: credit.amountUSD || 0 }));
    const gaps = getWalletCoverageGaps(linkedCards);
    return { score, missedCount, topMissed, gaps };
  }, [creditItems, linkedCards]);

  const walletNextCard = useMemo(() => {
    const pick = getApplyRecommendations(
      cards,
      scoreRange,
      feeComfort,
      travelFocus,
      monthlyBudget,
      incomeRange,
      carryBalance,
      businessOwner,
      travelFrequency
    )[0];
    return pick?.card || null;
  }, [cards, scoreRange, feeComfort, travelFocus, monthlyBudget, incomeRange, carryBalance, businessOwner, travelFrequency]);

  const effectiveWalletNextCard: WalletRecommendedCard | Card | null = walletSummaryApi?.recommendedNextCard ?? walletNextCard;
  const effectiveWalletGaps = walletSummaryApi?.missingCategories ?? walletHealth.gaps;
  const effectiveWalletScore = walletSummaryApi?.walletHealthScore ?? walletHealth.score;
  const effectiveWalletMissed = walletSummaryApi?.topMissedCredits ?? walletHealth.topMissed;

  const filteredCreditItems = useMemo(() => {
    const term = benefitSearch.trim().toLowerCase();
    return creditItems.filter((credit) => {
      if (benefitFilter === "unused" && credit.usedThisPeriod) return false;
      if (benefitFilter === "enrolled" && !credit.benefitState?.enrolled) return false;
      if (benefitFilter === "reminders" && !credit.benefitState?.remindEnabled) return false;
      if (benefitFilter === "upcoming") {
        const upcomingIds = new Set(upcomingCredits.map((item) => item.id));
        if (!upcomingIds.has(credit.benefitKey)) return false;
      }
      if (!term) return true;
      const hay = `${credit.label} ${credit.cardName} ${credit.typeLabel}`.toLowerCase();
      return hay.includes(term);
    });
  }, [creditItems, benefitFilter, benefitSearch, upcomingCredits]);

  const persistBenefitState = async (
    credit: CreditItem,
    patch: Partial<Pick<UserBenefitState, "enrolled" | "usedAt" | "remindEnabled">>
  ) => {
    setBenefitStateError(null);
    setSavingBenefitKeys((prev) => (prev.includes(credit.benefitKey) ? prev : [...prev, credit.benefitKey]));
    const existing = benefitStates[credit.benefitKey] || { benefitKey: credit.benefitKey };
    const optimistic: UserBenefitState = {
      ...existing,
      benefitKey: credit.benefitKey,
      cardSlug: credit.cardSlug || null,
      cardName: credit.cardName,
      label: credit.label,
      period: credit.periodRaw || credit.period,
      amountUSD: credit.amountUSD,
      requiresEnrollment: !!credit.requiresEnrollment,
      enrolled: typeof patch.enrolled === "boolean" ? patch.enrolled : existing.enrolled,
      enrolledAt:
        typeof patch.enrolled === "boolean"
          ? patch.enrolled
            ? new Date().toISOString()
            : null
          : existing.enrolledAt || null,
      usedAt: patch.usedAt !== undefined ? patch.usedAt ?? null : existing.usedAt || null,
      remindEnabled:
        typeof patch.remindEnabled === "boolean" ? patch.remindEnabled : !!existing.remindEnabled,
      updatedAt: new Date().toISOString(),
    };
    setBenefitStates((prev) => ({ ...prev, [credit.benefitKey]: optimistic }));

    try {
      const res = await fetch(`${API_BASE}/api/user-benefits/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          benefitKey: credit.benefitKey,
          cardSlug: credit.cardSlug || null,
          cardName: credit.cardName,
          label: credit.label,
          period: credit.periodRaw || credit.period,
          amountUSD: credit.amountUSD,
          requiresEnrollment: !!credit.requiresEnrollment,
          enrolled: optimistic.enrolled,
          usedAt: optimistic.usedAt ?? null,
          remindEnabled: optimistic.remindEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save benefit state");
      setBenefitStates((prev) => ({
        ...prev,
        [credit.benefitKey]: {
          ...optimistic,
          ...(data?.state || {}),
        },
      }));
    } catch (err: any) {
      setBenefitStates((prev) => ({ ...prev, [credit.benefitKey]: existing }));
      setBenefitStateError(err?.message || "Could not save benefit state. Restart the backend and try again.");
    } finally {
      setSavingBenefitKeys((prev) => prev.filter((key) => key !== credit.benefitKey));
    }
  };

  const enableAllReminders = async () => {
    const targets = creditItems.filter((credit) => !credit.benefitState?.remindEnabled);
    for (const credit of targets) {
      // Sequential on purpose to avoid spamming local dev backend.
      // eslint-disable-next-line no-await-in-loop
      await persistBenefitState(credit, { remindEnabled: true });
    }
  };
  const unlinkManualCard = (slug: string) => {
    if (!slug) return;
    setManualCardSlugs((prev) => {
      const next = prev.filter((s) => s !== slug);
      localStorage.setItem("cco_manual_cards", JSON.stringify(next));
      return next;
    });
  };
  const applyRecommendations = getApplyRecommendations(
    cards,
    scoreRange,
    feeComfort,
    travelFocus,
    monthlyBudget,
    incomeRange,
    carryBalance,
    businessOwner,
    travelFrequency
  );
  const allCardsList = Array.from(
    cards
      .filter((card) => {
        const name = (card.name || "").toLowerCase();
        if (!name) return false;
        if (/bankamericard/i.test(name)) return false;
        if (/unknown|linked credit card/i.test(name)) return false;
        return true;
      })
      .reduce((map, card) => {
        const raw = (card.name || "").trim().toLowerCase();
        const normalized = raw.replace(/\s+card$/, "").replace(/\s+credit card$/, "").trim();
        const key = (card.slug || normalized || raw).trim().toLowerCase();
        if (!key) return map;
        if (!map.has(key)) {
          map.set(key, card);
          return map;
        }
        const existing = map.get(key)!;
        const hasLogo = Boolean(getCardLogo(card));
        const existingHasLogo = Boolean(getCardLogo(existing));
        if (hasLogo && !existingHasLogo) {
          map.set(key, card);
          return map;
        }
        const existingPerks = existing.perks?.length || 0;
        const currentPerks = card.perks?.length || 0;
        if (currentPerks > existingPerks) {
          map.set(key, card);
        }
        return map;
      }, new Map<string, Card>())
      .values()
  );
  const allCardIssuers = Array.from(
    new Set(
      allCardsList
        .map((card) => card.issuer || "Other")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
    )
  );
  const filteredAllCards = allCardsList.filter((card) => {
    const name = (card.name || "").toLowerCase();
    const issuer = (card.issuer || "Other").toLowerCase();
    const matchesIssuer = allCardsIssuer === "all" || issuer === allCardsIssuer;
    const matchesSearch = !allCardsSearch || name.includes(allCardsSearch);
    return matchesIssuer && matchesSearch;
  });
  const visibleAllCards = showAllCards ? filteredAllCards : filteredAllCards.slice(0, 10);

  if (loading) return <div className="status">Loading cards...</div>;
  if (error) return <div className="status error">Error: {error}</div>;

  const isUnknownCard = (name?: string) => /unknown/i.test(name || "");
  const topPickValid = topPick && !isUnknownCard(topPick.card?.name);
  const filteredOtherBest = otherBest.filter((item) => !isUnknownCard(item.card?.name));
  const filteredOffers = offers.filter((item) => !isUnknownCard(item.card?.name));
  const recommendationRows = [topPick, ...filteredOtherBest].filter(
    (item): item is NonNullable<typeof item> => Boolean(item)
  );
  const exactMatchCount = recommendationRows.filter((item) => item.matchTier === "exact_benefit").length;
  const verifiedCount = recommendationRows.filter((item) => Boolean(item.lastVerified)).length;
  const categoryKeys = new Set([
    "travel",
    "dining",
    "groceries",
    "gas",
    "streaming",
    "rideshare",
    "drugstores",
    "online",
    "other",
  ]);
  const categoryLabels: Record<string, string> = {
    travel: "travel",
    dining: "dining",
    groceries: "groceries",
    gas: "gas",
    streaming: "streaming",
    rideshare: "rideshare",
    drugstores: "drugstores",
    online: "online shopping",
    other: "all purchases",
  };
  const selectedTerm = (merchantSubmitted.merchant || "").trim().toLowerCase();
  const isCategoryQuery = categoryKeys.has(selectedTerm);

  return (
    <div className="flow">
      <header className="flow-hero">
        <div className="flow-brand">
          <span className="flow-mark">✦</span>
          <div>
            <p className="flow-label">Rewardly</p>
            <h1>Capture every benefit now, discover your best next card later.</h1>
          </div>
        </div>
        <p className="flow-sub">
          Search any merchant to surface matching credits, then compare cards by rewards, fees, and fit.
        </p>
        <div className="mode-cta">
          <button
            type="button"
            className={activeMode === "use" ? "active" : ""}
            onClick={() => setActiveMode("use")}
          >
            Use a Card Now
          </button>
          <button
            type="button"
            className={activeMode === "apply" ? "active" : ""}
            onClick={() => setActiveMode("apply")}
          >
            Find a Card to Apply For
          </button>
        </div>
      </header>

      {activeMode === "use" && (
        <section className="section">
          <form
            className="merchant-form"
            onSubmit={(e) => {
              e.preventDefault();
              setMerchantSubmitted(merchantForm);
            }}
          >
            <div className="merchant-fields">
              <label className="field">
                <span>Merchant</span>
                <input
                  name="merchant"
                  placeholder="e.g., Lululemon"
                  value={merchantForm.merchant}
                  onChange={(e) => setMerchantForm((s) => ({ ...s, merchant: e.target.value }))}
                />
              </label>
            </div>
            <p className="merchant-hint">Try a merchant credit or category to surface matching benefits.</p>
            {suggestionChips.length > 0 && (
              <div className="merchant-suggestions">
                <span className="merchant-suggestions-label">Popular matches</span>
                {suggestionChips.map((item) => (
                  <button
                    key={`${item.type}-${item.label}`}
                    type="button"
                    className={`merchant-chip ${item.type === "category" ? "category" : ""}`}
                    onClick={() => {
                      const value = item.label;
                      setMerchantForm((s) => ({ ...s, merchant: value }));
                      setMerchantSubmitted((s) => ({ ...s, merchant: value }));
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            <button type="submit" disabled={!merchantForm.merchant.trim()}>
              Find best card
            </button>
          </form>

          {merchantLoading && <p className="result-note">Searching…</p>}
          {merchantError && <p className="result-note">Error: {merchantError}</p>}

          {!merchantLoading && !merchantError && !topPickValid && !filteredOtherBest.length && !filteredOffers.length && (
            <p className="result-note">
              Enter a merchant (or domain) to see the best card and matching benefits.
            </p>
          )}

          {!merchantLoading && !merchantError && (topPickValid || filteredOtherBest.length > 0) && (
            <div className="merchant-result">
              <h3>Matching benefits for {merchantSubmitted.merchant || merchantSubmitted.domain}</h3>
              <p className="merchant-trust-note">
                {exactMatchCount > 0
                  ? `${exactMatchCount} exact benefit match${exactMatchCount > 1 ? "es" : ""} found.`
                  : "No exact merchant benefit found, showing best available rewards matches."}{" "}
                {verifiedCount > 0
                  ? `${verifiedCount} card${verifiedCount > 1 ? "s" : ""} include a recent verification date.`
                  : "Verification date unavailable for these cards."}
              </p>
              {combinedLinkedSlugs.length > 0 && (
                <div className="wallet-recommendation">
                  <div className="wallet-recommendation-head">
                    <strong>Best card in your wallet</strong>
                    <span>{combinedLinkedSlugs.length} linked card{combinedLinkedSlugs.length > 1 ? "s" : ""}</span>
                  </div>
                  {walletRecommendationLoading ? (
                    <p className="result-note">Checking your linked cards…</p>
                  ) : walletRecommendationError ? (
                    <p className="result-note">Wallet check failed: {walletRecommendationError}</p>
                  ) : walletRecommendation?.bestCard ? (
                    <div className="wallet-recommendation-card">
                      <div>
                        <strong>{walletRecommendation.bestCard.name}</strong>
                        <span>{walletRecommendation.bestCard.issuer || "Linked card"}</span>
                      </div>
                      <div className="wallet-recommendation-copy">
                        <p>{walletRecommendation.reason?.text || "Best current option from your linked cards."}</p>
                        {Array.isArray(walletRecommendation.reason?.credits) &&
                          walletRecommendation.reason?.credits.length > 0 && (
                            <ul className="merchant-perks">
                              {walletRecommendation.reason.credits.slice(0, 2).map((credit) => (
                                <li key={credit.label}>
                                  {credit.label}
                                  {credit.requiresEnrollment ? " (enrollment required)" : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                    </div>
                  ) : (
                    <p className="result-note">
                      {walletRecommendation?.note || "No matching merchant benefit found in your linked cards yet."}
                    </p>
                  )}
                </div>
              )}
              <div className="candidate-list">
                {recommendationRows.map((item) => {
                  const fullCard = cards.find((card) => card.slug === item.card.slug);
                  const applyUrl = getApplyUrl(fullCard || item.card);
                  const offerMatch = filteredOffers.find((offer) => offer.card.slug === item.card.slug);
                  const offerPerks = offerMatch?.perks?.slice(0, 2) || [];
                  const categoryBenefit = isCategoryQuery
                    ? buildCategoryBenefit(fullCard, selectedTerm, categoryLabels)
                    : null;
                  const perksToShow = item.matchedBenefit
                    ? [item.matchedBenefit]
                    : offerPerks.length
                    ? offerPerks
                    : categoryBenefit
                    ? [categoryBenefit]
                    : [];
                  const verificationLabel = formatVerificationLabel(item.lastVerified || fullCard?.lastScraped);
                  const matchLabel = getMatchTierLabel(item.matchTier);
                  const matchTone = getMatchTierTone(item.matchTier);
                  const trustSummary = item.matchedBenefit
                    ? "Matched to a specific merchant benefit."
                    : item.matchTier === "category_match"
                    ? "Recommended from category rewards and card data."
                    : "Recommended from baseline earn rate and available card data.";
                  return (
                    <div key={item.card.slug} className="merchant-card-row">
                      {getCardLogo(fullCard) && (
                        <img
                          className="merchant-logo"
                          src={getCardLogo(fullCard) || ""}
                          alt={`${item.card.name} card`}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <div className="merchant-meta">
                        <strong>
                          {item.card.name}
                          {fullCard?.issuer ? ` · ${fullCard.issuer}` : ""}
                        </strong>
                        <div className="merchant-tags">
                          <span className={`merchant-tag ${matchTone}`}>{matchLabel}</span>
                          <span>{item.confidenceLabel || "Match"}</span>
                          {typeof item.effectiveRate === "number" && <span>{(item.effectiveRate * 100).toFixed(2)}% effective</span>}
                          {typeof item.annualFee === "number" && <span>${item.annualFee} annual fee</span>}
                          {verificationLabel && <span>{verificationLabel}</span>}
                        </div>
                        <p className="merchant-reason">{trustSummary}</p>
                        {perksToShow.length > 0 && (
                          <ul className="merchant-perks">
                            {perksToShow.map((perk) => (
                              <li key={perk}>{perk}</li>
                            ))}
                          </ul>
                        )}
                        {Array.isArray(item.why) && item.why.length > 0 && (
                          <ul className="merchant-perks">
                            {item.why.slice(0, 2).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        )}
                        {applyUrl && (
                          <a className="apply-link merchant-apply-link" href={applyUrl} target="_blank" rel="noreferrer">
                            Apply
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/** Offers list removed to avoid duplicate benefit listings. */}
        </section>
      )}

      {activeMode === "apply" && (
        <section className="section">
          <div className="apply-panel airy">
            <div className="apply-form">
              <div className="apply-form-head">
                <h3>Tell us about your profile</h3>
                <p>We’ll surface the best matches based on your goals and spend.</p>
              </div>
              <div className="apply-form-grid">
              <label className="field">
                <span>Credit score range</span>
                <select value={scoreRange} onChange={(e) => setScoreRange(e.target.value)}>
                  <option value="fair">Fair (580-669)</option>
                  <option value="good">Good (670-739)</option>
                  <option value="very-good">Very good (740-799)</option>
                  <option value="excellent">Excellent (800+)</option>
                </select>
              </label>
              <label className="field">
                <span>Annual fee comfort</span>
                <select value={feeComfort} onChange={(e) => setFeeComfort(e.target.value)}>
                  <option value="low">$0 - $95</option>
                  <option value="mid">$95 - $300</option>
                  <option value="high">$300+</option>
                </select>
              </label>
              <label className="field">
                <span>Rewards preference</span>
                <select value={travelFocus} onChange={(e) => setTravelFocus(e.target.value)}>
                  <option value="cash">Cash back focus</option>
                  <option value="balanced">Balanced</option>
                  <option value="travel">Travel points focus</option>
                </select>
              </label>
              <label className="field">
                <span>Monthly card spend</span>
                <input
                  type="number"
                  min="0"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Income range</span>
                <select value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)}>
                  <option value="under-50k">Under $50k</option>
                  <option value="50-100k">$50k - $100k</option>
                  <option value="100-200k">$100k - $200k</option>
                  <option value="200k-plus">$200k+</option>
                </select>
              </label>
              <label className="field">
                <span>Carry a balance?</span>
                <select value={carryBalance} onChange={(e) => setCarryBalance(e.target.value)}>
                  <option value="no">No, I pay in full</option>
                  <option value="yes">Yes, sometimes</option>
                </select>
              </label>
              <label className="field">
                <span>Travel frequency</span>
                <select value={travelFrequency} onChange={(e) => setTravelFrequency(e.target.value)}>
                  <option value="low">Rarely</option>
                  <option value="moderate">A few trips / year</option>
                  <option value="high">Frequent traveler</option>
                </select>
              </label>
              <label className="field">
                <span>Business owner?</span>
                <select value={businessOwner} onChange={(e) => setBusinessOwner(e.target.value)}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              </div>
              <button
                type="button"
                className="apply-search"
                onClick={() => {
                  setApplyResults(applyRecommendations);
                  setApplyRequested(true);
                }}
              >
                Find my best matches
              </button>
            </div>
            <div className="apply-results airy">
              {!applyRequested ? (
                <p className="empty-copy">Pick your criteria and hit search to see matches.</p>
              ) : (
                applyResults.map((entry, index) => (
                  <div key={entry.card.slug || entry.card.name} className="apply-card">
                    <div className="apply-rank">{index + 1}</div>
                    {getCardLogo(entry.card) && (
                      <img
                        src={getCardLogo(entry.card) || ""}
                        alt={`${entry.card.name} card`}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="apply-info">
                      <strong>{entry.card.name}</strong>
                      <span>{entry.card.issuer || "Issuer"}</span>
                      <p>{entry.reason}</p>
                    </div>
                    <div className="apply-details">
                      <div className="apply-benefits">
                        {(() => {
                          const perks = getApplyPerks(entry.card);
                          if (!perks.length) return null;
                          return (
                            <>
                              <span className="apply-benefits-title">Top benefits</span>
                              <ul className="apply-perks">
                                {perks.map((perk) => (
                                  <li key={perk}>{perk}</li>
                                ))}
                              </ul>
                            </>
                          );
                        })()}
                      </div>
                      <div className="apply-why">
                        <span className="apply-benefits-title">Why it matches</span>
                        <ul className="apply-perks">
                          {buildWhyMatches(entry.card, scoreRange, feeComfort, travelFocus, travelFrequency, businessOwner, entry.signals)
                            .slice(0, 3)
                            .map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                        </ul>
                      </div>
                    </div>
                    <div className="apply-meta">
                      <span>Annual fee</span>
                      <strong>{Number.isFinite(entry.card.annualFee) ? `$${entry.card.annualFee}` : "—"}</strong>
                      {getApplyUrl(entry.card) ? (
                        <a
                          className="apply-link"
                          href={getApplyUrl(entry.card) || ""}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Apply
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <section className="section benefits">
        <div className="section-head">
          <div>
            <h2>Benefits tracking</h2>
            <p>Track the credits available on the cards in your wallet.</p>
          </div>
          <button
            type="button"
            className="qa-toggle"
            onClick={() => setShowQaPanel((v) => !v)}
          >
            {showQaPanel ? "Hide QA" : "Show QA"}
          </button>
        </div>
        {showQaPanel && (
          <div className="qa-panel">
            <div className="qa-panel-head">
              <div>
                <strong>Runtime QA summary</strong>
                <p>Use this before testing merchant search, linking, and wallet recommendations.</p>
              </div>
              {qaSummary && (
                <span className={`qa-status ${qaSummary.status === "ready_for_runtime_qa" ? "ready" : "attention"}`}>
                  {qaSummary.status === "ready_for_runtime_qa" ? "Ready" : "Needs attention"}
                </span>
              )}
            </div>
            {qaLoading ? (
              <p className="result-note">Loading QA summary…</p>
            ) : qaError ? (
              <p className="result-note">QA summary error: {qaError}</p>
            ) : qaSummary ? (
              <>
                <div className="qa-metrics">
                  <div className="qa-metric">
                    <span>Cards tracked</span>
                    <strong>{qaSummary.cards.total}</strong>
                  </div>
                  <div className="qa-metric">
                    <span>Validation failures</span>
                    <strong>{qaSummary.cards.validationFailureCount}</strong>
                  </div>
                  <div className="qa-metric">
                    <span>Cards with issues</span>
                    <strong>{qaSummary.cards.cardsWithIssues}</strong>
                  </div>
                  <div className="qa-metric">
                    <span>Suspicious benefits</span>
                    <strong>{qaSummary.cards.suspiciousBenefitCount}</strong>
                  </div>
                  <div className="qa-metric">
                    <span>Credit accounts</span>
                    <strong>{qaSummary.linkedAccounts.creditAccounts}</strong>
                  </div>
                  <div className="qa-metric">
                    <span>Unresolved mappings</span>
                    <strong>{qaSummary.linkedAccounts.unresolvedMappings}</strong>
                  </div>
                </div>
                <div className="qa-columns">
                  <div className="qa-block">
                    <strong>Validation failures</strong>
                    {qaSummary.samples.validationFailures?.length ? (
                      <ul className="qa-list">
                        {qaSummary.samples.validationFailures.slice(0, 5).map((item, idx) => (
                          <li key={`${item.slug || "card"}-${idx}`}>
                            <span>{item.slug || "unknown"}</span>
                            <small>{item.reason || "Issue"}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="result-note">No sampled validation failures.</p>
                    )}
                  </div>
                  <div className="qa-block">
                    <strong>Suspicious benefits</strong>
                    {qaSummary.samples.suspiciousBenefits?.length ? (
                      <ul className="qa-list">
                        {qaSummary.samples.suspiciousBenefits.slice(0, 5).map((item, idx) => (
                          <li key={`${item.example || "benefit"}-${idx}`}>
                            <span>{item.example || "Unknown benefit"}</span>
                            <small>
                              score {item.suspicionScore ?? 0}
                              {item.issuers?.length ? ` · ${item.issuers.join(", ")}` : ""}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="result-note">No suspicious benefits sampled.</p>
                    )}
                  </div>
                  <div className="qa-block">
                    <strong>Card issues</strong>
                    {qaSummary.samples.cardIssues?.length ? (
                      <ul className="qa-list">
                        {qaSummary.samples.cardIssues.slice(0, 5).map((item, idx) => (
                          <li key={`${item.slug || "issue"}-${idx}`}>
                            <span>{item.slug || "unknown"}</span>
                            <small>{item.reasons?.[0] || "Issue detected"}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="result-note">No card issues sampled.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="result-note">QA summary unavailable.</p>
            )}
          </div>
        )}
        {combinedLinkedSlugs.length > 0 && (
          <>
            <div className="wallet-benefit-summary">
              <div className="wallet-summary-card">
                <strong>{walletSummary.total}</strong>
                <span>Total wallet credits</span>
              </div>
              <div className="wallet-summary-card">
                <strong>{walletSummary.availableCount}</strong>
                <span>Unused credits</span>
              </div>
              <div className="wallet-summary-card">
                <strong>{walletSummary.totalValue ? `$${walletSummary.totalValue.toFixed(0)}` : "$0"}</strong>
                <span>Estimated reward value</span>
              </div>
              <div className="wallet-summary-card">
                <strong>{walletSummary.upcomingCount}</strong>
                <span>Upcoming deadlines</span>
              </div>
            </div>
            <div className="wallet-health-panel">
              <div className="wallet-health-card">
                <div>
                  <strong>{effectiveWalletScore}%</strong>
                  <span>Wallet health</span>
                </div>
                <p>
                  {effectiveWalletMissed.length} credit{effectiveWalletMissed.length === 1 ? "" : "s"} open
                  and {effectiveWalletMissed.length} top suggestions.
                </p>
              </div>
              <div className="wallet-health-card">
                <strong>Suggested next card</strong>
                <span>{effectiveWalletNextCard ? effectiveWalletNextCard.name : "No wallet suggestion yet"}</span>
                {effectiveWalletNextCard && effectiveWalletNextCard.issuer && <em>{effectiveWalletNextCard.issuer}</em>}
                {effectiveWalletNextCard && "reason" in effectiveWalletNextCard && effectiveWalletNextCard.reason ? (
                  <p>{effectiveWalletNextCard.reason}</p>
                ) : null}
              </div>
              <div className="wallet-health-card">
                <strong>{effectiveWalletGaps.length ? effectiveWalletGaps.join(", ") : "Coverage good"}</strong>
                <span>Reward gaps</span>
              </div>
            </div>
            {walletSummaryApi?.topMissedCredits?.length ? (
              <div className="wallet-missed-list">
                <strong>Top missed credits</strong>
                <div className="missed-items">
                  {walletSummaryApi.topMissedCredits.map((credit) => (
                    <div key={`${credit.cardName}-${credit.label}`} className="missed-credit">
                      <span>{credit.label}</span>
                      <small>{credit.cardName}</small>
                      <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(credit.amountUSD)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {walletSummaryLoading && <p className="result-note">Refreshing wallet summary…</p>}
            {walletSummaryError && <p className="result-note">Wallet summary error: {walletSummaryError}</p>}
          </>
        )}
        {creditItems.length > 0 && (
          <div className="benefit-toolbar">
            <div className="benefit-filter-chips">
              {[
                { value: "all", label: "All" },
                { value: "unused", label: "Unused" },
                { value: "enrolled", label: "Enrolled" },
                { value: "reminders", label: "Reminders" },
                { value: "upcoming", label: "Upcoming" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={benefitFilter === option.value ? "filter-chip active" : "filter-chip"}
                  onClick={() => setBenefitFilter(option.value as typeof benefitFilter)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="benefit-search">
              <input
                type="search"
                placeholder="Search wallet benefits…"
                value={benefitSearch}
                onChange={(e) => setBenefitSearch(e.target.value)}
              />
            </div>
          </div>
        )}
        {combinedLinkedSlugs.length === 0 ? (
          <div className="empty-copy">
            <p>Link your cards to see which credits are available or redeemed.</p>
            <div className="link-actions">
              <PlaidLinkButton
                userId={userId}
                apiBase={API_BASE}
                onAccessToken={() => setLinkedRefresh((v) => v + 1)}
                onSuccess={() => setLinkStatus("Linked successfully. Refreshing cards…")}
                onError={(message) => setLinkStatus(message)}
                className="apply-search"
                label="Link with Plaid"
              />
              <button
                type="button"
                className="apply-search secondary"
                onClick={() => setShowManualLink((v) => !v)}
              >
                Add manually
              </button>
            </div>
            {linkStatus && <p className="result-note">{linkStatus}</p>}
            {showManualLink && (
              <div className="manual-link">
                <div className="manual-head">
                  <p className="result-note">Select the cards you already have.</p>
                  <button
                    type="button"
                    className="manual-close"
                    onClick={() => setShowManualLink(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="manual-list">
                  {allCardsList
                    .filter((card) => !!card.slug)
                    .map((card) => (
                    <label key={card.slug || card.name} className="manual-item">
                      <input
                        type="checkbox"
                        checked={manualCardSlugs.includes(card.slug || "")}
                        onChange={() => {
                          const slug = card.slug || "";
                          if (!slug) return;
                          setManualCardSlugs((prev) => {
                            const next = prev.includes(slug)
                              ? prev.filter((s) => s !== slug)
                              : [...prev, slug];
                            localStorage.setItem("cco_manual_cards", JSON.stringify(next));
                            return next;
                          });
                        }}
                      />
                      <span>{card.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <MapLinkedAccounts userId={userId} onChanged={() => setLinkedRefresh((v) => v + 1)} />
          </div>
        ) : creditItems.length === 0 ? (
          <div className="empty-copy">
            <p>No credits found for your linked cards yet.</p>
            <div className="linked-section">
              <span className="linked-title">Linked cards</span>
              <div className="linked-badges">
                {linkedCards.map((card) => (
                  <span key={card.slug || card.name} className="linked-badge">
                    {card.name}
                    {card.slug && manualCardSlugs.includes(card.slug) && (
                      <button
                        type="button"
                        className="linked-remove"
                        onClick={() => unlinkManualCard(card.slug || "")}
                        aria-label={`Remove ${card.name}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="linked-actions">
                <button
                  type="button"
                  className="apply-search secondary"
                  onClick={() => setShowManualLink((v) => !v)}
                >
                  Edit linked cards
                </button>
                {manualCardSlugs.length > 0 && (
                  <button
                    type="button"
                    className="apply-search ghost"
                    onClick={() => {
                      setManualCardSlugs([]);
                      localStorage.removeItem("cco_manual_cards");
                    }}
                  >
                    Clear manual links
                  </button>
                )}
              </div>
            </div>
            {showManualLink && (
              <div className="manual-link">
                <div className="manual-head">
                  <p className="result-note">Select the cards you already have.</p>
                  <button
                    type="button"
                    className="manual-close"
                    onClick={() => setShowManualLink(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="manual-list">
                  {allCardsList
                    .filter((card) => !!card.slug)
                    .map((card) => (
                      <label key={card.slug || card.name} className="manual-item">
                        <input
                          type="checkbox"
                          checked={manualCardSlugs.includes(card.slug || "")}
                          onChange={() => {
                            const slug = card.slug || "";
                            if (!slug) return;
                            setManualCardSlugs((prev) => {
                              const next = prev.includes(slug)
                                ? prev.filter((s) => s !== slug)
                                : [...prev, slug];
                              localStorage.setItem("cco_manual_cards", JSON.stringify(next));
                              return next;
                            });
                          }}
                        />
                        <span>{card.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
            <MapLinkedAccounts userId={userId} onChanged={() => setLinkedRefresh((v) => v + 1)} />
          </div>
        ) : (
          <>
            <div className="credits-list airy">
              {benefitStateError && <p className="benefit-state-error">{benefitStateError}</p>}
              {filteredCreditItems.map((credit) => (
                <div key={`${credit.cardName}-${credit.label}`} className="credit-row">
                  <div className="credit-logos">
                    {credit.cardLogo && (
                      <img
                        className="credit-card-logo"
                        src={credit.cardLogo}
                        alt={`${credit.cardName} card`}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="credit-copy">
                    <strong>{credit.label}</strong>
                    <span>{credit.cardName}</span>
                    <small>
                      {credit.typeLabel}
                      {credit.enrollmentLabel ? ` · ${credit.enrollmentLabel}` : ""}
                      {credit.verificationLabel ? ` · ${credit.verificationLabel}` : ""}
                    </small>
                    {credit.enrollmentLink && (
                      <a className="credit-enroll-btn" href={credit.enrollmentLink.url} target="_blank" rel="noreferrer">
                        {credit.enrollmentLink.ctaLabel}
                      </a>
                    )}
                    <div className="credit-actions">
                      {credit.requiresEnrollment && (
                        <button
                          type="button"
                          className={credit.benefitState?.enrolled ? "credit-action active" : "credit-action"}
                          disabled={savingBenefitKeys.includes(credit.benefitKey)}
                          onClick={() =>
                            persistBenefitState(credit, { enrolled: !credit.benefitState?.enrolled })
                          }
                        >
                          {credit.benefitState?.enrolled ? "Enrolled" : "Mark enrolled"}
                        </button>
                      )}
                      <button
                        type="button"
                        className={credit.usedThisPeriod ? "credit-action active" : "credit-action"}
                        disabled={savingBenefitKeys.includes(credit.benefitKey)}
                        onClick={() =>
                          persistBenefitState(credit, {
                            usedAt: credit.usedThisPeriod ? null : new Date().toISOString(),
                          })
                        }
                      >
                        {credit.usedThisPeriod ? "Used this period" : "Mark used"}
                      </button>
                      <button
                        type="button"
                        className={credit.benefitState?.remindEnabled ? "credit-action active" : "credit-action"}
                        disabled={savingBenefitKeys.includes(credit.benefitKey)}
                        onClick={() =>
                          persistBenefitState(credit, {
                            remindEnabled: !credit.benefitState?.remindEnabled,
                          })
                        }
                      >
                        {credit.benefitState?.remindEnabled ? "Reminder on" : "Remind me"}
                      </button>
                    </div>
                  </div>
                  <div className="credit-side">
                    {credit.benefitLogo && (
                      <img
                        className="credit-benefit-logo"
                        src={credit.benefitLogo}
                        alt=""
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="credit-bar">
                      <strong>{formatCurrency(credit.amountUSD)}</strong>
                      <span>{credit.period}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!filteredCreditItems.length ? (
              <div className="empty-copy">
                No wallet benefits match that filter. Try switching filters or searching a different term.
              </div>
            ) : null}
            <div className="reminders-panel">
              <div className="reminders-head">
                <div>
                  <strong>Upcoming credit deadlines</strong>
                  <span>Get notified before credits expire.</span>
                </div>
                <button type="button" className="reminders-cta" onClick={enableAllReminders}>
                  Enable reminders for all
                </button>
              </div>
              {upcomingCredits.length === 0 ? (
                <p className="empty-copy">No upcoming deadlines for reminded benefits yet.</p>
              ) : (
                <div className="reminders-list">
                  {upcomingCredits.map((item) => (
                    <div key={item.id} className="reminder-row">
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.cardName}</span>
                      </div>
                      <div className="reminder-meta">
                        <span>{item.deadlineLabel}</span>
                        <em>{item.cadenceLabel}</em>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {manualCardSlugs.length > 0 && (
              <div className="linked-section compact">
                <span className="linked-title">Linked cards</span>
                <div className="linked-badges">
                  {linkedCards.map((card) => (
                    <span key={card.slug || card.name} className="linked-badge">
                      {card.name}
                      {card.slug && manualCardSlugs.includes(card.slug) && (
                        <button
                          type="button"
                          className="linked-remove"
                          onClick={() => unlinkManualCard(card.slug || "")}
                          aria-label={`Remove ${card.name}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="linked-actions">
                  <button
                    type="button"
                    className="apply-search secondary"
                    onClick={() => setShowManualLink((v) => !v)}
                  >
                    Edit linked cards
                  </button>
                  <button
                    type="button"
                    className="apply-search ghost"
                    onClick={() => {
                      setManualCardSlugs([]);
                      localStorage.removeItem("cco_manual_cards");
                    }}
                  >
                    Clear manual links
                  </button>
                </div>
              </div>
            )}
            {showManualLink && (
              <div className="manual-link">
                <div className="manual-head">
                  <p className="result-note">Select one or more cards you already have.</p>
                  <button
                    type="button"
                    className="manual-close"
                    onClick={() => setShowManualLink(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="manual-list">
                  {allCardsList
                    .filter((card) => !!card.slug)
                    .map((card) => (
                      <label key={card.slug || card.name} className="manual-item">
                        <input
                          type="checkbox"
                          checked={manualCardSlugs.includes(card.slug || "")}
                          onChange={() => {
                            const slug = card.slug || "";
                            if (!slug) return;
                            setManualCardSlugs((prev) => {
                              const next = prev.includes(slug)
                                ? prev.filter((s) => s !== slug)
                                : [...prev, slug];
                              localStorage.setItem("cco_manual_cards", JSON.stringify(next));
                              return next;
                            });
                          }}
                        />
                        <span>{card.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
            <MapLinkedAccounts userId={userId} onChanged={() => setLinkedRefresh((v) => v + 1)} />
          </>
        )}
      </section>

      <section className="section all-cards">
        <div className="section-head">
          <div>
            <h2>All cards</h2>
            <p>
              {showAllCards ? "Every card we currently track." : `Top ${Math.min(10, filteredAllCards.length)} cards we track.`}
            </p>
          </div>
          <div className="all-cards-controls">
            <input
              type="text"
              placeholder="Search cards..."
              value={allCardsSearch}
              onChange={(e) => setAllCardsSearch(e.target.value.toLowerCase())}
            />
            {filteredAllCards.length > 10 && (
              <button
                type="button"
                className="all-cards-toggle"
                onClick={() => setShowAllCards((prev) => !prev)}
              >
                {showAllCards ? "Show fewer" : "See all"}
              </button>
            )}
          </div>
        </div>
        <div className="issuer-filters">
          <button
            type="button"
            className={allCardsIssuer === "all" ? "active" : ""}
            onClick={() => setAllCardsIssuer("all")}
          >
            All issuers
          </button>
          {allCardIssuers.map((issuer) => (
            <button
              key={issuer}
              type="button"
              className={allCardsIssuer === issuer.toLowerCase() ? "active" : ""}
              onClick={() => setAllCardsIssuer(issuer.toLowerCase())}
            >
              {issuer}
            </button>
          ))}
        </div>
        <div className="all-cards-grid">
          {visibleAllCards.map((card) => (
            <div key={card.slug || card.name} className="all-card">
              {getCardLogo(card) && (
                <img
                  src={getCardLogo(card) || ""}
                  alt={`${card.name} card`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div>
                <strong>{card.name}</strong>
                <span>{card.issuer || "Issuer"}</span>
                {getCardSummaryLine(card) && (
                  <em>{getCardSummaryLine(card)}</em>
                )}
                {getApplyUrl(card) && (
                  <a className="apply-link all-card-apply" href={getApplyUrl(card) || ""} target="_blank" rel="noreferrer">
                    Apply
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function collectCredits(cards: Card[], benefitStates: Record<string, UserBenefitState>): CreditItem[] {
  const creditGroups: Array<CreditItem[]> = [];
  const credits: CreditItem[] = [];
  cards.forEach((card) => {
    const merchantCredits = (card.merchantCredits || []) as Array<{
      id?: string;
      label?: string;
      name?: string;
      amountUSD?: number;
      period?: string;
      requiresEnrollment?: boolean;
      sourceUrl?: string;
      partner?: string;
      expiresAt?: string | null;
    }>;
    const recurringCredits = (card.recurringCredits || []) as Array<{
      id?: string;
      label?: string;
      name?: string;
      amountUSD?: number;
      period?: string;
      requiresEnrollment?: boolean;
      sourceUrl?: string;
      partner?: string;
      expiresAt?: string | null;
    }>;
    const cardCredits: typeof credits = [];
    merchantCredits.forEach((credit) => {
      if (!Number.isFinite(credit.amountUSD)) return;
      const benefitKey = buildBenefitKey(card, credit);
      const benefitState = benefitStates[benefitKey] || null;
      const requiresEnrollment = isEnrollmentRequiredCredit(credit);
      cardCredits.push({
        benefitKey,
        cardSlug: card.slug || null,
        cardName: card.name,
        cardIssuer: card.issuer || null,
        cardSourceUrl: card.sourceUrl || null,
        cardLogo: getCardLogo(card),
        benefitLogo: getBenefitLogo(credit.label || credit.name || ""),
        label: credit.label || credit.name || "Credit",
        amountUSD: credit.amountUSD || 0,
        period: formatCreditPeriod(credit.period),
        periodRaw: credit.period,
        typeLabel: "Merchant credit",
        requiresEnrollment,
        enrollmentLabel: requiresEnrollment ? "Enrollment required" : undefined,
        enrollmentLink: requiresEnrollment
          ? getEnrollmentLink({
              cardName: card.name,
              issuer: card.issuer,
              label: credit.label || credit.name || "",
              partner: credit.partner,
              creditSourceUrl: credit.sourceUrl,
              cardSourceUrl: card.sourceUrl,
            })
          : null,
        expiresAt: credit.expiresAt || null,
        benefitState,
        usedThisPeriod: isUsedInCurrentPeriod(benefitState?.usedAt || null, credit.period),
        verificationLabel: formatVerificationLabel(card.lastScraped),
      });
    });
    recurringCredits.forEach((credit) => {
      if (!Number.isFinite(credit.amountUSD)) return;
      const benefitKey = buildBenefitKey(card, credit);
      const benefitState = benefitStates[benefitKey] || null;
      const requiresEnrollment = isEnrollmentRequiredCredit(credit);
      cardCredits.push({
        benefitKey,
        cardSlug: card.slug || null,
        cardName: card.name,
        cardIssuer: card.issuer || null,
        cardSourceUrl: card.sourceUrl || null,
        cardLogo: getCardLogo(card),
        benefitLogo: getBenefitLogo(credit.label || credit.name || ""),
        label: credit.label || credit.name || "Credit",
        amountUSD: credit.amountUSD || 0,
        period: formatCreditPeriod(credit.period),
        periodRaw: credit.period,
        typeLabel: "Recurring credit",
        requiresEnrollment,
        enrollmentLabel: requiresEnrollment ? "Enrollment required" : undefined,
        enrollmentLink: requiresEnrollment
          ? getEnrollmentLink({
              cardName: card.name,
              issuer: card.issuer,
              label: credit.label || credit.name || "",
              partner: credit.partner,
              creditSourceUrl: credit.sourceUrl,
              cardSourceUrl: card.sourceUrl,
            })
          : null,
        expiresAt: credit.expiresAt || null,
        benefitState,
        usedThisPeriod: isUsedInCurrentPeriod(benefitState?.usedAt || null, credit.period),
        verificationLabel: formatVerificationLabel(card.lastScraped),
      });
    });
    if (cardCredits.length) creditGroups.push(cardCredits);
  });

  let remaining = true;
  let index = 0;
  while (remaining) {
    remaining = false;
    creditGroups.forEach((group) => {
      if (index < group.length) {
        credits.push(group[index]);
        remaining = true;
      }
    });
    index += 1;
  }

  return credits;
}

function formatCreditPeriod(period?: string) {
  if (!period) return "Annual";
  return period
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatVerificationLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Verified ${date.toLocaleDateString()}`;
}

function normalizePeriod(period?: string | null) {
  const value = String(period || "").trim().toLowerCase();
  if (!value) return "year";
  if (value === "semiannual") return "semi-annual";
  return value;
}

function buildBenefitKey(
  card: Card,
  credit: { id?: string; label?: string; name?: string; period?: string; amountUSD?: number }
) {
  const cardKey = String(card.slug || card.name || "card").trim().toLowerCase();
  const labelKey = String(credit.label || credit.name || "credit")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const periodKey = normalizePeriod(credit.period);
  const amountKey = Number.isFinite(credit.amountUSD) ? Number(credit.amountUSD) : 0;
  return [cardKey, labelKey, periodKey, amountKey].join("::");
}

function isEnrollmentRequiredCredit(credit: { requiresEnrollment?: boolean; label?: string; name?: string }) {
  if (credit.requiresEnrollment) return true;
  return /\benroll(?:ment)?\s+required\b/i.test(String(credit.label || credit.name || ""));
}

function getPeriodWindow(period?: string | null, base = new Date()) {
  const normalized = normalizePeriod(period);
  const year = base.getFullYear();
  const month = base.getMonth();

  if (normalized === "month") {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (normalized === "quarter") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    const start = new Date(year, quarterStartMonth, 1);
    const end = new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (normalized === "semi-annual") {
    const halfStartMonth = month < 6 ? 0 : 6;
    const start = new Date(year, halfStartMonth, 1);
    const end = new Date(year, halfStartMonth + 6, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function isUsedInCurrentPeriod(usedAt?: string | null, period?: string | null) {
  if (!usedAt) return false;
  const usedDate = new Date(usedAt);
  if (Number.isNaN(usedDate.getTime())) return false;
  const { start, end } = getPeriodWindow(period, new Date());
  return usedDate.getTime() >= start.getTime() && usedDate.getTime() <= end.getTime();
}

function resolveCreditDeadline(credit: CreditItem, now = new Date()) {
  if (credit.expiresAt) {
    const expires = new Date(credit.expiresAt);
    if (!Number.isNaN(expires.getTime())) return expires;
  }
  return getPeriodWindow(credit.periodRaw || credit.period, now).end;
}

function getMatchTierLabel(matchTier?: "exact_benefit" | "category_match" | "base_rate") {
  if (matchTier === "exact_benefit") return "Exact match";
  if (matchTier === "category_match") return "Category match";
  return "Base rate";
}

function getMatchTierTone(matchTier?: "exact_benefit" | "category_match" | "base_rate") {
  if (matchTier === "exact_benefit") return "exact";
  if (matchTier === "category_match") return "category";
  return "base";
}

function buildCategoryBenefit(card: Card | undefined, category: string, labels: Record<string, string>) {
  if (!card) return null;
  const map = card.rewardsByCategory || card.benefits || {};
  const rate = typeof map[category] === "number" ? map[category] : typeof map.other === "number" ? map.other : null;
  if (rate === null || !Number.isFinite(rate)) return null;
  const label = labels[category] || category;
  const formatted = Number.isInteger(rate) ? `${rate}x` : `${rate}x`;
  return `${formatted} on ${label}`;
}

function getApplyPerks(card: Card) {
  const perks: string[] = [];
  const rewards = card.rewardsByCategory || card.benefits || {};
  const rewardEntries = Object.entries(rewards)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .map(([key, value]) => ({ key, value: Number(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  rewardEntries.forEach((entry) => {
    const label = formatCategoryLabel(entry.key);
    perks.push(`${entry.value}x on ${label}`);
  });

  if (Number.isFinite(card.annualFee) && Number(card.annualFee) === 0) {
    perks.push("No annual fee");
  }

  return perks.slice(0, 4);
}

function getCardSummaryLine(card: Card) {
  const perks = getApplyPerks(card);
  if (perks.length) return perks[0];
  if (card.signupOffer) return `Signup: ${card.signupOffer}`;
  return "";
}

function formatCategoryLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getWalletCoverageGaps(cards: Card[]) {
  const categoryKeys = new Set<string>();
  cards.forEach((card) => {
    const rewards = card.rewardsByCategory || card.benefits || {};
    Object.entries(rewards).forEach(([key, value]) => {
      if (typeof value === "number" && Number.isFinite(value) && value >= 2) {
        categoryKeys.add(key.toLowerCase());
      }
    });
  });

  const categories = ["travel", "dining", "groceries", "gas", "streaming", "rideshare", "online", "drugstores"];
  return categories.filter((category) => !categoryKeys.has(category)).slice(0, 3).map((category) => category.replace(/_/g, " "));
}

function getApplyRecommendations(
  cards: Card[],
  scoreRange: string,
  feeComfort: string,
  travelFocus: string,
  monthlyBudget: string,
  incomeRange: string,
  carryBalance: string,
  businessOwner: string,
  travelFrequency: string
) {
  const budget = Math.max(0, Number(monthlyBudget) || 0);
  let targets = cards.filter((card) => {
    if (feeComfort === "low") return (card.annualFee ?? 0) <= 95;
    if (feeComfort === "mid") return (card.annualFee ?? 0) <= 300;
    if (feeComfort === "high") return (card.annualFee ?? 0) >= 300;
    return true;
  });
  if (businessOwner === "no") {
    targets = targets.filter((card) => !isBusinessCard(card));
  }
  const scored = targets.map((card) => {
    let score = 0;
    const signals: string[] = [];
    const rewards = card.rewardsByCategory || card.benefits || {};
    const totalRate = Object.values(rewards).reduce((sum, value) => {
      if (typeof value === "number") return sum + value;
      return sum;
    }, 0);
    score += totalRate * 0.8;
    if (totalRate > 4) signals.push("Broad rewards coverage");

    if (travelFocus === "travel") {
      const travelRate =
        (typeof rewards.travel === "number" ? rewards.travel : 0) +
        (typeof rewards.travel_portal === "number" ? rewards.travel_portal : 0);
      score += travelRate * 2;
      if (travelRate >= 3 || hasTravelSignals(card)) signals.push("Strong travel rewards");
      if (isPremiumTravel(card)) {
        score += 4;
        signals.push("Premium travel perks");
      }
    }
    if (travelFocus === "cash" && isCashBack(card)) {
      score += 2;
      signals.push("Cash-back oriented");
    }
    if (scoreRange === "fair" && (card.annualFee ?? 0) === 0) {
      score += 1.5;
      signals.push("No annual fee");
    }
    if (scoreRange === "excellent" || scoreRange === "very-good") {
      if ((card.annualFee ?? 0) >= 395) {
        score += 2;
        signals.push("Premium benefits");
      }
    }
    if (scoreRange === "good" && (card.annualFee ?? 0) <= 95) {
      score += 1;
      signals.push("Accessible approval");
    }
    if (budget > 3000 && (card.annualFee ?? 0) > 0) {
      score += 1;
      signals.push("Premium perks");
    }
    if (travelFrequency === "high" && hasTravelSignals(card)) {
      score += 3;
      signals.push("Great for frequent travel");
    }
    if (travelFrequency === "low" && isPremiumTravel(card)) {
      score -= 1;
    }
    if (carryBalance === "yes") {
      if (hasIntroApr(card)) {
        score += 4;
        signals.push("Intro APR available");
      } else {
        score -= 1;
      }
    }
    if (incomeRange === "under-50k" && (card.annualFee ?? 0) > 95) score -= 2;
    if (incomeRange === "50-100k" && (card.annualFee ?? 0) > 300) score -= 2;
    if (incomeRange === "200k-plus" && (card.annualFee ?? 0) >= 395) score += 1;
    if (businessOwner === "yes" && isBusinessCard(card)) {
      score += 1;
      signals.push("Business-friendly");
    }
    if (feeComfort === "low" && (card.annualFee ?? 0) === 0) score += 1;
    if (feeComfort === "mid" && (card.annualFee ?? 0) > 0 && (card.annualFee ?? 0) <= 300) score += 1;
    if (feeComfort === "high" && (card.annualFee ?? 0) >= 395) {
      score += 2;
      signals.push("High-end perks");
    }
    return { card, score, signals };
  });
  scored.sort((a, b) => b.score - a.score);

  const picks: typeof scored = [];
  const addPick = (item?: (typeof scored)[number]) => {
    if (!item) return;
    if (picks.some((p) => p.card.slug === item.card.slug || p.card.name === item.card.name)) return;
    picks.push(item);
  };
  const premium = scored.find((item) => (item.card.annualFee ?? 0) >= 95);
  const noFee = scored.find((item) => (item.card.annualFee ?? 0) === 0);
  const balanced = scored.find((item) => (item.card.annualFee ?? 0) > 0 && (item.card.annualFee ?? 0) < 300);
  addPick(premium);
  addPick(noFee);
  addPick(balanced);
  scored.forEach((item) => addPick(item));

  return picks.slice(0, 5).map((item) => ({
    card: item.card,
    reason: buildApplyReason(item.card, travelFocus, feeComfort, item.signals),
    signals: item.signals,
  }));
}

function hasTravelSignals(card: Card) {
  const name = card.name.toLowerCase();
  return (
    name.includes("travel") ||
    name.includes("venture") ||
    name.includes("sapphire") ||
    name.includes("platinum") ||
    name.includes("reserve") ||
    name.includes("altitude")
  );
}

function isCashBack(card: Card) {
  const name = card.name.toLowerCase();
  return name.includes("cash") || name.includes("savor") || name.includes("quicksilver");
}

function hasIntroApr(card: Card) {
  const apr = (card.apr || "").toLowerCase();
  const perkText = (card.perks || []).join(" ").toLowerCase();
  return apr.includes("0%") || perkText.includes("0% intro") || perkText.includes("intro apr");
}

function isBusinessCard(card: Card) {
  const name = card.name.toLowerCase();
  return name.includes("business") || name.includes("ink") || name.includes("spark");
}

function isPremiumTravel(card: Card) {
  const name = card.name.toLowerCase();
  return name.includes("platinum") || name.includes("reserve") || name.includes("venture x");
}

function buildApplyReason(card: Card, travelFocus: string, feeComfort: string, signals: string[] = []) {
  const fee = Number.isFinite(card.annualFee) ? `$${card.annualFee}` : "no annual fee";
  if (signals.length) return signals.slice(0, 2).join(" • ") + ` · ${fee} fee`;
  if (travelFocus === "travel") {
    return `Strong travel rewards with ${fee}.`;
  }
  if (travelFocus === "cash") {
    return `Solid cash-back value with ${fee}.`;
  }
  if (feeComfort === "low") {
    return `Low fee and broad rewards coverage.`;
  }
  return `Balanced rewards with ${fee}.`;
}

function buildWhyMatches(
  card: Card,
  scoreRange: string,
  feeComfort: string,
  travelFocus: string,
  travelFrequency: string,
  businessOwner: string,
  signals: string[]
) {
  const reasons: string[] = [];
  if (feeComfort === "low" && (card.annualFee ?? 0) <= 95) reasons.push("Fits low annual fee range");
  if (feeComfort === "mid" && (card.annualFee ?? 0) <= 300) reasons.push("Fits mid annual fee range");
  if (feeComfort === "high" && (card.annualFee ?? 0) >= 395) reasons.push("Premium tier annual fee");

  if (travelFocus === "travel" && hasTravelSignals(card)) reasons.push("Strong travel rewards");
  if (travelFocus === "cash" && isCashBack(card)) reasons.push("Cash‑back friendly");
  if (travelFrequency === "high" && hasTravelSignals(card)) reasons.push("Good for frequent travel");
  if (businessOwner === "yes" && isBusinessCard(card)) reasons.push("Business‑friendly option");

  if (scoreRange === "fair" && (card.annualFee ?? 0) === 0) reasons.push("Easier approval with no annual fee");
  if (scoreRange === "excellent" && (card.annualFee ?? 0) >= 395) reasons.push("Fits excellent‑credit perks");

  signals.forEach((s) => {
    if (!reasons.includes(s)) reasons.push(s);
  });

  return reasons;
}

type UpcomingCredit = {
  id: string;
  label: string;
  cardName: string;
  deadlineLabel: string;
  cadenceLabel: string;
  deadline?: Date;
};

function collectUpcomingCredits(credits: CreditItem[]): UpcomingCredit[] {
  const now = new Date();
  const windowDays = 45;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const items: UpcomingCredit[] = [];
  credits.forEach((credit) => {
    if (!credit.benefitState?.remindEnabled || credit.usedThisPeriod) return;
    const deadline = resolveCreditDeadline(credit, now);
    if (!deadline) return;
    const delta = deadline.getTime() - now.getTime();
    if (delta < 0 || delta > windowMs) return;
    items.push({
      id: credit.benefitKey,
      label: credit.label,
      cardName: credit.cardName,
      deadline,
      deadlineLabel: `Use by ${deadline.toLocaleDateString()}`,
      cadenceLabel: credit.period ? `Cadence: ${credit.period}` : "Cadence: ongoing",
    });
  });

  items.sort((a, b) => {
    if (!a.deadline || !b.deadline) return 0;
    return a.deadline.getTime() - b.deadline.getTime();
  });

  return items.slice(0, 6);
}

export default App;
