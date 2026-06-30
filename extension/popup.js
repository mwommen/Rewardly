// extension/popup.js
const apiBaseEl = document.getElementById("apiBase");
const userIdEl = document.getElementById("userId");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const saved = document.getElementById("saved");
const walletCount = document.getElementById("walletCount");
const cardSearch = document.getElementById("cardSearch");
const cardList = document.getElementById("cardList");
const quickButtons = {
  demoAmexGold: "amex-gold",
  demoPlatinum: "amex-platinum",
  demoVentureX: "capital-one-venture-x",
};

let allCards = [];
let selectedSlugs = new Set();

chrome.storage.sync.get(["API_BASE", "USER_ID", "MANUAL_CARD_SLUGS"], (o) => {
  apiBaseEl.value = o?.API_BASE || "http://localhost:5001";
  userIdEl.value = o?.USER_ID || "devUser";
  selectedSlugs = new Set(Array.isArray(o?.MANUAL_CARD_SLUGS) ? o.MANUAL_CARD_SLUGS : []);
  updateCount();
  loadCards();
});

Object.entries(quickButtons).forEach(([id, slug]) => {
  document.getElementById(id)?.addEventListener("click", () => {
    selectedSlugs.add(slug);
    renderCards();
    saveSettings();
  });
});

cardSearch.addEventListener("input", renderCards);
saveBtn.addEventListener("click", saveSettings);
clearBtn.addEventListener("click", () => {
  selectedSlugs = new Set();
  renderCards();
  saveSettings();
});

async function loadCards() {
  const apiBase = apiBaseEl.value.trim() || "http://localhost:5001";
  cardList.innerHTML = `<p class="muted">Loading card catalog…</p>`;
  try {
    const res = await fetch(`${apiBase}/api/cards/slugs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allCards = Array.isArray(data?.slugs)
      ? data.slugs
          .filter((card) => card?.slug && card?.name)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      : [];
    renderCards();
  } catch (err) {
    cardList.innerHTML = `<p class="muted">Could not load cards. Confirm the backend is running on ${apiBase}.</p>`;
    console.warn("Rewardly card catalog load failed", err);
  }
}

function renderCards() {
  const term = cardSearch.value.trim().toLowerCase();
  const visible = allCards
    .filter((card) => {
      if (!term) return selectedSlugs.has(card.slug) || isCommonDemoCard(card.slug);
      return `${card.name} ${card.slug}`.toLowerCase().includes(term);
    })
    .slice(0, 60);

  if (!visible.length) {
    cardList.innerHTML = `<p class="muted">No cards found. Try another search.</p>`;
    updateCount();
    return;
  }

  cardList.innerHTML = "";
  visible.forEach((card) => {
    const label = document.createElement("label");
    label.className = "card-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedSlugs.has(card.slug);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedSlugs.add(card.slug);
      else selectedSlugs.delete(card.slug);
      updateCount();
    });
    const text = document.createElement("span");
    text.textContent = card.name;
    label.appendChild(checkbox);
    label.appendChild(text);
    cardList.appendChild(label);
  });
  updateCount();
}

function saveSettings() {
  chrome.runtime.sendMessage(
    {
      type: "CCO_SAVE_SETTINGS",
      payload: {
        API_BASE: apiBaseEl.value.trim() || "http://localhost:5001",
        USER_ID: userIdEl.value.trim() || "devUser",
        MANUAL_CARD_SLUGS: Array.from(selectedSlugs),
      },
    },
    (resp) => {
      if (resp?.ok) {
        updateCount();
        saved.style.display = "block";
        setTimeout(() => (saved.style.display = "none"), 1800);
      }
    }
  );
}

function updateCount() {
  const count = selectedSlugs.size;
  walletCount.textContent = `${count} card${count === 1 ? "" : "s"}`;
}

function isCommonDemoCard(slug) {
  return [
    "amex-gold",
    "amex-platinum",
    "chase-sapphire-reserve",
    "chase-sapphire-preferred",
    "capital-one-venture-x",
    "citi-custom-cash",
  ].includes(slug);
}
