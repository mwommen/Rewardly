import { useEffect, useMemo, useState } from "react";
type CardSlug = { slug: string; name: string };
type LinkedDoc = {
  userId: string; accounts?: { accountId: string; name?: string; official_name?: string;
    type?: string; subtype?: string; mask?: string; mappedCardSlug?: string; }[];
};

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function MapLinkedAccounts({ userId }: { userId: string }) {
  const [slugs, setSlugs] = useState<CardSlug[]>([]);
  const [linked, setLinked] = useState<LinkedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [s, l] = await Promise.all([
        fetch(`${API}/api/cards/slugs`).then(r => r.ok ? r.json() : Promise.reject(new Error("Failed to load slugs"))),
        fetch(`${API}/api/plaid/linked-accounts?userId=${encodeURIComponent(userId)}`).then(async (r) => {
          if (r.status === 404) return { linked: [] };
          if (!r.ok) throw new Error("Failed to load linked accounts");
          return r.json();
        })
      ]);
      setSlugs(s.slugs || []); setLinked(l.linked || []);
    } catch (e: any) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [userId]);

  const accounts = useMemo(() => {
    const arr: NonNullable<LinkedDoc["accounts"]> = [];
    const seen = new Set<string>();
    linked.forEach(doc => doc.accounts?.forEach(a => {
      const key = `${a.official_name || a.name || ""}|${a.mask || ""}|${a.type || ""}|${a.subtype || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      const type = (a.type || "").toLowerCase();
      const subtype = (a.subtype || "").toLowerCase();
      if (type.includes("credit") || subtype.includes("credit")) {
        arr.push(a);
      }
    }));
    return arr;
  }, [linked]);

  async function mapAccount(accountId: string, mappedCardSlug: string) {
    setSaving(accountId); setError(null);
    try {
      const res = await fetch(`${API}/api/plaid/map-account`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, accountId, mappedCardSlug })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || "Failed to save");
      setLinked(json.linked || []);
    } catch (e: any) { setError(e?.message || "Failed to save"); }
    finally { setSaving(null); }
  }

  async function clearLinked() {
    if (!window.confirm("Clear all linked accounts for this user?")) return;
    setSaving("clearing"); setError(null);
    try {
      const res = await fetch(`${API}/api/plaid/linked-accounts?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || "Failed to clear");
      await load();
    } catch (e: any) { setError(e?.message || "Failed to clear"); }
    finally { setSaving(null); }
  }

  if (loading) return <div>Loading linked accounts…</div>;
  return (
    <div className="linked-panel">
      <div className="linked-header">
        <h3>Linked Accounts</h3>
        <p>Map each account to a specific card.</p>
      </div>
      {error && <div className="linked-error">{error}</div>}
      {accounts.length === 0 ? (
        <div className="linked-empty">No credit card accounts found yet.</div>
      ) : (
        <div className="linked-list">
          {accounts.map(acc => (
            <div key={acc.accountId} className="linked-row">
              <div className="linked-meta">
                <div className="linked-name">{acc.name || acc.official_name || "Account"}</div>
                <div className="linked-sub">{acc.type}/{acc.subtype} · •{acc.mask || "••••"}</div>
              </div>
              {acc.mappedCardSlug ? (
                <div className="linked-mapped">
                  {slugs.find((s) => s.slug === acc.mappedCardSlug)?.name || acc.mappedCardSlug}
                </div>
              ) : (
                <select
                  value={acc.mappedCardSlug || ""}
                  onChange={e => mapAccount(acc.accountId, e.target.value)}
                  disabled={!!saving}
                  className="linked-select"
                >
                  <option value="" disabled>Choose card…</option>
                  {slugs.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              )}
              {saving === acc.accountId && <span className="linked-saving">saving…</span>}
            </div>
          ))}
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
