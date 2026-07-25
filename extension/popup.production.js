const CONFIG = globalThis.REWARDLY_CONFIG || {};
const API_BASE = CONFIG.API_BASE;
const APP_URL = CONFIG.APP_URL;

const els = {
  statusPill: document.getElementById("statusPill"),
  stateTitle: document.getElementById("stateTitle"),
  stateBody: document.getElementById("stateBody"),
  connectPanel: document.getElementById("connectPanel"),
  walletPanel: document.getElementById("walletPanel"),
  walletList: document.getElementById("walletList"),
  actionsPanel: document.getElementById("actionsPanel"),
  message: document.getElementById("message"),
  connectForm: document.getElementById("connectForm"),
  connectionCode: document.getElementById("connectionCode"),
  retryBtn: document.getElementById("retryBtn"),
  clearSessionBtn: document.getElementById("clearSessionBtn"),
  openRewardly: document.getElementById("openRewardly"),
};

init();

function init() {
  els.connectForm.addEventListener("submit", redeemConnectionCode);
  els.retryBtn.addEventListener("click", validateSession);
  els.clearSessionBtn.addEventListener("click", clearSession);
  els.openRewardly.addEventListener("click", () => {
    chrome.tabs.create({ url: APP_URL || "https://rewardly.app" });
  });
  validateSession();
}

async function validateSession() {
  setState("checking");
  chrome.runtime.sendMessage({ type: "REWARDLY_VALIDATE_SESSION" }, async (resp) => {
    if (resp?.ok) {
      await loadWallet();
      return;
    }
    if (resp?.state === "expired") {
      setState("expired");
      return;
    }
    setState("not_connected");
  });
}

async function redeemConnectionCode(event) {
  event.preventDefault();
  const connectionCode = els.connectionCode.value.trim();
  if (!connectionCode) {
    showMessage("Enter the one-time code from Rewardly.", true);
    return;
  }
  setState("checking");
  chrome.runtime.sendMessage(
    { type: "REWARDLY_REDEEM_CONNECTION_CODE", connectionCode },
    async (resp) => {
      if (!resp?.ok) {
        setState("not_connected");
        showMessage("That code is invalid, expired, or already used.", true);
        return;
      }
      els.connectionCode.value = "";
      await loadWallet();
    },
  );
}

async function loadWallet() {
  const token = await localValue("SESSION_TOKEN");
  if (!token) return setState("not_connected");
  try {
    const res = await fetch(`${API_BASE}/api/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      await clearLocalSession();
      return setState("expired");
    }
    if (!res.ok) return setState("backend_unavailable");
    const data = await res.json();
    renderWallet(data?.wallet?.cardSlugs || []);
  } catch {
    setState("backend_unavailable");
  }
}

function renderWallet(cardSlugs) {
  els.walletList.textContent = "";
  if (!cardSlugs.length) {
    setState("empty_wallet");
    const empty = document.createElement("p");
    empty.textContent = "Add cards on Rewardly so recommendations are personalized.";
    els.walletList.appendChild(empty);
    return;
  }
  setState("ready");
  cardSlugs.forEach((slug) => {
    const row = document.createElement("div");
    row.className = "card-row";
    row.textContent = titleCase(slug.replace(/-/g, " "));
    els.walletList.appendChild(row);
  });
}

async function clearSession() {
  await clearLocalSession();
  chrome.runtime.sendMessage({ type: "REWARDLY_CLEAR_SESSION" }, () => {
    setState("not_connected");
  });
}

function setState(state) {
  hideAll();
  showMessage("");
  if (state === "checking") {
    els.statusPill.textContent = "Checking";
    els.stateTitle.textContent = "Checking your connection...";
    els.stateBody.textContent = "Rewardly is verifying your beta access.";
    return;
  }
  if (state === "not_connected") {
    els.statusPill.textContent = "Not connected";
    els.stateTitle.textContent = "Connect Rewardly";
    els.stateBody.textContent =
      "Activate on the Rewardly website, then connect this extension once.";
    els.connectPanel.classList.remove("hidden");
    return;
  }
  if (state === "empty_wallet") {
    els.statusPill.textContent = "Connected";
    els.stateTitle.textContent = "Your wallet is empty";
    els.stateBody.textContent =
      "Add payment methods on Rewardly before testing checkout recommendations.";
    els.walletPanel.classList.remove("hidden");
    els.actionsPanel.classList.remove("hidden");
    return;
  }
  if (state === "ready") {
    els.statusPill.textContent = "Active";
    els.stateTitle.textContent = "Rewardly is ready";
    els.stateBody.textContent =
      "Shop normally. Rewardly appears when you reach supported checkout payment steps.";
    els.walletPanel.classList.remove("hidden");
    els.actionsPanel.classList.remove("hidden");
    return;
  }
  if (state === "expired") {
    els.statusPill.textContent = "Reconnect";
    els.stateTitle.textContent = "Access expired";
    els.stateBody.textContent =
      "Your beta session was revoked or expired. Reconnect from Rewardly.";
    els.connectPanel.classList.remove("hidden");
    return;
  }
  els.statusPill.textContent = "Retry";
  els.stateTitle.textContent = "Rewardly is temporarily unavailable";
  els.stateBody.textContent = "We could not reach Rewardly. Try again shortly.";
  els.actionsPanel.classList.remove("hidden");
}

function hideAll() {
  [els.connectPanel, els.walletPanel, els.actionsPanel].forEach((el) =>
    el.classList.add("hidden"),
  );
}

function showMessage(message, isError = false) {
  els.message.textContent = message;
  els.message.className = `message${isError ? " error" : ""}`;
}

function localValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (value) => resolve(value?.[key] || ""));
  });
}

function clearLocalSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      ["SESSION_TOKEN", "BETA_USER", "SESSION_CONNECTED_AT"],
      resolve,
    );
  });
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
