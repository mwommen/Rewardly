import { useEffect, useMemo, useState } from "react";
import type { Card as WalletCard } from "./cardModules";
import { Badge, Button, Card, EmptyState, LoadingState, SearchInput, SectionHeader } from "./design-system/components";
import { useRecommendations } from "./hooks/useRecommendations";
import { API_BASE } from "./lib/api";
import { getBenefitLogo } from "./lib/benefitLogos";
import { getCardLogo } from "./lib/cardLogos";
import "./App.css";

type DebugState = {
  domain: string;
  amount: string;
  mcc: string;
};

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

const SMART_MOVES = [
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

const NO_RESULT_SUGGESTIONS = [
  "groceries",
  "rental car insurance",
  "Best Buy",
  "cell phone protection",
];

const WALLET_FALLBACKS = ["amex-platinum", "amex-gold", "chase-sapphire-preferred", "capital-one-venture-x"];

const BENEFIT_TERMS = [
  "cell phone insurance",
  "cell phone protection",
  "rental car insurance",
  "rental car coverage",
  "lounge access",
  "airport lounge",
  "tsa precheck",
  "uber credit",
  "dining credit",
  "purchase protection",
  "extended warranty",
  "return protection",
  "trip delay insurance",
  "travel protection",
];

const UNLOCK_LABELS = [
  "purchase protection",
  "extended warranty",
  "return protection",
  "active offer",
  "travel protection",
  "dining credit",
  "cell phone insurance",
  "rental car coverage",
];

function parseIntent(input: string) {
  const cleaned = input.trim();
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  const knownMerchants = [
    "lululemon",
    "capital one travel",
    "doordash",
    "saks",
    "saks fifth avenue",
    "uber",
    "lyft",
    "amazon",
    "starbucks",
    "walmart",
    "target",
    "cvs",
    "walgreens",
  ];
  const knownCategories = [
    "travel",
    "dining",
    "groceries",
    "gas",
    "streaming",
    "drugstores",
    "apparel",
    "cell phone insurance",
    "cell phone protection",
    "rental car insurance",
    "rental car coverage",
    "purchase protection",
    "extended warranty",
    "return protection",
    "tsa precheck",
    "airport lounge",
    "lounge access",
    "dining credit",
    "uber credit",
    "trip delay insurance",
  ];

  const merchant = knownMerchants.find((candidate) => lower.includes(candidate));
  if (merchant) return merchant;

  const category = knownCategories.find((candidate) => lower.includes(candidate));
  if (category) return category;

  return cleaned
    .replace(/^(i am|i'm|im|buying|ordering|booking|paying for|shopping at|using)\s+/i, "")
    .replace(/\s+(checkout|purchase|order|payment)$/i, "")
    .trim();
}

function isBenefitIntent(input: string) {
  const lower = input.toLowerCase();
  return BENEFIT_TERMS.some((term) => lower.includes(term));
}

function matchTierLabel(tier?: string) {
  if (tier === "exact_benefit") return "Exact benefit match";
  if (tier === "category_match") return "Category match";
  if (tier === "base_rate") return "Base rewards match";
  return "Recommendation";
}

function confidenceText(confidence?: number, label?: string) {
  if (label) return label;
  if (typeof confidence !== "number") return "Review recommended";
  if (confidence >= 0.8) return "High confidence";
  if (confidence >= 0.55) return "Medium confidence";
  return "Low confidence";
}

function formatFee(fee?: number) {
  if (typeof fee !== "number") return null;
  return fee === 0 ? "No annual fee" : `$${fee.toLocaleString()} annual fee`;
}

function formatRewards(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return "You'll earn the best available rewards";
  if (rate >= 10) return `You'll get about ${rate.toFixed(0)}x value`;
  const formatted = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1);
  return `You'll earn ${formatted}x rewards`;
}

function rewardChip(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return "Strong rewards";
  const formatted = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1);
  return `${formatted}x rewards`;
}

function normalizeUnlockLabel(value: string) {
  const lower = value.toLowerCase();
  const known = UNLOCK_LABELS.find((label) => lower.includes(label));
  return known ? formatCategory(known) : value;
}

function formatCategory(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function topRewards(card: WalletCard) {
  const rewards = card.rewardsByCategory || card.benefits || {};
  return Object.entries(rewards)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([category, value]) => `${value}x ${formatCategory(category)}`);
}

function walletSections(card: WalletCard) {
  const credits = [...(card.merchantCredits || []), ...(card.recurringCredits || [])];
  const perks = card.perks || [];
  const rewards = topRewards(card);
  const protections = perks.filter((perk) => /protection|insurance|warranty|coverage/i.test(perk)).slice(0, 3);
  const travel = perks.filter((perk) => /travel|lounge|hotel|flight|rental|trip/i.test(perk)).slice(0, 3);

  return [
    { title: "Best for", items: topRewards(card).slice(0, 2) },
    { title: "Rewards", items: rewards },
    { title: "Benefits", items: perks.filter((perk) => !protections.includes(perk) && !travel.includes(perk)).slice(0, 3) },
    { title: "Protections", items: protections },
    { title: "Credits", items: credits.slice(0, 3).map((credit) => `$${credit.amountUSD} ${credit.label}`) },
    { title: "Offers", items: card.signupOffer ? [card.signupOffer] : [] },
    { title: "Travel perks", items: travel },
  ].filter((section) => section.items.length);
}

function LogoMark({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return <img src={src} alt="" aria-hidden="true" />;
  }

  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "R";

  return <span aria-hidden="true">{initials}</span>;
}

export default function App() {
  const [intent, setIntent] = useState("");
  const [submittedIntent, setSubmittedIntent] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);
  const [debug, setDebug] = useState<DebugState>({ domain: "", amount: "", mcc: "" });
  const [walletCards, setWalletCards] = useState<WalletCard[]>([]);
  const [selectedWalletSlug, setSelectedWalletSlug] = useState<string>("");

  const merchant = useMemo(() => parseIntent(submittedIntent), [submittedIntent]);
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
  const benefitIntent = useMemo(() => isBenefitIntent(submittedIntent), [submittedIntent]);

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

  const topCardLogo = getCardLogo(topPick?.card);
  const selectedWalletCard = walletCards.find((card) => (card.slug || card.name) === selectedWalletSlug) || walletCards[0];

  const onSubmit = (event: React.FormEvent) => {
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
        <div className="brand-row">
          <span className="brand-mark">R</span>
          <span>Rewardly</span>
        </div>
        <div className="hero-copy">
          <h1>Know the best card to use before you pay.</h1>
          <p>
            Search a store, purchase, or benefit. Rewardly checks your cards and tells you the
            smartest way to pay.
          </p>
        </div>

        <Card className="intent-panel" variant="default">
          <form onSubmit={onSubmit}>
            <SearchInput
              id="intent"
              label="What are you buying or trying to use?"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="Ask about Lululemon, flights, rental car insurance, cell phone protection..."
              autoComplete="off"
              action={<Button type="submit" variant="primary">Ask Rewardly</Button>}
              note="Rewardly only uses your card benefits to make recommendations. You stay in control."
            />
          </form>
          <div className="example-row" aria-label="Example searches">
            {EXAMPLES.map((example) => (
              <Button
                key={example}
                type="button"
                variant="secondary"
                onClick={() => useExample(example)}
                aria-label={`Search ${example}`}
              >
                {example}
              </Button>
            ))}
          </div>

          <details className="debug-panel" open={debugOpen} onToggle={(event) => setDebugOpen(event.currentTarget.open)}>
            <summary>Advanced inputs</summary>
            <p>Optional: used for testing domain, amount, and MCC.</p>
            <div className="debug-grid">
              <label>
                Domain
                <input
                  value={debug.domain}
                  onChange={(event) => setDebug((prev) => ({ ...prev, domain: event.target.value }))}
                  placeholder="lululemon.com"
                />
              </label>
              <label>
                Amount
                <input
                  value={debug.amount}
                  onChange={(event) => setDebug((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="84.24"
                  inputMode="decimal"
                />
              </label>
              <label>
                MCC
                <input
                  value={debug.mcc}
                  onChange={(event) => setDebug((prev) => ({ ...prev, mcc: event.target.value }))}
                  placeholder="5651"
                />
              </label>
            </div>
            {topPick && (
              <div className="debug-result">
                <span>Recommendation logic</span>
                <Badge tone="neutral">{confidenceText(topPick.confidence, topPick.confidenceLabel)}</Badge>
                <Badge tone="neutral">{matchTierLabel(topPick.matchTier)}</Badge>
                {typeof topPick.confidence === "number" && (
                  <Badge tone="neutral">{Math.round(topPick.confidence * 100)}% confidence</Badge>
                )}
              </div>
            )}
          </details>
        </Card>

        <section className="smart-moves" aria-label="Today's smart moves">
          <SectionHeader title="Today's smart moves" />
          <div className="smart-move-grid">
            {SMART_MOVES.map((move) => (
              <Button
                key={move.title}
                type="button"
                variant="secondary"
                onClick={() => useExample(move.query)}
                aria-label={`Search ${move.title}`}
              >
                <span className="smart-icon" aria-hidden="true">{move.icon}</span>
                <strong>{move.title}</strong>
                <span>{move.text}</span>
              </Button>
            ))}
          </div>
        </section>
      </section>

      <section className="answer-grid" aria-live="polite">
        <Card className="answer-card primary recommendation-hero" variant="hero">
          <SectionHeader
            eyebrow="Best Choice"
            action={merchant ? <Badge tone="info">{merchant}</Badge> : null}
          />

          {!submittedIntent && (
            <EmptyState title="Start with what you're buying.">
              Rewardly will recommend the best card and explain which rewards, credits, or protections you can use.
            </EmptyState>
          )}

          {loading && (
            <LoadingState message="Checking your wallet for the smartest way to pay..." />
          )}
          {error && (
            <div className="error-state">
              <strong>Something went wrong while checking your wallet.</strong>
              <span>Try again in a moment.</span>
              <Button type="button" variant="primary" onClick={refetch}>Try again</Button>
            </div>
          )}

          {!loading && !error && submittedIntent && topPick && (
            <div className="recommendation">
              <div className="card-title-row">
                <div className="card-identity">
                  <div className="card-logo-tile">
                    <LogoMark src={topCardLogo} label={topPick.card.name} />
                  </div>
                  <div>
                    <p className="recommendation-label">Use this card</p>
                    <h2>{topPick.card.name}</h2>
                    <p className="concierge-copy">
                      Rewardly recommends this card because it gives you the strongest mix of rewards and usable benefits for this purchase.
                    </p>
                  </div>
                </div>
              </div>
              <div className="advice-grid">
                <div className="reward-callout">
                  <strong>{formatRewards(topPick.effectiveRate)}</strong>
                </div>
                <div>
                  <span>What you unlock</span>
                  <strong>{unlockedBenefits.find((benefit) => !/rewards/i.test(benefit.label))?.label || topPick.matchedBenefit || "Relevant card benefits"}</strong>
                </div>
                <div>
                  <span>Why it wins</span>
                  <strong>{topPick.explainer || topPick.why?.[0] || "Best fit for this purchase."}</strong>
                </div>
              </div>
              <div className="metadata-row">
                <strong>Details</strong>
                {formatFee(topPick.annualFee) && <Badge>{formatFee(topPick.annualFee)}</Badge>}
                {topPick.lastVerified && <Badge>Verified {new Date(topPick.lastVerified).toLocaleDateString()}</Badge>}
              </div>
            </div>
          )}

          {!loading && !error && submittedIntent && !topPick && (
            <EmptyState
              title="We don't have a confident match yet."
              action={(
              <div className="suggestion-row" aria-label="No result suggestions">
                {NO_RESULT_SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="secondary"
                    onClick={() => useExample(suggestion)}
                    aria-label={`Try ${suggestion}`}
                  >
                    Try "{suggestion}"
                  </Button>
                ))}
              </div>
              )}
            >
              Try a specific merchant, category, or benefit like Lululemon, groceries, or cell phone protection.
            </EmptyState>
          )}
        </Card>

        <Card className="answer-card unlock-card" variant="subtle">
          <SectionHeader eyebrow="What you unlock" />
          {unlockedBenefits.length ? (
            <ul className="benefit-list">
              {unlockedBenefits.map((benefit) => (
                <li key={benefit.label}>
                  <span className="benefit-logo">
                    <LogoMark src={benefit.logo} label={benefit.label} />
                  </span>
                  <span>{benefit.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Rewardly didn't find a specific benefit yet, but this card still looks like the strongest option based on available rewards.</p>
          )}
        </Card>

        <Card className="answer-card" variant="subtle">
          <SectionHeader eyebrow={benefitIntent ? "Cards with this benefit" : "Related perks and offers"} />
          {offers.length ? (
            <div className="offer-list">
              {offers.slice(0, 4).map((offer) => (
                <article key={offer.card.slug}>
                  <div className="offer-card-heading">
                    <span className="benefit-logo">
                      <LogoMark
                        src={getBenefitLogo(offer.perks?.[0] || offer.signupOffer || offer.card.name)}
                        label={offer.card.name}
                      />
                    </span>
                    <strong>{offer.card.name}</strong>
                  </div>
                  {offer.signupOffer && <span>{offer.signupOffer}</span>}
                  {(offer.perks || []).slice(0, 2).map((perk) => (
                    <p key={perk}>{perk}</p>
                  ))}
                  {benefitIntent && (
                    <div className="benefit-detail-grid">
                      <span>What it covers</span>
                      <p>{offer.perks?.[0] || "Relevant card benefit or protection."}</p>
                      <span>Requirements</span>
                      <p>Use this card when you pay.</p>
                      <span>Good to know</span>
                      <p>Coverage and limits depend on issuer terms.</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Related card perks and offers will appear after a search.</p>
          )}
        </Card>

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

      <section className="trust-section" aria-label="Rewardly trust and privacy">
        <div>
          <p className="recommendation-label">Trust</p>
          <h2>Your data stays yours.</h2>
          <p>Rewardly never moves money. It only uses your card and benefit information to recommend the smartest way to pay.</p>
        </div>
        <div className="trust-points">
          <span>Read-only data</span>
          <span>Secure connections</span>
          <span>You stay in control</span>
          <span>No payment movement</span>
        </div>
      </section>

      <section className="wallet-section" aria-label="Wallet">
        <SectionHeader
          eyebrow="Wallet"
          title="Your cards, organized for decisions."
          action={<Badge tone="info">{walletCards.length || "Demo"} cards</Badge>}
        />
        <div className="wallet-layout">
          <div className="wallet-stack" aria-label="Wallet cards">
            {walletCards.slice(0, 5).map((card, index) => {
              const key = card.slug || card.name;
              const selected = key === (selectedWalletCard?.slug || selectedWalletCard?.name);
              return (
                <button
                  key={key}
                  type="button"
                  className={`wallet-card ${selected ? "selected" : ""}`}
                  style={{ transform: `translateY(${index * -18}px)` }}
                  onClick={() => setSelectedWalletSlug(key)}
                  aria-label={`Open ${card.name}`}
                >
                  <span>{card.issuer}</span>
                  <strong>{card.name}</strong>
                  <LogoMark src={getCardLogo(card)} label={card.name} />
                </button>
              );
            })}
          </div>

          <Card className="wallet-detail" variant="subtle">
            {selectedWalletCard ? (
              <>
                <div className="wallet-detail-head">
                  <div className="card-logo-tile">
                    <LogoMark src={getCardLogo(selectedWalletCard)} label={selectedWalletCard.name} />
                  </div>
                  <div>
                    <p className="recommendation-label">In your wallet</p>
                    <h2>{selectedWalletCard.name}</h2>
                    <p>{selectedWalletCard.issuer}</p>
                  </div>
                </div>
                <div className="wallet-detail-grid">
                  {walletSections(selectedWalletCard).map((section) => (
                    <section key={section.title}>
                      <h3>{section.title}</h3>
                      <ul>
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="No wallet cards yet.">
                Link cards or seed demo data to see a wallet-style card stack.
              </EmptyState>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}
