// extension/background.js

const DEFAULT_API_BASE = "http://localhost:5001";
// Keeping FIELDS here for later, but NOT sending it right now since your backend
// doesn't return `top` yet. You can re-enable once backend supports it.
const BEST_FIELDS =
  "top.card.slug,top.card.name,top.effectiveRate,top.estValueUSD,top.reason,top.confidence";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[CCO] background installed");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Optional: backend merchant inference if your content.js sends CCO_INFER
  if (msg?.type === "CCO_INFER") {
    (async () => {
      try {
        const apiBase = (await getSetting("API_BASE")) || DEFAULT_API_BASE;
        const host = msg.payload?.host || "";
        console.log("[CCO] infer request for host:", host);
        const res = await fetch(`${apiBase}/api/merchant/infer?host=${encodeURIComponent(host)}`);
        if (!res.ok) throw new Error(`infer HTTP ${res.status}`);
        const data = await res.json();
        console.log("[CCO] infer response:", data);
        sendResponse({ ok: true, data });
      } catch (e) {
        console.error("[CCO] infer error:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true; // keep channel open for async
  }

  if (msg?.type === "CCO_RECOMMEND") {
    (async () => {
      try {
        const apiBase = (await getSetting("API_BASE")) || DEFAULT_API_BASE;
        const { merchant, mcc, restrictToOwned = false, userId = "devUser" } = msg.payload || {};

        // Build query. We intentionally DO NOT include `fields` for now because
        // your backend currently returns `recommendations` and not `top`.
        const params = new URLSearchParams({
          merchant: merchant || "",
          amount: "1" // harmless fallback to satisfy any required param
        });
        if (mcc) params.set("mcc", String(mcc));
        if (restrictToOwned) {
          params.set("restrictToOwned", "true");
          params.set("userId", userId);
        }

        const url = `${apiBase}/api/recommendations/best?${params.toString()}`;
        console.log("[CCO] best request:", url);

        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`best HTTP ${res.status}`);

        const data = await res.json();
        console.log("[CCO] best raw response:", data);

        // ✅ Normalize: prefer data.top, otherwise first of data.recommendations
        const top =
          (data && (data.top || (Array.isArray(data.recommendations) ? data.recommendations[0] : null))) ||
          null;

        console.log("[CCO] best normalized top:", top);
        sendResponse({ ok: true, data: { top } });
      } catch (e) {
        console.error("[CCO] best error:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true; // keep channel open for async
  }

  if (msg?.type === "CCO_SAVE_SETTINGS") {
    chrome.storage.sync.set(msg.payload || {}, () => sendResponse({ ok: true }));
    return true;
  }
});

async function getSetting(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get([key], (o) => resolve(o?.[key]));
  });
}
