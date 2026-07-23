import type { CheckoutStage } from "./domain";

export type CheckoutDetectionInput = {
  url?: string | null;
  pathname?: string | null;
  title?: string | null;
  visibleText?: string | null;
  hasPaymentForm?: boolean;
  hasOrderSummary?: boolean;
};

export type CheckoutDetectionResult = {
  isCheckout: boolean;
  stage: CheckoutStage;
  confidence: number;
  shouldTriggerRecommendation: boolean;
};

const CONFIRMATION_TERMS = [
  "thank you",
  "order confirmed",
  "confirmation",
  "receipt",
  "order complete",
];

const PAYMENT_TERMS = [
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
];

const CHECKOUT_TERMS = [
  "checkout",
  "secure checkout",
  "proceed to checkout",
  "shipping",
  "shipping address",
  "delivery",
  "order summary",
];

const CART_TERMS = ["cart", "bag", "basket"];

export function detectCheckout(
  input: CheckoutDetectionInput,
): CheckoutDetectionResult {
  const text = [input.url, input.pathname, input.title, input.visibleText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const route = [input.url, input.pathname].filter(Boolean).join(" ");
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
    (!input.hasPaymentForm && containsAny(text, CONFIRMATION_TERMS))
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

  if (isAmazonCheckoutPath(route)) {
    return {
      isCheckout: true,
      stage:
        input.hasPaymentForm || containsAny(text, PAYMENT_TERMS)
          ? "payment"
          : "checkout",
      confidence: input.hasPaymentForm ? 0.92 : 0.78,
      shouldTriggerRecommendation: true,
    };
  }

  if (isAmazonPage(input.url)) {
    return {
      isCheckout: false,
      stage: "unknown",
      confidence: 0.88,
      shouldTriggerRecommendation: false,
    };
  }

  if (input.hasPaymentForm || containsAny(text, PAYMENT_TERMS)) {
    return {
      isCheckout: true,
      stage: "payment",
      confidence: input.hasPaymentForm ? 0.9 : 0.74,
      shouldTriggerRecommendation: true,
    };
  }

  if (input.hasOrderSummary || containsAny(text, CHECKOUT_TERMS)) {
    return {
      isCheckout: true,
      stage: "checkout",
      confidence: input.hasOrderSummary ? 0.82 : 0.68,
      shouldTriggerRecommendation: true,
    };
  }

  if (containsAny(text, CART_TERMS)) {
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

function containsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function isCartPath(value?: string | null) {
  return /(?:^|[/-])(?:cart|bag|basket)(?:[./-]|$)|\/gp\/cart/i.test(
    value || "",
  );
}

function isConfirmationPath(value?: string | null) {
  return /(?:^|[/-])(?:confirmation|receipt|thank-you|order-complete)(?:[./-]|$)/i.test(
    value || "",
  );
}

function isSignInPath(value?: string | null) {
  return /\/(?:ap\/signin|signin|login)(?:[/?#]|$)/i.test(value || "");
}

function isAmazonAuthPath(value?: string | null) {
  return /amazon\.[^/]+\/ap\//i.test(value || "");
}

function isAmazonPage(value?: string | null) {
  try {
    return /(?:^|\.)amazon\.[^.]+$/i.test(new URL(value || "").hostname);
  } catch {
    return false;
  }
}

function isAmazonCheckoutPath(value?: string | null) {
  const input = value || "";
  return /(?:amazon\.[^/]+)?\/(?:gp\/buy|checkout|buy\/|gp\/buyagain|payselect|gp\/payselect|gp\/buy\/spc|gp\/buy\/payselect|gp\/buy\/addressselect|gp\/buy\/shipoptionselect|gp\/buy\/signin)/i.test(
    input,
  );
}
