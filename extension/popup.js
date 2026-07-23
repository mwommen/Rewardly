// extension/popup.js
const DEFAULT_API_BASE = "http://localhost:5001";
const SAVE_MESSAGE_MS = 1800;

const apiBaseEl = document.getElementById("apiBase");
const userIdEl = document.getElementById("userId");
const betaSessionTokenEl = document.getElementById("betaSessionToken");
const clearBtn = document.getElementById("clearBtn");
const saved = document.getElementById("saved");
const walletCount = document.getElementById("walletCount");
const selectedWallet = document.getElementById("selectedWallet");
const cardSearch = document.getElementById("cardSearch");
const cardList = document.getElementById("cardList");
const debugLogs = document.getElementById("debugLogs");

const quickButtons = {
  demoAmexGold: "amex-gold",
  demoPlatinum: "amex-platinum",
  demoVentureX: "capital-one-venture-x",
};

let allCards = [];
let selectedSlugs = new Set();
let saveTimer = null;

const chromeApi =
  typeof chrome !== "undefined" && chrome?.runtime && chrome?.storage
    ? chrome
    : null;

loadSettings();
trackPopupEvent("extension_popup_opened");

Object.entries(quickButtons).forEach(([id, slug]) => {
  document.getElementById(id)?.addEventListener("click", () => {
    if (selectedSlugs.has(slug)) selectedSlugs.delete(slug);
    else selectedSlugs.add(slug);
    renderAll();
    saveSettings("Wallet updated.");
  });
});

cardSearch.addEventListener("input", renderCards);

clearBtn.addEventListener("click", () => {
  selectedSlugs = new Set();
  renderAll();
  saveSettings("Wallet cleared.");
});

[apiBaseEl, userIdEl, betaSessionTokenEl].forEach((input) => {
  input.addEventListener("change", () => {
    saveSettings("Developer settings saved.");
    if (input === apiBaseEl) loadCards();
  });
});

debugLogs.addEventListener("change", () => {
  saveSettings("Developer settings saved.");
});

function loadSettings() {
  if (!chromeApi) {
    apiBaseEl.value = DEFAULT_API_BASE;
    userIdEl.value = "devUser";
    renderAll();
    loadCards();
    return;
  }

  chromeApi.storage.sync.get(
    [
      "API_BASE",
      "USER_ID",
      "BETA_SESSION_TOKEN",
      "MANUAL_CARD_SLUGS",
      "DEBUG_LOGS",
    ],
    (settings) => {
      apiBaseEl.value = settings?.API_BASE || DEFAULT_API_BASE;
      userIdEl.value = settings?.USER_ID || "devUser";
      betaSessionTokenEl.value = settings?.BETA_SESSION_TOKEN || "";
      debugLogs.checked = !!settings?.DEBUG_LOGS;
      selectedSlugs = new Set(
        Array.isArray(settings?.MANUAL_CARD_SLUGS)
          ? settings.MANUAL_CARD_SLUGS
          : [],
      );
      renderAll();
      loadCards();
    },
  );
}

async function loadCards() {
  const apiBase = apiBaseEl.value.trim() || DEFAULT_API_BASE;
  cardList.innerHTML = `<p class="empty-wallet">Loading card options...</p>`;
  try {
    const res = await fetch(`${apiBase}/api/cards/slugs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allCards = Array.isArray(data?.slugs)
      ? data.slugs
          .filter((card) => card?.slug && card?.name)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      : [];
    renderAll();
  } catch (err) {
    cardList.innerHTML = `<p class="empty-wallet">Rewardly couldn't load the card list. Try again later.</p>`;
    trackPopupEvent("wallet_load_failed", {
      errorType: "card_catalog_unavailable",
    });
    console.warn("Rewardly card catalog load failed", err);
  }
}

function renderAll() {
  updateCount();
  renderSelectedWallet();
  renderCards();
  updateQuickButtons();
}

function renderSelectedWallet() {
  const selectedCards = Array.from(selectedSlugs).map(cardForSlug);

  if (!selectedCards.length) {
    selectedWallet.innerHTML = `<p class="empty-wallet">Add the cards you carry to personalize checkout recommendations.</p>`;
    return;
  }

  selectedWallet.innerHTML = "";
  selectedCards.forEach((card) => {
    const row = document.createElement("div");
    row.className = "selected-card";

    const mark = document.createElement("span");
    mark.className = "card-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = cardInitials(card.name);

    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = card.name;
    const helper = document.createElement("span");
    helper.textContent = "Ready for checkout recommendations";
    copy.appendChild(name);
    copy.appendChild(helper);

    const remove = document.createElement("button");
    remove.className = "remove-card";
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${card.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      selectedSlugs.delete(card.slug);
      renderAll();
      saveSettings("Wallet updated.");
    });

    row.appendChild(mark);
    row.appendChild(copy);
    row.appendChild(remove);
    selectedWallet.appendChild(row);
  });
}

function renderCards() {
  const term = cardSearch.value.trim().toLowerCase();
  const visible = allCards
    .filter((card) => {
      if (!term) return selectedSlugs.has(card.slug) || isCommonCard(card.slug);
      return `${card.name} ${card.slug}`.toLowerCase().includes(term);
    })
    .slice(0, 60);

  if (!visible.length) {
    cardList.innerHTML = `<p class="empty-wallet">No cards found. Try another card name or issuer.</p>`;
    return;
  }

  cardList.innerHTML = "";
  visible.forEach((card) => {
    const selected = selectedSlugs.has(card.slug);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card-option${selected ? " selected" : ""}`;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      `${selected ? "Remove" : "Add"} ${card.name}`,
    );
    button.addEventListener("click", () => {
      if (selectedSlugs.has(card.slug)) selectedSlugs.delete(card.slug);
      else selectedSlugs.add(card.slug);
      renderAll();
      saveSettings("Wallet updated.");
    });

    const mark = document.createElement("span");
    mark.className = "card-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = cardInitials(card.name);

    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = card.name;
    const helper = document.createElement("span");
    helper.textContent = selected ? "In your wallet" : "Tap to add";
    copy.appendChild(name);
    copy.appendChild(helper);

    const state = document.createElement("span");
    state.className = "add-state";
    state.textContent = selected ? "Added" : "Add";

    button.appendChild(mark);
    button.appendChild(copy);
    button.appendChild(state);
    cardList.appendChild(button);
  });
}

function saveSettings(message = "Saved.") {
  if (saveTimer) window.clearTimeout(saveTimer);

  const payload = {
    API_BASE: apiBaseEl.value.trim() || DEFAULT_API_BASE,
    USER_ID: userIdEl.value.trim() || "devUser",
    BETA_SESSION_TOKEN: betaSessionTokenEl.value.trim(),
    MANUAL_CARD_SLUGS: Array.from(selectedSlugs),
    DEBUG_LOGS: !!debugLogs.checked,
  };

  if (!chromeApi) {
    showSaved(message);
    return;
  }

  chromeApi.runtime.sendMessage(
    {
      type: "CCO_SAVE_SETTINGS",
      payload,
    },
    (resp) => {
      if (resp?.ok) showSaved(message);
    },
  );
}

function showSaved(message) {
  saved.textContent = message;
  saveTimer = window.setTimeout(() => {
    saved.textContent = "";
  }, SAVE_MESSAGE_MS);
}

function updateCount() {
  const count = selectedSlugs.size;
  walletCount.textContent = `${count} card${count === 1 ? "" : "s"}`;
}

function updateQuickButtons() {
  Object.entries(quickButtons).forEach(([id, slug]) => {
    const button = document.getElementById(id);
    if (!button) return;
    const selected = selectedSlugs.has(slug);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected
      ? `${shortCardName(slug)} added`
      : shortCardName(slug);
  });
}

function cardForSlug(slug) {
  return (
    allCards.find((card) => card.slug === slug) || {
      slug,
      name: titleCase(slug.replace(/-/g, " ")),
    }
  );
}

function cardInitials(name) {
  const cleaned = String(name || "Card")
    .replace(/\b(the|card|from|american|express|rewards|credit)\b/gi, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "C") + (parts[1]?.[0] || "");
}

function shortCardName(slug) {
  const names = {
    "amex-gold": "Amex Gold",
    "amex-platinum": "Amex Platinum",
    "capital-one-venture-x": "Venture X",
  };
  return names[slug] || titleCase(slug.replace(/-/g, " "));
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isCommonCard(slug) {
  return [
    "amex-gold",
    "amex-platinum",
    "chase-sapphire-reserve",
    "chase-sapphire-preferred",
    "capital-one-venture-x",
    "capital-one-venture-rewards",
    "citi-custom-cash",
  ].includes(slug);
}

function trackPopupEvent(event, metadata = {}) {
  if (!chromeApi) return;
  try {
    chromeApi.runtime.sendMessage({
      type: "REWARDLY_ANALYTICS_EVENT",
      event,
      metadata,
    });
  } catch (error) {
    console.warn("Rewardly analytics event failed", error);
  }
}
