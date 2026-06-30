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

const DASHBOARD_URL = "http://localhost:5173";
let lastBannerContext = null;
let lastBenefitStateMap = new Map();

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

  const pageInference = inferMerchantFromPage();
  const requestRecommendation = (merchantName, mcc) => {
    chrome.storage.sync.get(["USER_ID"], (o) => {
      const userId = o?.USER_ID || "devUser";
      const firstPayload = { merchant: merchantName, mcc, userId, restrictToLinked: true };

      const handleResponse = (rec, benefitStateMap) => {
        if (!rec?.ok) {
          inFlight = false;
          return;
        }
        const top = rec.data?.top || null;
        const benefitMatches = Array.isArray(rec.data?.benefitMatches) ? rec.data?.benefitMatches : [];
        const topMatches = Array.isArray(top?.matches) ? top.matches : [];
        const hasAnyBenefit = benefitMatches.length || topMatches.length;
        if (hasAnyBenefit) {
          const list = benefitMatches.length ? benefitMatches : topMatches.map((m) => ({
            card: top?.card,
            reason: top?.reason || null,
            matches: [m],
            credits: top?.credits || [],
          }));
          banner({
            result: benefitMatches.length ? null : top,
            merchant: merchantName,
            matches: list,
            benefitStateMap,
          });
          lastHadBenefit = true;
          inFlight = false;
          return;
        }

        removeBanner();
        lastHadBenefit = false;
        inFlight = false;
      };

      chrome.runtime.sendMessage({ type: "CCO_GET_USER_BENEFIT_STATES", payload: { userId } }, (stateResp) => {
        const stateMap = stateResp?.ok && Array.isArray(stateResp.data?.states)
          ? buildBenefitStateMap(stateResp.data.states)
          : new Map();

        chrome.runtime.sendMessage({ type: "CCO_RECOMMEND", payload: firstPayload }, (rec) => {
          handleResponse(rec, stateMap);
        });
      });
    });
  };

  if (pageInference?.merchantName) {
    requestRecommendation(pageInference.merchantName, pageInference.mcc);
  } else {
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
      requestRecommendation(merchantName, mcc);
    });
  }
}

// ---- Banner UI ----
function banner({ loading, error, result, merchant, note, matches, benefitStateMap = new Map() }) {
  lastBannerContext = { loading, error, result, merchant, note, matches };
  lastBenefitStateMap = benefitStateMap instanceof Map ? new Map(benefitStateMap) : new Map();
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
  brand.innerHTML = `<div class="cco-brand-name">Rewardly</div><div class="cco-brand-sub">Card benefit found</div>`;

  const merchantPill = document.createElement("div");
  merchantPill.className = "cco-merchant";
  merchantPill.textContent = merchant || "Merchant";

  header.appendChild(brand);
  header.appendChild(merchantPill);
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "cco-body";

  const walletSummary = buildWalletSummary(benefitStateMap);
  if (walletSummary.totalCredits > 0) {
    const summary = document.createElement("div");
    summary.className = "cco-summary";
    summary.innerHTML = `
      <div class="cco-summary-text">
        <strong>Your wallet has ${walletSummary.totalCredits} tracked credit${walletSummary.totalCredits === 1 ? "" : "s"}</strong>
        <span>${walletSummary.enrollmentRequired} still need enrollment</span>
      </div>
      <button class="cco-btn cco-btn-primary cco-dashboard-btn" type="button">Manage wallet</button>
    `;
    summary.querySelector(".cco-dashboard-btn").onclick = (e) => {
      e.stopPropagation();
      window.open(DASHBOARD_URL, "_blank", "noopener");
    };
    body.appendChild(summary);
  }

  const content = document.createElement("div");
  content.className = "cco-content";
  let primaryCredit = null;
  let sourceUrl = null;
  let verifiedAt = null;

  if (loading) {
    content.textContent = note || "Analyzing…";
  } else if (error) {
    content.textContent = `CCO: ${error}`;
  } else if (result || (Array.isArray(matches) && matches.length)) {
    const title = document.createElement("div");
    title.className = "cco-title";
    title.textContent = matches?.length ? "Use this card before you pay" : "Best card here";
    content.appendChild(title);

    if (result && (!matches || matches.length === 0)) {
      const resMatches = Array.isArray(result?.matches) ? result.matches : [];
      const primaryBenefit = resMatches[0] || (result?.reason ? String(result.reason) : "Best available rate");
      primaryCredit = pickEnrollCredit(result?.credits || [], primaryBenefit);
      sourceUrl = primaryCredit?.sourceUrl || result?.card?.sourceUrl || null;
      verifiedAt = result?.card?.lastScraped || null;

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
      const primaryState = primaryCredit?.benefitKey ? benefitStateMap.get(primaryCredit.benefitKey) : null;
      appendBenefitActions(row, primaryCredit, result?.card, primaryState);
      content.appendChild(row);
    }
  } else {
    content.textContent = "No result";
  }

  body.appendChild(content);

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
    sectionTitle.textContent = "Cards with this benefit";
    card.appendChild(sectionTitle);

    const list = document.createElement("div");
    list.className = "cco-list";

    const cleanMatches = matches.filter((m) => {
      const name = String(m?.card?.name || "");
      return name && !/unknown/i.test(name);
    });
    const maxVisible = 3;
    const visibleMatches = cleanMatches.slice(0, maxVisible);

    visibleMatches.forEach((m) => {
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
      const matchState = matchCredit?.benefitKey ? benefitStateMap.get(matchCredit.benefitKey) : null;
      appendBenefitActions(row, matchCredit, m?.card, matchState);
      list.appendChild(row);
    });
    card.appendChild(list);

    if (cleanMatches.length > maxVisible) {
      const toggle = document.createElement("button");
      toggle.className = "cco-btn cco-btn-ghost cco-toggle";
      toggle.textContent = `Show all (${cleanMatches.length})`;
      toggle.onclick = () => {
        const expanded = list.classList.toggle("expanded");
        toggle.textContent = expanded ? "Show fewer" : `Show all (${cleanMatches.length})`;
        if (expanded) {
          list.innerHTML = "";
          cleanMatches.forEach((m) => {
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
            const matchState = matchCredit?.benefitKey ? benefitStateMap.get(matchCredit.benefitKey) : null;
            const enrollBtn = enrollButton(matchCredit, m?.card, matchState);
            if (enrollBtn) row.appendChild(enrollBtn);
            const saveBtn = saveBenefitStateButton(matchCredit, matchState);
            if (saveBtn) row.appendChild(saveBtn);
            list.appendChild(row);
          });
        } else {
          list.innerHTML = "";
          visibleMatches.forEach((m) => {
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
            const matchState = matchCredit?.benefitKey ? benefitStateMap.get(matchCredit.benefitKey) : null;
            const enrollBtn = enrollButton(matchCredit, m?.card, matchState);
            if (enrollBtn) row.appendChild(enrollBtn);
            const saveBtn = saveBenefitStateButton(matchCredit, matchState);
            if (saveBtn) row.appendChild(saveBtn);
            list.appendChild(row);
          });
        }
      };
      card.appendChild(toggle);
    }
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
      border-radius: 12px;
      background: #0f172a;
      border: 1px solid rgba(148,163,184,0.16);
      box-shadow: 0 10px 24px rgba(2,6,23,0.3);
      padding: 14px 14px 12px;
      position: relative;
      overflow-x: hidden;
      overflow-y: auto;
      animation: cco-pop-in 240ms ease-out;
      max-height: min(76vh, 560px);
    }
    #cco-banner .cco-card:before,
    #cco-banner .cco-card:after {
      display: none;
    }
    #cco-banner .cco-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
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
      border-radius: 10px;
      background: rgba(148,163,184,0.12);
      border: 1px solid rgba(148,163,184,0.28);
      text-transform: capitalize;
      font-weight: 600;
    }
    #cco-banner .cco-body {
      font-size: 13px;
      display: grid;
      gap: 10px;
    }
    #cco-banner .cco-title {
      font-size: 14px;
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
      grid-template-columns: 58px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      padding: 10px;
      border-radius: 12px;
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
      min-width: 0;
    }
    #cco-banner .cco-card-name {
      font-weight: 600;
      font-size: 12px;
      color: #f8fafc;
      line-height: 1.25;
      overflow-wrap: break-word;
    }
    #cco-banner .cco-benefit {
      font-size: 11.5px;
      color: #cbd5f5;
      line-height: 1.35;
      overflow-wrap: break-word;
    }
    #cco-banner .cco-cardline > .cco-btn {
      grid-column: 2;
      justify-self: start;
      margin-top: 2px;
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
      max-height: 220px;
      overflow-y: auto;
      padding-right: 2px;
    }
    #cco-banner .cco-list.expanded {
      max-height: 320px;
      overflow-y: auto;
    }
    #cco-banner .cco-toggle {
      align-self: flex-start;
      margin-top: 6px;
    }
    #cco-banner .cco-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px;
      border-radius: 12px;
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.18);
      color: #e2e8f0;
      margin-bottom: 10px;
    }
    #cco-banner .cco-summary-text {
      display: grid;
      gap: 2px;
      font-size: 12px;
      line-height: 1.4;
    }
    #cco-banner .cco-summary-text strong {
      font-size: 13px;
      color: #f8fafc;
    }
    #cco-banner .cco-dashboard-btn {
      white-space: nowrap;
      padding: 7px 10px;
      background: #38bdf8;
      color: #0f172a;
      border: 1px solid transparent;
    }
    #cco-banner .cco-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
    }
    #cco-banner .cco-btn {
      font-size: 12px;
      padding: 7px 10px;
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.35);
      color: #f8fafc;
      background: rgba(148,163,184,0.12);
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    #cco-banner .cco-btn-primary {
      background: #38bdf8;
      border-color: #22c2f1;
      color: #0f172a;
      font-weight: 700;
    }
    #cco-banner .cco-btn:hover {
      background: rgba(148,163,184,0.18);
    }
    #cco-banner .cco-btn-primary:hover {
      background: #22c2f1;
    }
    #cco-banner .cco-btn-ghost {
      background: transparent;
    }
    #cco-banner .cco-toast {
      position: absolute;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%) translateY(12px);
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 180ms ease, transform 180ms ease;
      z-index: 1;
    }
    #cco-banner .cco-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
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
  const pageKeywords = /checkout|cart|bag|basket|payment|billing|order|confirm|purchase|place order|order summary|payment method/;
  if (pageKeywords.test(path)) return true;
  if (document.querySelector("form[action*='checkout'], form[action*='payment'], form[action*='order']")) return true;
  const bodyText = (document.body.textContent || "").toLowerCase();
  return pageKeywords.test(bodyText);
}

function inferMerchantFromPage() {
  const sources = [
    document.title,
    document.querySelector("meta[property='og:site_name']")?.getAttribute("content"),
    document.querySelector("meta[name='application-name']")?.getAttribute("content"),
    document.querySelector("meta[property='og:title']")?.getAttribute("content"),
    document.querySelector("meta[name='twitter:title']")?.getAttribute("content"),
    document.querySelector(".site-name")?.textContent,
    document.querySelector(".brand")?.textContent,
    document.querySelector(".merchant-name")?.textContent,
    document.querySelector("[data-test='merchant-name']")?.textContent,
    document.querySelector("header a[aria-label]")?.getAttribute("aria-label"),
    document.querySelector("header img[alt]")?.getAttribute("alt"),
  ];

  for (const source of sources) {
    const candidate = cleanMerchantName(String(source || ""));
    if (candidate) {
      return { merchantName: candidate, mcc: null };
    }
  }
  return null;
}

function cleanMerchantName(text) {
  let normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  normalized = normalized
    .replace(/\s+\|\s+.*/, "")
    .replace(/\s*[-|•]\s*(checkout|payment|cart|bag|billing|order summary|shop).*$/i, "")
    .replace(/\b(checkout|payment|cart|bag|billing|order summary)\b/gi, "")
    .trim();
  const lower = normalized.toLowerCase();
  if (/(shopify|payment gateway)/.test(lower)) return "";
  if (normalized.length < 3) return "";
  return normalized;
}

function buildWalletSummary(benefitStateMap) {
  const summary = { totalCredits: 0, enrollmentRequired: 0, remindersEnabled: 0 };
  if (!(benefitStateMap instanceof Map)) return summary;
  summary.totalCredits = benefitStateMap.size;
  for (const state of benefitStateMap.values()) {
    if (!state?.usedAt) {
      if (!state.enrolled && state.requiresEnrollment) {
        summary.enrollmentRequired += 1;
      }
      if (state.remindEnabled) {
        summary.remindersEnabled += 1;
      }
    }
  }
  return summary;
}

function buildBenefitStateMap(states) {
  const map = new Map();
  if (!Array.isArray(states)) return map;
  states.forEach((state) => {
    if (!state?.benefitKey) return;
    map.set(state.benefitKey, state);
  });
  return map;
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

function appendBenefitActions(row, credit, card, state) {
  const enrollBtn = enrollButton(credit, card, state);
  if (enrollBtn) row.appendChild(enrollBtn);
  const clearBtn = clearEnrollmentButton(credit, state);
  if (clearBtn) row.appendChild(clearBtn);
}

function enrollButton(credit, card, state) {
  if (!credit?.requiresEnrollment) return null;
  const url = credit?.enrollmentUrl || credit?.sourceUrl || getEnrollUrl(card);
  if (state?.enrolled) {
    const badge = document.createElement("button");
    badge.textContent = "Enrolled";
    badge.className = "cco-btn cco-btn-ghost";
    badge.disabled = true;
    return badge;
  }
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

function reminderButton(credit, state) {
  if (!credit?.benefitKey) return null;
  const btn = document.createElement("button");
  if (state?.remindEnabled) {
    btn.textContent = "Disable reminder";
    btn.className = "cco-btn cco-btn-ghost";
    btn.onclick = (e) => {
      e.stopPropagation();
      btn.disabled = true;
      btn.textContent = "Saving…";
      chrome.storage.sync.get(["USER_ID"], (o) => {
        const userId = o?.USER_ID || "devUser";
        chrome.runtime.sendMessage(
          {
            type: "CCO_SAVE_BENEFIT_STATE",
            payload: {
              userId,
              benefitKey: credit.benefitKey,
              remindEnabled: false,
            },
          },
          (resp) => {
            if (resp?.ok) {
              btn.textContent = "Set reminder";
              btn.disabled = false;
              btn.className = "cco-btn";
              updateSavedBenefitState(credit.benefitKey, { remindEnabled: false });
              refreshBanner();
              showBannerToast("Reminder disabled");
            } else {
              btn.textContent = "Disable reminder";
              btn.disabled = false;
              console.warn("Failed to disable reminder", resp?.error);
            }
          }
        );
      });
    };
  } else {
    btn.textContent = "Set reminder";
    btn.className = "cco-btn";
    btn.onclick = (e) => {
      e.stopPropagation();
      btn.disabled = true;
      btn.textContent = "Saving…";
      chrome.storage.sync.get(["USER_ID"], (o) => {
        const userId = o?.USER_ID || "devUser";
        chrome.runtime.sendMessage(
          {
            type: "CCO_SAVE_BENEFIT_STATE",
            payload: {
              userId,
              benefitKey: credit.benefitKey,
              remindEnabled: true,
            },
          },
          (resp) => {
            if (resp?.ok) {
              btn.textContent = "Disable reminder";
              btn.disabled = false;
              btn.className = "cco-btn cco-btn-ghost";
              updateSavedBenefitState(credit.benefitKey, { remindEnabled: true });
              refreshBanner();
              showBannerToast("Reminder enabled");
            } else {
              btn.textContent = "Set reminder";
              btn.disabled = false;
              console.warn("Failed to save reminder state", resp?.error);
            }
          }
        );
      });
    };
  }
  return btn;
}

function saveBenefitStateButton(credit, state) {
  if (!credit?.requiresEnrollment || !credit?.benefitKey || state?.enrolled) return null;
  const btn = document.createElement("button");
  btn.textContent = "Mark enrolled";
  btn.className = "cco-btn";
  btn.onclick = (e) => {
    e.stopPropagation();
    btn.disabled = true;
    btn.textContent = "Saving…";
    chrome.storage.sync.get(["USER_ID"], (o) => {
      const userId = o?.USER_ID || "devUser";
      chrome.runtime.sendMessage(
        {
          type: "CCO_SAVE_BENEFIT_STATE",
          payload: {
            userId,
            benefitKey: credit.benefitKey,
            enrolled: true,
            requiresEnrollment: true,
          },
        },
        (resp) => {
          if (resp?.ok) {
            btn.textContent = "Enrolled";
            btn.disabled = true;
            btn.className = "cco-btn cco-btn-ghost";
            updateSavedBenefitState(credit.benefitKey, { enrolled: true, requiresEnrollment: true });
            refreshBanner();
            showBannerToast("Saved enrollment status");
          } else {
            btn.textContent = "Mark enrolled";
            btn.disabled = false;
            console.warn("Failed to save benefit state", resp?.error);
          }
        }
      );
    });
  };
  return btn;
}

function clearEnrollmentButton(credit, state) {
  if (!credit?.benefitKey || !state?.enrolled) return null;
  const btn = document.createElement("button");
  btn.textContent = "Undo enrolled";
  btn.className = "cco-btn cco-btn-ghost";
  btn.onclick = (e) => {
    e.stopPropagation();
    btn.disabled = true;
    btn.textContent = "Saving…";
    chrome.storage.sync.get(["USER_ID"], (o) => {
      const userId = o?.USER_ID || "devUser";
      chrome.runtime.sendMessage(
        {
          type: "CCO_SAVE_BENEFIT_STATE",
          payload: {
            userId,
            benefitKey: credit.benefitKey,
            enrolled: false,
            requiresEnrollment: true,
          },
        },
        (resp) => {
          if (resp?.ok) {
            btn.textContent = "Undo enrolled";
            btn.disabled = false;
            btn.className = "cco-btn";
            updateSavedBenefitState(credit.benefitKey, { enrolled: false });
            refreshBanner();
            showBannerToast("Enrollment cleared");
          } else {
            btn.textContent = "Undo enrolled";
            btn.disabled = false;
            console.warn("Failed to clear enrollment", resp?.error);
          }
        }
      );
    });
  };
  return btn;
}

function markUsedButton(credit, state) {
  if (!credit?.benefitKey || state?.usedAt) return null;
  const btn = document.createElement("button");
  btn.textContent = "Mark used";
  btn.className = "cco-btn";
  btn.onclick = (e) => {
    e.stopPropagation();
    btn.disabled = true;
    btn.textContent = "Saving…";
    chrome.storage.sync.get(["USER_ID"], (o) => {
      const userId = o?.USER_ID || "devUser";
      chrome.runtime.sendMessage(
        {
          type: "CCO_SAVE_BENEFIT_STATE",
          payload: {
            userId,
            benefitKey: credit.benefitKey,
            usedAt: new Date().toISOString(),
          },
        },
        (resp) => {
          if (resp?.ok) {
            btn.textContent = "Used";
            btn.disabled = true;
            btn.className = "cco-btn cco-btn-ghost";
            updateSavedBenefitState(credit.benefitKey, { usedAt: new Date().toISOString() });
            refreshBanner();
            showBannerToast("Marked as used");
          } else {
            btn.textContent = "Mark used";
            btn.disabled = false;
            console.warn("Failed to save used state", resp?.error);
          }
        }
      );
    });
  };
  return btn;
}

function refreshBanner() {
  rerenderBanner();
}

function rerenderBanner() {
  if (!lastBannerContext) return;
  banner({ ...lastBannerContext, benefitStateMap: lastBenefitStateMap });
}

function updateSavedBenefitState(benefitKey, updates = {}) {
  if (!benefitKey) return;
  const existing = lastBenefitStateMap.get(benefitKey) || {};
  lastBenefitStateMap.set(benefitKey, { ...existing, ...updates });
}

function showBannerToast(message) {
  const host = document.getElementById("cco-banner");
  if (!host) return;
  let toast = host.querySelector(".cco-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "cco-toast";
    host.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toast._timeout);
  toast._timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
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
