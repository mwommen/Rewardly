import { useMemo, useState } from "react";
import { useRecommendations } from "./hooks/useRecommendations";
import "./App.css";

type DebugState = {
  domain: string;
  amount: string;
  mcc: string;
};

const EXAMPLES = [
  "I am buying a belt bag at Lululemon",
  "Ordering dinner on DoorDash",
  "Booking a flight",
  "Paying for Capital One Travel",
  "Shopping at Saks",
  "Buying groceries",
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
  const knownCategories = ["travel", "dining", "groceries", "gas", "streaming", "drugstores", "apparel"];

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
    for (const reason of topPick?.why || []) {
      if (reason) lines.add(reason);
    }
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
          <h1>Ask what card to use before you pay.</h1>
          <p>
            Tell Rewardly what you are buying or where you are shopping. It checks card rewards,
            merchant benefits, and confidence signals without making you think in MCC codes.
          </p>
        </div>

        <form className="intent-panel" onSubmit={onSubmit}>
          <label htmlFor="intent">What are you buying or trying to use?</label>
          <div className="search-row">
            <input
              id="intent"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="e.g. I am buying a belt bag at Lululemon"
              autoComplete="off"
            />
            <button type="submit">Ask Rewardly</button>
          </div>
          <div className="example-row" aria-label="Example searches">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => useExample(example)}>
                {example}
              </button>
            ))}
          </div>

          <details className="debug-panel" open={debugOpen} onToggle={(event) => setDebugOpen(event.currentTarget.open)}>
            <summary>Developer/debug inputs</summary>
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
      </section>

      <section className="answer-grid" aria-live="polite">
        <div className="answer-card primary">
          <div className="section-heading">
            <p className="eyebrow">Best card to use</p>
            {merchant && <span>{merchant}</span>}
          </div>

          {!submittedIntent && (
            <div className="empty-state">
              <h2>Start with a purchase, not a form.</h2>
              <p>Try "I am buying a belt bag at Lululemon" or "Booking a flight".</p>
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
                <h2>{topPick.card.name}</h2>
                <span>{matchTierLabel(topPick.matchTier)}</span>
              </div>
              <div className="recommendation-body">
                <div>
                  <h3>Why</h3>
                  <p>{topPick.explainer || topPick.why?.[0] || "This is the strongest card match for this purchase."}</p>
                </div>
                <div>
                  <h3>Confidence</h3>
                  <p>{confidenceText(topPick.confidence, topPick.confidenceLabel)}</p>
                </div>
              </div>
              <div className="metadata-row">
                {formatFee(topPick.annualFee) && <span>{formatFee(topPick.annualFee)}</span>}
                {topPick.lastVerified && <span>Verified {new Date(topPick.lastVerified).toLocaleDateString()}</span>}
              </div>
            </div>
          )}

          {!loading && !error && submittedIntent && !topPick && (
            <div className="empty-state">
              <h2>No confident card match yet.</h2>
              <p>Try a specific merchant like Lululemon, Saks, DoorDash, or Capital One Travel.</p>
            </div>
          )}
        </div>

        <aside className="answer-card">
          <div className="section-heading">
            <p className="eyebrow">Benefits you would unlock</p>
          </div>
          {benefitLines.length ? (
            <ul className="benefit-list">
              {benefitLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Benefits and perks will appear here after a search.</p>
          )}
        </aside>

        <aside className="answer-card">
          <div className="section-heading">
            <p className="eyebrow">Benefit search</p>
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
            <p className="muted">Search a merchant or category to find relevant perks across cards.</p>
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
