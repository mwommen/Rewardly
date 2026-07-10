// Rewardly magic moment: detect checkout, request one wallet decision, show one card.

const REWARDLY_CHECK_DELAY_MS = 250;
const REWARDLY_MIN_CHECK_INTERVAL_MS = 750;
const REWARDLY_DISMISS_MS = 30 * 60 * 1000;
const REWARDLY_REQUEST_TIMEOUT_MS = 3000;

const CARD_LOGOS = {
  "amex-gold": "amex-gold.png",
  "amex-platinum": "amex-platinum.png",
  "amex-blue-business-plus": "Amex Blue Business Plus.png",
  "chase-sapphire-preferred": "chase-sapphire-preferred.png",
  "chase-freedom-unlimited": "chase-freedom-unlimited.png",
  "citi-custom-cash": "citi-custom-cash.png",
  "capital-one-savorone": "capital-one-savorone.png",
  "capital-one-venture-x": "capital-one-venture-x.png",
};

const REWARDLY_MERCHANTS = {
  "lululemon.com": {
    name: "Lululemon",
    category: "apparel",
    mcc: "5651",
    aliases: ["lululemon", "lulu lemon", "lululemon.com"],
  },
  "amazon.com": {
    name: "Amazon",
    category: "online_shopping",
    mcc: "5942",
    aliases: ["amazon", "amazon.com"],
  },
  "target.com": {
    name: "Target",
    category: "departmentstores",
    mcc: "5310",
    aliases: ["target", "target.com"],
  },
  "walmart.com": {
    name: "Walmart",
    category: "departmentstores",
    mcc: "5310",
    aliases: ["walmart", "wal-mart", "walmart.com"],
  },
  "costco.com": {
    name: "Costco",
    category: "groceries",
    mcc: "5300",
    aliases: ["costco", "costco wholesale", "costco.com"],
  },
  "bestbuy.com": {
    name: "Best Buy",
    category: "online_shopping",
    mcc: "5732",
    aliases: ["best buy", "bestbuy", "bestbuy.com"],
  },
  "apple.com": {
    name: "Apple",
    category: "online_shopping",
    mcc: "5732",
    aliases: ["apple store", "apple.com"],
  },
  "nike.com": {
    name: "Nike",
    category: "apparel",
    mcc: "5651",
    aliases: ["nike", "nike.com"],
  },
  "homedepot.com": {
    name: "Home Depot",
    category: "other",
    mcc: "5200",
    aliases: ["home depot", "the home depot", "homedepot"],
  },
  "lowes.com": {
    name: "Lowe's",
    category: "other",
    mcc: "5200",
    aliases: ["lowe's", "lowes", "lowe’s"],
  },
  "doordash.com": {
    name: "DoorDash",
    category: "dining",
    mcc: "5814",
    aliases: ["doordash", "door dash", "doordash.com"],
  },
  "ubereats.com": {
    name: "Uber Eats",
    category: "dining",
    mcc: "5814",
    aliases: ["uber eats", "ubereats", "ubereats.com"],
  },
  "starbucks.com": {
    name: "Starbucks",
    category: "dining",
    mcc: "5814",
    aliases: ["starbucks", "starbucks coffee"],
  },
  "delta.com": {
    name: "Delta",
    category: "travel",
    mcc: "4511",
    aliases: ["delta air lines", "delta airlines", "delta.com"],
  },
  "united.com": {
    name: "United",
    category: "travel",
    mcc: "4511",
    aliases: ["united airlines", "united.com"],
  },
  "southwest.com": {
    name: "Southwest",
    category: "travel",
    mcc: "4511",
    aliases: ["southwest airlines", "southwest.com"],
  },
  "marriott.com": {
    name: "Marriott",
    category: "travel",
    mcc: "7011",
    aliases: ["marriott", "marriott bonvoy"],
  },
  "hilton.com": {
    name: "Hilton",
    category: "travel",
    mcc: "7011",
    aliases: ["hilton", "hilton honors"],
  },
  "airbnb.com": {
    name: "Airbnb",
    category: "travel",
    mcc: "7011",
    aliases: ["airbnb", "airbnb.com"],
  },
  "expedia.com": {
    name: "Expedia",
    category: "travel",
    mcc: "4722",
    aliases: ["expedia", "expedia.com"],
  },
  "booking.com": {
    name: "Booking.com",
    category: "travel",
    mcc: "4722",
    aliases: ["booking.com", "booking com"],
  },
};

let rewardlyTimer = null;
let rewardlyLastCheckAt = 0;
let rewardlyInFlight = false;
let rewardlyShownKey = "";
let rewardlyObserver = null;
let rewardlyDebugEnabled = false;
let rewardlyLastUrl = location.href;

initRewardly();

function initRewardly() {
  document.documentElement.setAttribute("data-rewardly-extension", "loaded");
  rewardlyLog("content-script-loaded", {
    url: location.href,
    host: location.hostname,
  });
  loadRewardlyDebugSetting();
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (
      area === "sync" &&
      Object.prototype.hasOwnProperty.call(changes, "DEBUG_LOGS")
    ) {
      rewardlyDebugEnabled = !!changes.DEBUG_LOGS.newValue;
      rewardlyLog("debug-setting-changed", {
        enabled: rewardlyDebugEnabled,
      });
    }
  });
  window.addEventListener("message", handleRewardlyDiagnosticMessage);
  scheduleRewardlyCheck("initial-load", 50);
  rewardlyObserver = new MutationObserver(() => {
    scheduleRewardlyCheck("dom-mutated");
  });
  rewardlyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  setInterval(() => {
    if (location.href === rewardlyLastUrl) return;
    rewardlyLastUrl = location.href;
    scheduleRewardlyCheck("url-changed", 50);
  }, 500);
}

function scheduleRewardlyCheck(reason, delay = REWARDLY_CHECK_DELAY_MS) {
  if (rewardlyTimer) return;
  const elapsed = Date.now() - rewardlyLastCheckAt;
  const wait = Math.max(delay, REWARDLY_MIN_CHECK_INTERVAL_MS - elapsed, 0);
  rewardlyTimer = setTimeout(() => {
    rewardlyTimer = null;
    rewardlyLastCheckAt = Date.now();
    runRewardlyPipeline(reason);
  }, wait);
}

function runRewardlyPipeline(triggerReason = "scheduled") {
  try {
    rewardlyLog("pipeline-started", {
      triggerReason,
      url: location.href,
    });
    const checkout = detectCheckoutFromPage();
    document.documentElement.setAttribute(
      "data-rewardly-checkout-stage",
      checkout.stage || "unknown",
    );
    document.documentElement.setAttribute(
      "data-rewardly-should-trigger",
      String(!!checkout.shouldTriggerRecommendation),
    );
    rewardlyLog("checkout-detected", {
      stage: checkout.stage,
      shouldTriggerRecommendation: checkout.shouldTriggerRecommendation,
      confidence: checkout.confidence,
      url: location.href,
    });
    if (!checkout.shouldTriggerRecommendation) {
      rewardlyLog("pipeline-failed", {
        stage: "checkout-detection",
        reason: "checkout stage does not trigger",
        url: location.href,
        checkoutStage: checkout.stage,
      });
      removeRewardlyPopup();
      return;
    }

    const merchant = detectMerchantFromPage();
    const key = decisionKey(merchant, checkout);
    rewardlyLog("merchant-detected", {
      merchant: merchant.name,
      hostname: merchant.hostname,
      category: merchant.category,
      mcc: merchant.mcc,
      url: location.href,
    });
    if (!merchant.name || rewardlyInFlight || rewardlyShownKey === key) {
      rewardlyLog("pipeline-failed", {
        stage: "pre-request",
        merchant: merchant.name || null,
        url: location.href,
        reason: !merchant.name
          ? "merchant missing"
          : rewardlyInFlight
            ? "decision request already in flight"
            : "duplicate checkout context",
        hasMerchant: !!merchant.name,
        rewardlyInFlight,
        duplicateContext: rewardlyShownKey === key,
        key,
      });
      return;
    }
    if (isDismissed(key)) {
      rewardlyLog("pipeline-failed", {
        stage: "dismissal-check",
        merchant: merchant.name,
        url: location.href,
        reason: "dismissed for checkout context",
        key,
      });
      return;
    }

    rewardlyInFlight = true;
    rewardlyShownKey = key;

    const payload = {
      merchant: merchant.name,
      hostname: location.hostname,
      url: location.href,
      title: document.title,
      mcc: merchant.mcc,
      category: merchant.category,
      restrictToWallet: true,
      purchaseContext: {
        surface: "extension",
        url: location.href,
        checkoutDetected: checkout.isCheckout,
        checkoutStage: checkout.stage,
        amount: readCheckoutAmount(),
        timestamp: new Date().toISOString(),
      },
    };

    rewardlyLog("recommendation-requested", {
      merchant: payload.merchant,
      url: payload.url,
      payload,
    });

    requestPaymentDecision(payload)
      .then((decision) => {
        rewardlyInFlight = false;
        rewardlyLog("recommendation-received", {
          hasRecommendation: !!decision?.recommendedCard,
          cardSlug: decision?.recommendedCard?.card?.slug || null,
          cardName: decision?.recommendedCard?.card?.name || null,
          merchant: decision?.merchant?.name || null,
          walletCardSlugs: decision?.wallet?.cardSlugs || [],
        });
        if (!decision?.recommendedCard) {
          rewardlyShownKey = "";
          removeRewardlyPopup();
          rewardlyLog("pipeline-failed", {
            stage: "recommendation-response",
            merchant: payload.merchant,
            url: payload.url,
            reason: "no recommended card returned",
          });
          return;
        }
        renderRewardlyPopup(decision, key);
      })
      .catch((error) => {
        rewardlyInFlight = false;
        rewardlyShownKey = "";
        rewardlyLog("pipeline-failed", {
          stage: "recommendation-request",
          merchant: payload.merchant,
          url: payload.url,
          message: String(error?.message || error),
        });
        console.warn("[Rewardly] decision failed", error);
      });
  } catch (error) {
    rewardlyInFlight = false;
    rewardlyShownKey = "";
    rewardlyLog("pipeline-failed", {
      stage: "content-script",
      url: location.href,
      message: String(error?.message || error),
    });
    console.warn("[Rewardly] checkout detection failed", error);
  }
}

function requestPaymentDecision(payload) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Decision request timed out"));
    }, REWARDLY_REQUEST_TIMEOUT_MS);

    chrome.runtime.sendMessage(
      { type: "REWARDLY_PAYMENT_DECISION", payload },
      (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Decision request failed"));
          return;
        }
        resolve(response.data?.decision || null);
      },
    );
  });
}

function detectCheckoutFromPage() {
  return detectCheckout({
    url: location.href,
    pathname: location.pathname,
    title: document.title,
    visibleText: readVisibleText(),
    hasPaymentForm: Boolean(
      document.querySelector(
        [
          "input[name*='card']",
          "input[id*='card']",
          "input[autocomplete='cc-number']",
          "iframe[src*='payment']",
          "[data-testid*='payment']",
          "input[name*='ppw']",
          "input[id*='ppw']",
          "form[action*='payselect']",
          "form[action*='buy']",
          "#payChangeButtonId",
          "#payment-information",
          "[id*='payment']",
          "[class*='payment']",
        ].join(","),
      ),
    ),
    hasOrderSummary: Boolean(
      document.querySelector(
        [
          "#spc-orders",
          "#subtotals-marketplace-table",
          "#orderSummaryPrimaryActionBtn",
          "#submitOrderButtonId",
          "[data-testid*='order-summary']",
          "[class*='order-summary']",
          "[id*='order-summary']",
          "[id*='orderSummary']",
          "[class*='orderSummary']",
        ].join(","),
      ),
    ),
  });
}

// Browser-ready copy of rewardly-core checkoutDetection. Keep behavior aligned
// with packages/rewardly-core/src/checkoutDetection.ts until the extension is bundled.
function detectCheckout(input) {
  const text = [input.url, input.pathname, input.title, input.visibleText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const path = input.pathname || input.url;

  if (
    isSignInPath(path) ||
    isAmazonAuthPath(path)
  ) {
    return {
      isCheckout: false,
      stage: "unknown",
      confidence: 0.88,
      shouldTriggerRecommendation: false,
    };
  }

  if (
    isConfirmationPath(path) ||
    (!input.hasPaymentForm &&
      containsAny(text, [
        "thank you",
        "order confirmed",
        "confirmation",
        "receipt",
        "order complete",
      ]))
  ) {
    return {
      isCheckout: false,
      stage: "confirmation",
      confidence: 0.9,
      shouldTriggerRecommendation: false,
    };
  }

  if (isCartPath(path) && !input.hasPaymentForm) {
    return {
      isCheckout: true,
      stage: "cart",
      confidence: 0.72,
      shouldTriggerRecommendation: false,
    };
  }

  if (isAmazonCheckoutPath(path)) {
    return {
      isCheckout: true,
      stage:
        input.hasPaymentForm ||
        containsAny(text, [
          "payment",
          "payment method",
          "select a payment method",
          "choose a payment method",
          "use this payment method",
          "card number",
          "billing",
          "billing address",
          "place order",
          "place your order",
          "complete purchase",
          "review order",
          "review your order",
          "review items",
        ])
          ? "payment"
          : "checkout",
      confidence: input.hasPaymentForm ? 0.92 : 0.78,
      shouldTriggerRecommendation: true,
    };
  }

  if (
    input.hasPaymentForm ||
    containsAny(text, [
      "payment",
      "payment method",
      "select a payment method",
      "choose a payment method",
      "use this payment method",
      "card number",
      "billing",
      "billing address",
      "place order",
      "place your order",
      "complete purchase",
      "review order",
      "review your order",
      "review items",
    ])
  ) {
    return {
      isCheckout: true,
      stage: "payment",
      confidence: input.hasPaymentForm ? 0.9 : 0.74,
      shouldTriggerRecommendation: true,
    };
  }

  if (
    input.hasOrderSummary ||
    containsAny(text, [
      "checkout",
      "secure checkout",
      "proceed to checkout",
      "shipping",
      "shipping address",
      "delivery",
      "order summary",
    ])
  ) {
    return {
      isCheckout: true,
      stage: "checkout",
      confidence: input.hasOrderSummary ? 0.82 : 0.68,
      shouldTriggerRecommendation: true,
    };
  }

  if (containsAny(text, ["cart", "bag", "basket"])) {
    return {
      isCheckout: true,
      stage: "cart",
      confidence: 0.58,
      shouldTriggerRecommendation: false,
    };
  }

  return {
    isCheckout: false,
    stage: "unknown",
    confidence: 0.2,
    shouldTriggerRecommendation: false,
  };
}

function detectMerchantFromPage() {
  const host = normalizeRewardlyHost(location.hostname);
  const metaName =
    document
      .querySelector("meta[property='og:site_name']")
      ?.getAttribute("content") ||
    document
      .querySelector("meta[name='application-name']")
      ?.getAttribute("content") ||
    document.querySelector("meta[name='apple-itunes-app']")?.getAttribute("content");
  const checkoutText = [
    host,
    document.title,
    metaName,
    document.querySelector("h1")?.textContent,
    document.querySelector("[data-testid*='checkout' i]")?.textContent,
    document.querySelector("[aria-label*='checkout' i]")?.getAttribute("aria-label"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const known = findRewardlyMerchant(host, checkoutText);
  if (known) {
    return {
      name: known.name,
      hostname: host,
      category: known.category || null,
      mcc: known.mcc || null,
    };
  }

  const fallback = host.split(".")[0] || "Merchant";
  return {
    name:
      cleanMerchantName(metaName) || titleCase(fallback.replace(/[-_]+/g, " ")),
    hostname: host,
    category: null,
    mcc: null,
  };
}

function renderRewardlyPopup(decision, dismissKey) {
  if (document.getElementById("rewardly-popup")) {
    rewardlyLog("popup-render-skipped", {
      reason: "popup already exists",
      url: location.href,
      merchant: decision?.merchant?.name || null,
    });
    return;
  }
  ensureRewardlyStyles();

  const recommendation = decision.recommendedCard;
  const card = recommendation.card;
  const primaryReason =
    decision.primaryReason?.detail ||
    recommendation.primaryReason?.detail ||
    decision.recommendationSummary ||
    "Best card in your wallet for this checkout.";
  const reward =
    decision.rewardEstimate?.label ||
    recommendation.rewardEstimate?.label ||
    "Strong available rewards";
  const benefits = (decision.unlockedBenefits || [])
    .map((match) => match?.benefit?.label || match?.summary)
    .filter(Boolean)
    .slice(0, 2);

  const root = document.createElement("div");
  root.id = "rewardly-popup";
  root.className = "rewardly-root";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Rewardly card recommendation");

  root.innerHTML = `
    <div class="rewardly-card">
      <div class="rewardly-topline">
        <div>
          <div class="rewardly-brand">Rewardly</div>
          <div class="rewardly-subtitle">Best card before you pay</div>
        </div>
        <div class="rewardly-merchant">${sanitize(decision.merchant?.name || "Checkout")}</div>
      </div>

      <div class="rewardly-choice">
        <div class="rewardly-logo" aria-hidden="true"></div>
        <div>
          <div class="rewardly-label">Best Card</div>
          <div class="rewardly-card-name">${sanitize(card.name)}</div>
        </div>
      </div>

      <div class="rewardly-section">
        <span>Why</span>
        <strong>${sanitize(primaryReason)}</strong>
      </div>

      <div class="rewardly-grid">
        <div>
          <span>Estimated Rewards</span>
          <strong>${sanitize(reward)}</strong>
        </div>
        <div>
          <span>Benefits</span>
          <strong>${sanitize(benefits[0] || "No extra benefit found")}</strong>
        </div>
      </div>

      <button class="rewardly-dismiss" type="button" aria-label="Dismiss Rewardly recommendation">Dismiss</button>
    </div>
  `;

  const logoHost = root.querySelector(".rewardly-logo");
  const logo = cardLogo(card);
  if (logo) logoHost.appendChild(logo);
  else logoHost.textContent = cardInitials(card.name);

  root.querySelector(".rewardly-dismiss").addEventListener("click", () => {
    rememberDismissal(dismissKey);
    root.remove();
    disconnectAfterDismiss();
  });

  (document.body || document.documentElement).appendChild(root);
  rewardlyLog("popup-rendered", {
    merchant: decision.merchant?.name || null,
    cardSlug: card.slug || null,
    cardName: card.name || null,
    url: location.href,
  });
  requestAnimationFrame(() => {
    const rect = root.getBoundingClientRect();
    const visible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight;
    rewardlyLog("popup-visible", {
      visible,
      rect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      zIndex: getComputedStyle(root).zIndex,
      url: location.href,
    });
  });
}

function ensureRewardlyStyles() {
  if (document.getElementById("rewardly-styles")) return;
  const style = document.createElement("style");
  style.id = "rewardly-styles";
  style.textContent = `
    #rewardly-popup.rewardly-root {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      width: min(342px, calc(100vw - 28px));
      color: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color-scheme: dark;
    }

    #rewardly-popup .rewardly-card {
      display: grid;
      gap: 14px;
      border: 1px solid rgba(207, 217, 255, 0.16);
      border-radius: 22px;
      background:
        radial-gradient(circle at 88% 10%, rgba(110, 231, 249, 0.18), transparent 30%),
        linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(18, 26, 42, 0.92));
      box-shadow: 0 28px 80px rgba(2, 6, 23, 0.38);
      padding: 16px;
      backdrop-filter: blur(18px);
      animation: rewardly-in 180ms ease-out both;
    }

    #rewardly-popup .rewardly-topline,
    #rewardly-popup .rewardly-choice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    #rewardly-popup .rewardly-brand {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    #rewardly-popup .rewardly-subtitle,
    #rewardly-popup .rewardly-label,
    #rewardly-popup .rewardly-section span,
    #rewardly-popup .rewardly-grid span {
      color: #a8b3c7;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    #rewardly-popup .rewardly-merchant {
      max-width: 112px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border: 1px solid rgba(207, 217, 255, 0.18);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      padding: 6px 10px;
      color: #dbeafe;
      font-size: 12px;
      font-weight: 800;
    }

    #rewardly-popup .rewardly-choice {
      justify-content: flex-start;
      align-items: center;
      border-radius: 18px;
      background: rgba(7, 12, 24, 0.38);
      padding: 12px;
    }

    #rewardly-popup .rewardly-logo {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      width: 72px;
      height: 46px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
      color: #f8fafc;
      font-size: 16px;
      font-weight: 900;
    }

    #rewardly-popup .rewardly-logo img {
      max-width: 64px;
      max-height: 39px;
      object-fit: contain;
    }

    #rewardly-popup .rewardly-card-name {
      margin-top: 3px;
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      line-height: 1.12;
    }

    #rewardly-popup .rewardly-section {
      display: grid;
      gap: 5px;
    }

    #rewardly-popup .rewardly-section strong {
      color: #e5edf9;
      font-size: 14px;
      line-height: 1.35;
    }

    #rewardly-popup .rewardly-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    #rewardly-popup .rewardly-grid div {
      display: grid;
      gap: 5px;
      min-width: 0;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.065);
      padding: 11px;
    }

    #rewardly-popup .rewardly-grid strong {
      color: #f8fafc;
      font-size: 13px;
      line-height: 1.25;
      overflow-wrap: break-word;
    }

    #rewardly-popup .rewardly-dismiss {
      min-height: 38px;
      border: 1px solid rgba(207, 217, 255, 0.18);
      border-radius: 13px;
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      font: inherit;
      font-size: 13px;
      font-weight: 850;
      cursor: pointer;
    }

    #rewardly-popup .rewardly-dismiss:hover {
      background: rgba(255, 255, 255, 0.13);
    }

    @keyframes rewardly-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function readVisibleText() {
  return String(document.body?.innerText || "").slice(0, 5000);
}

function readCheckoutAmount() {
  const text = readVisibleText();
  const match = text.match(
    /(?:order total|estimated total|total)\D{0,40}\$([0-9,]+(?:\.[0-9]{2})?)/i,
  );
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function decisionKey(merchant, checkout) {
  const host = location.hostname.replace(/^www\./i, "").toLowerCase();
  return [
    host,
    merchant.name || "merchant",
    checkout.stage || "checkout",
    location.pathname.replace(/\/+$/, "") || "/",
  ].join("::");
}

function isDismissed(key) {
  try {
    const dismissedUntil = Number(
      localStorage.getItem(`rewardly-dismiss:${key}`),
    );
    return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissal(key) {
  try {
    localStorage.setItem(
      `rewardly-dismiss:${key}`,
      String(Date.now() + REWARDLY_DISMISS_MS),
    );
    rewardlyLog("popup-dismissed", {
      key,
      dismissedForMs: REWARDLY_DISMISS_MS,
      url: location.href,
    });
  } catch {}
}

function loadRewardlyDebugSetting() {
  try {
    chrome.storage.sync.get(["DEBUG_LOGS"], (settings) => {
      rewardlyDebugEnabled = !!settings?.DEBUG_LOGS;
      rewardlyLog("debug-setting-loaded", {
        enabled: rewardlyDebugEnabled,
      });
      rewardlyLog("content-script-loaded", {
        url: location.href,
        host: location.hostname,
      });
    });
  } catch {}
}

function rewardlyLog(label, data) {
  if (!rewardlyDebugEnabled) return;
  console.log(`[Rewardly] ${label}`, data || {});
}

function handleRewardlyDiagnosticMessage(event) {
  if (event.source !== window) return;
  if (event.data?.type !== "REWARDLY_FORCE_RENDER") return;
  if (!rewardlyDebugEnabled) {
    console.warn("[Rewardly] forced-render-blocked", {
      reason: "debug mode is disabled",
      url: location.href,
    });
    return;
  }

  rewardlyLog("forced-render-requested", {
    url: location.href,
  });
  renderRewardlyPopup(
    {
      merchant: detectMerchantFromPage(),
      recommendedCard: {
        card: {
          slug: "debug-card",
          name: "Rewardly Debug Card",
        },
        primaryReason: {
          detail: "Forced render diagnostic. Recommendation logic was bypassed.",
        },
        rewardEstimate: {
          label: "Debug only",
        },
      },
      primaryReason: {
        detail: "Forced render diagnostic. Recommendation logic was bypassed.",
      },
      rewardEstimate: {
        label: "Debug only",
      },
      unlockedBenefits: [{ summary: "Popup rendering works" }],
    },
    `debug-force-render::${location.hostname}::${Date.now()}`,
  );
}

function removeRewardlyPopup() {
  document.getElementById("rewardly-popup")?.remove();
}

function disconnectAfterDismiss() {
  if (rewardlyObserver) {
    rewardlyObserver.disconnect();
    rewardlyObserver = null;
  }
}

function containsAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function isCartPath(value) {
  return /(?:^|[/-])(?:cart|bag|basket)(?:[./-]|$)|\/gp\/cart/i.test(
    value || "",
  );
}

function isConfirmationPath(value) {
  return /(?:^|[/-])(?:confirmation|receipt|thank-you|order-complete)(?:[./-]|$)/i.test(
    value || "",
  );
}

function isSignInPath(value) {
  return /\/(?:ap\/signin|signin|login)(?:[/?#]|$)/i.test(value || "");
}

function isAmazonAuthPath(value) {
  return /amazon\.[^/]+\/ap\//i.test(value || "");
}

function isAmazonCheckoutPath(value) {
  const input = value || "";
  return /(?:amazon\.[^/]+)?\/(?:gp\/buy|checkout|buy\/|gp\/buyagain|payselect|gp\/payselect|gp\/buy\/spc|gp\/buy\/payselect|gp\/buy\/addressselect|gp\/buy\/shipoptionselect|gp\/buy\/signin)/i.test(
    input,
  );
}

function normalizeRewardlyHost(value) {
  return String(value || "")
    .replace(/^(?:www|m)\./i, "")
    .toLowerCase();
}

function findRewardlyMerchant(host, text) {
  if (host) {
    const direct = REWARDLY_MERCHANTS[host];
    if (direct) return direct;

    const parts = host.split(".");
    for (let index = 1; index < parts.length - 1; index += 1) {
      const suffix = parts.slice(index).join(".");
      if (REWARDLY_MERCHANTS[suffix]) return REWARDLY_MERCHANTS[suffix];
    }
  }

  return Object.values(REWARDLY_MERCHANTS).find((merchant) =>
    merchant.aliases.some((alias) => text.includes(alias)),
  );
}

function cleanMerchantName(value) {
  return String(value || "")
    .replace(/\s+\|\s+.*/, "")
    .replace(/\s*[-|•]\s*(checkout|payment|cart|order).*$/i, "")
    .trim();
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sanitize(value) {
  return String(value || "").replace(
    /[<>&]/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char],
  );
}

function cardLogo(card) {
  const file = CARD_LOGOS[card?.slug];
  if (!file) return null;
  const image = document.createElement("img");
  image.src = chrome.runtime.getURL(`assets/card-logos/${file}`);
  image.alt = "";
  image.onerror = () => image.remove();
  return image;
}

function cardInitials(name) {
  return String(name || "Card")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
