// extension/background.js

const DEFAULT_API_BASE = "http://localhost:5001";
const PAYMENT_DECISION_API_PATH = "/api/decisions/payment";
const ANALYTICS_EVENT_API_PATH = "/api/analytics/event";
const BACKGROUND_FETCH_TIMEOUT_MS = 2500;
// Keeping FIELDS here for later, but NOT sending it right now since your backend
// doesn't return `top` yet. You can re-enable once backend supports it.
const BEST_FIELDS =
  "top.card.slug,top.card.name,top.effectiveRate,top.estValueUSD,top.reason,top.confidence";

chrome.runtime.onInstalled.addListener(() => {
  trackAnalyticsEvent("extension_installed", {
    reason: "chrome_runtime_on_installed",
  });
  console.log("[Rewardly] background installed");
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
        const betaSessionToken = (await getSetting("BETA_SESSION_TOKEN")) || "";
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
          payload: safeDecisionLogPayload(decisionPayload),
        });
        const data = await fetchJsonWithFallback(
          apiBase,
          PAYMENT_DECISION_API_PATH,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(betaSessionToken
                ? { "X-Rewardly-Beta-Session": betaSessionToken }
                : {}),
            },
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
        sendResponse({
          ok: false,
          error: String(e?.message || e),
          code: e?.code || "REWARDLY_DECISION_ERROR",
        });
      }
    })();
    return true;
  }

  if (msg?.type === "REWARDLY_ANALYTICS_EVENT") {
    (async () => {
      try {
        await trackAnalyticsEvent(msg.event, msg.metadata || {});
        sendResponse({ ok: true });
      } catch (e) {
        rewardlyDebugLog(
          !!(await getSetting("DEBUG_LOGS")),
          "analytics event failed",
          {
            event: msg.event || null,
            message: String(e?.message || e),
          },
        );
        sendResponse({ ok: false, error: "analytics unavailable" });
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
    const payload = msg.payload || {};
    chrome.storage.sync.get(["MANUAL_CARD_SLUGS"], (previous) => {
      const before = Array.isArray(previous?.MANUAL_CARD_SLUGS)
        ? previous.MANUAL_CARD_SLUGS
        : [];
      const after = Array.isArray(payload?.MANUAL_CARD_SLUGS)
        ? payload.MANUAL_CARD_SLUGS
        : before;
      chrome.storage.sync.set(payload, () => {
        trackWalletChanges(before, after);
        sendResponse({ ok: true });
      });
    });
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

async function trackWalletChanges(before, after) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  if (!before.length && after.length) {
    await trackAnalyticsEvent("wallet_created", {
      walletCardCount: after.length,
    });
  }
  for (const slug of afterSet) {
    if (!beforeSet.has(slug)) {
      await trackAnalyticsEvent("card_added", {
        walletCardCount: after.length,
      });
    }
  }
  for (const slug of beforeSet) {
    if (!afterSet.has(slug)) {
      await trackAnalyticsEvent("card_removed", {
        walletCardCount: after.length,
      });
    }
  }
  if (before.length && !after.length) {
    await trackAnalyticsEvent("wallet_empty", {
      walletCardCount: 0,
    });
  }
}

async function trackAnalyticsEvent(event, metadata = {}) {
  if (!event || typeof event !== "string") return;
  const apiBase = (await getSetting("API_BASE")) || DEFAULT_API_BASE;
  const installationId = await getInstallationId();
  const body = {
    installationId,
    source: "chrome_extension",
    event,
    metadata: sanitizeAnalyticsMetadata(metadata),
  };
  try {
    await fetchJsonWithFallback(apiBase, ANALYTICS_EVENT_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    rewardlyDebugLog(!!(await getSetting("DEBUG_LOGS")), "analytics dropped", {
      event,
      message: String(error?.message || error),
    });
  }
}

async function getInstallationId() {
  const existing = await getSetting("INSTALLATION_ID");
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `rewardly-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await new Promise((resolve) => {
    chrome.storage.sync.set({ INSTALLATION_ID: generated }, resolve);
  });
  return generated;
}

function sanitizeAnalyticsMetadata(metadata) {
  const allowed = {};
  const keys = [
    "reason",
    "stage",
    "merchant",
    "hostname",
    "category",
    "hasRecommendation",
    "errorCode",
    "errorType",
    "walletCardCount",
    "popupVisible",
    "duplicateContext",
    "dismissedForMs",
  ];
  for (const key of keys) {
    const value = metadata?.[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      allowed[key] = value;
    }
  }
  return allowed;
}

function safeDecisionLogPayload(payload) {
  return {
    merchant: payload?.merchant || null,
    hostname: payload?.hostname || null,
    mcc: payload?.mcc || null,
    category: payload?.category || null,
    restrictToWallet: payload?.restrictToWallet !== false,
    checkoutStage: payload?.purchaseContext?.checkoutStage || null,
    walletCardCount: Array.isArray(payload?.manualCardSlugs)
      ? payload.manualCardSlugs.length
      : undefined,
  };
}

async function fetchJsonWithFallback(apiBase, path, options) {
  try {
    return await fetchJson(apiBase, path, options);
  } catch (err) {
    if (err?.code === "REWARDLY_TIMEOUT") throw err;
    if (apiBase && apiBase !== DEFAULT_API_BASE) {
      console.warn("[CCO] fetch failed, retrying default API base", err);
      return await fetchJson(DEFAULT_API_BASE, path, options);
    }
    throw err;
  }
}

async function fetchJson(apiBase, path, options) {
  const url = `${apiBase}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    BACKGROUND_FETCH_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(
        `Decision request timed out after ${BACKGROUND_FETCH_TIMEOUT_MS}ms`,
      );
      timeoutError.code = "REWARDLY_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
