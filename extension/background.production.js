const CONFIG = globalThis.REWARDLY_CONFIG || {};
const API_BASE = CONFIG.API_BASE;
const PAYMENT_DECISION_API_PATH = "/api/decisions/payment";
const ANALYTICS_EVENT_API_PATH = "/api/analytics/event";
const FEEDBACK_API_PATH = "/api/feedback";
const FETCH_TIMEOUT_MS = 2500;

chrome.runtime.onInstalled.addListener(() => {
  trackAnalyticsEvent("extension_installed", {
    reason: "chrome_runtime_on_installed",
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "REWARDLY_PAYMENT_DECISION") {
    (async () => {
      try {
        const sessionToken = await getSessionToken();
        if (!sessionToken) throw new Error("Rewardly beta access is required.");
        const payload = {
          ...(msg.payload || {}),
          restrictToWallet: true,
        };
        delete payload["user" + "Id"];
        delete payload.manualCardSlugs;
        const data = await fetchJson(PAYMENT_DECISION_API_PATH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(payload),
        });
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({
          ok: false,
          error: "Rewardly could not check your wallet.",
          code: error?.code || "REWARDLY_DECISION_ERROR",
        });
      }
    })();
    return true;
  }

  if (msg?.type === "REWARDLY_REDEEM_CONNECTION_CODE") {
    (async () => {
      try {
        const data = await fetchJson("/api/beta/extension-connections/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionCode: String(msg.connectionCode || "").trim(),
          }),
        });
        await setLocalSession(data.sessionToken, data.user || null);
        sendResponse({ ok: true, user: data.user || null });
      } catch {
        sendResponse({
          ok: false,
          error: "Rewardly could not connect this extension.",
        });
      }
    })();
    return true;
  }

  if (msg?.type === "REWARDLY_VALIDATE_SESSION") {
    (async () => {
      try {
        const sessionToken = await getSessionToken();
        if (!sessionToken) {
          return sendResponse({ ok: false, state: "not_connected" });
        }
        const data = await fetchJson("/api/beta/session", {
          method: "GET",
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        sendResponse({ ok: true, user: data.user || null });
      } catch {
        await clearLocalSession();
        sendResponse({ ok: false, state: "expired" });
      }
    })();
    return true;
  }

  if (msg?.type === "REWARDLY_CLEAR_SESSION") {
    clearLocalSession().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "REWARDLY_ANALYTICS_EVENT") {
    trackAnalyticsEvent(msg.event, msg.metadata || {}).then(() =>
      sendResponse({ ok: true }),
    );
    return true;
  }

  if (msg?.type === "REWARDLY_FEEDBACK_EVENT") {
    sendFeedbackEvent(msg.payload || {})
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false, error: "feedback unavailable" }));
    return true;
  }
});

async function trackAnalyticsEvent(event, metadata = {}) {
  if (!event || typeof event !== "string") return;
  try {
    await fetchJson(ANALYTICS_EVENT_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: await getInstallationId(),
        source: "chrome_extension",
        event,
        metadata: sanitizeMetadata(metadata),
      }),
    });
  } catch {
    // Analytics must never interrupt checkout.
  }
}

async function sendFeedbackEvent(payload = {}) {
  await fetchJson(FEEDBACK_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installationId: await getInstallationId(),
      ...sanitizeFeedbackPayload(payload),
      extensionVersion: chrome.runtime.getManifest?.().version || "unknown",
    }),
  });
}

async function getSessionToken() {
  return (await getLocal("SESSION_TOKEN")) || "";
}

async function setLocalSession(sessionToken, user) {
  return setLocal({
    SESSION_TOKEN: sessionToken,
    BETA_USER: user || null,
    SESSION_CONNECTED_AT: new Date().toISOString(),
  });
}

async function clearLocalSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      ["SESSION_TOKEN", "BETA_USER", "SESSION_CONNECTED_AT"],
      resolve,
    );
  });
}

async function getInstallationId() {
  const existing = await getLocal("INSTALLATION_ID");
  if (existing) return existing;
  const generated = crypto.randomUUID();
  await setLocal({ INSTALLATION_ID: generated });
  return generated;
}

function getLocal(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (value) => resolve(value?.[key]));
  });
}

function setLocal(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

async function fetchJson(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Rewardly request timed out.");
      timeoutError.code = "REWARDLY_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeMetadata(metadata) {
  const allowed = {};
  for (const key of [
    "sessionId",
    "reason",
    "stage",
    "merchant",
    "hostname",
    "category",
    "confidenceLabel",
    "confidenceBand",
    "recommendationLatencyMs",
    "popupLatencyMs",
    "errorCode",
    "errorType",
    "walletCardCount",
  ]) {
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

function sanitizeFeedbackPayload(payload) {
  const allowed = {};
  for (const key of [
    "type",
    "sessionId",
    "merchantName",
    "merchantDomain",
    "merchantCategory",
    "confidenceBand",
    "recommendedCardName",
    "reason",
    "comment",
  ]) {
    const value = payload?.[key];
    if (typeof value === "string") {
      allowed[key] = value.slice(0, key === "comment" ? 250 : 140);
    }
  }
  return allowed;
}
