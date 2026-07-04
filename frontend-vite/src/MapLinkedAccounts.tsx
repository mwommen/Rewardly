import { useCallback, useEffect, useMemo, useState } from "react";
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

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
  const [accountFilter, setAccountFilter] = useState<"all" | "needs_review">(
    "all",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l] = await Promise.all([
        fetch(`${API_BASE}/api/cards/slugs`).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Failed to load cards")),
        ),
        fetch(
          `${API_BASE}/api/plaid/linked-accounts?userId=${encodeURIComponent(userId)}`,
        ).then((r) =>
          r.ok
            ? r.json()
            : Promise.reject(new Error("Failed to load linked accounts")),
        ),
      ]);
      setSlugs(Array.isArray(s?.slugs) ? s.slugs : []);
      setLinked(Array.isArray(l?.linked) ? l.linked : []);
    } catch (e) {
      setError(getErrorMessage(e, "Failed to load linked accounts"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const cardMap = useMemo(
    () => new Map(slugs.map((s) => [s.slug, s.name])),
    [slugs],
  );

  const accounts = useMemo(() => {
    const arr: LinkedAccount[] = [];
    const seen = new Set<string>();

    linked.forEach((doc) =>
      doc.accounts?.forEach((account) => {
        const key =
          account.accountId ||
          `${account.official_name || account.name || ""}|${account.mask || ""}`;
        if (!key || seen.has(key)) return;
        seen.add(key);
        const type = String(account.type || "").toLowerCase();
        const subtype = String(account.subtype || "").toLowerCase();
        if (type.includes("credit") || subtype.includes("credit"))
          arr.push(account);
      }),
    );

    return arr;
  }, [linked]);

  const reviewAccounts = useMemo(() => {
    if (accountFilter === "needs_review") {
      return accounts.filter((acc) => {
        const mappedSlug = String(acc.mappedCardSlug || "").trim();
        return (
          !mappedSlug ||
          mappedSlug === "unknown" ||
          mappedSlug === "generic-credit"
        );
      });
    }
    return accounts;
  }, [accounts, accountFilter]);

  const reviewCount = accounts.filter((acc) => {
    const mappedSlug = String(acc.mappedCardSlug || "").trim();
    return (
      !mappedSlug || mappedSlug === "unknown" || mappedSlug === "generic-credit"
    );
  }).length;

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
      if (!res.ok || !json.ok)
        throw new Error(json?.error || "Failed to save mapping");
      setLinked(Array.isArray(json?.linked) ? json.linked : []);
      onChanged?.();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to save mapping"));
    } finally {
      setSaving(null);
    }
  }

  async function refreshMappings() {
    setSaving("refresh");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/plaid/remap-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json?.error || "Failed to refresh mappings");
      setLinked(Array.isArray(json?.linked) ? json.linked : []);
      onChanged?.();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to refresh mappings"));
    } finally {
      setSaving(null);
    }
  }

  async function clearLinked() {
    if (!window.confirm("Clear all linked accounts for this user?")) return;
    setSaving("clearing");
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/plaid/linked-accounts?userId=${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json?.error || "Failed to clear linked accounts");
      await load();
      onChanged?.();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to clear linked accounts"));
    } finally {
      setSaving(null);
    }
  }

  if (loading)
    return <div className="result-note">Loading linked accounts…</div>;

  return (
    <div className="linked-panel">
      <div className="linked-header">
        <h3>Linked accounts</h3>
        <p>Review auto-matches and correct any card that looks wrong.</p>
      </div>
      <div className="linked-summary">
        <div className="linked-stat">
          <strong>{accounts.length}</strong>
          <span>Credit accounts</span>
        </div>
        <div className="linked-stat">
          <strong>{accounts.length - reviewCount}</strong>
          <span>Auto-mapped</span>
        </div>
        <div className="linked-stat">
          <strong>{reviewCount}</strong>
          <span>Needs review</span>
        </div>
      </div>
      <div className="linked-filter-bar">
        <button
          type="button"
          className={
            accountFilter === "all"
              ? "linked-filter-button active"
              : "linked-filter-button"
          }
          onClick={() => setAccountFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={
            accountFilter === "needs_review"
              ? "linked-filter-button active"
              : "linked-filter-button"
          }
          onClick={() => setAccountFilter("needs_review")}
        >
          Needs review ({reviewCount})
        </button>
      </div>
      <p className="linked-help">
        If a card name looks wrong, choose the best matching card from the
        dropdown.
      </p>
      {error && <div className="linked-error">{error}</div>}
      {accounts.length === 0 ? (
        <div className="linked-empty">No credit card accounts found yet.</div>
      ) : (
        <div className="linked-list">
          {reviewAccounts.map((acc) => {
            const mappedSlug = String(acc.mappedCardSlug || "").trim();
            const mappedName = mappedSlug
              ? cardMap.get(mappedSlug) ||
                (mappedSlug === "generic-credit"
                  ? "Generic credit card"
                  : mappedSlug)
              : "";
            const isUnknown =
              !mappedSlug ||
              mappedSlug === "unknown" ||
              mappedSlug === "generic-credit";
            return (
              <div key={acc.accountId} className="linked-row">
                <div className="linked-meta">
                  <div className="linked-name">
                    {acc.name || acc.official_name || "Account"}
                  </div>
                  <div className="linked-sub">
                    {acc.type}/{acc.subtype} · •{acc.mask || "••••"}
                  </div>
                  {mappedName && !isUnknown ? (
                    <div className="linked-mapped">Mapped to {mappedName}</div>
                  ) : null}
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
                  <span
                    className={`linked-status ${isUnknown ? "warning" : "ok"}`}
                  >
                    {isUnknown ? "Needs review" : "Mapped"}
                  </span>
                </div>
                {saving === acc.accountId && (
                  <span className="linked-saving">saving…</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="linked-actions">
        <button onClick={load} className="linked-btn" disabled={!!saving}>
          Reload
        </button>
        <button
          onClick={refreshMappings}
          disabled={!!saving}
          className="linked-btn"
        >
          {saving === "refresh" ? "Matching…" : "Auto-match cards"}
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
