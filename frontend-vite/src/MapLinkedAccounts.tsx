import { useEffect, useMemo, useState } from "react";
type CardSlug = { slug: string; name: string };
type LinkedDoc = {
  userId: string; accounts?: { accountId: string; name?: string; official_name?: string;
    type?: string; subtype?: string; mask?: string; mappedCardSlug?: string; }[];
};

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
const USER_ID = "devUser";

export default function MapLinkedAccounts() {
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
        fetch(`${API}/api/plaid/linked-accounts?userId=${encodeURIComponent(USER_ID)}`).then(async (r) => {
          if (r.status === 404) return { linked: [] };
          if (!r.ok) throw new Error("Failed to load linked accounts");
          return r.json();
        })
      ]);
      setSlugs(s.slugs || []); setLinked(l.linked || []);
    } catch (e: any) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const accounts = useMemo(() => {
    const arr: NonNullable<LinkedDoc["accounts"]> = [];
    linked.forEach(doc => doc.accounts?.forEach(a => arr.push(a)));
    return arr;
  }, [linked]);

  async function mapAccount(accountId: string, mappedCardSlug: string) {
    setSaving(accountId); setError(null);
    try {
      const res = await fetch(`${API}/api/plaid/map-account`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, accountId, mappedCardSlug })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || "Failed to save");
      setLinked(json.linked || []);
    } catch (e: any) { setError(e?.message || "Failed to save"); }
    finally { setSaving(null); }
  }

  if (loading) return <div>Loading linked accounts…</div>;
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, maxWidth: 780 }}>
      <h3 style={{ marginTop: 0 }}>Linked Accounts</h3>
      <p style={{ color: "#555", marginTop: 4 }}>Map each account to a specific card.</p>
      {error && <div style={{ background:"#fff4f4", color:"#b00020", padding:8, borderRadius:8 }}>{error}</div>}
      {accounts.length === 0 ? (
        <div style={{ color: "#777" }}>No linked accounts yet.</div>
      ) : (
        <div style={{ display:"grid", gap:10 }}>
          {accounts.map(acc => (
            <div key={acc.accountId} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 12px", border:"1px solid #f1f1f1", borderRadius:10, background:"#fafafa" }}>
              <div style={{ minWidth: 260 }}>
                <div style={{ fontWeight: 600 }}>{acc.name || acc.official_name || "Account"}</div>
                <div style={{ color:"#666", fontSize:12 }}>{acc.type}/{acc.subtype} · •{acc.mask || "••••"}</div>
              </div>
              <select
                value={acc.mappedCardSlug || ""}
                onChange={e => mapAccount(acc.accountId, e.target.value)}
                disabled={!!saving}
                style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #ddd", minWidth:220 }}
              >
                <option value="" disabled>Choose card…</option>
                {slugs.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
              {saving === acc.accountId && <span style={{ fontSize:12, color:"#888" }}>saving…</span>}
            </div>
          ))}
        </div>
      )}
      <button onClick={load} style={{ marginTop: 14, padding:"8px 12px", borderRadius:8, border:"1px solid #ddd" }}>
        Refresh
      </button>
    </div>
  );
}
