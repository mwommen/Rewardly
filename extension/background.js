// extension/background.js

const DEFAULT_API_BASE = "http://localhost:5001";
const PAYMENT_DECISION_API_PATH = "/api/decisions/payment";
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
        const data = await fetchJsonWithFallback(
          apiBase,
          `/api/merchant/infer?host=${encodeURIComponent(host)}`,
          { method: "GET" },
        );
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
        const settingsUserId = (await getSetting("USER_ID")) || "devUser";
        const storedManualCardSlugs =
          (await getSetting("MANUAL_CARD_SLUGS")) || [];
        const {
          merchant,
          mcc,
          userId = settingsUserId,
          restrictToLinked,
          manualCardSlugs,
        } = msg.payload || {};
        if (!merchant) throw new Error("merchant required");

        const path = "/api/cards/best-card-for-merchant";
        console.log("[CCO] best request:", `${apiBase}${path}`, merchant);

        const data = await fetchJsonWithFallback(apiBase, path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant,
            mcc,
            userId,
            ...(typeof restrictToLinked === "boolean"
              ? { restrictToLinked }
              : {}),
            manualCardSlugs: Array.isArray(manualCardSlugs)
              ? manualCardSlugs
              : storedManualCardSlugs,
          }),
          credentials: "include",
        });
        console.log("[CCO] best raw response:", data);

        const top = data?.bestCard
          ? {
              card: data.bestCard,
              reason: data.reason?.text || data.reason || null,
              matches: data.reason?.matches || [],
              credits: data.reason?.credits || [],
            }
          : null;
        const benefitMatches = Array.isArray(data?.benefitMatches)
          ? data.benefitMatches.map((m) => ({
              card: m.card,
              reason: m.reason?.text || m.reason || null,
              matches: m.reason?.matches || [],
              credits: m.reason?.credits || [],
            }))
          : [];

        sendResponse({
          ok: true,
          data: { top, benefitMatches, note: data?.note || null },
        });
      } catch (e) {
        console.error("[CCO] best error:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true; // keep channel open for async
  }

  if (msg?.type === "REWARDLY_PAYMENT_DECISION") {
    (async () => {
      try {
        const apiBase = (await getSetting("API_BASE")) || DEFAULT_API_BASE;
        const settingsUserId = (await getSetting("USER_ID")) || "devUser";
        const storedManualCardSlugs =
          (await getSetting("MANUAL_CARD_SLUGS")) || [];
        const debugLogs = !!(await getSetting("DEBUG_LOGS"));
        const payload = msg.payload || {};
        const decisionPayload = {
          ...payload,
          userId: payload.userId || settingsUserId,
          manualCardSlugs: Array.isArray(payload.manualCardSlugs)
            ? payload.manualCardSlugs
            : storedManualCardSlugs,
          restrictToWallet:
            typeof payload.restrictToWallet === "boolean"
              ? payload.restrictToWallet
              : true,
        };
        rewardlyDebugLog(debugLogs, "background decision request", {
          apiBase,
          payload: decisionPayload,
        });
        const data = await fetchJsonWithFallback(
          apiBase,
          PAYMENT_DECISION_API_PATH,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(decisionPayload),
            credentials: "include",
          },
        );
        rewardlyDebugLog(debugLogs, "background decision response", {
          hasDecision: !!data?.decision,
          hasRecommendation: !!data?.decision?.recommendedCard,
          cardSlug: data?.decision?.recommendedCard?.card?.slug || null,
          merchant: data?.decision?.merchant?.name || null,
        });
        sendResponse({ ok: true, data });
      } catch (e) {
        console.error("[Rewardly] pipeline-failed", {
          stage: "background-payment-decision",
          url: msg?.payload?.url || null,
          merchant: msg?.payload?.merchant || null,
          message: String(e?.message || e),
        });
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "CCO_GET_USER_BENEFIT_STATES") {
    (async () => {
      try {
        const apiBase = (await getSetting("API_BASE")) || DEFAULT_API_BASE;
        const settingsUserId = (await getSetting("USER_ID")) || "devUser";
        const userId = msg.payload?.userId || settingsUserId;
        const path = `/api/user-benefits?userId=${encodeURIComponent(userId)}`;
        const data = await fetchJsonWithFallback(apiBase, path, {
          method: "GET",
        });
        sendResponse({ ok: true, data });
      } catch (e) {
        console.error("[CCO] benefit states error:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "CCO_GET_USER_BENEFIT_SUMMARY") {
    (async () => {
      try {
        const apiBase = (await getSetting("API_BASE")) || DEFAULT_API_BASE;
        const settingsUserId = (await getSetting("USER_ID")) || "devUser";
        const userId = msg.payload?.userId || settingsUserId;
        const path = `/api/user-benefits/summary?userId=${encodeURIComponent(userId)}`;
        const data = await fetchJsonWithFallback(apiBase, path, {
          method: "GET",
        });
        sendResponse({ ok: true, data });
      } catch (e) {
        console.error("[CCO] benefit summary error:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "CCO_SAVE_BENEFIT_STATE") {
    (async () => {
      try {
        const apiBase = (await getSetting("API_BASE")) || DEFAULT_API_BASE;
        const settingsUserId = (await getSetting("USER_ID")) || "devUser";
        const {
          userId = settingsUserId,
          benefitKey,
          ...state
        } = msg.payload || {};
        if (!benefitKey) throw new Error("benefitKey required");
        const data = await fetchJsonWithFallback(
          apiBase,
          "/api/user-benefits/state",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, benefitKey, ...state }),
          },
        );
        sendResponse({ ok: true, data });
      } catch (e) {
        console.error("[CCO] save benefit state error:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "CCO_SAVE_SETTINGS") {
    chrome.storage.sync.set(msg.payload || {}, () =>
      sendResponse({ ok: true }),
    );
    return true;
  }
});

async function getSetting(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get([key], (o) => resolve(o?.[key]));
  });
}

function rewardlyDebugLog(enabled, label, data) {
  if (!enabled) return;
  console.log(`[Rewardly] ${label}`, data || {});
}

async function fetchJsonWithFallback(apiBase, path, options) {
  try {
    return await fetchJson(apiBase, path, options);
  } catch (err) {
    if (apiBase && apiBase !== DEFAULT_API_BASE) {
      console.warn("[CCO] fetch failed, retrying default API base", err);
      return await fetchJson(DEFAULT_API_BASE, path, options);
    }
    throw err;
  }
}

async function fetchJson(apiBase, path, options) {
  const url = `${apiBase}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}
