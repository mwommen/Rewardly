// extension/content.js
// Zero-input version: infer merchant from domain, no amount scraping.

console.log("[CCO] content loaded on", location.href);

const DEBOUNCE_MS = 400;
let lastHost = "";
let timer = null;

init();

function init() {
  detectAndRender();
  const obs = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(detectAndRender, DEBOUNCE_MS);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

function detectAndRender() {
  const host = location.hostname || "";
  if (!host || host === lastHost) return;
  lastHost = host;

  banner({ loading: true, note: `Detecting for ${host}…` });

  // Step 1: infer merchant (server-side; works for any domain)
  chrome.runtime.sendMessage({ type: "CCO_INFER", payload: { host } }, (inf) => {
    if (!inf?.ok) {
      banner({ error: `Infer failed: ${inf?.error || "unknown"}` });
      return;
    }
    const { merchantName, mcc } = inf.data || {};
    if (!merchantName) {
      banner({ error: "No merchant inferred" });
      return;
    }

    // Step 2: get best recommendation (no amount)
    chrome.runtime.sendMessage(
      { type: "CCO_RECOMMEND", payload: { merchant: merchantName, mcc } },
      (rec) => {
        if (!rec?.ok) {
          banner({ error: `Best failed: ${rec?.error || "unknown"}`, merchant: merchantName });
          return;
        }
        const top = rec.data?.top || null;
        if (!top) {
          banner({ error: "No recommendation found", merchant: merchantName });
          return;
        }
        banner({ result: top, merchant: merchantName });
      }
    );
  });
}

// ---- Banner UI ----
function banner({ loading, error, result, merchant, note }) {
  let host = document.getElementById("cco-banner");
  if (!host) {
    host = document.createElement("div");
    host.id = "cco-banner";
    Object.assign(host.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    });
    document.body.appendChild(host);
  }
  host.innerHTML = "";

  const card = document.createElement("div");
  Object.assign(card.style, {
    minWidth: "280px",
    maxWidth: "360px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#111827",
    color: "#fff",
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    border: "1px solid rgba(255,255,255,.12)"
  });

  const title = document.createElement("div");
  title.style.fontSize = "14px";
  title.style.opacity = ".9";
  title.textContent = `Best card here${merchant ? ` · ${merchant}` : ""}`;
  card.appendChild(title);

  const body = document.createElement("div");
  body.style.marginTop = "6px";
  body.style.fontSize = "14px";

  if (loading) body.textContent = note || "Analyzing…";
  else if (error) body.textContent = `CCO: ${error}`;
  else if (result) {
    const name = result?.card?.name || result?.name || "Unknown card";
    const er =
      result?.effectiveRate != null ? `${Math.round(result.effectiveRate * 1000) / 10}%` : "";
    const conf =
      result?.confidence != null ? ` · ${Math.round(result.confidence * 100)}% conf` : "";
    const reason = result?.reason ? `\n${sanitize(result.reason)}` : "";
    body.textContent = `${name} — ${er}${conf}${reason}`;
  } else {
    body.textContent = "No result";
  }

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.alignItems = "center";
  row.style.marginTop = "8px";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Dismiss";
  Object.assign(closeBtn.style, {
    fontSize: "12px",
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    cursor: "pointer"
  });
  closeBtn.onclick = () => host.remove();

  row.appendChild(closeBtn);
  card.appendChild(body);
  card.appendChild(row);
  host.appendChild(card);
}

function sanitize(s) {
  return String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}
