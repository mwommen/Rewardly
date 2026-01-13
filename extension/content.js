// extension/content.js
// Zero-input version: infer merchant from domain, no amount scraping.

console.log("[CCO] content loaded on", location.href);

const DEBOUNCE_MS = 400;
const RETRY_MS = 5000;
let lastHost = "";
let lastAttemptAt = 0;
let timer = null;
let inFlight = false;
let lastHadBenefit = false;

const CARD_LOGOS = {
  "amex-gold": "amex-gold.png",
  "amex-platinum": "amex-platinum.png",
  "chase-sapphire-preferred": "chase-sapphire-preferred.png",
  "chase-freedom-unlimited": "chase-freedom-unlimited.png",
  "citi-custom-cash": "citi-custom-cash.png",
  "capital-one-savorone": "capital-one-savorone.png",
  "capital-one-venture-x": "capital-one-venture-x.png",
};

const CARD_ENROLL_URLS = {
  "amex-gold": "https://www.americanexpress.com/en-us/benefits/the-gold-card/",
  "amex-platinum": "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
  "chase-sapphire-preferred": "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
  "chase-freedom-unlimited": "https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited",
  "citi-custom-cash": "https://www.citi.com/credit-cards/citi-custom-cash-credit-card",
  "capital-one-savorone": "https://www.capitalone.com/credit-cards/savorone/",
  "capital-one-venture-x": "https://www.capitalone.com/credit-cards/venture-x/",
};

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
  if (!isCheckoutPage()) {
    removeBanner();
    return;
  }

  const host = location.hostname || "";
  if (!host) return;
  const now = Date.now();
  const hasBanner = Boolean(document.getElementById("cco-banner"));
  if (host === lastHost && hasBanner && now - lastAttemptAt < RETRY_MS) return;
  if (host !== lastHost) {
    lastHost = host;
    lastHadBenefit = false;
  }
  lastAttemptAt = now;

  if (isSnoozed(host)) {
    removeBanner();
    return;
  }

  if (inFlight) return;
  inFlight = true;

  // Step 1: infer merchant (server-side; works for any domain)
  chrome.runtime.sendMessage({ type: "CCO_INFER", payload: { host } }, (inf) => {
    if (!inf?.ok) {
      inFlight = false;
      return;
    }
    const { merchantName, mcc } = inf.data || {};
    if (!merchantName) {
      inFlight = false;
      return;
    }

    // Step 2: get best recommendation (no amount)
    chrome.storage.sync.get(["USER_ID"], (o) => {
      const userId = o?.USER_ID || "devUser";
      const firstPayload = { merchant: merchantName, mcc, userId, restrictToLinked: true };
      chrome.runtime.sendMessage({ type: "CCO_RECOMMEND", payload: firstPayload }, (rec) => {
        if (!rec?.ok) {
          inFlight = false;
          return;
        }
        const top = rec.data?.top || null;
        const benefitMatches = rec.data?.benefitMatches || [];
        const topMatches = Array.isArray(top?.matches) ? top.matches : [];
        const hasAnyBenefit = benefitMatches.length || topMatches.length;
        const noLinkedCards = typeof rec.data?.note === "string" && rec.data.note.includes("No linked cards");

        if (hasAnyBenefit) {
          banner({ result: top, merchant: merchantName, matches: benefitMatches });
          lastHadBenefit = true;
          inFlight = false;
          return;
        }

        if (!noLinkedCards) {
          removeBanner();
          lastHadBenefit = false;
          inFlight = false;
          return;
        }

        chrome.runtime.sendMessage(
          {
            type: "CCO_RECOMMEND",
            payload: { merchant: merchantName, mcc, userId, restrictToLinked: false },
          },
          (fallback) => {
            if (!fallback?.ok) {
              removeBanner();
              lastHadBenefit = false;
              inFlight = false;
              return;
            }
            const fbTop = fallback.data?.top || null;
            const fbMatches = fallback.data?.benefitMatches || [];
            const fbTopMatches = Array.isArray(fbTop?.matches) ? fbTop.matches : [];
            const fbHasAnyBenefit = fbMatches.length || fbTopMatches.length;
            if (!fbHasAnyBenefit) {
              removeBanner();
              lastHadBenefit = false;
              inFlight = false;
              return;
            }
            banner({ result: fbTop, merchant: merchantName, matches: fbMatches });
            lastHadBenefit = true;
            inFlight = false;
          }
        );
      });
    });
  });
}

// ---- Banner UI ----
function banner({ loading, error, result, merchant, note, matches }) {
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
    minWidth: "240px",
    maxWidth: "300px",
    padding: "10px 12px",
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
  body.style.fontSize = "13px";

  if (loading) body.textContent = note || "Analyzing…";
  else if (error) body.textContent = `CCO: ${error}`;
  else if (result) {
    const matches = Array.isArray(result?.matches) ? result.matches : [];
    const primaryBenefit = matches[0] || (result?.reason ? String(result.reason) : "Best available rate");
    const primaryCredit = pickEnrollCredit(result?.credits || [], primaryBenefit);

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";

    const icon = cardIcon(result?.card);
    const text = document.createElement("div");
    text.style.fontSize = "13px";
    const cardName = result?.card?.name ? sanitize(result.card.name) : "Card";
    text.textContent = `${cardName} — ${sanitize(primaryBenefit)}`;

    row.appendChild(icon);
    row.appendChild(text);
    const enrollBtn = enrollButton(primaryCredit, result?.card);
    if (enrollBtn) row.appendChild(enrollBtn);
    body.appendChild(row);
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
  if (Array.isArray(matches) && matches.length) {
    const list = document.createElement("div");
    list.style.marginTop = "10px";
    list.style.display = "grid";
    list.style.gap = "8px";

    matches.slice(0, 3).forEach((m) => {
      const benefit = (m?.matches && m.matches[0]) || m?.reason || "Benefit available";
      const matchCredit = pickEnrollCredit(m?.credits || [], benefit);
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "10px";

      const icon = cardIcon(m?.card);
      const text = document.createElement("div");
      text.style.fontSize = "12px";
      text.style.opacity = ".9";
      const cardName = m?.card?.name ? sanitize(m.card.name) : "Card";
      text.textContent = `${cardName} — ${sanitize(benefit)}`;

      row.appendChild(icon);
      row.appendChild(text);
      const enrollBtn = enrollButton(matchCredit, m?.card);
      if (enrollBtn) row.appendChild(enrollBtn);
      list.appendChild(row);
    });
    card.appendChild(list);
  }
  const snoozeBtn = document.createElement("button");
  snoozeBtn.textContent = "Hide on this site";
  Object.assign(snoozeBtn.style, {
    fontSize: "12px",
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    cursor: "pointer"
  });
  snoozeBtn.onclick = () => {
    setSnooze(location.hostname || "");
    removeBanner();
  };

  row.appendChild(snoozeBtn);
  card.appendChild(row);
  host.appendChild(card);
}

function sanitize(s) {
  return String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

function removeBanner() {
  const host = document.getElementById("cco-banner");
  if (host) host.remove();
}

function isCheckoutPage() {
  const path = (location.pathname || "").toLowerCase();
  return /checkout|cart|bag|basket|payment|billing|order|confirm|purchase/.test(path);
}

function isSnoozed(host) {
  try {
    const key = `cco_snooze_${host}`;
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setSnooze(host) {
  if (!host) return;
  try {
    const key = `cco_snooze_${host}`;
    localStorage.setItem(key, "1");
  } catch {}
}

function cardIcon(card) {
  const logoUrl = getCardLogoUrl(card);
  if (logoUrl) {
    const img = document.createElement("img");
    img.src = logoUrl;
    img.alt = `${card?.name || "Card"} card`;
    Object.assign(img.style, {
      width: "56px",
      height: "36px",
      borderRadius: "8px",
      objectFit: "cover",
      border: "1px solid rgba(255,255,255,.2)",
      background: "rgba(255,255,255,.08)",
    });
    img.onerror = () => {
      img.replaceWith(makeLabelIcon(card));
    };
    return img;
  }
  return makeLabelIcon(card);
}

function getCardLogoUrl(card) {
  const slug = card?.slug;
  if (slug && CARD_LOGOS[slug]) {
    return chrome.runtime.getURL(`assets/card-logos/${CARD_LOGOS[slug]}`);
  }
  return null;
}

function getEnrollUrl(card) {
  const slug = card?.slug;
  if (slug && CARD_ENROLL_URLS[slug]) return CARD_ENROLL_URLS[slug];
  return null;
}

function pickEnrollCredit(credits, label) {
  if (!Array.isArray(credits) || !credits.length) return null;
  const normalized = String(label || "").toLowerCase();
  const direct = credits.find((c) => c?.label && normalized.includes(String(c.label).toLowerCase()));
  return direct || credits[0];
}

function enrollButton(credit, card) {
  if (!credit?.requiresEnrollment) return null;
  const url = credit?.sourceUrl || getEnrollUrl(card);
  if (!url) return null;
  const btn = document.createElement("button");
  btn.textContent = "Enroll";
  Object.assign(btn.style, {
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,.2)",
    background: "rgba(255,255,255,.12)",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
  btn.onclick = (e) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener");
  };
  return btn;
}

function makeLabelIcon(card) {
  const name = String(card?.name || "").toLowerCase();
  const issuer = String(card?.issuer || "").toLowerCase();
  let label = "CARD";
  let bg = "#1f2937";
  let fg = "#fff";

  if (name.includes("platinum")) {
    label = "PLAT";
    bg = "#9ca3af";
    fg = "#111827";
  } else if (name.includes("gold")) {
    label = "GOLD";
    bg = "#b78a2a";
  } else if (issuer.includes("american express") || name.includes("american express") || name.includes("amex")) {
    label = "AMEX";
    bg = "#1d4ed8";
  } else if (issuer.includes("chase") || name.includes("chase")) {
    label = "CHASE";
    bg = "#2563eb";
  } else if (issuer.includes("citi") || name.includes("citi")) {
    label = "CITI";
    bg = "#0f766e";
  } else if (issuer.includes("capital one") || name.includes("capital one")) {
    label = "CAP1";
    bg = "#111827";
  }

  const icon = document.createElement("div");
  icon.textContent = label;
  Object.assign(icon.style, {
    minWidth: "42px",
    padding: "6px 8px",
    borderRadius: "8px",
    background: bg,
    color: fg,
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.05em",
    textAlign: "center",
    textTransform: "uppercase",
  });
  return icon;
}
