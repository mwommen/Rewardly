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
    ensureStyles();
    host = document.createElement("div");
    host.id = "cco-banner";
    host.className = "cco-root";
    document.body.appendChild(host);
  }
  host.innerHTML = "";

  const card = document.createElement("div");
  card.className = "cco-card";

  const header = document.createElement("div");
  header.className = "cco-header";

  const brand = document.createElement("div");
  brand.className = "cco-brand";
  brand.innerHTML = `<div class="cco-brand-name">Rewardly</div><div class="cco-brand-sub">Live benefit match</div>`;

  const merchantPill = document.createElement("div");
  merchantPill.className = "cco-merchant";
  merchantPill.textContent = merchant || "Merchant";

  header.appendChild(brand);
  header.appendChild(merchantPill);
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "cco-body";

  let primaryCredit = null;
  let sourceUrl = null;
  let verifiedAt = null;

  if (loading) body.textContent = note || "Analyzing…";
  else if (error) body.textContent = `CCO: ${error}`;
  else if (result) {
    const matches = Array.isArray(result?.matches) ? result.matches : [];
    const primaryBenefit = matches[0] || (result?.reason ? String(result.reason) : "Best available rate");
    primaryCredit = pickEnrollCredit(result?.credits || [], primaryBenefit);
    sourceUrl = primaryCredit?.sourceUrl || result?.card?.sourceUrl || null;
    verifiedAt = result?.card?.lastScraped || null;

    const title = document.createElement("div");
    title.className = "cco-title";
    title.textContent = "Best card here";
    body.appendChild(title);

    const row = document.createElement("div");
    row.className = "cco-cardline";

    const icon = cardIcon(result?.card);
    icon.classList.add("cco-icon");
    const text = document.createElement("div");
    text.className = "cco-text";
    const cardName = result?.card?.name ? sanitize(result.card.name) : "Card";
    text.innerHTML = `<div class="cco-card-name">${cardName}</div><div class="cco-benefit">${sanitize(primaryBenefit)}</div>`;

    row.appendChild(icon);
    row.appendChild(text);
    const enrollBtn = enrollButton(primaryCredit, result?.card);
    if (enrollBtn) row.appendChild(enrollBtn);
    body.appendChild(row);
  } else {
    body.textContent = "No result";
  }

  const row = document.createElement("div");
  row.className = "cco-actions";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Dismiss";
  closeBtn.className = "cco-btn cco-btn-ghost";
  closeBtn.onclick = () => {
    setSnooze(location.hostname || "", 30 * 60 * 1000);
    host.remove();
  };

  row.appendChild(closeBtn);
  card.appendChild(body);

  if (sourceUrl || verifiedAt) {
    const meta = document.createElement("div");
    meta.className = "cco-meta";

    if (verifiedAt) {
      const verified = document.createElement("span");
      verified.textContent = `Verified: ${formatVerifiedDate(verifiedAt)}`;
      meta.appendChild(verified);
    }

    if (sourceUrl) {
      const link = document.createElement("a");
      link.href = sourceUrl;
      link.textContent = "Source";
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "cco-link";
      meta.appendChild(link);
    }

    card.appendChild(meta);
  }

  if (Array.isArray(matches) && matches.length) {
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "cco-section-title";
    sectionTitle.textContent = "Other cards with this benefit";
    card.appendChild(sectionTitle);

    const list = document.createElement("div");
    list.className = "cco-list";

    matches.slice(0, 3).forEach((m) => {
      const benefit = (m?.matches && m.matches[0]) || m?.reason || "Benefit available";
      const matchCredit = pickEnrollCredit(m?.credits || [], benefit);
      const row = document.createElement("div");
      row.className = "cco-cardline cco-cardline-compact";

      const icon = cardIcon(m?.card);
      icon.classList.add("cco-icon");
      const text = document.createElement("div");
      text.className = "cco-text";
      const cardName = m?.card?.name ? sanitize(m.card.name) : "Card";
      text.innerHTML = `<div class="cco-card-name">${cardName}</div><div class="cco-benefit">${sanitize(benefit)}</div>`;

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
  snoozeBtn.className = "cco-btn cco-btn-ghost";
  snoozeBtn.onclick = () => {
    setSnooze(location.hostname || "");
    removeBanner();
  };

  row.appendChild(snoozeBtn);
  card.appendChild(row);
  host.appendChild(card);
}

function ensureStyles() {
  if (document.getElementById("cco-styles")) return;
  const style = document.createElement("style");
  style.id = "cco-styles";
  style.textContent = `
    #cco-banner.cco-root {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      font-family: "Sora", "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
      letter-spacing: 0.01em;
      color-scheme: light;
    }
    #cco-banner .cco-card {
      width: 360px;
      max-width: min(360px, 92vw);
      color: #f8fafc;
      border-radius: 20px;
      background: linear-gradient(160deg, #0b1220 0%, #0b1022 40%, #0f172a 100%);
      border: 1px solid rgba(148,163,184,0.18);
      box-shadow: 0 18px 40px rgba(2,6,23,0.55);
      padding: 16px 16px 14px;
      position: relative;
      overflow: hidden;
      animation: cco-pop-in 240ms ease-out;
    }
    #cco-banner .cco-card:before {
      content: "";
      position: absolute;
      inset: -40% auto auto -30%;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(14,165,233,0.2), rgba(15,23,42,0));
      transform: rotate(-8deg);
      pointer-events: none;
    }
    #cco-banner .cco-card:after {
      content: "";
      position: absolute;
      inset: auto -30% -40% auto;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(248,113,113,0.18), rgba(15,23,42,0));
      pointer-events: none;
    }
    #cco-banner .cco-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    #cco-banner .cco-brand {
      display: grid;
      gap: 2px;
    }
    #cco-banner .cco-brand-name {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    #cco-banner .cco-brand-sub {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    #cco-banner .cco-merchant {
      font-size: 12px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(148,163,184,0.12);
      border: 1px solid rgba(148,163,184,0.28);
      text-transform: capitalize;
      font-weight: 600;
    }
    #cco-banner .cco-body {
      font-size: 13px;
      display: grid;
      gap: 12px;
    }
    #cco-banner .cco-title {
      font-size: 15px;
      font-weight: 600;
      color: #f1f5f9;
    }
    #cco-banner .cco-section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #94a3b8;
      margin-top: 8px;
    }
    #cco-banner .cco-cardline {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border-radius: 14px;
      background: rgba(15,23,42,0.65);
      border: 1px solid rgba(148,163,184,0.16);
    }
    #cco-banner .cco-cardline-compact {
      padding: 10px;
    }
    #cco-banner .cco-icon {
      box-shadow: 0 10px 20px rgba(2,6,23,0.4);
    }
    #cco-banner .cco-text {
      display: grid;
      gap: 4px;
    }
    #cco-banner .cco-card-name {
      font-weight: 600;
      font-size: 13px;
      color: #f8fafc;
    }
    #cco-banner .cco-benefit {
      font-size: 12px;
      color: #cbd5f5;
      line-height: 1.35;
    }
    #cco-banner .cco-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
      font-size: 11px;
      color: #cbd5e1;
    }
    #cco-banner .cco-link {
      color: #7dd3fc;
      text-decoration: none;
      font-weight: 600;
    }
    #cco-banner .cco-list {
      display: grid;
      gap: 8px;
      margin-top: 6px;
    }
    #cco-banner .cco-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
    }
    #cco-banner .cco-btn {
      font-size: 12px;
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.35);
      color: #f8fafc;
      background: rgba(148,163,184,0.12);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    #cco-banner .cco-btn-primary {
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      border-color: rgba(56,189,248,0.6);
      color: #07101f;
      font-weight: 700;
    }
    #cco-banner .cco-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(2,6,23,0.35);
      background: rgba(148,163,184,0.22);
    }
    #cco-banner .cco-btn-primary:hover {
      background: linear-gradient(135deg, #7dd3fc, #38bdf8);
    }
    #cco-banner .cco-btn-ghost {
      background: transparent;
    }
    @keyframes cco-pop-in {
      from { opacity: 0; transform: translateY(10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
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
    const value = localStorage.getItem(key);
    if (!value) return false;
    if (value === "1") return true;
    if (value.startsWith("ts:")) {
      const until = Number(value.slice(3));
      if (Number.isFinite(until) && Date.now() < until) return true;
      localStorage.removeItem(key);
    }
    return false;
  } catch {
    return false;
  }
}

function setSnooze(host, ttlMs) {
  if (!host) return;
  try {
    const key = `cco_snooze_${host}`;
    if (typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0) {
      localStorage.setItem(key, `ts:${Date.now() + ttlMs}`);
      return;
    }
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
  btn.className = "cco-btn cco-btn-primary";
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

function formatVerifiedDate(raw) {
  const dt = new Date(raw);
  if (Number.isNaN(dt.valueOf())) return String(raw);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
