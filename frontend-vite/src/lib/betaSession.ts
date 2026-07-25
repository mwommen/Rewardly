import { API_BASE } from "./api";

const SESSION_KEY = "rewardly-beta-session";

export type BetaSession = {
  token: string;
  user?: {
    name?: string;
    email?: string;
    status?: string;
  };
  activatedAt: string;
};

export function readBetaSession(): BetaSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BetaSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBetaSession(token: string, user?: BetaSession["user"]) {
  const session: BetaSession = {
    token,
    user,
    activatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearBetaSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export async function betaFetch(path: string, init: RequestInit = {}) {
  const session = readBetaSession();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export async function activateBetaSession(activationToken: string) {
  const res = await fetch(`${API_BASE}/api/beta/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activationToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Rewardly could not activate this invite.");
  }
  return writeBetaSession(data.sessionToken, data.user);
}

export async function verifyBetaSession() {
  const res = await betaFetch("/api/beta/session");
  if (!res.ok) {
    clearBetaSession();
    throw new Error("Rewardly beta access has expired.");
  }
  return res.json();
}

export async function loadBetaWallet() {
  const res = await betaFetch("/api/wallet");
  if (!res.ok) throw new Error("Rewardly could not load your wallet.");
  return res.json();
}

export async function createExtensionConnectionCode() {
  const res = await betaFetch("/api/beta/extension-connections", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Rewardly could not create a connection code.");
  }
  return data as { connectionCode: string; expiresAt: string };
}
