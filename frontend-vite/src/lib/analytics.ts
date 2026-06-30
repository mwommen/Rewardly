import { API_BASE } from "./api";

export type AnalyticsMetadata = Record<string, unknown>;

export function trackEvent(event: string, metadata: AnalyticsMetadata = {}) {
  if (!event) return;
  const payload = {
    userId: localStorage.getItem("cco_user_id") || "devUser",
    event,
    metadata,
  };

  if (typeof window !== "undefined" && window.navigator && window.navigator.sendBeacon) {
    try {
      const url = `${API_BASE}/api/analytics/event`;
      const body = JSON.stringify(payload);
      window.navigator.sendBeacon(url, body);
      return;
    } catch {
      // fallback to fetch
    }
  }

  fetch(`${API_BASE}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn("Analytics event failed:", err);
  });
}
