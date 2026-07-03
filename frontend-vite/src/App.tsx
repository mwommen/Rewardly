import { useMemo, useState } from "react";
import { useRecommendations } from "./hooks/useRecommendations";
import "./App.css";

type DebugState = {
  domain: string;
  amount: string;
  mcc: string;
};

const EXAMPLES = [
  "Lululemon",
  "DoorDash",
  "Booking a flight",
  "Cell phone insurance",
  "Rental car insurance",
  "Saks credit",
  "Groceries",
  "Best Buy purchase protection",
];

const SMART_MOVES = [
  "Use Amex Gold for dining",
  "Check travel protections before booking flights",
  "Search benefits like cell phone insurance or rental car coverage",
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
    "rental car insurance",
    "purchase protection",
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

export default function App() {
  const [intent, setIntent] = useState("");
  const [submittedIntent, setSubmittedIntent] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);
  const [debug, setDebug] = useState<DebugState>({ domain: "", amount: "", mcc: "" });

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

  const benefitLines = useMemo(() => {
    const lines = new Set<string>();
    if (topPick?.matchedBenefit) lines.add(topPick.matchedBenefit);
    for (const offer of offers) {
      for (const perk of offer.perks || []) {
        if (perk) lines.add(perk);
      }
    }
    return Array.from(lines).slice(0, 5);
  }, [offers, topPick]);

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
          <p className="eyebrow">Wallet assistant</p>
          <h1>Know the best card to use before you pay.</h1>
          <p>
            Search a store, purchase, or benefit. Rewardly checks your cards and tells you the
            smartest way to pay.
          </p>
        </div>

        <form className="intent-panel" onSubmit={onSubmit}>
          <label htmlFor="intent">What are you buying or trying to use?</label>
          <div className="search-row">
            <input
              id="intent"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="Try: Lululemon, DoorDash, booking a flight, cell phone insurance"
              autoComplete="off"
            />
            <button type="submit">Find best card</button>
          </div>
          <div className="example-row" aria-label="Example searches">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => useExample(example)}>
                {example}
              </button>
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
          </details>
        </form>

        <section className="smart-moves" aria-labelledby="smart-moves-heading">
          <h2 id="smart-moves-heading">Today's smart moves</h2>
          <div className="smart-move-grid">
            {SMART_MOVES.map((move) => (
              <button key={move} type="button" onClick={() => useExample(move)}>
                {move}
              </button>
            ))}
          </div>
        </section>
      </section>

      <section className="answer-grid" aria-live="polite">
        <div className="answer-card primary">
          <div className="section-heading">
            <p className="eyebrow">Use this card</p>
            {merchant && <span>{merchant}</span>}
          </div>

          {!submittedIntent && (
            <div className="empty-state">
              <h2>Start with what you're buying.</h2>
              <p>Rewardly will recommend the best card and explain which rewards, credits, or protections you can use.</p>
            </div>
          )}

          {loading && <div className="empty-state">Checking your wallet...</div>}
          {error && (
            <div className="error-state">
              <strong>Could not load a recommendation.</strong>
              <span>{error}</span>
              <button type="button" onClick={refetch}>Try again</button>
            </div>
          )}

          {!loading && !error && submittedIntent && topPick && (
            <div className="recommendation">
              <div className="card-title-row">
                <div>
                  <p className="recommendation-label">Use this card</p>
                  <h2>{topPick.card.name}</h2>
                </div>
                <div className="badge-stack">
                  <span className="confidence-badge">{confidenceText(topPick.confidence, topPick.confidenceLabel)}</span>
                  <span className="match-badge">{matchTierLabel(topPick.matchTier)}</span>
                </div>
              </div>
              <div className="recommendation-body">
                <section>
                  <h3>Why this wins</h3>
                  <p>{topPick.explainer || topPick.why?.[0] || "This is the strongest card match for this purchase."}</p>
                </section>
                <section>
                  <h3>Benefits unlocked</h3>
                  <p>{benefitLines[0] || topPick.matchedBenefit || "Rewards or protections may apply based on this card."}</p>
                </section>
              </div>
              <div className="metadata-row">
                <strong>Good to know</strong>
                {formatFee(topPick.annualFee) && <span>{formatFee(topPick.annualFee)}</span>}
                {topPick.lastVerified && <span>Verified {new Date(topPick.lastVerified).toLocaleDateString()}</span>}
              </div>
            </div>
          )}

          {!loading && !error && submittedIntent && !topPick && (
            <div className="empty-state">
              <h2>We don't have a confident match yet.</h2>
              <p>Try a specific merchant, category, or benefit like Lululemon, groceries, or cell phone protection.</p>
            </div>
          )}
        </div>

        <aside className="answer-card">
          <div className="section-heading">
            <p className="eyebrow">Benefits unlocked by this purchase</p>
          </div>
          {benefitLines.length ? (
            <ul className="benefit-list">
              {benefitLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Search a merchant, purchase, or benefit to see what your cards can unlock.</p>
          )}
        </aside>

        <aside className="answer-card">
          <div className="section-heading">
            <p className="eyebrow">Related perks and offers</p>
          </div>
          {offers.length ? (
            <div className="offer-list">
              {offers.slice(0, 4).map((offer) => (
                <article key={offer.card.slug}>
                  <strong>{offer.card.name}</strong>
                  {offer.signupOffer && <span>{offer.signupOffer}</span>}
                  {(offer.perks || []).slice(0, 2).map((perk) => (
                    <p key={perk}>{perk}</p>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Related card perks and offers will appear after a search.</p>
          )}
        </aside>

        {otherBest.length > 0 && (
          <aside className="answer-card">
            <div className="section-heading">
              <p className="eyebrow">Other cards to consider</p>
            </div>
            <div className="alternate-list">
              {otherBest.slice(0, 3).map((card) => (
                <div key={card.card.slug}>
                  <strong>{card.card.name}</strong>
                  <span>{matchTierLabel(card.matchTier)}</span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}
