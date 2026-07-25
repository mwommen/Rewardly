import type { CheckoutStage } from "./domain";

export type CheckoutDetectionInput = {
  url?: string | null;
  pathname?: string | null;
  title?: string | null;
  visibleText?: string | null;
  hostname?: string | null;
  hasPaymentForm?: boolean;
  hasPaymentIframe?: boolean;
  hasSavedPaymentMethod?: boolean;
  hasExpressCheckoutControl?: boolean;
  hasPaymentStepLabel?: boolean;
  hasPaymentOptionControl?: boolean;
  hasBillingAddressControl?: boolean;
  hasShippingForm?: boolean;
  hasCheckoutProgress?: boolean;
  hasPlaceOrderButton?: boolean;
  hasOrderSummary?: boolean;
  hasSubtotalOrTotal?: boolean;
};

export type CheckoutSignalSummary = {
  merchant: string;
  routeSignals: {
    checkoutRoute: boolean;
    cartRoute: boolean;
    browsingRoute: boolean;
    confirmationRoute: boolean;
    reviewRoute: boolean;
    authRoute: boolean;
  };
  shippingSignals: number;
  paymentSignals: number;
  reviewSignals: number;
  confirmationSignals: number;
  cartSignals: number;
  activePaymentProviders: string[];
  orderTotalSignals: number;
  checkoutProgressSignals: number;
  scores: {
    shipping: number;
    payment: number;
    review: number;
    cart: number;
    confirmation: number;
  };
};

export type CheckoutDetectionResult = {
  isCheckout: boolean;
  stage: CheckoutStage;
  confidence: number;
  confidenceLabel: "LOW" | "MEDIUM" | "HIGH";
  shouldTriggerRecommendation: boolean;
  suppressionReason?: string;
  signalSummary?: CheckoutSignalSummary;
};

export const HIGH_CHECKOUT_CONFIDENCE = 0.85;

const CONFIRMATION_TERMS = [
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
];

const REVIEW_TERMS = [
  "review order",
  "review your order",
  "review items",
  "place order",
  "place your order",
  "submit order",
  "complete purchase",
];

const PAYMENT_TERMS = [
  "payment",
  "payment method",
  "payment information",
  "payment details",
  "select a payment method",
  "choose a payment method",
  "how do you want to pay",
  "how would you like to pay",
  "choose how to pay",
  "pay with",
  "use this payment method",
  "card number",
  "credit card",
  "debit card",
  "billing",
  "billing address",
];

const PLACE_ORDER_TERMS = [
  "place order",
  "place your order",
  "submit order",
  "complete purchase",
];

const SHIPPING_TERMS = [
  "shipping address",
  "delivery address",
  "delivery options",
  "ship to",
];

const SUMMARY_TERMS = [
  "order summary",
  "estimated total",
  "order total",
  "subtotal",
  "total due",
  "purchase total",
];

const CART_TERMS = ["cart", "bag", "basket"];

type MerchantCheckoutProfile = {
  id: string;
  domains: RegExp[];
  checkoutRouteHints: RegExp[];
  cartRouteHints: RegExp[];
  confirmationRouteHints: RegExp[];
  reviewRouteHints?: RegExp[];
  authRouteHints?: RegExp[];
  browsingRouteHints?: RegExp[];
  knownPaymentProviders?: string[];
  weights?: Partial<Record<"checkoutRoute" | "cartRoute" | "reviewRoute", number>>;
};

const DEFAULT_PROFILE: MerchantCheckoutProfile = {
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

export const MERCHANT_CHECKOUT_PROFILES: MerchantCheckoutProfile[] = [
  {
    ...DEFAULT_PROFILE,
    id: "amazon",
    domains: [/(?:^|\.)amazon\.[^.]+$/i],
    checkoutRouteHints: [
      /(?:amazon\.[^/]+)?\/(?:gp\/buy|checkout|buy\/|payselect|gp\/payselect|gp\/buy\/spc|gp\/buy\/payselect|gp\/buy\/addressselect|gp\/buy\/shipoptionselect|gp\/buy\/signin)/i,
    ],
    cartRouteHints: [/\/gp\/cart/i, ...DEFAULT_PROFILE.cartRouteHints],
    confirmationRouteHints: [
      /\/gp\/buy\/thankyou(?:[/?#]|$)/i,
      ...DEFAULT_PROFILE.confirmationRouteHints,
    ],
    reviewRouteHints: [
      /(?:amazon\.[^/]+)?\/(?:checkout\/.*\/spc|gp\/buy\/spc)(?:[/?#]|$)/i,
      /[?&](?:pipelineType=Chewbacca|referrer=spc)(?:&|$)/i,
      ...(DEFAULT_PROFILE.reviewRouteHints || []),
    ],
    authRouteHints: [/amazon\.[^/]+\/ap\//i, ...(DEFAULT_PROFILE.authRouteHints || [])],
    knownPaymentProviders: ["Amazon Pay"],
    weights: { reviewRoute: 0.55 },
  },
  {
    ...DEFAULT_PROFILE,
    id: "lululemon",
    domains: [/(?:^|\.)lululemon\.com$/i],
    checkoutRouteHints: [/\/shop\/mybag(?:[/?#]|$)/i, ...DEFAULT_PROFILE.checkoutRouteHints],
    cartRouteHints: [/\/shop\/mybag(?:[/?#]|$)/i, ...DEFAULT_PROFILE.cartRouteHints],
    confirmationRouteHints: DEFAULT_PROFILE.confirmationRouteHints,
    knownPaymentProviders: ["Klarna", "PayPal"],
    weights: { cartRoute: -0.04, checkoutRoute: 0.08 },
  },
  {
    ...DEFAULT_PROFILE,
    id: "target",
    domains: [/(?:^|\.)target\.com$/i],
  },
  {
    ...DEFAULT_PROFILE,
    id: "walmart",
    domains: [/(?:^|\.)walmart\.com$/i],
  },
  {
    ...DEFAULT_PROFILE,
    id: "apple",
    domains: [/(?:^|\.)apple\.com$/i],
  },
  {
    ...DEFAULT_PROFILE,
    id: "best-buy",
    domains: [/(?:^|\.)bestbuy\.com$/i],
  },
];

export function detectCheckout(
  input: CheckoutDetectionInput,
): CheckoutDetectionResult {
  const text = [input.url, input.pathname, input.title, input.visibleText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const route = [input.url, input.pathname].filter(Boolean).join(" ");
  const path = input.pathname || input.url;
  const profile = resolveCheckoutProfile(input);
  const signals = collectSignals(input, profile, text, route, path);

  if (signals.routeSignals.authRoute) {
    return result({
      isCheckout: false,
      stage: "unknown",
      confidence: 0.88,
      shouldTriggerRecommendation: false,
      suppressionReason: "sign-in or authentication page",
      signalSummary: signals,
    });
  }

  if (signals.routeSignals.confirmationRoute || signals.confirmationSignals > 0) {
    return result({
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
    return result({
      isCheckout: false,
      stage: "unknown",
      confidence: 0.18,
      shouldTriggerRecommendation: false,
      suppressionReason: "browsing or product page",
      signalSummary: signals,
    });
  }

  if (signals.scores.review >= HIGH_CHECKOUT_CONFIDENCE) {
    return result({
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

  if (signals.scores.payment >= HIGH_CHECKOUT_CONFIDENCE) {
    return result({
      isCheckout: true,
      stage: "payment",
      confidence: signals.scores.payment,
      shouldTriggerRecommendation: true,
      signalSummary: signals,
    });
  }

  if (signals.scores.shipping >= HIGH_CHECKOUT_CONFIDENCE) {
    return result({
      isCheckout: true,
      stage: "checkout",
      confidence: signals.scores.shipping,
      shouldTriggerRecommendation: true,
      signalSummary: signals,
    });
  }

  if (signals.routeSignals.cartRoute || signals.cartSignals > 0) {
    return result({
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
    return result({
      isCheckout: true,
      stage: "checkout",
      confidence: 0.6,
      shouldTriggerRecommendation: false,
      suppressionReason: "checkout route without active payment or review evidence",
      signalSummary: signals,
    });
  }

  return result({
    isCheckout: false,
    stage: "unknown",
    confidence: 0.2,
    shouldTriggerRecommendation: false,
    suppressionReason: "no checkout evidence",
    signalSummary: signals,
  });
}

function containsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function matchesAny(value: string | null | undefined, patterns: RegExp[]) {
  const input = value || "";
  return patterns.some((pattern) => pattern.test(input));
}

function resolveCheckoutProfile(input: CheckoutDetectionInput) {
  const host = normalizeHost(input);
  return (
    MERCHANT_CHECKOUT_PROFILES.find((profile) =>
      profile.domains.some((domain) => domain.test(host)),
    ) || DEFAULT_PROFILE
  );
}

function normalizeHost(input: CheckoutDetectionInput) {
  if (input.hostname) return input.hostname;
  try {
    return new URL(input.url || "").hostname;
  } catch {
    return "";
  }
}

function collectSignals(
  input: CheckoutDetectionInput,
  profile: MerchantCheckoutProfile,
  text: string,
  route: string,
  path?: string | null,
): CheckoutSignalSummary {
  const routeSignals = {
    checkoutRoute: matchesAny(route, profile.checkoutRouteHints),
    cartRoute: matchesAny(path || route, profile.cartRouteHints),
    browsingRoute:
      isHomePath(path) || matchesAny(path || route, profile.browsingRouteHints || []),
    confirmationRoute: matchesAny(path || route, profile.confirmationRouteHints),
    reviewRoute: matchesAny(route, profile.reviewRouteHints || []),
    authRoute: matchesAny(path || route, profile.authRouteHints || []),
  };
  const orderTotalSignals = Number(Boolean(input.hasOrderSummary)) +
    Number(Boolean(input.hasSubtotalOrTotal));
  const shippingSignals =
    Number(Boolean(input.hasShippingForm)) +
    Number(Boolean(input.hasCheckoutProgress && containsAny(text, SHIPPING_TERMS)));
  const paymentSignals =
    Number(Boolean(input.hasPaymentForm)) +
    Number(Boolean(input.hasPaymentIframe)) +
    Number(Boolean(input.hasSavedPaymentMethod)) +
    Number(Boolean(input.hasExpressCheckoutControl)) +
    Number(Boolean(input.hasPaymentStepLabel)) +
    Number(Boolean(input.hasPaymentOptionControl)) +
    Number(Boolean(input.hasBillingAddressControl));
  const reviewSignals =
    Number(Boolean(input.hasPlaceOrderButton)) +
    Number(routeSignals.reviewRoute);
  const confirmationSignals = Number(isPostPurchaseConfirmationText(text));
  const cartSignals =
    Number(routeSignals.cartRoute) + Number(containsAny(text, CART_TERMS));
  const checkoutProgressSignals = Number(Boolean(input.hasCheckoutProgress));
  const activePaymentProviders = [
    input.hasPaymentIframe ? "hosted-payment-iframe" : null,
    input.hasExpressCheckoutControl ? "express-checkout-control" : null,
    input.hasPaymentOptionControl ? "payment-option-control" : null,
    ...(profile.knownPaymentProviders || []).filter((provider) =>
      text.includes(provider.toLowerCase()),
    ),
  ].filter(Boolean) as string[];
  const checkoutRouteWeight = profile.weights?.checkoutRoute ?? 0.08;
  const cartRouteWeight = profile.weights?.cartRoute ?? -0.06;
  const reviewRouteWeight = profile.weights?.reviewRoute ?? 0.18;
  const routeWeight = routeSignals.checkoutRoute ? checkoutRouteWeight : 0;
  const cartPenalty = routeSignals.cartRoute ? cartRouteWeight : 0;
  const scores = {
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
  };

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
    checkoutProgressSignals,
    scores,
  };
}

function isPostPurchaseConfirmationText(value: string) {
  if (!containsAny(value, CONFIRMATION_TERMS)) return false;
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

function isHomePath(value?: string | null) {
  try {
    const url = new URL(value || "");
    return url.pathname === "/" || url.pathname === "";
  } catch {
    return value === "/" || value === "";
  }
}

function checkoutConfidence(parts: number[]) {
  const score = parts.reduce((sum, value) => sum + value, 0);
  return Math.min(0.98, Math.round(score * 100) / 100);
}

function confidenceLabel(confidence: number): "LOW" | "MEDIUM" | "HIGH" {
  if (confidence >= HIGH_CHECKOUT_CONFIDENCE) return "HIGH";
  if (confidence >= 0.55) return "MEDIUM";
  return "LOW";
}

function result(input: Omit<CheckoutDetectionResult, "confidenceLabel">) {
  return {
    ...input,
    confidenceLabel: confidenceLabel(input.confidence),
    shouldTriggerRecommendation:
      input.shouldTriggerRecommendation &&
      input.confidence >= HIGH_CHECKOUT_CONFIDENCE,
  };
}
