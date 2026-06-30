import { useEffect, useMemo, useState } from "react";
import type { Card } from "../cardModules";
import "../App.css";
import { getApplyUrl } from "../lib/applyLinks";
import { getCardLogo } from "../lib/cardLogos";

type Props = {
  cards: Card[];
  onClose: () => void;
  onSelect: (card: Card) => void;
};

function formatCategoryLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getTopPerks(card: Card) {
  const rewards = (card.rewardsByCategory || card.benefits) || {};
  const entries = Object.entries(rewards)
    .filter(([, v]) => typeof v === "number" && Number.isFinite(Number(v)))
    .map(([k, v]) => ({ key: k, value: Number(v) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((e) => `${e.value}x on ${formatCategoryLabel(e.key)}`);
  if (entries.length) return entries;
  if (card.signupOffer) return [`Signup: ${card.signupOffer}`];
  return [];
}

export default function CardSearch({ cards, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Card | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards.slice(0, 10);
    return cards
      .filter((c) => (c.name || "").toLowerCase().includes(q) || (c.issuer || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [cards, query]);

  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    return results.findIndex((card) => card.slug === selected.slug);
  }, [results, selected]);

  useEffect(() => {
    if (results.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !results.some((card) => card.slug === selected.slug)) {
      setSelected(results[0]);
    }
  }, [results, selected]);

  return (
    <div className="card-search-overlay" role="dialog" aria-modal="true">
      <div className="card-search-modal">
        <div className="card-search-head">
          <input
            autoFocus
            aria-label="Search cards by name or issuer"
            placeholder="Search cards by name or issuer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                const next = results[(selectedIndex + 1) % results.length];
                if (next) setSelected(next);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                const next = results[(selectedIndex - 1 + results.length) % results.length];
                if (next) setSelected(next);
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (selected) {
                  onSelect(selected);
                  onClose();
                }
              }
            }}
          />
          <button className="card-search-close" onClick={onClose} aria-label="Close card search">
            Close
          </button>
        </div>
        <div className="card-search-body">
          <div className="card-search-list" role="listbox" aria-label="Card search results">
            {results.map((card) => (
              <button
                key={card.slug || card.name}
                type="button"
                className={`card-search-item${selected?.slug === card.slug ? " selected" : ""}`}
                onClick={() => setSelected(card)}
                role="option"
                aria-selected={selected?.slug === card.slug}
              >
                {getCardLogo(card) ? (
                  <img className="card-search-logo" src={getCardLogo(card) || ""} alt={`${card.name} logo`} />
                ) : null}
                <div>
                  <strong>{card.name}</strong>
                  <div className="muted">{card.issuer || "Issuer"}</div>
                </div>
              </button>
            ))}
            {results.length === 0 && <div className="empty-copy">No cards found.</div>}
          </div>
          <div className="card-search-details">
            {selected ? (
              <div>
                {getCardLogo(selected) ? (
                  <img className="card-search-selected-logo" src={getCardLogo(selected) || ""} alt={`${selected.name} logo`} />
                ) : null}
                <h3>{selected.name}</h3>
                <p className="muted">{selected.issuer}</p>
                <div>
                  <strong>Top benefits</strong>
                  <ul>
                    {getTopPerks(selected).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                {selected.annualFee !== undefined && (
                  <p className="muted">Annual fee: ${selected.annualFee}</p>
                )}
                <div className="card-search-details-actions">
                  <button
                    type="button"
                    className="apply-search"
                    onClick={() => {
                      onSelect(selected);
                      onClose();
                    }}
                  >
                    View card details
                  </button>
                  <a className="apply-link" href={getApplyUrl(selected) || "#"} target="_blank" rel="noreferrer">Apply / Learn more</a>
                </div>
              </div>
            ) : (
              <div className="empty-copy">Select a card to view benefits.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
