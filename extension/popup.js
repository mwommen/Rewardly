// extension/popup.js
const apiBaseEl = document.getElementById("apiBase");
const saveBtn = document.getElementById("saveBtn");
const saved = document.getElementById("saved");

chrome.storage.sync.get(["API_BASE"], (o) => {
  apiBaseEl.value = o?.API_BASE || "http://localhost:5001";
});

saveBtn.onclick = () => {
  chrome.runtime.sendMessage(
    { type: "CCO_SAVE_SETTINGS", payload: { API_BASE: apiBaseEl.value.trim() } },
    (resp) => {
      if (resp?.ok) {
        saved.style.display = "inline";
        setTimeout(() => (saved.style.display = "none"), 1200);
      }
    }
  );
};
