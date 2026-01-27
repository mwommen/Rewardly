// extension/popup.js
const apiBaseEl = document.getElementById("apiBase");
const userIdEl = document.getElementById("userId");
const saveBtn = document.getElementById("saveBtn");
const saved = document.getElementById("saved");

chrome.storage.sync.get(["API_BASE", "USER_ID"], (o) => {
  apiBaseEl.value = o?.API_BASE || "http://localhost:5001";
  userIdEl.value = o?.USER_ID || "devUser";
});

saveBtn.onclick = () => {
  chrome.runtime.sendMessage(
    {
      type: "CCO_SAVE_SETTINGS",
      payload: {
        API_BASE: apiBaseEl.value.trim(),
        USER_ID: userIdEl.value.trim() || "devUser",
      },
    },
    (resp) => {
      if (resp?.ok) {
        saved.style.display = "inline";
        setTimeout(() => (saved.style.display = "none"), 1200);
      }
    }
  );
};
