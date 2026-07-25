// Rewardly magic moment: detect checkout, request one wallet decision, show one card.

const REWARDLY_CHECK_DELAY_MS = 250;
const REWARDLY_MIN_CHECK_INTERVAL_MS = 750;
const REWARDLY_DISMISS_MS = 30 * 60 * 1000;
const REWARDLY_REQUEST_TIMEOUT_MS = 3000;
const REWARDLY_CHECKOUT_EXIT_GRACE_MS = 4000;
const REWARDLY_LIFECYCLE = {
  IDLE: "IDLE",
  CANDIDATE: "CANDIDATE",
  CONFIRMED: "CONFIRMED",
  RECOMMENDATION_VISIBLE: "RECOMMENDATION_VISIBLE",
  EXIT_PENDING: "EXIT_PENDING",
  DISMISSED: "DISMISSED",
  PURCHASE_CONFIRMED: "PURCHASE_CONFIRMED",
  EXITED: "EXITED",
};
const REWARDLY_SUPPORTED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "amazon.com",
  "www.amazon.com",
  "smile.amazon.com",
  "lululemon.com",
  "www.lululemon.com",
  "shop.lululemon.com",
  "checkout.lululemon.com",
  "apple.com",
  "www.apple.com",
  "secure.store.apple.com",
  "target.com",
  "www.target.com",
  "m.target.com",
  "bestbuy.com",
  "www.bestbuy.com",
  "walmart.com",
  "www.walmart.com",
];
const REWARDLY_SUPPORTED_HOST_SUFFIXES = [
  "amazon.com",
  "lululemon.com",
  "apple.com",
  "target.com",
  "bestbuy.com",
  "walmart.com",
];

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
let rewardlyLifecycleState = REWARDLY_LIFECYCLE.IDLE;
let rewardlyActiveSession = null;
let rewardlyPendingExit = null;
let rewardlyLastDecision = null;

if (isRewardlySupportedHost(location.hostname)) {
  initRewardly();
} else {
  removeRewardlyPopup();
}

function initRewardly() {
  if (!isRewardlySupportedHost(location.hostname)) {
    removeRewardlyPopup();
    return;
  }
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
  scheduleRewardlyCheck("initial-load", 50);
  rewardlyObserver = new MutationObserver(() => {
    scheduleRewardlyCheck("dom-mutated");
  });
  rewardlyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "aria-checked",
      "aria-expanded",
      "aria-selected",
      "checked",
      "class",
      "data-state",
      "data-selected",
      "data-testid",
      "hidden",
      "style",
      "value",
    ],
  });
  document.addEventListener("click", handleRewardlyUserInteraction, true);
  document.addEventListener("change", handleRewardlyUserInteraction, true);
  document.addEventListener("input", handleRewardlyUserInteraction, true);
  document.addEventListener("keydown", handleRewardlyUserInteraction, true);
  setInterval(() => {
    if (location.href === rewardlyLastUrl) return;
    rewardlyLastUrl = location.href;
    scheduleRewardlyCheck("url-changed", 50);
  }, 500);
}

function handleRewardlyUserInteraction(event) {
  const target = event.target;
  const text = String(
    target?.innerText ||
      target?.value ||
      target?.getAttribute?.("aria-label") ||
      target?.textContent ||
      "",
  );
  const candidate = target?.closest?.(
    "button,label,input,select,[role='radio'],[role='button'],[role='option'],[aria-label],[data-testid],[class*='payment' i],[id*='payment' i]",
  );
  if (
    candidate &&
    /payment|pay|card|credit|debit|cash|paypal|apple pay|google pay|klarna|gift card/i.test(
      text || String(candidate.innerText || candidate.textContent || ""),
    )
  ) {
    scheduleRewardlyCheck("payment-interaction", 75);
    return;
  }
  if (/click|change|input/i.test(event.type)) {
    scheduleRewardlyCheck(`user-${event.type}`, 200);
  }
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
    const pipelineStartedAt = Date.now();
    const safeCurrentUrl = safeRewardlyUrl(location.href);
    if (!isRewardlySupportedHost(location.hostname)) {
      endRewardlySession("merchant-changed", {
        url: safeCurrentUrl,
        host: location.hostname,
      });
      return;
    }
    rewardlyLog("pipeline-started", {
      triggerReason,
      url: safeCurrentUrl,
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
    document.documentElement.setAttribute(
      "data-rewardly-checkout-confidence",
      String(checkout.confidence ?? ""),
    );
    document.documentElement.setAttribute(
      "data-rewardly-checkout-confidence-label",
      checkout.confidenceLabel || "UNKNOWN",
    );
    rewardlyLog("checkout-detected", {
      stage: checkout.stage,
      shouldTriggerRecommendation: checkout.shouldTriggerRecommendation,
      confidence: checkout.confidence,
      confidenceLabel: checkout.confidenceLabel,
      threshold: 0.85,
      recommendationRequestSent: false,
      url: safeCurrentUrl,
    });
    if (checkout.isCheckout) {
      trackRewardlyEvent("checkout_detected", {
        sessionId: checkoutSessionId(null, checkout),
        stage: checkout.stage,
        confidenceLabel: checkout.confidenceLabel,
      });
    }
    rewardlyLog(`Checkout confidence: ${checkout.confidenceLabel}`, {
      confidence: checkout.confidence,
      stage: checkout.stage,
      url: safeCurrentUrl,
    });
    if (checkout.signalSummary) {
      rewardlyLog("checkout-signal-summary", {
        merchant: checkout.signalSummary.merchant,
        url: safeCurrentUrl,
        routeSignals: checkout.signalSummary.routeSignals,
        shippingSignals: checkout.signalSummary.shippingSignals,
        paymentSignals: checkout.signalSummary.paymentSignals,
        reviewSignals: checkout.signalSummary.reviewSignals,
        confirmationSignals: checkout.signalSummary.confirmationSignals,
        cartSignals: checkout.signalSummary.cartSignals,
        activePaymentProviders: checkout.signalSummary.activePaymentProviders,
        stage: checkout.stage,
        confidence: checkout.confidence,
        confidenceLabel: checkout.confidenceLabel,
        threshold: 0.85,
        shouldTriggerRecommendation: checkout.shouldTriggerRecommendation,
        suppressionReason: checkout.suppressionReason || null,
        recommendationRequestSent: false,
      });
    }
    if (!checkout.shouldTriggerRecommendation) {
      const suppressionReason = checkoutSuppressionReason(checkout);
      if (checkout.stage === "confirmation") {
        endRewardlySession("purchase-confirmed", {
          checkout,
          url: safeCurrentUrl,
        });
        return;
      }
      if (rewardlyActiveSession && document.getElementById("rewardly-popup")) {
        scheduleRewardlyCheckoutExit(checkout, suppressionReason);
        return;
      }
      rewardlyLog("Waiting for checkout", {
        checkoutConfidence: checkout.confidenceLabel,
        confidence: checkout.confidence,
        stage: checkout.stage,
        reason: suppressionReason,
        threshold: 0.85,
        recommendationRequestSent: false,
        url: safeCurrentUrl,
      });
      rewardlyLog("waiting-for-checkout", {
        checkoutConfidence: checkout.confidenceLabel,
        confidence: checkout.confidence,
        stage: checkout.stage,
        reason: suppressionReason,
        threshold: 0.85,
        recommendationRequestSent: false,
        url: safeCurrentUrl,
      });
      rewardlyLog("pipeline-failed", {
        stage: "checkout-detection",
        reason: suppressionReason,
        url: safeCurrentUrl,
        checkoutStage: checkout.stage,
        checkoutConfidence: checkout.confidenceLabel,
        threshold: 0.85,
        recommendationRequestSent: false,
      });
      return;
    }

    const merchant = detectMerchantFromPage();
    const key = decisionKey(merchant, checkout);
    const previousSession = rewardlyActiveSession;
    if (previousSession && previousSession.key !== key) {
      endRewardlySession("checkout-session-replaced", {
        previousSession,
        nextKey: key,
        merchant: merchant.name || null,
        checkout,
      });
    }
    confirmRewardlyCheckoutSession(key, merchant, checkout);
    trackRewardlyEvent("merchant_detected", {
      sessionId: key,
      merchant: merchant.name,
      hostname: merchant.hostname,
      category: merchant.category,
      stage: checkout.stage,
      merchantClassificationLatencyMs: Date.now() - pipelineStartedAt,
    });
    rewardlyLog("merchant-detected", {
      merchant: merchant.name,
      hostname: merchant.hostname,
      category: merchant.category,
      mcc: merchant.mcc,
      url: safeCurrentUrl,
    });
    rewardlyLog("Merchant detected", {
      merchant: merchant.name,
      hostname: merchant.hostname,
      category: merchant.category,
      mcc: merchant.mcc,
      url: safeCurrentUrl,
    });
    if (
      rewardlyLastDecision &&
      rewardlyActiveSession?.key === key &&
      document.getElementById("rewardly-popup")
    ) {
      rewardlyLog("popup-retained", {
        reason: "active checkout session already has visible recommendation",
        key,
        state: rewardlyLifecycleState,
        stage: checkout.stage,
        confidence: checkout.confidence,
        url: safeCurrentUrl,
      });
      return;
    }
    if (!merchant.name || rewardlyInFlight || rewardlyShownKey === key) {
      rewardlyLog("pipeline-failed", {
        stage: "pre-request",
        merchant: merchant.name || null,
        url: safeCurrentUrl,
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
      trackRewardlyEvent(
        rewardlyInFlight || rewardlyShownKey === key
          ? "popup_hidden"
          : "merchant_detection_error",
        {
          merchant: merchant.name || null,
          hostname: location.hostname,
          stage: checkout.stage,
          duplicateContext: rewardlyShownKey === key,
          errorType: !merchant.name
            ? "merchant_missing"
            : rewardlyInFlight
              ? "request_in_flight"
              : "duplicate_checkout_context",
        },
      );
      return;
    }
    if (isDismissed(key)) {
      rewardlyLog("pipeline-failed", {
        stage: "dismissal-check",
        merchant: merchant.name,
        url: safeCurrentUrl,
        reason: "dismissed for checkout context",
        key,
      });
      trackRewardlyEvent("popup_hidden", {
        merchant: merchant.name,
        hostname: location.hostname,
        stage: checkout.stage,
        errorType: "dismissed_context",
      });
      return;
    }

    rewardlyInFlight = true;
    rewardlyShownKey = key;
    const recommendationRequestedAt = Date.now();

    const payload = {
      merchant: merchant.name,
      hostname: location.hostname,
      url: safeCurrentUrl,
      title: document.title,
      mcc: merchant.mcc,
      category: merchant.category,
      merchantSignals: collectRewardlyMerchantSignals(merchant, checkout),
      restrictToWallet: true,
      purchaseContext: {
        surface: "extension",
        url: safeCurrentUrl,
        checkoutDetected: checkout.isCheckout,
        checkoutStage: checkout.stage,
        amount: readCheckoutAmount(),
        purchase: readPurchaseFromPage(merchant),
        timestamp: new Date().toISOString(),
      },
    };

    rewardlyLog("recommendation-requested", {
      merchant: payload.merchant,
      url: payload.url,
      payload: safeRewardlyDecisionPayload(payload),
      recommendationRequestSent: true,
    });
    rewardlyLog("Rendering popup", {
      checkoutConfidence: checkout.confidenceLabel,
      confidence: checkout.confidence,
      merchant: payload.merchant,
      stage: checkout.stage,
    });
    trackRewardlyEvent("recommendation_requested", {
      sessionId: key,
      merchant: payload.merchant,
      hostname: location.hostname,
      category: payload.category,
      stage: checkout.stage,
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
        rewardlyLog(
          "popup-explanation-input",
          explanationDebugPayload(decision),
        );
        if (!decision?.recommendedCard) {
          endRewardlySession("recommendation-invalidated", {
            key,
            merchant: payload.merchant,
            checkout,
            url: payload.url,
          });
          rewardlyLog("pipeline-failed", {
            stage: "recommendation-response",
            merchant: payload.merchant,
            url: payload.url,
            reason: "no recommended card returned",
          });
        trackRewardlyEvent("recommendation_failed", {
            sessionId: key,
            merchant: payload.merchant,
            hostname: location.hostname,
            stage: checkout.stage,
            errorType: "no_recommendation",
            walletCardCount: Array.isArray(decision?.wallet?.cardSlugs)
              ? decision.wallet.cardSlugs.length
              : undefined,
          });
          renderRewardlyStatePopup({
            state: "empty",
            title:
              decision?.presentation?.trust?.recommendationReason ||
              "Rewardly couldn't determine the best card for this purchase.",
            body:
              decision?.wallet?.cardSlugs?.length === 0
                ? "Add your cards to begin receiving recommendations."
                : "Try continuing checkout or use your strongest everyday rewards card.",
            primaryLabel: "Dismiss",
            dismissKey: key,
            merchant: payload.merchant,
          });
          return;
        }
        rewardlyLastDecision = decision;
        rewardlyLifecycleState = REWARDLY_LIFECYCLE.RECOMMENDATION_VISIBLE;
        trackRewardlyEvent("recommendation_displayed", {
          sessionId: key,
          merchant: payload.merchant,
          hostname: location.hostname,
          category: payload.category,
          stage: checkout.stage,
          confidenceLabel: decision?.presentation?.trust?.confidenceLabel || null,
          recommendationLatencyMs: Date.now() - recommendationRequestedAt,
          estimatedRewardValueUSD: analyticsEstimatedRewardValue(decision),
          advantageOverRunnerUpUSD: analyticsAdvantageOverRunnerUp(decision),
          rewardType: analyticsRewardType(decision),
          hasRecommendation: true,
          walletCardCount: Array.isArray(decision?.wallet?.cardSlugs)
            ? decision.wallet.cardSlugs.length
            : undefined,
        });
        renderRewardlyPopup(decision, key);
      })
      .catch((error) => {
        rewardlyInFlight = false;
        rewardlyShownKey = "";
        rewardlyLastDecision = null;
        rewardlyLog("pipeline-failed", {
          stage: "recommendation-request",
          merchant: payload.merchant,
          url: payload.url,
          message: String(error?.message || error),
        });
        trackRewardlyEvent(
          error?.code === "REWARDLY_TIMEOUT" ||
            /timed out|timeout/i.test(String(error?.message || ""))
            ? "recommendation_timeout"
            : "recommendation_failed",
          {
            sessionId: key,
            merchant: payload.merchant,
            hostname: location.hostname,
            stage: checkout.stage,
            errorCode: error?.code || "REWARDLY_DECISION_ERROR",
            errorType: "decision_request_failed",
          },
        );
        console.warn("[Rewardly] decision failed", error);
        renderRewardlyStatePopup({
          state: "error",
          title: "We couldn't analyze this checkout.",
          body: "Something went wrong while checking your payment methods.",
          primaryLabel: "Retry",
          secondaryLabel: "Dismiss",
          dismissKey: key,
          merchant: payload.merchant,
          onPrimary: () => {
            trackRewardlyEvent("retry_clicked", {
              sessionId: key,
              merchant: payload.merchant,
              hostname: location.hostname,
              stage: checkout.stage,
            });
            scheduleRewardlyCheck("retry-after-error", 75);
          },
        });
      });
  } catch (error) {
    rewardlyInFlight = false;
    rewardlyShownKey = "";
    rewardlyLog("pipeline-failed", {
        stage: "content-script",
        url: safeRewardlyUrl(location.href),
      message: String(error?.message || error),
    });
    trackRewardlyEvent("merchant_detection_error", {
      hostname: location.hostname,
      errorType: "content_script_error",
    });
    console.warn("[Rewardly] checkout detection failed", error);
  }
}

function collectRewardlyMerchantSignals(merchant, checkout) {
  const metadataSignals = collectRewardlyStructuredMerchantSignals();
  const providerSignals = Array.from(
    new Set(
      [
        ...(checkout?.signalSummary?.activePaymentProviders || []),
        ...readMerchantMetaValues("script[src],iframe[src]", "src", [
          "shopify",
          "stripe",
          "paypal",
          "shop pay",
          "amazon pay",
        ]),
      ]
        .filter(Boolean)
        .map((value) => String(value).slice(0, 80)),
    ),
  ).slice(0, 12);
  const domSignals = Array.from(
    new Set(
      [
        ...readMerchantMetaValues("[data-testid],[aria-label]", "data-testid", [
          "merchant",
          "store",
          "payment",
          "checkout",
        ]),
        ...readMerchantMetaValues("[data-testid],[aria-label]", "aria-label", [
          "merchant",
          "store",
          "payment",
          "checkout",
        ]),
      ]
        .filter(Boolean)
        .map((value) => String(value).slice(0, 100)),
    ),
  )
    .slice(0, 20)
    .map((value) => ({
      type: /payment|checkout/i.test(value)
        ? "checkout_marker"
        : "merchant_marker",
      value,
      source: "dom-attribute",
    }));

  return {
    url: safeRewardlyUrl(location.href),
    hostname: location.hostname,
    pageTitle: document.title.slice(0, 160),
    detectedMerchantLabel: merchant?.name || "",
    documentTextSignals: [
      merchant?.name,
      merchant?.category,
      checkout?.stage,
    ]
      .filter(Boolean)
      .map((value) => String(value).slice(0, 120)),
    structuredData: metadataSignals,
    checkoutProviderSignals: providerSignals,
    domSignals,
    purchaseChannelHint: "online_direct",
    checkoutStage: checkout?.stage || "unknown",
    transactionDate: new Date().toISOString(),
  };
}

function collectRewardlyStructuredMerchantSignals() {
  const signals = [];
  for (const selector of [
    "meta[property='og:site_name']",
    "meta[name='application-name']",
    "meta[name='apple-mobile-web-app-title']",
  ]) {
    const value = document.querySelector(selector)?.getAttribute("content");
    if (value) {
      signals.push({
        type: "merchant_name",
        value: value.slice(0, 120),
        source: selector,
      });
    }
  }
  return signals.slice(0, 12);
}

function readMerchantMetaValues(selector, attribute, allowlist) {
  const values = [];
  document.querySelectorAll(selector).forEach((node) => {
    const value = node.getAttribute(attribute);
    if (!value) return;
    const lower = value.toLowerCase();
    if (allowlist.some((token) => lower.includes(token))) {
      values.push(value);
    }
  });
  return values;
}

function safeRewardlyUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return "";
  }
}

function safeRewardlyDecisionPayload(payload) {
  return {
    merchant: payload?.merchant || null,
    hostname: payload?.hostname || null,
    url: payload?.url || null,
    mcc: payload?.mcc || null,
    category: payload?.category || null,
    restrictToWallet: payload?.restrictToWallet !== false,
    checkoutStage: payload?.purchaseContext?.checkoutStage || null,
    checkoutDetected: !!payload?.purchaseContext?.checkoutDetected,
    amountPresent: typeof payload?.purchaseContext?.amount === "number",
    merchantSignalSummary: {
      hostname: payload?.merchantSignals?.hostname || null,
      checkoutProviderSignalCount: Array.isArray(
        payload?.merchantSignals?.checkoutProviderSignals,
      )
        ? payload.merchantSignals.checkoutProviderSignals.length
        : 0,
      domSignalCount: Array.isArray(payload?.merchantSignals?.domSignals)
        ? payload.merchantSignals.domSignals.length
        : 0,
      structuredDataCount: Array.isArray(payload?.merchantSignals?.structuredData)
        ? payload.merchantSignals.structuredData.length
        : 0,
    },
  };
}

function requestPaymentDecision(payload) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new Error("Decision request timed out");
      error.code = "REWARDLY_TIMEOUT";
      reject(error);
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
        const decision = response.data?.decision || null;
        if (decision && response.data?.presentation) {
          decision.presentation = response.data.presentation;
        }
        resolve(decision);
      },
    );
  });
}

function detectCheckoutFromPage() {
  const signals = collectCheckoutSignals();
  return detectCheckout({
    url: location.href,
    pathname: location.pathname,
    title: document.title,
    visibleText: readVisibleText(),
    hasPaymentForm: signals.visiblePaymentSignals > 0,
    hasPaymentIframe: signals.visibleHostedPaymentSignals > 0,
    hasSavedPaymentMethod:
      signals.visibleSavedPaymentSignals + signals.visibleSavedPaymentTextSignals > 0,
    hasExpressCheckoutControl: signals.visibleExpressCheckoutSignals > 0,
    hasPaymentStepLabel: signals.visiblePaymentStepSignals > 0,
    hasPaymentOptionControl: signals.visiblePaymentOptionSignals > 0,
    hasBillingAddressControl: signals.visibleBillingSignals > 0,
    hasShippingForm: signals.visibleShippingSignals > 0,
    hasCheckoutProgress: signals.visibleCheckoutProgressSignals > 0,
    hasPlaceOrderButton: signals.visibleReviewSignals > 0,
    hasOrderSummary: signals.visibleOrderSummarySignals > 0,
    hasSubtotalOrTotal: Boolean(readCheckoutAmount()),
  });
}

function collectCheckoutSignals() {
  return {
    visibleShippingSignals: countVisibleSignals([
      "input[autocomplete='shipping street-address']",
      "input[autocomplete='postal-code']",
      "input[name*='address' i]",
      "input[id*='address' i]",
      "input[name*='postal' i]",
      "input[id*='postal' i]",
      "input[name*='zip' i]",
      "input[id*='zip' i]",
      "form[action*='address' i]",
      "form[action*='shipping' i]",
      "[data-testid*='shipping' i]",
      "[data-testid*='delivery' i]",
    ]),
    visiblePaymentSignals: countVisibleSignals([
      "input[name*='card' i]",
      "input[id*='card' i]",
      "input[autocomplete='cc-number']",
      "input[autocomplete='cc-exp']",
      "input[autocomplete='cc-csc']",
      "input[name*='security' i]",
      "input[id*='security' i]",
      "input[name*='cvv' i]",
      "input[id*='cvv' i]",
      "input[name*='ppw' i]",
      "input[id*='ppw' i]",
    ]) + countSameOriginIframeSignals([
      "input[name*='card' i]",
      "input[id*='card' i]",
      "input[autocomplete='cc-number']",
      "input[autocomplete='cc-exp']",
      "input[autocomplete='cc-csc']",
      "input[name*='security' i]",
      "input[id*='security' i]",
      "input[name*='cvv' i]",
      "input[id*='cvv' i]",
    ]),
    visibleHostedPaymentSignals: countVisibleSignals([
      "iframe[src*='payment' i]",
      "iframe[src*='card' i]",
      "iframe[src*='checkout' i]",
      "iframe[src*='secure' i]",
      "iframe[name*='payment' i]",
      "iframe[name*='card' i]",
      "iframe[name*='checkout' i]",
      "iframe[id*='payment' i]",
      "iframe[id*='card' i]",
      "iframe[title*='payment' i]",
      "iframe[title*='card' i]",
      "iframe[aria-label*='payment' i]",
      "iframe[aria-label*='card' i]",
    ]),
    visibleSavedPaymentSignals: countVisibleSignals([
      "[data-testid*='payment' i]",
      "[data-testid*='pay' i]",
      "#payment-information",
      "#payChangeButtonId",
      "form[action*='payselect' i]",
      "form[action*='buy' i]",
      "[aria-label*='payment method' i]",
      "[aria-label*='pay with' i]",
      "[data-testid*='saved-payment' i]",
      "[class*='payment-option' i]",
      "[class*='paymentMethod' i]",
      "[id*='payment-option' i]",
      "[id*='paymentMethod' i]",
    ]),
    visibleSavedPaymentTextSignals: countVisibleTextSignals(
      "button,label,[role='radio'],[role='button'],[role='option'],[aria-checked],[aria-selected],[data-testid*='payment' i],[data-testid*='pay' i],[class*='payment' i],[id*='payment' i]",
      /credit or debit card|credit card|debit card|card ending in|saved card|payment method|add payment|edit payment|change payment|cash|gift card/i,
    ),
    visibleExpressCheckoutSignals: countVisibleTextSignals(
      "button,input[type='submit'],a,[role='button']",
      /apple pay|paypal|pay pal|google pay|shop pay|express checkout/i,
    ),
    visiblePaymentStepSignals: countVisibleTextSignals(
      "h1,h2,h3,legend,label,section,fieldset,[role='heading'],[aria-label],[data-testid*='payment' i],[data-testid*='pay' i],[id*='payment' i],[class*='payment' i],[id*='pay' i],[class*='pay' i]",
      /payment information|payment method|payment details|payment options|how do you want to pay|how would you like to pay|choose how to pay|select payment|pay with/i,
    ),
    visiblePaymentOptionSignals: countVisibleTextSignals(
      "button,label,[role='radio'],[role='button'],[role='option'],input[type='radio'],[aria-label],[aria-checked],[aria-selected],[data-selected],[data-state],[data-testid*='payment' i],[data-testid*='pay' i],[class*='payment' i],[id*='payment' i]",
      /credit card|debit card|credit or debit card|card ending in|saved card|payment method|add payment|edit payment|change payment|paypal|pay pal|apple pay|klarna|google pay|cash|gift card/i,
    ),
    visibleBillingSignals: countVisibleSignals([
      "input[autocomplete='billing street-address']",
      "input[name*='billing' i]",
      "input[id*='billing' i]",
      "[data-testid*='billing' i]",
    ]),
    visibleReviewSignals: countVisibleTextSignals(
      "button,input[type='submit'],a",
      /place order|place your order|submit order|complete purchase/i,
    ),
    visibleCheckoutProgressSignals: countVisibleTextSignals(
      "nav,ol,ul,[role='list'],[aria-label*='checkout' i],[data-testid*='checkout' i]",
      /shipping|delivery|payment|review/i,
    ),
    visibleOrderSummarySignals: countVisibleSignals([
      "#spc-orders",
      "#subtotals-marketplace-table",
      "#orderSummaryPrimaryActionBtn",
      "#submitOrderButtonId",
      "[data-testid*='order-summary' i]",
      "[class*='order-summary' i]",
      "[id*='order-summary' i]",
      "[id*='orderSummary' i]",
      "[class*='orderSummary' i]",
    ]),
  };
}

// Browser-ready copy of rewardly-core checkoutDetection. Keep behavior aligned
// with packages/rewardly-core/src/checkoutDetection.ts until the extension is bundled.
const DEFAULT_CHECKOUT_PROFILE = {
  id: "generic",
  domains: [],
  checkoutRouteHints: [
    /(?:^|[/-])(?:checkout|checkouts|payment|pay|shipping|delivery|review-order|order-review|place-order)(?:[/?#./-]|$)/i,
    /(?:^|[/-])co-(?:delivery|shipping|payment|review|place-order)(?:[/?#./-]|$)/i,
  ],
  cartRouteHints: [/(?:^|[/-])(?:cart|bag|basket)(?:[./-]|$)/i],
  confirmationRouteHints: [
    /(?:^|[/-])(?:thankyou|thank-you|order-confirmation|order-complete)(?:[/?#./-]|$)/i,
  ],
  reviewRouteHints: [
    /(?:^|[/-])(?:review-order|order-review|place-order)(?:[/?#./-]|$)/i,
    /(?:^|[/-])co-(?:review|place-order)(?:[/?#./-]|$)/i,
  ],
  authRouteHints: [/\/(?:signin|login)(?:[/?#]|$)/i],
  browsingRouteHints: [
    /(?:^|[/-])(?:search|s|wishlist|wish-list|favorites|collections?|categories?|category|c|product|products|p|dp)(?:[/?#./-]|$)/i,
  ],
};

const MERCHANT_CHECKOUT_PROFILES = [
  {
    ...DEFAULT_CHECKOUT_PROFILE,
    id: "amazon",
    domains: [/(?:^|\.)amazon\.[^.]+$/i],
    checkoutRouteHints: [
      /(?:amazon\.[^/]+)?\/(?:gp\/buy|checkout|buy\/|payselect|gp\/payselect|gp\/buy\/spc|gp\/buy\/payselect|gp\/buy\/addressselect|gp\/buy\/shipoptionselect|gp\/buy\/signin)/i,
    ],
    cartRouteHints: [/\/gp\/cart/i, ...DEFAULT_CHECKOUT_PROFILE.cartRouteHints],
    confirmationRouteHints: [
      /\/gp\/buy\/thankyou(?:[/?#]|$)/i,
      ...DEFAULT_CHECKOUT_PROFILE.confirmationRouteHints,
    ],
    reviewRouteHints: [
      /(?:amazon\.[^/]+)?\/(?:checkout\/.*\/spc|gp\/buy\/spc)(?:[/?#]|$)/i,
      /[?&](?:pipelineType=Chewbacca|referrer=spc)(?:&|$)/i,
      ...(DEFAULT_CHECKOUT_PROFILE.reviewRouteHints || []),
    ],
    authRouteHints: [
      /amazon\.[^/]+\/ap\//i,
      ...(DEFAULT_CHECKOUT_PROFILE.authRouteHints || []),
    ],
    knownPaymentProviders: ["Amazon Pay"],
    weights: { reviewRoute: 0.55 },
  },
  {
    ...DEFAULT_CHECKOUT_PROFILE,
    id: "lululemon",
    domains: [/(?:^|\.)lululemon\.com$/i],
    checkoutRouteHints: [
      /\/shop\/mybag(?:[/?#]|$)/i,
      ...DEFAULT_CHECKOUT_PROFILE.checkoutRouteHints,
    ],
    cartRouteHints: [
      /\/shop\/mybag(?:[/?#]|$)/i,
      ...DEFAULT_CHECKOUT_PROFILE.cartRouteHints,
    ],
    knownPaymentProviders: ["Klarna", "PayPal"],
    weights: { cartRoute: -0.04, checkoutRoute: 0.08 },
  },
  { ...DEFAULT_CHECKOUT_PROFILE, id: "target", domains: [/(?:^|\.)target\.com$/i] },
  { ...DEFAULT_CHECKOUT_PROFILE, id: "walmart", domains: [/(?:^|\.)walmart\.com$/i] },
  { ...DEFAULT_CHECKOUT_PROFILE, id: "apple", domains: [/(?:^|\.)apple\.com$/i] },
  { ...DEFAULT_CHECKOUT_PROFILE, id: "best-buy", domains: [/(?:^|\.)bestbuy\.com$/i] },
];

function detectCheckout(input) {
  const text = [input.url, input.pathname, input.title, input.visibleText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const route = [input.url, input.pathname].filter(Boolean).join(" ");
  const path = input.pathname || input.url;
  const profile = resolveCheckoutProfile(input);
  const signals = collectCheckoutSignalSummary(input, profile, text, route, path);

  if (signals.routeSignals.authRoute) {
    return checkoutResult({
      isCheckout: false,
      stage: "unknown",
      confidence: 0.88,
      shouldTriggerRecommendation: false,
      suppressionReason: "sign-in or authentication page",
      signalSummary: signals,
    });
  }

  if (signals.routeSignals.confirmationRoute || signals.confirmationSignals > 0) {
    return checkoutResult({
      isCheckout: false,
      stage: "confirmation",
      confidence: 0.9,
      shouldTriggerRecommendation: false,
      suppressionReason: "stage is post-purchase confirmation",
      signalSummary: signals,
    });
  }

  const activeCheckoutSignals =
    signals.shippingSignals + signals.paymentSignals + signals.reviewSignals;
  if (signals.routeSignals.browsingRoute && !signals.routeSignals.checkoutRoute) {
    return checkoutResult({
      isCheckout: false,
      stage: "unknown",
      confidence: 0.18,
      shouldTriggerRecommendation: false,
      suppressionReason: "browsing or product page",
      signalSummary: signals,
    });
  }

  if (signals.scores.review >= 0.85) {
    return checkoutResult({
      isCheckout: true,
      stage: "review",
      confidence: signals.scores.review,
      shouldTriggerRecommendation: signals.paymentSignals > 0,
      suppressionReason:
        signals.paymentSignals > 0
          ? undefined
          : "review stage without payment decision evidence",
      signalSummary: signals,
    });
  }

  if (signals.scores.payment >= 0.85) {
    return checkoutResult({
      isCheckout: true,
      stage: "payment",
      confidence: signals.scores.payment,
      shouldTriggerRecommendation: true,
      signalSummary: signals,
    });
  }

  if (signals.scores.shipping >= 0.85) {
    return checkoutResult({
      isCheckout: true,
      stage: "checkout",
      confidence: signals.scores.shipping,
      shouldTriggerRecommendation: true,
      signalSummary: signals,
    });
  }

  if (signals.routeSignals.cartRoute || signals.cartSignals > 0) {
    return checkoutResult({
      isCheckout: true,
      stage: "cart",
      confidence: signals.scores.cart,
      shouldTriggerRecommendation: false,
      suppressionReason:
        activeCheckoutSignals > 0
          ? "insufficient strong signals"
          : "cart-only state",
      signalSummary: signals,
    });
  }

  if (signals.routeSignals.checkoutRoute) {
    return checkoutResult({
      isCheckout: true,
      stage: "checkout",
      confidence: 0.6,
      shouldTriggerRecommendation: false,
      suppressionReason: "checkout route without active payment or review evidence",
      signalSummary: signals,
    });
  }

  return checkoutResult({
    isCheckout: false,
    stage: "unknown",
    confidence: 0.2,
    shouldTriggerRecommendation: false,
    suppressionReason: "no checkout evidence",
    signalSummary: signals,
  });
}

function resolveCheckoutProfile(input) {
  const host = input.hostname || safeHostname(input.url);
  return (
    MERCHANT_CHECKOUT_PROFILES.find((profile) =>
      profile.domains.some((domain) => domain.test(host)),
    ) || DEFAULT_CHECKOUT_PROFILE
  );
}

function safeHostname(value) {
  try {
    return new URL(value || "").hostname;
  } catch {
    return "";
  }
}

function collectCheckoutSignalSummary(input, profile, text, route, path) {
  const routeSignals = {
    checkoutRoute: matchesAny(route, profile.checkoutRouteHints),
    cartRoute: matchesAny(path || route, profile.cartRouteHints),
    browsingRoute:
      isHomePath(path) ||
      matchesAny(path || route, profile.browsingRouteHints || []),
    confirmationRoute: matchesAny(
      path || route,
      profile.confirmationRouteHints,
    ),
    reviewRoute: matchesAny(route, profile.reviewRouteHints || []),
    authRoute: matchesAny(path || route, profile.authRouteHints || []),
  };
  const orderTotalSignals =
    Number(Boolean(input.hasOrderSummary)) +
    Number(Boolean(input.hasSubtotalOrTotal));
  const shippingSignals =
    Number(Boolean(input.hasShippingForm)) +
    Number(Boolean(input.hasCheckoutProgress && containsAny(text, [
      "shipping address",
      "delivery address",
      "delivery options",
      "ship to",
    ])));
  const paymentSignals =
    Number(Boolean(input.hasPaymentForm)) +
    Number(Boolean(input.hasPaymentIframe)) +
    Number(Boolean(input.hasSavedPaymentMethod)) +
    Number(Boolean(input.hasExpressCheckoutControl)) +
    Number(Boolean(input.hasPaymentStepLabel)) +
    Number(Boolean(input.hasPaymentOptionControl)) +
    Number(Boolean(input.hasBillingAddressControl));
  const reviewSignals =
    Number(Boolean(input.hasPlaceOrderButton)) + Number(routeSignals.reviewRoute);
  const confirmationSignals = Number(isPostPurchaseConfirmationText(text));
  const cartSignals =
    Number(routeSignals.cartRoute) +
    Number(containsAny(text, ["cart", "bag", "basket"]));
  const activePaymentProviders = [
    input.hasPaymentIframe ? "hosted-payment-iframe" : null,
    input.hasExpressCheckoutControl ? "express-checkout-control" : null,
    input.hasPaymentOptionControl ? "payment-option-control" : null,
    ...(profile.knownPaymentProviders || []).filter((provider) =>
      text.includes(provider.toLowerCase()),
    ),
  ].filter(Boolean);
  const checkoutRouteWeight = profile.weights?.checkoutRoute ?? 0.08;
  const cartRouteWeight = profile.weights?.cartRoute ?? -0.06;
  const reviewRouteWeight = profile.weights?.reviewRoute ?? 0.18;
  const routeWeight = routeSignals.checkoutRoute ? checkoutRouteWeight : 0;
  const cartPenalty = routeSignals.cartRoute ? cartRouteWeight : 0;

  return {
    merchant: profile.id,
    routeSignals,
    shippingSignals,
    paymentSignals,
    reviewSignals,
    confirmationSignals,
    cartSignals,
    activePaymentProviders,
    orderTotalSignals,
    checkoutProgressSignals: Number(Boolean(input.hasCheckoutProgress)),
    scores: {
      shipping: checkoutConfidence([
        input.hasShippingForm ? 0.6 : 0,
        orderTotalSignals > 0 ? 0.18 : 0,
        input.hasCheckoutProgress ? 0.18 : 0,
        routeSignals.checkoutRoute ? Math.max(routeWeight, 0.09) : 0,
        routeSignals.cartRoute ? 0.08 : 0,
      ]),
      payment: checkoutConfidence([
        input.hasPaymentForm ? 0.84 : 0,
        input.hasPaymentIframe ? 0.62 : 0,
        input.hasSavedPaymentMethod ? 0.52 : 0,
        input.hasExpressCheckoutControl ? 0.72 : 0,
        input.hasPaymentStepLabel ? 0.42 : 0,
        input.hasPaymentOptionControl ? 0.38 : 0,
        input.hasBillingAddressControl ? 0.14 : 0,
        orderTotalSignals > 0 ? 0.15 : 0,
        input.hasCheckoutProgress ? 0.1 : 0,
        input.hasPaymentStepLabel && input.hasPaymentOptionControl ? 0.12 : 0,
        input.hasExpressCheckoutControl && routeSignals.cartRoute ? 0.08 : 0,
        routeWeight,
        cartPenalty,
      ]),
      review: checkoutConfidence([
        input.hasPlaceOrderButton ? 0.48 : 0,
        routeSignals.reviewRoute ? reviewRouteWeight : 0,
        orderTotalSignals > 0 ? 0.2 : 0,
        paymentSignals > 0 ? 0.24 : 0,
        shippingSignals > 0 ? 0.1 : 0,
        input.hasCheckoutProgress ? 0.08 : 0,
        routeWeight,
        cartPenalty,
      ]),
      cart: checkoutConfidence([
        routeSignals.cartRoute ? 0.45 : 0,
        cartSignals > 0 ? 0.13 : 0,
        orderTotalSignals > 0 ? 0.07 : 0,
      ]),
      confirmation: checkoutConfidence([
        routeSignals.confirmationRoute ? 0.72 : 0,
        confirmationSignals > 0 ? 0.28 : 0,
      ]),
    },
  };
}

function matchesAny(value, patterns) {
  const input = value || "";
  return patterns.some((pattern) => pattern.test(input));
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
  const renderStartedAt = Date.now();
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
  const presentation = decision.presentation || null;
  const integrity = decision.recommendationIntegrity || null;
  const narrative = decision.decisionNarrative || null;
  const trust = presentation?.trust || {};
  const winningReason =
    decision.winningReason || recommendation.winningReason || null;
  if (!decision.decisionNarrative) {
    rewardlyLog("recommendation-integrity-warning", {
      reason: "missing backend-owned decision narrative",
      merchant: decision?.merchant?.name || null,
      cardSlug: card?.slug || null,
      url: location.href,
    });
  } else if (integrity?.valid !== true) {
    rewardlyLog("recommendation-integrity-warning", {
      reason: integrity?.reason || "decision narrative failed validation",
      merchant: decision?.merchant?.name || null,
      cardSlug: card?.slug || null,
      url: location.href,
    });
  }
  const earning =
    trust.estimatedRewardDisplay ||
    narrative?.earningText ||
    safeFallbackRewardLabel();
  const estimatedReward =
    trust.estimatedRewardValueDisplay ||
    narrative?.estimatedRewardText ||
    narrative?.rewardDetails?.estimatedDisplay ||
    narrative?.estimatedReward ||
    null;
  const reason =
    trust.recommendationReason ||
    narrative?.reasonText ||
    safeFallbackWinningReason();
  const comparison =
    trust.alternativeCard
      ? `${trust.alternativeCard.summary}: ${trust.alternativeCard.cardName} ${trust.alternativeCard.valueDifferenceDisplay}`
      : narrative?.comparisonText || null;
  const merchantName = merchantDisplayName(decision, presentation);
  const cardName =
    narrative?.recommendedCard?.name ||
    presentation?.recommendedCard?.displayName ||
    card.name;
  const confidenceLabel =
    trust.confidenceLabel ||
    presentation?.confidence?.userFacingLabel ||
    confidenceLabelForDecision(decision);
  const categoryLabel =
    trust.categoryDisplayName ||
    presentation?.dominantCategory ||
    decision.merchant?.category ||
    "Purchase";
  const detailId = "rewardly-details-panel";

  rewardlyLog("recommendation-render-validation", {
    merchant: merchantName,
    recommendedCard: card?.slug || cardName || null,
    winningReasonType: winningReason?.type || null,
    winningRuleId: winningReason?.sourceRuleId || null,
    winningBenefitId: winningReason?.sourceBenefitId || null,
    narrativeHeadline: decision.decisionNarrative?.headline || null,
    integrityValid: integrity?.valid === true,
    integrityFailureReasons: integrity?.valid === false ? [integrity.reason] : [],
    renderedEarning: earning,
    renderedEstimatedReward: estimatedReward,
    renderedExplanation: reason,
    renderedComparison: comparison,
  });

  const root = document.createElement("div");
  root.id = "rewardly-popup";
  root.className = "rewardly-root";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Rewardly card recommendation");
  root.setAttribute("aria-describedby", "rewardly-recommendation-summary");

  root.innerHTML = `
    <div class="rewardly-card">
      <div class="rewardly-topline">
        <div>
          <div class="rewardly-brand">Rewardly</div>
          <div class="rewardly-subtitle">Best card before you pay</div>
        </div>
        <div class="rewardly-merchant">${sanitize(merchantName)}</div>
      </div>

      <div class="rewardly-choice">
        <div class="rewardly-logo" aria-hidden="true"></div>
        <div>
          <div class="rewardly-label">Best Card</div>
          <div class="rewardly-card-name">${sanitize(cardName)}</div>
          <div class="rewardly-meta-row">
            <span class="rewardly-confidence">${sanitize(confidenceLabel)}</span>
            <span>${sanitize(categoryLabel)}</span>
          </div>
        </div>
      </div>

      <div class="rewardly-earn">
        <span>Estimated Rewards</span>
        <strong>${sanitize(earning)}</strong>
        ${estimatedReward ? `<em>${sanitize(estimatedReward)}</em>` : ""}
      </div>

      <div class="rewardly-why" id="rewardly-recommendation-summary">
        <span>Why this card?</span>
        <strong>${sanitize(reason)}</strong>
        ${comparison ? `<em>${sanitize(comparison)}</em>` : ""}
      </div>

      <div class="rewardly-details" id="${detailId}" hidden>
        ${detailRow("Merchant", trust.details?.merchant || merchantName)}
        ${detailRow("Category", trust.details?.category || categoryLabel)}
        ${detailRow("Estimated rewards", trust.details?.estimatedRewards || earning)}
        ${detailRow("Estimated value", trust.details?.estimatedValue || estimatedReward)}
        ${detailRow("Applied benefit", trust.details?.appliedBenefit || trust.benefitDisplayName)}
        ${detailRow("Alternative", trust.details?.alternativeCard || comparison)}
        ${detailRow("Confidence", trust.details?.confidence || presentation?.confidence?.userFacingLabel)}
      </div>

      <div class="rewardly-actions">
        <button class="rewardly-details-toggle" type="button" aria-expanded="false" aria-controls="${detailId}">View details</button>
        <button class="rewardly-dismiss" type="button" aria-label="Dismiss Rewardly recommendation">Got it</button>
      </div>
    </div>
  `;

  const logoHost = root.querySelector(".rewardly-logo");
  const logo = cardLogo(card);
  if (logo) logoHost.appendChild(logo);
  else logoHost.textContent = cardInitials(card.name);

  root.querySelector(".rewardly-details-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const panel = root.querySelector(`#${detailId}`);
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    button.textContent = expanded ? "View details" : "Hide details";
    if (expanded) panel.setAttribute("hidden", "");
    else {
      panel.removeAttribute("hidden");
      trackRewardlyEvent("details_opened", {
        sessionId: dismissKey,
        merchant: decision.merchant?.name || null,
        hostname: location.hostname,
        confidenceLabel: decision?.presentation?.trust?.confidenceLabel || null,
      });
    }
  });

  const dismissButton = root.querySelector(".rewardly-dismiss");
  dismissButton.addEventListener("click", () => {
    rememberDismissal(dismissKey);
    trackRewardlyEvent("recommendation_dismissed", {
      sessionId: dismissKey,
      merchant: decision.merchant?.name || null,
      hostname: location.hostname,
      dismissedForMs: REWARDLY_DISMISS_MS,
    });
    trackRewardlyEvent("continue_checkout_clicked", {
      sessionId: dismissKey,
      merchant: decision.merchant?.name || null,
      hostname: location.hostname,
    });
    endRewardlySession("user-dismissed", {
      key: dismissKey,
      merchant: decision.merchant?.name || null,
      url: location.href,
      disconnectObserver: true,
    });
  });

  document.documentElement.appendChild(root);
  dismissButton.focus({ preventScroll: true });
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
    trackRewardlyEvent(visible ? "popup_visible" : "popup_hidden", {
      sessionId: dismissKey,
      merchant: decision.merchant?.name || null,
      hostname: location.hostname,
      popupVisible: visible,
      popupLatencyMs: Date.now() - renderStartedAt,
    });
  });
}

function detailRow(label, value) {
  if (!value) return "";
  return `
    <div class="rewardly-detail-row">
      <span>${sanitize(label)}</span>
      <strong>${sanitize(value)}</strong>
    </div>
  `;
}

function renderRewardlyStatePopup({
  state,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  dismissKey,
  merchant,
  onPrimary,
}) {
  if (document.getElementById("rewardly-popup")) return;
  ensureRewardlyStyles();
  const root = document.createElement("div");
  root.id = "rewardly-popup";
  root.className = `rewardly-root rewardly-root-${state}`;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Rewardly checkout status");
  root.setAttribute("aria-describedby", "rewardly-state-body");
  root.innerHTML = `
    <div class="rewardly-card">
      <div class="rewardly-topline">
        <div>
          <div class="rewardly-brand">Rewardly</div>
          <div class="rewardly-subtitle">${state === "error" ? "Checkout check paused" : "Wallet check"}</div>
        </div>
        <div class="rewardly-merchant">${sanitize(merchant || "Checkout")}</div>
      </div>
      <div class="rewardly-state">
        <strong>${sanitize(title)}</strong>
        <p id="rewardly-state-body">${sanitize(body)}</p>
      </div>
      <div class="rewardly-actions">
        ${
          secondaryLabel
            ? `<button class="rewardly-dismiss rewardly-secondary" type="button">${sanitize(secondaryLabel)}</button>`
            : "<span></span>"
        }
        <button class="rewardly-dismiss rewardly-primary" type="button">${sanitize(primaryLabel)}</button>
      </div>
    </div>
  `;

  root.querySelector(".rewardly-primary").addEventListener("click", () => {
    if (onPrimary) {
      root.remove();
      onPrimary();
      return;
    }
    if (dismissKey) rememberDismissal(dismissKey);
    endRewardlySession(`state-${state}-dismissed`, {
      key: dismissKey,
      merchant,
      url: safeRewardlyUrl(location.href),
      disconnectObserver: true,
    });
  });
  root.querySelector(".rewardly-secondary")?.addEventListener("click", () => {
    if (dismissKey) rememberDismissal(dismissKey);
    endRewardlySession(`state-${state}-dismissed`, {
      key: dismissKey,
      merchant,
      url: safeRewardlyUrl(location.href),
      disconnectObserver: true,
    });
  });

  document.documentElement.appendChild(root);
  root.querySelector(".rewardly-primary")?.focus({ preventScroll: true });
}

function merchantDisplayName(decision, presentation) {
  return (
    presentation?.merchantSummary?.name || decision.merchant?.name || "Checkout"
  );
}

function safeFallbackWinningReason() {
  return "This card earns the highest verified rewards among the eligible cards in your wallet.";
}

function safeFallbackRewardLabel() {
  return "Best available wallet rewards";
}

function analyticsEstimatedRewardValue(decision) {
  const value =
    decision?.presentation?.trust?.estimatedRewardValueUSD ??
    decision?.decisionNarrative?.estimatedRewardValue ??
    decision?.decisionNarrative?.reward?.estimatedRewardCashValue ??
    decision?.rewardEstimate?.estimatedValueUSD ??
    decision?.recommendedCard?.rewardEstimate?.estimatedValueUSD;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100) / 100
    : undefined;
}

function analyticsAdvantageOverRunnerUp(decision) {
  const primary = analyticsEstimatedRewardValue(decision);
  const alternative =
    decision?.presentation?.trust?.alternativeCard?.estimatedValueUSD ??
    decision?.alternatives?.[0]?.rewardEstimate?.estimatedValueUSD ??
    decision?.top?.[1]?.rewardEstimate?.estimatedValueUSD ??
    decision?.runnerUp?.rewardEstimate?.estimatedValueUSD;
  if (
    typeof primary !== "number" ||
    typeof alternative !== "number" ||
    !Number.isFinite(alternative)
  ) {
    return undefined;
  }
  return Math.max(0, Math.round((primary - alternative) * 100) / 100);
}

function analyticsRewardType(decision) {
  const unit =
    decision?.winningReason?.rewardUnit ||
    decision?.recommendedCard?.winningReason?.rewardUnit ||
    decision?.decisionNarrative?.reward?.rewardType ||
    decision?.rewardEstimate?.rewardType ||
    "";
  const text = String(unit).toLowerCase();
  if (/cash|percent/.test(text)) return "cash_back";
  if (/mile/.test(text)) return "miles";
  if (/point|membership/.test(text)) return "points";
  if (/statement|credit/.test(text)) return "statement_credit";
  return text ? "unknown" : undefined;
}

function confidenceLabelForDecision(decision) {
  const label = decision?.confidence?.label || "unknown";
  const score = decision?.confidence?.score;
  if (label === "high" && typeof score === "number" && score >= 0.9) {
    return "Excellent Match";
  }
  if (label === "high") return "High Confidence";
  if (label === "medium") return "Good Match";
  if (label === "low") return "General Recommendation";
  return "Limited Confidence";
}

function checkoutSessionId(merchant, checkout) {
  return [
    normalizeRewardlyHost(location.hostname),
    merchant?.name || "unknown",
    checkout?.stage || "unknown",
    safeRewardlyUrl(location.href),
  ]
    .filter(Boolean)
    .join("|")
    .slice(0, 180);
}

function explanationDebugPayload(decision) {
  const recommendation = decision?.recommendedCard || null;
  const winningReason =
    decision?.winningReason || recommendation?.winningReason || null;
  const relevantBenefits =
    decision?.relevantBenefits || recommendation?.relevantBenefits || [];
  const legacyBenefits = [
    ...(decision?.unlockedBenefits || []),
    ...(recommendation?.unlockedBenefits || []),
  ];
  return {
    merchant: decision?.merchant?.name || null,
    recommendedCard:
      recommendation?.card?.slug || recommendation?.card?.name || null,
    decisionNarrative: decision?.decisionNarrative
      ? {
          reasonType: decision.decisionNarrative.reasonType || null,
          headline: decision.decisionNarrative.headline || null,
          summary: decision.decisionNarrative.summary || null,
          estimatedReward: decision.decisionNarrative.estimatedReward || null,
          comparison: decision.decisionNarrative.comparison || null,
          confidence: decision.decisionNarrative.confidence || null,
          primaryReason: decision.decisionNarrative.primaryReason || null,
        }
      : null,
    recommendationIntegrity: decision?.recommendationIntegrity || null,
    winningReason: winningReason
      ? {
          type: winningReason.type || null,
          title: winningReason.title || null,
          explanation: winningReason.explanation || null,
          applicableToPurchase: winningReason.applicableToPurchase,
          influencedRecommendation: winningReason.influencedRecommendation,
          sourceBenefitId: winningReason.sourceBenefitId || null,
          sourceRuleId: winningReason.sourceRuleId || null,
        }
      : null,
    relevantBenefits: relevantBenefits.map((match) => ({
      label: match?.benefit?.label || match?.summary || null,
      sourceBenefitId: match?.benefit?.id || null,
    })),
    legacyWhyThisWins:
      decision?.primaryReason?.detail ||
      recommendation?.primaryReason?.detail ||
      decision?.presentation?.explanation?.primaryReason ||
      null,
    legacyBenefits: legacyBenefits.map((match) => ({
      label: match?.benefit?.label || match?.summary || null,
      sourceBenefitId: match?.benefit?.id || null,
    })),
    sourceBenefitIds: [
      winningReason?.sourceBenefitId,
      ...relevantBenefits.map((match) => match?.benefit?.id),
    ].filter(Boolean),
    sourceRuleIds: [winningReason?.sourceRuleId].filter(Boolean),
  };
}

function ensureRewardlyStyles() {
  if (document.getElementById("rewardly-styles")) return;
  const style = document.createElement("style");
  style.id = "rewardly-styles";
  style.textContent = `
    #rewardly-popup.rewardly-root {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      width: min(356px, calc(100vw - 28px));
      color: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color-scheme: dark;
    }

    #rewardly-popup .rewardly-card {
      display: grid;
      gap: 15px;
      border: 1px solid rgba(207, 217, 255, 0.14);
      border-radius: 26px;
      background:
        radial-gradient(circle at 84% 0%, rgba(103, 232, 249, 0.16), transparent 34%),
        radial-gradient(circle at 8% 12%, rgba(139, 92, 246, 0.12), transparent 32%),
        linear-gradient(150deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.985) 54%, rgba(3, 7, 18, 0.99));
      box-shadow:
        0 30px 90px rgba(2, 6, 23, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
      padding: 17px;
      backdrop-filter: blur(20px);
      animation: rewardly-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    #rewardly-popup .rewardly-topline,
    #rewardly-popup .rewardly-choice,
    #rewardly-popup .rewardly-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    #rewardly-popup .rewardly-topline,
    #rewardly-popup .rewardly-actions {
      justify-content: space-between;
    }

    #rewardly-popup .rewardly-brand {
      color: #ffffff;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    #rewardly-popup .rewardly-subtitle,
    #rewardly-popup .rewardly-label,
    #rewardly-popup .rewardly-earn span,
    #rewardly-popup .rewardly-value span,
    #rewardly-popup .rewardly-why span {
      color: #b7c3d7;
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
      align-items: center;
      justify-content: flex-start;
      gap: 14px;
      border-radius: 21px;
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.055)),
        rgba(7, 12, 24, 0.38);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      padding: 13px;
    }

    #rewardly-popup .rewardly-choice > div:last-child {
      min-width: 0;
    }

    #rewardly-popup .rewardly-logo {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      width: 86px;
      height: 55px;
      border-radius: 15px;
      background:
        radial-gradient(circle at 72% 10%, rgba(255, 255, 255, 0.34), transparent 30%),
        linear-gradient(145deg, rgba(226, 232, 240, 0.95), rgba(148, 163, 184, 0.82));
      box-shadow:
        0 16px 34px rgba(0, 0, 0, 0.28),
        inset 0 0 0 1px rgba(255, 255, 255, 0.24);
      color: #0f172a;
      font-size: 17px;
      font-weight: 900;
      overflow: hidden;
    }

    #rewardly-popup .rewardly-logo img {
      max-width: 78px;
      max-height: 48px;
      object-fit: contain;
    }

    #rewardly-popup .rewardly-card-name {
      margin-top: 4px;
      color: #ffffff;
      font-size: 19px;
      font-weight: 900;
      line-height: 1.08;
      letter-spacing: -0.02em;
      overflow-wrap: anywhere;
    }

    #rewardly-popup .rewardly-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    #rewardly-popup .rewardly-meta-row span {
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.085);
      color: #cbd5e1;
      padding: 5px 8px;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
    }

    #rewardly-popup .rewardly-meta-row .rewardly-confidence {
      background: rgba(52, 211, 153, 0.14);
      color: #bbf7d0;
    }

    #rewardly-popup .rewardly-earn {
      display: grid;
      gap: 5px;
      padding: 4px 2px 0;
    }

    #rewardly-popup .rewardly-earn strong {
      color: #ffffff;
      font-size: 30px;
      font-weight: 950;
      line-height: 1;
      letter-spacing: -0.03em;
      overflow-wrap: anywhere;
    }

    #rewardly-popup .rewardly-earn em {
      width: fit-content;
      border-radius: 999px;
      background: rgba(96, 165, 250, 0.13);
      color: #dbeafe;
      padding: 6px 9px;
      font-size: 13px;
      font-style: normal;
      font-weight: 850;
    }

    #rewardly-popup .rewardly-why {
      display: grid;
      gap: 5px;
      border-radius: 18px;
      background: rgba(5, 12, 24, 0.34);
      padding: 12px;
    }

    #rewardly-popup .rewardly-why strong {
      color: #e5edf9;
      font-size: 14px;
      font-weight: 780;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    #rewardly-popup .rewardly-why em {
      color: #a8c7ff;
      font-size: 12px;
      font-style: normal;
      font-weight: 760;
      line-height: 1.35;
    }

    #rewardly-popup .rewardly-details {
      display: grid;
      gap: 8px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.055);
      padding: 11px;
    }

    #rewardly-popup .rewardly-details[hidden] {
      display: none;
    }

    #rewardly-popup .rewardly-detail-row {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }

    #rewardly-popup .rewardly-detail-row span {
      color: #94a3b8;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    #rewardly-popup .rewardly-detail-row strong {
      color: #e5edf9;
      font-size: 12px;
      font-weight: 760;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    #rewardly-popup .rewardly-state {
      display: grid;
      gap: 8px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.075);
      padding: 14px;
    }

    #rewardly-popup .rewardly-state strong {
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      line-height: 1.15;
    }

    #rewardly-popup .rewardly-state p {
      margin: 0;
      color: #b7c3d7;
      font-size: 13px;
      font-weight: 650;
      line-height: 1.4;
    }

    #rewardly-popup .rewardly-includes {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      min-width: 0;
    }

    #rewardly-popup .rewardly-chip {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border: 1px solid rgba(103, 232, 249, 0.2);
      border-radius: 999px;
      background: rgba(103, 232, 249, 0.1);
      color: #cffafe;
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 820;
    }

    #rewardly-popup .rewardly-actions {
      gap: 10px;
      padding-top: 1px;
    }

    #rewardly-popup .rewardly-actions span {
      min-width: 0;
      color: #a8b3c7;
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    #rewardly-popup .rewardly-dismiss,
    #rewardly-popup .rewardly-details-toggle {
      flex: 0 0 auto;
      min-height: 38px;
      border: 1px solid rgba(207, 217, 255, 0.2);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.095);
      color: #f8fafc;
      font: inherit;
      font-size: 13px;
      font-weight: 850;
      cursor: pointer;
      padding: 0 15px;
      transition:
        background 160ms ease,
        border-color 160ms ease,
        transform 160ms ease;
    }

    #rewardly-popup .rewardly-details-toggle {
      margin-right: auto;
      color: #bfdbfe;
    }

    #rewardly-popup .rewardly-primary {
      background: #f8fafc;
      color: #0f172a;
    }

    #rewardly-popup .rewardly-secondary {
      color: #cbd5e1;
    }

    #rewardly-popup .rewardly-dismiss:hover,
    #rewardly-popup .rewardly-details-toggle:hover {
      border-color: rgba(207, 217, 255, 0.32);
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }

    #rewardly-popup .rewardly-primary:hover {
      background: #ffffff;
    }

    #rewardly-popup .rewardly-dismiss:focus-visible,
    #rewardly-popup .rewardly-details-toggle:focus-visible {
      outline: 2px solid rgba(103, 232, 249, 0.85);
      outline-offset: 3px;
    }

    @media (max-width: 420px) {
      #rewardly-popup.rewardly-root {
        right: 14px;
        bottom: 14px;
        width: calc(100vw - 28px);
      }

      #rewardly-popup .rewardly-card {
        border-radius: 23px;
        padding: 15px;
      }

      #rewardly-popup .rewardly-logo {
        width: 78px;
        height: 50px;
      }

      #rewardly-popup .rewardly-earn strong {
        font-size: 25px;
      }

      #rewardly-popup .rewardly-actions {
        flex-wrap: wrap;
      }

      #rewardly-popup .rewardly-details-toggle {
        margin-right: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #rewardly-popup .rewardly-card {
        animation: none;
      }

      #rewardly-popup .rewardly-dismiss,
      #rewardly-popup .rewardly-details-toggle {
        transition: none;
      }
    }

    @keyframes rewardly-in {
      from { opacity: 0; transform: translateY(10px) scale(0.985); }
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

function countVisibleSignals(selectors) {
  const seen = new Set();
  return selectors.reduce((count, selector) => {
    const nodes = querySelectorAllDeep(document, selector).slice(0, 50);
    return (
      count +
      nodes.filter((node) => {
        if (seen.has(node) || !isVisibleInteractiveElement(node)) return false;
        seen.add(node);
        return true;
      }).length
    );
  }, 0);
}

function countVisibleTextSignals(selector, pattern) {
  return querySelectorAllDeep(document, selector)
    .slice(0, 250)
    .filter((node) => {
      if (!isVisibleInteractiveElement(node)) return false;
      return pattern.test(
        String(
          node.innerText ||
            node.value ||
            node.getAttribute?.("aria-label") ||
            node.getAttribute?.("title") ||
            node.getAttribute?.("data-testid") ||
            node.textContent ||
            "",
        ),
      );
    }).length;
}

function countSameOriginIframeSignals(selectors) {
  return Array.from(document.querySelectorAll("iframe"))
    .slice(0, 20)
    .reduce((count, frame) => {
      if (!isVisibleInteractiveElement(frame)) return count;
      let frameDocument = null;
      try {
        frameDocument =
          frame.contentDocument || frame.contentWindow?.document || null;
      } catch {
        return count;
      }
      if (!frameDocument) return count;
      const frameMatches = selectors.reduce((total, selector) => {
        return total + querySelectorAllDeep(frameDocument, selector).length;
      }, 0);
      return count + Math.min(frameMatches, 5);
    }, 0);
}

function querySelectorAllDeep(root, selector) {
  const results = [];
  const visited = new Set();
  function collect(currentRoot) {
    if (!currentRoot || visited.has(currentRoot)) return;
    visited.add(currentRoot);
    try {
      results.push(...Array.from(currentRoot.querySelectorAll(selector)));
      const shadowHosts = Array.from(currentRoot.querySelectorAll("*")).filter(
        (node) => node.shadowRoot,
      );
      shadowHosts.forEach((host) => collect(host.shadowRoot));
    } catch {
      return;
    }
  }
  collect(root);
  return results;
}

function isVisibleInteractiveElement(node) {
  if (!node || !node.isConnected) return false;
  if (node.matches?.("input[type='hidden'],[hidden],[aria-hidden='true']")) {
    return false;
  }
  if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
    return false;
  }
  if (
    node.closest?.(
      "[hidden],[aria-hidden='true'],template,[data-rewardly-hidden='true']",
    )
  ) {
    return false;
  }

  const style = window.getComputedStyle(node);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    (Number(style.opacity) === 0 && style.pointerEvents === "none")
  ) {
    return false;
  }

  const rects = Array.from(node.getClientRects());
  if (!rects.some((rect) => rect.width > 0 && rect.height > 0)) return false;
  return rects.some(
    (rect) =>
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth,
  );
}

function readPurchaseFromPage(merchant) {
  const text = readVisibleText();
  const total = readCheckoutAmount();
  const subtotal = readMoneyNear(text, "subtotal");
  const tax = readMoneyNear(text, "tax");
  const shipping = readMoneyNear(text, "shipping");
  const discounts =
    readMoneyNear(text, "discount") || readMoneyNear(text, "coupon");
  return {
    merchantId: merchant?.name || null,
    merchantName: merchant?.name || null,
    hostname: location.hostname,
    url: safeRewardlyUrl(location.href),
    title: document.title.slice(0, 160),
    subtotal,
    tax,
    shipping,
    discounts,
    total,
    currency: "USD",
    checkoutProvider: merchant?.name || location.hostname,
    items: [],
  };
}

function readCheckoutItems() {
  const selectors = [
    "[data-testid*='item' i]",
    "[data-testid*='product' i]",
    "[class*='item' i]",
    "[class*='product' i]",
    "[id*='item' i]",
    "[id*='product' i]",
  ];
  const nodes = Array.from(document.querySelectorAll(selectors.join(",")))
    .slice(0, 30);
  const seen = new Set();
  const items = [];
  nodes.forEach((node) => {
    const raw = String(node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (raw.length < 8 || raw.length > 260) return;
    const priceMatch = raw.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
    const name = raw
      .replace(/\$[0-9,]+(?:\.[0-9]{2})?.*$/, "")
      .replace(/\b(qty|quantity)\b.*$/i, "")
      .trim();
    if (name.length < 4 || /subtotal|shipping|tax|total|payment/i.test(name)) {
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      name,
      quantity: readQuantity(raw),
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null,
    });
  });
  return items.slice(0, 12);
}

function readMoneyNear(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(`${escaped}\\D{0,40}\\$([0-9,]+(?:\\.[0-9]{2})?)`, "i"),
  );
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function readQuantity(text) {
  const match = text.match(/\b(?:qty|quantity)\D{0,8}([0-9]+)/i);
  if (!match) return 1;
  const quantity = Number(match[1]);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function decisionKey(merchant, checkout) {
  const host = location.hostname.replace(/^www\./i, "").toLowerCase();
  return [
    host,
    merchant.name || "merchant",
    normalizeCheckoutSessionRoute(location.pathname),
  ].join("::");
}

function normalizeCheckoutSessionRoute(pathname) {
  const path = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (/\/shop\/mybag(?:[/?#]|$)/i.test(path)) return "/shop/mybag";
  if (/\/gp\/buy\/spc/i.test(path)) return "/gp/buy/spc";
  if (/\/checkout\b/i.test(path)) return "/checkout";
  if (/cart|bag|basket|\/gp\/cart/i.test(path)) return "/cart";
  return path;
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

function trackRewardlyEvent(event, metadata = {}) {
  try {
    chrome.runtime.sendMessage({
      type: "REWARDLY_ANALYTICS_EVENT",
      event,
      metadata,
    });
  } catch (error) {
    rewardlyLog("analytics-send-failed", {
      event,
      message: String(error?.message || error),
    });
  }
}

function confirmRewardlyCheckoutSession(key, merchant, checkout) {
  if (rewardlyPendingExit) {
    clearTimeout(rewardlyPendingExit.timer);
    rewardlyLog("checkout-exit-cancelled", {
      key,
      reason: "valid checkout evidence returned",
      previousReason: rewardlyPendingExit.reason,
      url: location.href,
    });
    rewardlyPendingExit = null;
  }

  if (!rewardlyActiveSession || rewardlyActiveSession.key !== key) {
    rewardlyActiveSession = {
      key,
      merchant: merchant.name || null,
      host: location.hostname,
      route: normalizeCheckoutSessionRoute(location.pathname),
      createdAt: Date.now(),
      lastConfirmedAt: Date.now(),
      lastStage: checkout.stage,
      lastConfidence: checkout.confidence,
    };
    rewardlyLifecycleState = REWARDLY_LIFECYCLE.CANDIDATE;
    rewardlyLog("checkout-session-created", {
      key,
      merchant: rewardlyActiveSession.merchant,
      route: rewardlyActiveSession.route,
      stage: checkout.stage,
      confidence: checkout.confidence,
      url: location.href,
    });
  } else {
    rewardlyActiveSession.lastConfirmedAt = Date.now();
    rewardlyActiveSession.lastStage = checkout.stage;
    rewardlyActiveSession.lastConfidence = checkout.confidence;
  }

  if (
    rewardlyLifecycleState === REWARDLY_LIFECYCLE.IDLE ||
    rewardlyLifecycleState === REWARDLY_LIFECYCLE.CANDIDATE
  ) {
    rewardlyLifecycleState = REWARDLY_LIFECYCLE.CONFIRMED;
    rewardlyLog("checkout-session-confirmed", {
      key,
      merchant: rewardlyActiveSession.merchant,
      stage: checkout.stage,
      confidence: checkout.confidence,
      url: location.href,
    });
  }
}

function scheduleRewardlyCheckoutExit(checkout, reason) {
  const key = rewardlyActiveSession?.key || rewardlyShownKey || null;
  const evaluation = evaluateRewardlyPopupExit(checkout);
  rewardlyLog("transient-signal-loss", {
    key,
    state: rewardlyLifecycleState,
    stage: checkout.stage,
    confidence: checkout.confidence,
    confidenceLabel: checkout.confidenceLabel,
    reason,
    url: location.href,
  });
  rewardlyLog("popup-exit-evaluation", {
    ...evaluation,
    sessionKey: key,
    action: evaluation.durableExitEvidence
      ? "remove-after-grace"
      : "retain-and-continue-observing",
  });

  if (rewardlyPendingExit) {
    rewardlyPendingExit.checkout = checkout;
    rewardlyPendingExit.reason = reason;
    rewardlyLog("popup-retained", {
      key,
      reason: "checkout exit grace period already pending",
      graceMs: REWARDLY_CHECKOUT_EXIT_GRACE_MS,
      url: location.href,
    });
    return;
  }

  rewardlyLifecycleState = REWARDLY_LIFECYCLE.EXIT_PENDING;
  rewardlyPendingExit = {
    key,
    reason,
    checkout,
    startedAt: Date.now(),
    timer: setTimeout(() => {
      const pending = rewardlyPendingExit;
      rewardlyPendingExit = null;
      const finalEvaluation = evaluateRewardlyPopupExit(
        pending?.checkout || checkout,
      );
      rewardlyLog("popup-exit-evaluation", {
        ...finalEvaluation,
        sessionKey: pending?.key || key,
        action: finalEvaluation.durableExitEvidence
          ? `remove:${finalEvaluation.reason}`
          : "retain-visible-after-grace",
      });
      if (finalEvaluation.durableExitEvidence) {
        endRewardlySession(finalEvaluation.reason, {
          key: pending?.key || key,
          reason: pending?.reason || reason,
          checkout: pending?.checkout || checkout,
          url: location.href,
          evidence: finalEvaluation,
        });
        return;
      }
      rewardlyLifecycleState = REWARDLY_LIFECYCLE.RECOMMENDATION_VISIBLE;
      rewardlyLog("popup-retained", {
        key: pending?.key || key,
        reason: "grace expired without durable exit evidence",
        url: location.href,
      });
    }, REWARDLY_CHECKOUT_EXIT_GRACE_MS),
  };
  rewardlyLog("checkout-exit-pending", {
    key,
    reason,
    graceMs: REWARDLY_CHECKOUT_EXIT_GRACE_MS,
    stage: checkout.stage,
    confidence: checkout.confidence,
    url: location.href,
  });
  rewardlyLog("popup-retained", {
    key,
    reason: "within checkout exit grace period",
    graceMs: REWARDLY_CHECKOUT_EXIT_GRACE_MS,
    url: location.href,
  });
}

function evaluateRewardlyPopupExit(checkout) {
  const session = rewardlyActiveSession;
  const currentRoute = normalizeCheckoutSessionRoute(location.pathname);
  const currentHost = location.hostname.replace(/^www\./i, "").toLowerCase();
  const routeChanged = Boolean(session && session.route !== currentRoute);
  const merchantChanged = Boolean(
    session &&
      session.host &&
      session.host.replace(/^www\./i, "").toLowerCase() !== currentHost,
  );
  const confirmationDetected = checkout.stage === "confirmation";
  const routeIsCheckoutLike = isCheckoutLikeSessionRoute(location.pathname);
  const durableNavigationExit = routeChanged && !routeIsCheckoutLike;
  const durableExitEvidence =
    merchantChanged || confirmationDetected || durableNavigationExit;
  const reason = merchantChanged
    ? "merchant-changed"
    : confirmationDetected
      ? "purchase-confirmed"
      : durableNavigationExit
        ? "durable-navigation-exit"
        : "retain-visible";

  return {
    currentStage: checkout.stage,
    currentConfidence: checkout.confidence,
    currentConfidenceLabel: checkout.confidenceLabel,
    routeChanged,
    previousRoute: session?.route || null,
    currentRoute,
    merchantChanged,
    previousHost: session?.host || null,
    currentHost,
    confirmationDetected,
    routeIsCheckoutLike,
    durableExitEvidence,
    reason,
  };
}

function isCheckoutLikeSessionRoute(pathname) {
  const path = String(pathname || "/").toLowerCase();
  if (/\/shop\/mybag(?:[/?#]|$)/i.test(path)) return true;
  if (
    /\/gp\/buy|\/checkout|\/buy\/|payselect|shipoptionselect|addressselect|spc/i.test(
      path,
    )
  ) {
    return true;
  }
  if (/cart|bag|basket|\/gp\/cart/i.test(path)) return true;
  return false;
}

function endRewardlySession(reason, details = {}) {
  const priorState = rewardlyLifecycleState;
  const allowedReasons = new Set([
    "user-dismissed",
    "purchase-confirmed",
    "durable-navigation-exit",
    "merchant-changed",
    "checkout-session-replaced",
    "recommendation-invalidated",
  ]);
  const removalReason = allowedReasons.has(reason)
    ? reason
    : "durable-navigation-exit";
  if (rewardlyPendingExit) {
    clearTimeout(rewardlyPendingExit.timer);
    rewardlyPendingExit = null;
  }

  const popup = document.getElementById("rewardly-popup");
  if (popup) {
    popup.remove();
    rewardlyLog("popup-removed", {
      reason: removalReason,
      sessionKey:
        details.key || rewardlyActiveSession?.key || rewardlyShownKey || null,
      priorState,
      evidence: details.evidence || details.checkout || null,
      url: details.url || location.href,
    });
  }

  rewardlyLog("checkout-session-ended", {
    reason: removalReason,
    previousState: priorState,
    key: details.key || rewardlyActiveSession?.key || rewardlyShownKey || null,
    merchant: details.merchant || rewardlyActiveSession?.merchant || null,
    url: details.url || location.href,
    details,
  });

  rewardlyLifecycleState =
    removalReason === "user-dismissed"
      ? REWARDLY_LIFECYCLE.DISMISSED
      : removalReason === "purchase-confirmed"
        ? REWARDLY_LIFECYCLE.PURCHASE_CONFIRMED
        : REWARDLY_LIFECYCLE.EXITED;
  rewardlyActiveSession = null;
  rewardlyLastDecision = null;
  rewardlyShownKey = "";
  rewardlyInFlight = false;

  if (details.disconnectObserver) {
    disconnectAfterDismiss();
  }
}

function removeRewardlyPopup(reason = "merchant-changed") {
  const popup = document.getElementById("rewardly-popup");
  if (!popup) return;
  popup.remove();
  rewardlyLog("popup-removed", {
    reason,
    sessionKey: rewardlyActiveSession?.key || rewardlyShownKey || null,
    priorState: rewardlyLifecycleState,
    evidence: {
      host: location.hostname,
      url: location.href,
    },
    url: location.href,
  });
}

function disconnectAfterDismiss() {
  if (rewardlyObserver) {
    rewardlyObserver.disconnect();
    rewardlyObserver = null;
  }
  document.removeEventListener("click", handleRewardlyUserInteraction, true);
  document.removeEventListener("change", handleRewardlyUserInteraction, true);
  document.removeEventListener("input", handleRewardlyUserInteraction, true);
  document.removeEventListener("keydown", handleRewardlyUserInteraction, true);
}

function containsAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function checkoutSuppressionReason(checkout) {
  if (checkout.suppressionReason) return checkout.suppressionReason;
  if (checkout.stage === "confirmation") return "stage is post-purchase confirmation";
  if (checkout.confidence < 0.85) return "checkout confidence below threshold";
  if (!checkout.shouldTriggerRecommendation) return "shouldTriggerRecommendation is false";
  return "unsupported checkout stage";
}

function isPostPurchaseConfirmationText(value) {
  if (
    !containsAny(value, [
      "thank you for your order",
      "your order has been placed",
      "order has been placed",
      "we've received your order",
      "we have received your order",
      "order confirmed",
      "order is confirmed",
      "your order is confirmed",
      "order complete",
      "completed order",
    ])
  ) {
    return false;
  }
  if (/order\s*(?:#|number)\s*[:#]?\s*[a-z0-9-]+/i.test(value)) return true;
  return containsAny(value, [
    "thank you for your order",
    "your order has been placed",
    "order has been placed",
    "order is confirmed",
    "your order is confirmed",
    "we've received your order",
    "we have received your order",
  ]);
}

function checkoutConfidence(parts) {
  const score = parts.reduce((sum, value) => sum + value, 0);
  return Math.min(0.98, Math.round(score * 100) / 100);
}

function checkoutConfidenceLabel(confidence) {
  if (confidence >= 0.85) return "HIGH";
  if (confidence >= 0.55) return "MEDIUM";
  return "LOW";
}

function checkoutResult(input) {
  return {
    ...input,
    confidenceLabel: checkoutConfidenceLabel(input.confidence),
    shouldTriggerRecommendation:
      input.shouldTriggerRecommendation && input.confidence >= 0.85,
  };
}

function isHomePath(value) {
  try {
    const url = new URL(value || "");
    return url.pathname === "/" || url.pathname === "";
  } catch {
    return value === "/" || value === "";
  }
}

function normalizeRewardlyHost(value) {
  return String(value || "")
    .replace(/^(?:www|m)\./i, "")
    .toLowerCase();
}

function isRewardlySupportedHost(value) {
  const host = normalizeRewardlyHost(value);
  return (
    REWARDLY_SUPPORTED_HOSTS.includes(host) ||
    REWARDLY_SUPPORTED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    )
  );
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
