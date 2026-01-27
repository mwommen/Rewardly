// frontend/src/App.tsx
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import CardList from "./CardList";
import type { Card } from "./cardModules";
import { getCardLogo } from "./lib/cardLogos";
import PlaidLinkButton from "./PlaidLinkButton";
import MapLinkedAccounts from "./MapLinkedAccounts"; // ⬅️ NEW
import "./App.css";

const categories = ["clothes", "groceries", "electronics", "amazon", "walmart", "dining", "travel"];
const spendCategories = [
  { key: "groceries", label: "Groceries" },
  { key: "dining", label: "Dining" },
  { key: "travel", label: "Travel" },
  { key: "gas", label: "Gas" },
  { key: "online_shopping", label: "Online shopping" },
  { key: "other", label: "Other" },
];
const choiceCategories = ["gas", "online_shopping", "dining", "travel", "drugstore", "home_improvement", "furniture"];
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [search, setSearch] = useState("");
  const [bestCardId, setBestCardId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>(""); // Plaid access token (if you still use direct /accounts)
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem("cco_user_id") || "devUser";
  });
  const [merchant, setMerchant] = useState("");
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantError, setMerchantError] = useState("");
  const [useLinkedOnly, setUseLinkedOnly] = useState(false);
  const [merchantResult, setMerchantResult] = useState<{
    merchant: string;
    category: string;
    bestCard: Card | null;
    reason?: { text: string; matches?: string[]; credits?: Array<{ label: string; requiresEnrollment?: boolean; sourceUrl?: string }> } | null;
    candidates?: { card: Card; score: number; reason?: { text: string; matches?: string[]; credits?: Array<{ label: string; requiresEnrollment?: boolean; sourceUrl?: string }> } }[];
    benefitMatches?: { card: Card; reason?: { text: string; matches?: string[]; credits?: Array<{ label: string; requiresEnrollment?: boolean; sourceUrl?: string }> } }[];
    note?: string;
  } | null>(null);
  const [pinnedId, setPinnedId] = useState<string | undefined>(undefined);
  const [balance, setBalance] = useState("1500");
  const [carryMonths, setCarryMonths] = useState("12");
  const [spendInputs, setSpendInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(spendCategories.map((c) => [c.key, "0"]))
  );
  const [preferredBonusCategory, setPreferredBonusCategory] = useState("dining");
  const [ecosystemCardSlug, setEcosystemCardSlug] = useState<string>("");
  const [activeTool, setActiveTool] = useState<"apr" | "spend" | "ecosystem">("apr");

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
        setFilteredCards(arr);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load cards");
        setLoading(false);
      });
  }, []);

  // Handle search input
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setSearch(value);

    const filtered = cards.filter(
      (card) =>
        card.name.toLowerCase().includes(value) ||
        (card.perks || []).some((perk) => perk.toLowerCase().includes(value)) ||
        Object.keys(card.benefits || {}).some((benefit) => benefit.toLowerCase().includes(value))
    );
    setFilteredCards(filtered);
  };

  // Highlight best card by category (kept as-is)
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    if (!category) {
      setBestCardId(undefined);
      return;
    }

    fetch(`${API_BASE}/api/cards/best-card/${category}`)
      .then((res) => res.json())
      .then((data: { bestCard: Card }) => setBestCardId((data as any).bestCard?._id))
      .catch((err) => console.error(err));
  };

  const handleMerchantSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!merchant.trim()) return;
    setMerchantLoading(true);
    setMerchantError("");
    setMerchantResult(null);

    fetch(`${API_BASE}/api/cards/best-card-for-merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant: merchant.trim(),
        userId,
        restrictToLinked: useLinkedOnly,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch recommendation");
        return res.json();
      })
      .then((data) => setMerchantResult(data))
      .catch((err) => setMerchantError(err.message || "Failed to fetch"))
      .finally(() => setMerchantLoading(false));
  };

  useEffect(() => {
    if (merchantResult?.bestCard?._id) setPinnedId(merchantResult.bestCard._id);
  }, [merchantResult]);

  useEffect(() => {
    localStorage.setItem("cco_user_id", userId);
  }, [userId]);

  useEffect(() => {
    if (!ecosystemCardSlug && cards.length) {
      setEcosystemCardSlug(cards[0]?.slug || "");
    }
  }, [cards, ecosystemCardSlug]);

  const introAprCards = useMemo(() => {
    return cards
      .map((card) => ({ card, months: parseIntroMonths(card.apr || "") }))
      .filter((item) => item.months != null)
      .sort((a, b) => (b.months || 0) - (a.months || 0));
  }, [cards]);

  const spendSimulation = useMemo(() => {
    const monthlySpend = Object.fromEntries(
      Object.entries(spendInputs).map(([key, value]) => [key, Math.max(0, Number(value) || 0)])
    );
    const annualSpend = Object.fromEntries(
      Object.entries(monthlySpend).map(([key, value]) => [key, value * 12])
    );

    const totals = cards.map((card) => {
      let cashEquivalent = 0;
      const valuation = getIssuerValuation(card);
      for (const category of spendCategories) {
        const spend = annualSpend[category.key] || 0;
        if (!spend) continue;
        const rate = getCardRate(card, category.key, preferredBonusCategory);
        cashEquivalent += spend * (rate || 1) * valuation;
      }
      return { card, cashEquivalent };
    });

    totals.sort((a, b) => b.cashEquivalent - a.cashEquivalent);
    return {
      annualSpendTotal: Object.values(annualSpend).reduce((sum, value) => sum + value, 0),
      top: totals[0],
      topThree: totals.slice(0, 3),
    };
  }, [cards, spendInputs, preferredBonusCategory]);

  const ecosystemView = useMemo(() => {
    const baseCard = cards.find((c) => c.slug === ecosystemCardSlug) || cards[0];
    if (!baseCard) return null;
    const issuer = baseCard.issuer;
    const issuerCards = cards.filter((c) => c.issuer === issuer && c.slug !== baseCard.slug);
    const baseCategories = new Set(getRewardCategories(baseCard));
    const ranked = issuerCards
      .map((card) => {
        const categories = getRewardCategories(card);
        let score = 0;
        const valuation = getIssuerValuation(card);
        categories.forEach((cat) => {
          if (!baseCategories.has(cat)) {
            score += getCardRate(card, cat, preferredBonusCategory) * valuation;
          }
        });
        const coverage = categories.filter((cat) => !baseCategories.has(cat));
        return { card, score, coverage };
      })
      .sort((a, b) => b.score - a.score);
    return { baseCard, issuer, suggestions: ranked.slice(0, 3) };
  }, [cards, ecosystemCardSlug, preferredBonusCategory]);

  if (loading) return <div className="status">Loading cards...</div>;
  if (error) return <div className="status error">Error: {error}</div>;

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-backdrop" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
          <span className="grid-lines" />
        </div>
        <div className="hero-copy">
          <span className="eyebrow">Rewardly • live benefit tracker</span>
          <h1>Make every swipe a smarter decision.</h1>
          <p>
            We track changing credit card benefits and surface the best card for any purchase,
            with clear breakdowns of multipliers, credits, and perks... all in real-time
          </p>
          <div className="hero-highlights">
            <div className="highlight">
              <p className="meta-label">Real-time tuning</p>
              <p className="meta-value">Hourly benefit refresh</p>
            </div>
            <div className="highlight">
              <p className="meta-label">Smart matches</p>
              <p className="meta-value">Merchant + category logic</p>
            </div>
            <div className="highlight">
              <p className="meta-label">No guesswork</p>
              <p className="meta-value">Clear reward breakdowns</p>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2>Find your benefits</h2>
              </div>
            </div>

            <div className="controls">
              <label className="field">
                <span>Search benefits</span>
                <input
                  type="text"
                  placeholder="Dining, groceries, travel, perks..."
                  value={search}
                  onChange={handleSearch}
                />
              </label>

              <label className="field">
                <span>Highlight category</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">Choose a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

            </div>

            <form className="merchant-form" onSubmit={handleMerchantSubmit}>
              <div className="merchant-fields">
                <label className="field">
                  <span>Merchant</span>
                  <input
                    type="text"
                    placeholder="Nike, Amazon, Whole Foods..."
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span>Recommendation scope</span>
                <div className="toggle-row">
                  <input
                    id="linked-only"
                    type="checkbox"
                    checked={useLinkedOnly}
                    onChange={(e) => setUseLinkedOnly(e.target.checked)}
                  />
                  <label htmlFor="linked-only">Only show linked cards</label>
                </div>
              </label>
              <button type="submit" disabled={merchantLoading}>
                {merchantLoading ? "Finding best card..." : "Get recommendation"}
              </button>
              {merchantError && <p className="status-inline error">{merchantError}</p>}
            </form>

            {merchantResult && (
              <div className="merchant-result">
                <div className="merchant-card">
                  <p className="meta-label">Best match</p>
                  <div className="merchant-card-row">
                    {merchantResult.bestCard && getCardLogo(merchantResult.bestCard) && (
                      <img
                        className="merchant-logo"
                        src={getCardLogo(merchantResult.bestCard) || ""}
                        alt={`${merchantResult.bestCard.name} card`}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <h3>{merchantResult.bestCard?.name || "No card found"}</h3>
                  </div>
                </div>
                {merchantResult.reason?.matches?.length ? (
                  <p className="result-note">
                    {sanitizeText(merchantResult.reason.matches[0])}
                    {renderOptIn(merchantResult.bestCard, merchantResult.reason)}
                  </p>
                ) : merchantResult.reason?.text ? (
                  <p className="result-note">
                    {sanitizeText(merchantResult.reason.text)}
                    {renderOptIn(merchantResult.bestCard, merchantResult.reason)}
                  </p>
                ) : null}
                {merchantResult.note && (
                  <p className="result-note">{merchantResult.note}</p>
                )}
              </div>
            )}

            {merchantResult?.benefitMatches?.length ? (
              <div className="candidate-list">
                <p className="meta-label">Other cards with this benefit</p>
                {merchantResult.benefitMatches
                  .filter((c) => c.card?._id !== merchantResult.bestCard?._id)
                  .slice(0, 3)
                  .map((c) => (
                    <div key={c.card?._id || c.card?.name} className="candidate-card">
                      <div className="candidate-row">
                        {c.card && getCardLogo(c.card) && (
                          <img
                            className="candidate-logo"
                            src={getCardLogo(c.card) || ""}
                            alt={`${c.card?.name || "Card"} card`}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <strong>{c.card?.name || "Card"}</strong>
                      </div>
                      <span>
                        {sanitizeText(c.reason?.matches?.[0] || c.reason?.text || "Benefit available")}
                        {renderOptIn(c.card, c.reason)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : null}


          </div>

          <div className="panel-secondary">
            <div className="linked-cta">
              <PlaidLinkButton
                onAccessToken={setAccessToken}
                userId={userId}
                apiBase={API_BASE}
              />
              {accessToken && <p className="status-inline">Bank account linked.</p>}
            </div>
            <MapLinkedAccounts userId={userId} />
          </div>
        </div>
      </header>

      <section className="tools">
        <div className="panel-card tools-panel">
          <div className="tools-panel-head">
            <div>
              <h2>Decision helpers</h2>
              <p>Pick a tool to answer one clear question about your next move.</p>
            </div>
            <div className="tools-tabs" role="tablist" aria-label="Decision tools">
              <button
                type="button"
                className={`tools-tab ${activeTool === "apr" ? "is-active" : ""}`}
                onClick={() => setActiveTool("apr")}
                role="tab"
                aria-selected={activeTool === "apr"}
              >
                Payoff helper
              </button>
              <button
                type="button"
                className={`tools-tab ${activeTool === "spend" ? "is-active" : ""}`}
                onClick={() => setActiveTool("spend")}
                role="tab"
                aria-selected={activeTool === "spend"}
              >
                Rewards calculator
              </button>
              <button
                type="button"
                className={`tools-tab ${activeTool === "ecosystem" ? "is-active" : ""}`}
                onClick={() => setActiveTool("ecosystem")}
                role="tab"
                aria-selected={activeTool === "ecosystem"}
              >
                Best pairing
              </button>
            </div>
          </div>

          {activeTool === "apr" && (
            <div className="tools-panel-body" role="tabpanel">
              <div className="tool-pane-head">
                <div>
                  <h3>Payoff helper</h3>
                  <p>Answer: Which card gives me the longest 0% intro APR for a carried balance?</p>
                </div>
                <div className="tool-spotlight">
                  {introAprCards.length ? (
                    <>
                      <span>Best 0% APR window</span>
                      <strong>{introAprCards[0].card.name}</strong>
                      <em>{introAprCards[0].months} months at 0% intro APR</em>
                    </>
                  ) : (
                    <span>No cards with 0% intro APR detected yet.</span>
                  )}
                </div>
              </div>
              <div className="controls">
                <label className="field">
                  <span>Balance carried</span>
                  <input
                    type="number"
                    min="0"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                  />
                  <span className="field-hint">How much you plan to carry on a 0% intro offer.</span>
                </label>
                <label className="field">
                  <span>Months to pay off</span>
                  <input
                    type="number"
                    min="1"
                    value={carryMonths}
                    onChange={(e) => setCarryMonths(e.target.value)}
                  />
                  <span className="field-hint">Your target payoff timeline in months.</span>
                </label>
              </div>
              <div className="tool-result">
                {introAprCards.length ? (
                  <div className="tool-list">
                    {introAprCards.slice(0, 3).map((item) => (
                      <div key={item.card.slug} className="tool-row">
                        <span>{item.card.name}</span>
                        <strong>{item.months} mo</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                {Number(balance) > 0 && Number(carryMonths) > 0 && (
                  <p className="tool-note">
                    Target payoff: ${Math.max(0, Number(balance) / Number(carryMonths || 1)).toFixed(0)} / month
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTool === "spend" && (
            <div className="tools-panel-body" role="tabpanel">
              <div className="tool-pane-head">
                <div>
                  <h3>Rewards calculator</h3>
                  <p>Answer: Which card earns the most for my monthly spend?</p>
                </div>
                <div className="tool-spotlight">
                  {spendSimulation.top ? (
                    <>
                      <span>Top earner</span>
                      <strong>{spendSimulation.top.card.name}</strong>
                      <em>${spendSimulation.top.cashEquivalent.toFixed(0)} est. yearly rewards</em>
                    </>
                  ) : (
                    <span>Add spend to get personalized results.</span>
                  )}
                </div>
              </div>
              <div className="controls">
                {spendCategories.map((category) => (
                  <label key={category.key} className="field">
                    <span>{category.label}</span>
                    <input
                      type="number"
                      min="0"
                      value={spendInputs[category.key] || "0"}
                      onChange={(e) =>
                        setSpendInputs((prev) => ({ ...prev, [category.key]: e.target.value }))
                      }
                    />
                  </label>
                ))}
                <label className="field">
                  <span>Preferred bonus category</span>
                  <select
                    value={preferredBonusCategory}
                    onChange={(e) => setPreferredBonusCategory(e.target.value)}
                  >
                    {choiceCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">Some cards let you pick a bonus category.</span>
                </label>
              </div>
              <div className="tool-result">
                {spendSimulation.top ? (
                  <>
                    <div className="tool-list">
                      {spendSimulation.topThree.map((item) => (
                        <div key={item.card.slug} className="tool-row">
                          <span>{item.card.name}</span>
                          <strong>${item.cashEquivalent.toFixed(0)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                <p className="tool-note">
                  Estimates use issuer point values (Amex/Chase 1.5¢, others 1¢) and category multipliers where available.
                </p>
              </div>
            </div>
          )}

          {activeTool === "ecosystem" && (
            <div className="tools-panel-body" role="tabpanel">
              <div className="tool-pane-head">
                <div>
                  <h3>Best pairing</h3>
                  <p>Answer: Which card best complements a card I already have?</p>
                </div>
                <div className="tool-spotlight">
                  {ecosystemView ? (
                    <>
                      <span>Best same-issuer add-on</span>
                      <strong>{ecosystemView.baseCard.name}</strong>
                      <em>{ecosystemView.issuer}</em>
                    </>
                  ) : (
                    <span>Select a card to see ecosystem matches.</span>
                  )}
                </div>
              </div>
              <div className="controls">
                <label className="field">
                  <span>Card you already have</span>
                  <select
                    value={ecosystemCardSlug}
                    onChange={(e) => setEcosystemCardSlug(e.target.value)}
                  >
                    {cards.map((card) => (
                      <option key={card.slug} value={card.slug}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">We suggest cards from the same issuer that fill gaps.</span>
                </label>
              </div>
              <div className="tool-result">
                {ecosystemView ? (
                  <>
                    <div className="tool-list">
                      {ecosystemView.suggestions.map((item) => (
                        <div key={item.card.slug} className="tool-row">
                          <span>{item.card.name}</span>
                          <strong>+{item.score.toFixed(2)}%</strong>
                        </div>
                      ))}
                    </div>
                    {ecosystemView.suggestions[0]?.coverage?.length ? (
                      <p className="tool-note">
                        Fills: {ecosystemView.suggestions[0].coverage.map(formatCategoryLabel).join(", ")}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="results">
        <div className="results-head">
          <div>
            <h2>Card recommendations</h2>
            <p>Compare benefits, rewards, and perks in one view.</p>
          </div>
        </div>
        <CardList cards={orderCards(filteredCards, pinnedId)} bestCardId={pinnedId || bestCardId} />
      </section>
    </div>
  );
}

function parseIntroMonths(apr: string) {
  const lower = (apr || "").toLowerCase();
  if (!lower.includes("0%")) return null;
  const match = lower.match(/(\d+)\s*months?/);
  return match ? Number(match[1]) : null;
}

function getIssuerValuation(card: Card) {
  const issuer = (card.issuer || "").toLowerCase();
  if (issuer.includes("american express")) return 0.015;
  if (issuer.includes("chase")) return 0.015;
  if (issuer.includes("citi")) return 0.01;
  return 0.01;
}

function getRewardCategories(card: Card) {
  const rewards = card.rewardsByCategory || card.benefits || {};
  return Object.keys(rewards).filter((k) => k !== "default");
}

function getCardRate(card: Card, category: string, bonusCategory: string) {
  const rewards = card.rewardsByCategory || card.benefits || {};
  if (category === "other") {
    return rewards.other || rewards.default || 1;
  }
  if (rewards.chosen_category && category === bonusCategory) {
    return rewards.chosen_category;
  }
  return rewards[category] || rewards.other || rewards.default || 1;
}

function formatCategoryLabel(value: string) {
  return value.replace(/_/g, " ");
}

function orderCards(cards: Card[], pinnedId?: string) {
  if (!pinnedId) return cards;
  const idx = cards.findIndex((c) => c._id === pinnedId);
  if (idx <= 0) return cards;
  const next = cards.slice();
  const [item] = next.splice(idx, 1);
  next.unshift(item);
  return next;
}

function sanitizeText(value: string) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPT_IN_URLS: Record<string, string> = {
  "american express": "https://www.americanexpress.com/en-us/benefits/",
  chase: "https://creditcards.chase.com/",
  citi: "https://www.citi.com/credit-cards",
  "capital one": "https://www.capitalone.com/credit-cards/",
};

function renderOptIn(
  card: Card | null | undefined,
  reason?: { credits?: Array<{ requiresEnrollment?: boolean; sourceUrl?: string }> } | null
) {
  const credits = reason?.credits || [];
  const credit = credits.find((c) => c?.requiresEnrollment);
  if (!credit) return null;
  const issuerKey = (card?.issuer || "").toLowerCase();
  const url = credit.sourceUrl || (issuerKey && OPT_IN_URLS[issuerKey]);
  if (!url) return null;
  return (
    <a className="optin-inline" href={url} target="_blank" rel="noreferrer">
      Opt in
    </a>
  );
}

export default App;
