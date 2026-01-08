// frontend/src/App.tsx
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import CardList from "./CardList";
import type { Card } from "./cardModules";
import PlaidLinkButton from "./PlaidLinkButton";
import MapLinkedAccounts from "./MapLinkedAccounts"; // ⬅️ NEW
import "./App.css";

const categories = ["clothes", "groceries", "electronics", "amazon", "walmart", "dining", "travel"];
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
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantError, setMerchantError] = useState("");
  const [merchantResult, setMerchantResult] = useState<{
    merchant: string;
    category: string;
    bestCard: Card | null;
    candidates?: { card: Card; score: number }[];
    note?: string;
  } | null>(null);

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
      body: JSON.stringify({ merchant: merchant.trim(), amount: Number(amount) || undefined }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch recommendation");
        return res.json();
      })
      .then((data) => setMerchantResult(data))
      .catch((err) => setMerchantError(err.message || "Failed to fetch"))
      .finally(() => setMerchantLoading(false));
  };

  if (loading) return <div className="status">Loading cards...</div>;
  if (error) return <div className="status error">Error: {error}</div>;

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Rewardly • live benefit tracker</span>
          <h1>Make every swipe a smarter decision.</h1>
          <p>
            We track changing credit card benefits and surface the best card for any purchase,
            with clear breakdowns of multipliers, credits, and perks.
          </p>

          <div className="hero-meta">
            <div>
              <p className="meta-label">Coverage</p>
              <p className="meta-value">Major issuers + localized perks</p>
            </div>
            <div>
              <p className="meta-label">Freshness</p>
              <p className="meta-value">Snapshot history with diffing</p>
            </div>
            <div>
              <p className="meta-label">Privacy</p>
              <p className="meta-value">Local-first dev + secure tokens</p>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Try it now</p>
                <h2>Find your top card</h2>
              </div>
              <span className="panel-chip">Live</span>
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

              <div className="plaid-row">
                <PlaidLinkButton onAccessToken={setAccessToken} />
                {accessToken && <p className="status-inline">Bank account linked.</p>}
              </div>
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
                <label className="field">
                  <span>Amount (optional)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="120"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" disabled={merchantLoading}>
                {merchantLoading ? "Finding best card..." : "Get recommendation"}
              </button>
              {merchantError && <p className="status-inline error">{merchantError}</p>}
            </form>

            {merchantResult && (
              <div className="merchant-result">
                <div>
                  <p className="meta-label">Best match</p>
                  <h3>{merchantResult.bestCard?.name || "No card found"}</h3>
                  <p className="meta-value">
                    Category: {merchantResult.category || "other"}
                  </p>
                </div>
                {merchantResult.note && (
                  <p className="result-note">{merchantResult.note}</p>
                )}
              </div>
            )}

            <div className="panel-footer">
              <span className="footer-pill">Smart defaults</span>
              <span className="footer-pill">Issuer-specific parsing</span>
              <span className="footer-pill">Benefit history</span>
            </div>
          </div>

          <div className="panel-secondary">
            <MapLinkedAccounts />
          </div>
        </div>
      </header>

      <section className="results">
        <div className="results-head">
          <div>
            <h2>Card recommendations</h2>
            <p>Compare benefits, rewards, and perks in one view.</p>
          </div>
          <div className="results-stat">
            <span>{filteredCards.length}</span>
            <p>Cards in view</p>
          </div>
        </div>
        <CardList cards={filteredCards} bestCardId={bestCardId} />
      </section>
    </div>
  );
}

export default App;
