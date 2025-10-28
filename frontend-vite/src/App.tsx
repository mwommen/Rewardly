// frontend/src/App.tsx
import React, { useState, useEffect } from "react";
import CardList from "./CardList";
import type { Card } from "./cardModules";
import PlaidLinkButton from "./PlaidLinkButton";
import MapLinkedAccounts from "./MapLinkedAccounts"; // ⬅️ NEW
import "./App.css";

const categories = ["clothes", "groceries", "electronics", "amazon", "walmart", "dining", "travel"];

function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [search, setSearch] = useState("");
  const [bestCardId, setBestCardId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>(""); // Plaid access token (if you still use direct /accounts)
  const [plaidAccounts, setPlaidAccounts] = useState<any[]>([]); // user bank accounts

  // Fetch all cards from backend
  useEffect(() => {
    setLoading(true);
    fetch("http://localhost:5001/api/cards")
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

  // (Optional) Fetch Plaid accounts whenever accessToken is set
  useEffect(() => {
    if (!accessToken) return;
    fetch("http://localhost:5001/api/plaid/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("User accounts from Plaid:", data.accounts);
        setPlaidAccounts(data.accounts || []);
      })
      .catch((err) => console.error(err));
  }, [accessToken]);

  // Handle search input
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    fetch(`http://localhost:5001/api/cards/best-card/${category}`)
      .then((res) => res.json())
      .then((data: { bestCard: Card }) => setBestCardId((data as any).bestCard?._id))
      .catch((err) => console.error(err));
  };

  if (loading) return <p className="loading">Loading cards...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div className="App">
      <header>
        <h1>Credit Card Optimizer</h1>
        <p>Find the best card for your needs quickly!</p>

        <div className="controls">
          <input
            type="text"
            placeholder="Search cards or benefits..."
            value={search}
            onChange={handleSearch}
          />

          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">Select category to highlight best card</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          {/* Plaid Link button */}
          <PlaidLinkButton onAccessToken={setAccessToken} />
          {accessToken && <p>Bank account linked! Access token received.</p>}
        </div>

        {/* ⬇️ Add the mapping panel right under your controls */}
        <div style={{ marginTop: 24 }}>
          <MapLinkedAccounts />
        </div>
      </header>

      <CardList cards={filteredCards} bestCardId={bestCardId} />
    </div>
  );
}

export default App;
