// frontend-vite/src/App_recommendation.tsx
import { useMemo, useState } from "react";
import TopPick from "./components/TopPick";
import OffersList from "./components/OffersList";
import { useRecommendations } from "./hooks/useRecommendations";

type FormState = {
  merchant: string;
  domain: string;
  amount: string; // keep as string for the input
  mcc: string;
};

export default function AppRecommendation() {
  const [form, setForm] = useState<FormState>({
    merchant: "",
    domain: "",
    amount: "",
    mcc: "",
  });
  const [submitted, setSubmitted] = useState<FormState>(form);

  const query = useMemo(() => {
    const amt = submitted.amount.trim() ? Number(submitted.amount) : undefined;
    return {
      merchant: submitted.merchant || undefined,
      domain: submitted.domain || undefined,
      amount: Number.isFinite(amt!) ? amt : undefined,
      mcc: submitted.mcc || undefined,
      limit: 5,
    };
  }, [submitted]);

  const { loading, error, topPick, otherBest, offers, refetch } = useRecommendations(query);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(form);
  };

  return (
    <div style={{ maxWidth: 920, margin: "40px auto", padding: "0 16px", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>CCO — Recommendations MVP</h1>
      <p style={{ color: "#4b5563", marginTop: 0, marginBottom: 20 }}>
        Enter a merchant (or domain), amount, and optional MCC. We’ll call <code>/best</code> and <code>/offers</code> with
        <code> fields=</code> to keep responses small.
      </p>

      <form onSubmit={onSubmit} style={styles.form}>
        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Merchant</label>
            <input
              name="merchant"
              placeholder="e.g., Starbucks"
              value={form.merchant}
              onChange={onChange}
              style={styles.input}
            />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Domain</label>
            <input
              name="domain"
              placeholder="e.g., lululemon.com"
              value={form.domain}
              onChange={onChange}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Amount</label>
            <input
              name="amount"
              placeholder="e.g., 75"
              value={form.amount}
              onChange={onChange}
              style={styles.input}
              inputMode="decimal"
            />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>MCC (optional)</label>
            <input
              name="mcc"
              placeholder="e.g., 5812"
              value={form.mcc}
              onChange={onChange}
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" style={styles.button}>
            Get Recommendations
          </button>
          <button type="button" style={styles.ghostButton} onClick={refetch} disabled={loading}>
            Refresh
          </button>
        </div>
      </form>

      {loading && <div style={{ marginTop: 16 }}>Loading…</div>}
      {error && (
        <div style={{ marginTop: 16, color: "#b91c1c" }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && (topPick || otherBest.length || offers.length) ? (
        <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
          {topPick && (
            <TopPick
              name={topPick.card.name}
              rate={topPick.effectiveRate}
              explainer={topPick.explainer}
              confidence={topPick.confidence}
            />
          )}

          {otherBest.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Other Best Matches</div>
              <div style={{ display: "grid", gap: 8 }}>
                {otherBest.map((b) => (
                  <div
                    key={b.card.slug}
                    style={{
                      border: "1px dashed #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{b.card.name}</div>
                    <div style={{ fontSize: 13, color: "#374151" }}>
                      Effective rate: <strong>{b.effectiveRate != null ? `${b.effectiveRate.toFixed(2)}%` : "—"}</strong>
                      {b.explainer ? ` — ${b.explainer}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Offers & Perks</div>
            <OffersList items={offers} />
          </div>
        </div>
      ) : null}

      {!loading && !error && !topPick && !otherBest.length && !offers.length && (
        <div style={{ marginTop: 16, color: "#6b7280" }}>
          No results. Try a merchant like <code>Starbucks</code> or a domain like <code>lululemon.com</code>.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 20, background: "white" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  col: { display: "flex", flexDirection: "column" },
  label: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  },
  button: {
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  ghostButton: {
    background: "transparent",
    border: "1px solid #111827",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
};
