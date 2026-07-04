import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Card as WalletCard } from "./cardModules";
import { type DebugState } from "./components/AdvancedInputs";
import HeroAskRewardly from "./components/HeroAskRewardly";
import RecommendationResult from "./components/RecommendationResult";
import RelatedPerksSection from "./components/RelatedPerksSection";
import SmartMoves, { type SmartMove } from "./components/SmartMoves";
import TrustSection from "./components/TrustSection";
import UnlocksSection from "./components/UnlocksSection";
import WalletPreview from "./components/WalletPreview";
import { Badge, Card, SectionHeader } from "./design-system/components";
import { useRecommendations } from "./hooks/useRecommendations";
import { API_BASE } from "./lib/api";
import { getBenefitLogo } from "./lib/benefitLogos";
import { normalizeUnlockLabel, rewardChip } from "./lib/formatters";
import { isBenefitIntent, parseIntent } from "./lib/intent";
import { WALLET_FALLBACKS } from "./lib/walletSections";
import "./App.css";

const EXAMPLES = [
  "Lululemon",
  "Costco",
  "Booking a flight",
  "Rental car insurance",
  "Cell phone protection",
  "TSA PreCheck",
  "Airport lounge",
  "Best Buy purchase protection",
  "Dining credit",
];

const SMART_MOVES: SmartMove[] = [
  {
    icon: "E",
    title: "Eating out tonight?",
    text: "Find the card that earns the most at restaurants.",
    query: "Dining",
  },
  {
    icon: "B",
    title: "Booking travel?",
    text: "Check protections before you pay.",
    query: "Booking a flight",
  },
  {
    icon: "P",
    title: "Buying electronics?",
    text: "See purchase protection or extended warranty.",
    query: "Best Buy purchase protection",
  },
  {
    icon: "C",
    title: "Have credits expiring?",
    text: "Use benefits before they disappear.",
    query: "Dining credit",
  },
];

export default function App() {
  const [intent, setIntent] = useState("");
  const [submittedIntent, setSubmittedIntent] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);
  const [debug, setDebug] = useState<DebugState>({ domain: "", amount: "", mcc: "" });
  const [walletCards, setWalletCards] = useState<WalletCard[]>([]);
  const [selectedWalletSlug, setSelectedWalletSlug] = useState<string>("");

  const merchant = useMemo(() => parseIntent(submittedIntent), [submittedIntent]);
  const benefitIntent = useMemo(() => isBenefitIntent(submittedIntent), [submittedIntent]);
  const query = useMemo(() => {
    const amount = debug.amount.trim() ? Number(debug.amount) : undefined;
    return {
      merchant: merchant || undefined,
      domain: debug.domain || undefined,
      amount: Number.isFinite(amount) ? amount : undefined,
      mcc: debug.mcc || undefined,
      limit: 5,
    };
  }, [debug.amount, debug.domain, debug.mcc, merchant]);

  const { loading, error, topPick, otherBest, offers, refetch } = useRecommendations(query);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/cards`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load wallet cards");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const cards = Array.isArray(data) ? data : data.cards || [];
        const prioritized = [...cards].sort((a: WalletCard, b: WalletCard) => {
          const aIndex = WALLET_FALLBACKS.indexOf(a.slug || "");
          const bIndex = WALLET_FALLBACKS.indexOf(b.slug || "");
          return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
        });
        setWalletCards(prioritized.slice(0, 6));
        setSelectedWalletSlug((current) => current || prioritized[0]?.slug || prioritized[0]?.name || "");
      })
      .catch(() => {
        if (!cancelled) setWalletCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlockedBenefits = useMemo(() => {
    const lines = new Map<string, string | null>();
    if (topPick) lines.set(rewardChip(topPick.effectiveRate), null);
    if (topPick?.matchedBenefit) lines.set(topPick.matchedBenefit, getBenefitLogo(topPick.matchedBenefit));
    for (const offer of offers) {
      for (const perk of offer.perks || []) {
        if (perk && !lines.has(perk)) lines.set(perk, getBenefitLogo(perk));
      }
    }
    if (benefitIntent && submittedIntent) {
      const label = normalizeUnlockLabel(submittedIntent);
      if (!lines.has(label)) lines.set(label, getBenefitLogo(label));
    }
    return Array.from(lines, ([label, logo]) => ({ label: normalizeUnlockLabel(label), logo })).slice(0, 8);
  }, [benefitIntent, offers, submittedIntent, topPick]);

  const selectedWalletCard = walletCards.find((card) => (card.slug || card.name) === selectedWalletSlug) || walletCards[0];

  const submitIntent = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedIntent(intent.trim());
  };

  const useExample = (example: string) => {
    setIntent(example);
    setSubmittedIntent(example);
  };

  return (
    <main className="assistant-shell">
      <section className="assistant-hero">
        <HeroAskRewardly
          intent={intent}
          debug={debug}
          debugOpen={debugOpen}
          topPick={topPick}
          examples={EXAMPLES}
          onIntentChange={setIntent}
          onSubmit={submitIntent}
          onExample={useExample}
          onDebugChange={setDebug}
          onDebugOpenChange={setDebugOpen}
        />
        <SmartMoves moves={SMART_MOVES} onSelect={useExample} />
      </section>

      <section className="answer-grid" aria-live="polite">
        <RecommendationResult
          merchant={merchant}
          submittedIntent={submittedIntent}
          loading={loading}
          error={error}
          topPick={topPick}
          unlockedBenefits={unlockedBenefits}
          onRetry={refetch}
          onSuggestion={useExample}
        />

        <UnlocksSection unlockedBenefits={unlockedBenefits} />
        <RelatedPerksSection offers={offers} benefitIntent={benefitIntent} />

        {otherBest.length > 0 && (
          <Card className="answer-card" variant="subtle">
            <SectionHeader eyebrow="Other cards to consider" />
            <div className="alternate-list">
              {otherBest.slice(0, 3).map((card) => (
                <div key={card.card.slug}>
                  <strong>{card.card.name}</strong>
                  <Badge>Backup option</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      <TrustSection />

      <WalletPreview
        walletCards={walletCards}
        selectedWalletCard={selectedWalletCard}
        onSelect={setSelectedWalletSlug}
      />
    </main>
  );
}
