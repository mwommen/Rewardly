import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "./lib/api";

type CardSlug = { slug: string; name: string };
type LinkedAccount = {
  accountId: string;
  name?: string;
  official_name?: string;
  type?: string;
  subtype?: string;
  mask?: string;
  mappedCardSlug?: string;
};
type LinkedDoc = {
  userId: string;
  accounts?: LinkedAccount[];
};

export default function MapLinkedAccounts({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged?: () => void;
}) {
  const [slugs, setSlugs] = useState<CardSlug[]>([]);
  const [linked, setLinked] = useState<LinkedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, l] = await Promise.all([
        fetch(`${API_BASE}/api/cards/slugs`).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Failed to load cards"))
        ),
        fetch(`${API_BASE}/api/plaid/linked-accounts?userId=${encodeURIComponent(userId)}`).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Failed to load linked accounts"))
        ),
      ]);
      setSlugs(Array.isArray(s?.slugs) ? s.slugs : []);
      setLinked(Array.isArray(l?.linked) ? l.linked : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load linked accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  const accounts = useMemo(() => {
    const arr: LinkedAccount[] = [];
    const seen = new Set<string>();

    linked.forEach((doc) =>
      doc.accounts?.forEach((account) => {
        const key = account.accountId || `${account.official_name || account.name || ""}|${account.mask || ""}`;
        if (!key || seen.has(key)) return;
        seen.add(key);
        const type = String(account.type || "").toLowerCase();
        const subtype = String(account.subtype || "").toLowerCase();
        if (type.includes("credit") || subtype.includes("credit")) arr.push(account);
      })
    );

    return arr;
  }, [linked]);

  async function mapAccount(accountId: string, mappedCardSlug: string) {
    setSaving(accountId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/plaid/map-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, accountId, mappedCardSlug }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || "Failed to save mapping");
      setLinked(Array.isArray(json?.linked) ? json.linked : []);
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || "Failed to save mapping");
    } finally {
      setSaving(null);
    }
  }

  async function clearLinked() {
    if (!window.confirm("Clear all linked accounts for this user?")) return;
    setSaving("clearing");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/plaid/linked-accounts?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || "Failed to clear linked accounts");
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || "Failed to clear linked accounts");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="result-note">Loading linked accounts…</div>;

  return (
    <div className="linked-panel">
      <div className="linked-header">
        <h3>Linked accounts</h3>
        <p>Review auto-matches and correct any card that looks wrong.</p>
      </div>
      {error && <div className="linked-error">{error}</div>}
      {accounts.length === 0 ? (
        <div className="linked-empty">No credit card accounts found yet.</div>
      ) : (
        <div className="linked-list">
          {accounts.map((acc) => {
            const mappedSlug = String(acc.mappedCardSlug || "").trim();
            const isUnknown = !mappedSlug || mappedSlug === "unknown" || mappedSlug === "generic-credit";
            return (
              <div key={acc.accountId} className="linked-row">
                <div className="linked-meta">
                  <div className="linked-name">{acc.name || acc.official_name || "Account"}</div>
                  <div className="linked-sub">
                    {acc.type}/{acc.subtype} · •{acc.mask || "••••"}
                  </div>
                </div>
                <div className="linked-map-control">
                  <select
                    value={mappedSlug}
                    onChange={(e) => mapAccount(acc.accountId, e.target.value)}
                    disabled={!!saving}
                    className="linked-select"
                  >
                    <option value="">Choose card…</option>
                    <option value="generic-credit">Generic credit card</option>
                    {slugs.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <span className={`linked-status ${isUnknown ? "warning" : "ok"}`}>
                    {isUnknown ? "Needs review" : "Mapped"}
                  </span>
                </div>
                {saving === acc.accountId && <span className="linked-saving">saving…</span>}
              </div>
            );
          })}
        </div>
      )}
      <div className="linked-actions">
        <button onClick={load} className="linked-btn">
          Refresh
        </button>
        <button
          onClick={clearLinked}
          disabled={saving === "clearing"}
          className="linked-btn danger"
        >
          {saving === "clearing" ? "Clearing..." : "Clear linked accounts"}
        </button>
      </div>
    </div>
  );
}
