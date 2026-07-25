import { detectCheckout } from "../../packages/rewardly-core/src/checkoutDetection";

describe("checkout detection", () => {
  test.each([
    {
      label: "normal product page",
      input: {
        url: "https://example.com/products/running-shoes",
        pathname: "/products/running-shoes",
        title: "Running Shoes",
        visibleText: "Add to cart Payment options Free shipping",
        hasPaymentForm: false,
        hasOrderSummary: false,
      },
      stage: "unknown",
      shouldTriggerRecommendation: false,
    },
    {
      label: "cart with Checkout button",
      input: {
        url: "https://example.com/cart",
        pathname: "/cart",
        title: "Cart",
        visibleText: "Cart Subtotal Checkout",
        hasPaymentForm: false,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      },
      stage: "cart",
      shouldTriggerRecommendation: false,
    },
    {
      label: "active shipping form",
      input: {
        url: "https://example.com/checkout/shipping",
        pathname: "/checkout/shipping",
        title: "Checkout",
        visibleText: "Shipping address Order summary Estimated total",
        hasShippingForm: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      },
      stage: "checkout",
      shouldTriggerRecommendation: true,
    },
    {
      label: "active payment form",
      input: {
        url: "https://example.com/checkout/payment",
        pathname: "/checkout/payment",
        title: "Checkout",
        visibleText: "Card number Billing address Order summary",
        hasPaymentForm: true,
        hasBillingAddressControl: true,
        hasOrderSummary: true,
      },
      stage: "payment",
      shouldTriggerRecommendation: true,
    },
    {
      label: "hosted payment iframe",
      input: {
        url: "https://example.com/checkout/payment",
        pathname: "/checkout/payment",
        title: "Checkout",
        visibleText: "Secure payment Order total",
        hasPaymentIframe: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      },
      stage: "payment",
      shouldTriggerRecommendation: true,
    },
    {
      label: "saved payment-method selection",
      input: {
        url: "https://example.com/checkout/payment",
        pathname: "/checkout/payment",
        title: "Checkout",
        visibleText: "Select saved payment method Order total",
        hasSavedPaymentMethod: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
        hasCheckoutProgress: true,
      },
      stage: "payment",
      shouldTriggerRecommendation: true,
    },
    {
      label: "active order-review page",
      input: {
        url: "https://example.com/checkout/review-order",
        pathname: "/checkout/review-order",
        title: "Review Order",
        visibleText: "Selected payment method Delivery address Order total",
        hasSavedPaymentMethod: true,
        hasShippingForm: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      },
      stage: "checkout",
      shouldTriggerRecommendation: true,
    },
    {
      label: "place-order page",
      input: {
        url: "https://example.com/checkout/place-order",
        pathname: "/checkout/place-order",
        title: "Place Order",
        visibleText: "Place your order Payment method Order total",
        hasPaymentStepLabel: true,
        hasSavedPaymentMethod: true,
        hasPlaceOrderButton: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      },
      stage: "review",
      shouldTriggerRecommendation: true,
    },
    {
      label: "completed-order confirmation",
      input: {
        url: "https://example.com/order-confirmation",
        pathname: "/order-confirmation",
        title: "Order Confirmation",
        visibleText: "Thank you for your order. Your order has been placed.",
        hasOrderSummary: true,
      },
      stage: "confirmation",
      shouldTriggerRecommendation: false,
    },
    {
      label: "hidden payment template",
      input: {
        url: "https://example.com/cart",
        pathname: "/cart",
        title: "Cart",
        visibleText: "Payment card number CVV checkout subtotal",
        hasPaymentForm: false,
        hasOrderSummary: true,
      },
      stage: "cart",
      shouldTriggerRecommendation: false,
    },
    {
      label: "SPA checkout retaining cart URL",
      input: {
        url: "https://example.com/cart",
        pathname: "/cart",
        title: "Checkout",
        visibleText: "Payment method Order total Billing address",
        hasPaymentForm: true,
        hasBillingAddressControl: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      },
      stage: "payment",
      shouldTriggerRecommendation: true,
    },
  ])(
    "classifies merchant-independent fixture: $label",
    ({ input, stage, shouldTriggerRecommendation }) => {
      const result = detectCheckout(input);

      expect(result.stage).toBe(stage);
      expect(result.shouldTriggerRecommendation).toBe(shouldTriggerRecommendation);
      expect(result.signalSummary).toBeTruthy();
    },
  );

  describe("merchant-agnostic payment decision coverage", () => {
    test.each([
      {
        label: "standard card form",
        input: {
          url: "https://checkout.random-shop.test/payment",
          pathname: "/payment",
          hostname: "checkout.random-shop.test",
          title: "Checkout",
          visibleText: "Payment information Card number Expiration CVV Order total",
          hasPaymentForm: true,
          hasBillingAddressControl: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
      {
        label: "saved card selector",
        input: {
          url: "https://secure.example-store.test/checkout",
          pathname: "/checkout",
          hostname: "secure.example-store.test",
          title: "Checkout",
          visibleText: "Payment method Card ending in 4242 Order summary Total",
          hasSavedPaymentMethod: true,
          hasPaymentStepLabel: true,
          hasPaymentOptionControl: true,
          hasCheckoutProgress: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
      {
        label: "express checkout options",
        input: {
          url: "https://shop.example-market.test/cart",
          pathname: "/cart",
          hostname: "shop.example-market.test",
          title: "Bag",
          visibleText: "Apple Pay PayPal Express checkout Order summary Total",
          hasExpressCheckoutControl: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
      {
        label: "custom radio tile payment selector",
        input: {
          url: "https://pay.random-merchant.test/checkout",
          pathname: "/checkout",
          hostname: "pay.random-merchant.test",
          title: "Checkout",
          visibleText:
            "Payment method Credit card selected PayPal Cash Order summary Total",
          hasPaymentStepLabel: true,
          hasPaymentOptionControl: true,
          hasCheckoutProgress: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
      {
        label: "same-origin iframe payment form",
        input: {
          url: "https://checkout.random-shop.test/payment",
          pathname: "/payment",
          hostname: "checkout.random-shop.test",
          title: "Checkout",
          visibleText: "Secure payment Order summary Total",
          hasPaymentIframe: true,
          hasPaymentForm: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
      {
        label: "cross-origin iframe metadata fallback",
        input: {
          url: "https://checkout.random-shop.test/payment",
          pathname: "/payment",
          hostname: "checkout.random-shop.test",
          title: "Checkout",
          visibleText: "Secure payment Order summary Total",
          hasPaymentIframe: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
      {
        label: "shadow DOM payment controls where accessible",
        input: {
          url: "https://checkout.shadow-shop.test/payment",
          pathname: "/payment",
          hostname: "checkout.shadow-shop.test",
          title: "Checkout",
          visibleText: "Payment method Credit card Order summary Total",
          hasPaymentForm: true,
          hasPaymentStepLabel: true,
          hasPaymentOptionControl: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
      {
        label: "guest checkout shipping step",
        input: {
          url: "https://checkout.random-shop.test/guest",
          pathname: "/guest",
          hostname: "checkout.random-shop.test",
          title: "Guest Checkout",
          visibleText:
            "Guest checkout Shipping address Delivery options Order summary Total",
          hasShippingForm: true,
          hasCheckoutProgress: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "checkout",
      },
      {
        label: "signed-in checkout saved payment",
        input: {
          url: "https://checkout.random-shop.test/review",
          pathname: "/review",
          hostname: "checkout.random-shop.test",
          title: "Checkout",
          visibleText:
            "Signed in Payment method Card ending in 4242 Delivery address Order total",
          hasSavedPaymentMethod: true,
          hasPaymentStepLabel: true,
          hasPaymentOptionControl: true,
          hasCheckoutProgress: true,
          hasOrderSummary: true,
          hasSubtotalOrTotal: true,
        },
        expectedStage: "payment",
      },
    ])("detects generic $label", ({ input, expectedStage }) => {
      const result = detectCheckout(input);

      expect(result.signalSummary?.merchant).toBe("generic");
      expect(result.stage).toBe(expectedStage);
      expect(result.confidenceLabel).toBe("HIGH");
      expect(result.shouldTriggerRecommendation).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    test("suppresses cart-only page", () => {
      const result = detectCheckout({
        url: "https://shop.random-store.test/cart",
        pathname: "/cart",
        hostname: "shop.random-store.test",
        title: "Cart",
        visibleText: "Your cart Order summary Subtotal Total Checkout",
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      });

      expect(result.signalSummary?.merchant).toBe("generic");
      expect(result.stage).toBe("cart");
      expect(result.shouldTriggerRecommendation).toBe(false);
      expect(result.suppressionReason).toBe("cart-only state");
    });

    test("suppresses review page with place-order button but no payment controls", () => {
      const result = detectCheckout({
        url: "https://checkout.random-shop.test/review-order",
        pathname: "/review-order",
        hostname: "checkout.random-shop.test",
        title: "Review Order",
        visibleText: "Review order Shipping complete Order summary Total Place order",
        hasPlaceOrderButton: true,
        hasCheckoutProgress: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      });

      expect(result.signalSummary?.merchant).toBe("generic");
      expect(result.stage).toBe("review");
      expect(result.confidenceLabel).toBe("HIGH");
      expect(result.shouldTriggerRecommendation).toBe(false);
      expect(result.suppressionReason).toBe(
        "review stage without payment decision evidence",
      );
    });

    test("suppresses confirmation page", () => {
      const result = detectCheckout({
        url: "https://checkout.random-shop.test/thank-you",
        pathname: "/thank-you",
        hostname: "checkout.random-shop.test",
        title: "Order complete",
        visibleText: "Thank you for your order. Your order has been placed.",
        hasOrderSummary: true,
      });

      expect(result.signalSummary?.merchant).toBe("generic");
      expect(result.stage).toBe("confirmation");
      expect(result.shouldTriggerRecommendation).toBe(false);
    });

    test("detects SPA route transition from browsing to payment state", () => {
      const beforeRouteChange = detectCheckout({
        url: "https://shop.random-store.test/products/widget",
        pathname: "/products/widget",
        hostname: "shop.random-store.test",
        title: "Widget",
        visibleText: "Add to cart Payment options Free shipping",
        hasPaymentStepLabel: false,
        hasPaymentOptionControl: false,
      });
      const afterRouteChange = detectCheckout({
        url: "https://shop.random-store.test/checkout",
        pathname: "/checkout",
        hostname: "shop.random-store.test",
        title: "Checkout",
        visibleText:
          "Payment information Credit card Order summary Total",
        hasPaymentStepLabel: true,
        hasPaymentOptionControl: true,
        hasCheckoutProgress: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      });

      expect(beforeRouteChange.stage).toBe("unknown");
      expect(beforeRouteChange.shouldTriggerRecommendation).toBe(false);
      expect(afterRouteChange.signalSummary?.merchant).toBe("generic");
      expect(afterRouteChange.stage).toBe("payment");
      expect(afterRouteChange.confidenceLabel).toBe("HIGH");
      expect(afterRouteChange.shouldTriggerRecommendation).toBe(true);
    });
  });

  test.each([
    ["Amazon", "https://www.amazon.com/checkout/p/abc/spc", "/checkout/p/abc/spc"],
    ["Lululemon", "https://shop.lululemon.com/shop/mybag", "/shop/mybag"],
    ["Target", "https://www.target.com/checkout", "/checkout"],
    ["Walmart", "https://www.walmart.com/checkout", "/checkout"],
    ["Apple", "https://www.apple.com/shop/checkout", "/shop/checkout"],
    ["Best Buy", "https://www.bestbuy.com/checkout/r/payment", "/checkout/r/payment"],
  ])(
    "uses universal detector for representative merchant fixture: %s",
    (_merchant, url, pathname) => {
      const result = detectCheckout({
        url,
        pathname,
        title: "Checkout",
        visibleText: "Payment card Billing address Order total",
        hasPaymentForm: true,
        hasBillingAddressControl: true,
        hasOrderSummary: true,
        hasSubtotalOrTotal: true,
      });

      expect(result.stage).toMatch(/payment|review/);
      expect(result.confidenceLabel).toBe("HIGH");
      expect(result.shouldTriggerRecommendation).toBe(true);
      expect(result.signalSummary?.paymentSignals).toBeGreaterThan(0);
    },
  );

  test("treats place-order pages with confirm language as review, not confirmation", () => {
    const result = detectCheckout({
      pathname: "/demo-checkout-amazon.html",
      title: "Amazon Checkout - Payment",
      visibleText:
        "Confirm your payment method, review order summary, then place your order. Confirmation test",
      hasPaymentForm: true,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("payment");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("suppresses hyphenated cart URLs even when they contain an order summary", () => {
    const result = detectCheckout({
      pathname: "/demo-amazon-cart.html",
      title: "Amazon Cart",
      visibleText: "Cart order summary subtotal checkout",
      hasPaymentForm: false,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("cart");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("suppresses confirmation URLs", () => {
    const result = detectCheckout({
      pathname: "/demo-amazon-confirmation.html",
      title: "Order confirmation",
      visibleText: "Thank you. Your order is confirmed.",
      hasPaymentForm: false,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("confirmation");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("detects Amazon buy flow payment pages without a visible card input", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/gp/buy/spc/handlers/display.html?hasWorkingJavascript=1",
      pathname: "/gp/buy/spc/handlers/display.html",
      title: "Amazon Checkout",
      visibleText:
        "Choose a payment method. Use this payment method. Review your order.",
      hasPaymentForm: false,
      hasPaymentStepLabel: true,
      hasPaymentOptionControl: true,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("review");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("detects live Amazon checkout SPC as high-confidence review", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/checkout/p/abc123/spc?pipelineType=Chewbacca&referrer=spc",
      pathname: "/checkout/p/abc123/spc",
      title: "Amazon Checkout",
      visibleText:
        "Review your order Place your order Payment method Delivery details Order summary Order total",
      hasPaymentForm: false,
      hasPaymentStepLabel: true,
      hasSavedPaymentMethod: true,
      hasPlaceOrderButton: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("review");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("treats Amazon place your order text as review, not confirmation", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/checkout/p/abc123/spc",
      pathname: "/checkout/p/abc123/spc",
      title: "Amazon Checkout",
      visibleText:
        "Place your order Review your order Order summary Payment method",
      hasPaymentForm: false,
      hasPaymentStepLabel: true,
      hasSavedPaymentMethod: true,
      hasPlaceOrderButton: true,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("review");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("treats Amazon review your order text as review and triggers", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/checkout/p/abc123/spc",
      pathname: "/checkout/p/abc123/spc",
      title: "Amazon Checkout",
      visibleText:
        "Review your order Payment method Delivery details Order summary Estimated total",
      hasPaymentForm: false,
      hasPaymentStepLabel: true,
      hasSavedPaymentMethod: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("review");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("classifies Amazon thankyou route as confirmation and suppresses", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/gp/buy/thankyou/handlers/display.html",
      pathname: "/gp/buy/thankyou/handlers/display.html",
      title: "Amazon Order Confirmation",
      visibleText: "Thank you for your order. Order number 123-4567890-1234567",
      hasPaymentForm: false,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("confirmation");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("classifies thank you for your order text as confirmation and suppresses", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/checkout/p/abc123/complete",
      pathname: "/checkout/p/abc123/complete",
      title: "Amazon",
      visibleText:
        "Thank you for your order. Your order has been placed. Order number 123-4567890-1234567",
      hasPaymentForm: false,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("confirmation");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("classifies your order has been placed text as confirmation and suppresses", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/checkout/p/abc123/complete",
      pathname: "/checkout/p/abc123/complete",
      title: "Amazon",
      visibleText:
        "Your order has been placed. We'll send a confirmation email soon.",
      hasPaymentForm: false,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("confirmation");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("waits on checkout paths when supporting checkout evidence is sparse", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/checkout/p/p-123",
      pathname: "/checkout/p/p-123",
      title: "Amazon Checkout",
      visibleText: "Continue",
      hasPaymentForm: false,
      hasOrderSummary: false,
    });

    expect(result.stage).toBe("checkout");
    expect(result.confidenceLabel).toBe("MEDIUM");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("keeps local Amazon checkout harness enabled", () => {
    const result = detectCheckout({
      url: "http://localhost:5173/demo-checkout-amazon.html",
      pathname: "/demo-checkout-amazon.html",
      title: "Amazon Checkout - Payment",
      visibleText:
        "Choose a payment method. Use this payment method. Review your order.",
      hasPaymentForm: true,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("payment");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("suppresses Amazon product pages even when generic payment text exists", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/dp/B0TEST1234",
      pathname: "/dp/B0TEST1234",
      title: "Amazon.com: Example Product",
      visibleText:
        "Add to Cart Buy Now Secure transaction Payment options Returns and support",
      hasPaymentForm: true,
      hasOrderSummary: false,
    });

    expect(result.stage).toBe("unknown");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test.each([
    {
      label: "Lululemon home",
      url: "https://shop.lululemon.com/",
      pathname: "/",
      title: "lululemon",
      visibleText: "Women Men Bags Gear Add to Bag Checkout Klarna payment options",
    },
    {
      label: "Lululemon category",
      url: "https://shop.lululemon.com/c/women-pants/_/N-7vf",
      pathname: "/c/women-pants/_/N-7vf",
      title: "Women's Pants | lululemon",
      visibleText: "Women's pants Align Wunder Train Add to Bag checkout payment options",
    },
    {
      label: "Lululemon product",
      url: "https://shop.lululemon.com/p/women-pants/Align-Pant/_/prod2020012",
      pathname: "/p/women-pants/Align-Pant/_/prod2020012",
      title: "lululemon Align Pant",
      visibleText: "Add to Bag Free shipping Returns Payment options Checkout",
    },
    {
      label: "Lululemon wishlist",
      url: "https://shop.lululemon.com/wishlist",
      pathname: "/wishlist",
      title: "Wishlist | lululemon",
      visibleText: "Saved items Add to Bag Checkout Payment",
    },
    {
      label: "Amazon search",
      url: "https://www.amazon.com/s?k=shoes",
      pathname: "/s",
      title: "Amazon Search",
      visibleText: "Results Add to cart payment options shipping order summary",
    },
  ])("suppresses supported merchant browsing page: $label", (page) => {
    const result = detectCheckout({
      ...page,
      hasPaymentForm: false,
      hasOrderSummary: false,
    });

    expect(result.stage).toBe("unknown");
    expect(result.confidenceLabel).toBe("LOW");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("suppresses Lululemon mybag ordinary cart contents", () => {
    const result = detectCheckout({
      url: "https://shop.lululemon.com/shop/mybag",
      pathname: "/shop/mybag",
      title: "My Bag | lululemon",
      visibleText:
        "My Bag Align Pant Checkout Payment options Shipping returns Subtotal",
      hasPaymentForm: false,
      hasShippingForm: false,
      hasPlaceOrderButton: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("cart");
    expect(result.confidenceLabel).toBe("MEDIUM");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("suppresses Lululemon mybag with only a checkout button", () => {
    const result = detectCheckout({
      url: "https://shop.lululemon.com/shop/mybag",
      pathname: "/shop/mybag",
      title: "My Bag | lululemon",
      visibleText: "My Bag Checkout Order summary Estimated total",
      hasPaymentForm: false,
      hasShippingForm: false,
      hasPlaceOrderButton: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("cart");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("suppresses Lululemon mybag when payment fields are hidden templates", () => {
    const result = detectCheckout({
      url: "https://shop.lululemon.com/shop/mybag",
      pathname: "/shop/mybag",
      title: "My Bag | lululemon",
      visibleText:
        "Payment card number expiration CVV shipping checkout order summary",
      hasPaymentForm: false,
      hasShippingForm: false,
      hasPlaceOrderButton: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("cart");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("triggers Lululemon mybag with visible shipping form and order context", () => {
    const result = detectCheckout({
      url: "https://shop.lululemon.com/shop/mybag",
      pathname: "/shop/mybag",
      title: "Checkout | lululemon",
      visibleText: "Shipping address Delivery method Order summary Estimated total",
      hasPaymentForm: false,
      hasShippingForm: true,
      hasPlaceOrderButton: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("checkout");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("triggers Lululemon mybag with visible card payment controls", () => {
    const result = detectCheckout({
      url: "https://shop.lululemon.com/shop/mybag",
      pathname: "/shop/mybag",
      title: "Checkout | lululemon",
      visibleText: "Card number Expiration Security code Billing address",
      hasPaymentForm: true,
      hasShippingForm: false,
      hasPlaceOrderButton: false,
      hasOrderSummary: false,
      hasSubtotalOrTotal: false,
    });

    expect(result.stage).toBe("payment");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("triggers Lululemon mybag review with place-order button and order total", () => {
    const result = detectCheckout({
      url: "https://shop.lululemon.com/shop/mybag",
      pathname: "/shop/mybag",
      title: "Review Order | lululemon",
      visibleText:
        "Review your order Selected payment method Delivery address Order total Place your order",
      hasPaymentForm: false,
      hasPaymentStepLabel: true,
      hasSavedPaymentMethod: true,
      hasShippingForm: false,
      hasPlaceOrderButton: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("review");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("suppresses Lululemon post-purchase confirmation", () => {
    const result = detectCheckout({
      url: "https://shop.lululemon.com/shop/mybag",
      pathname: "/shop/mybag",
      title: "Order confirmation | lululemon",
      visibleText: "Thank you for your order. Your order has been placed.",
      hasPaymentForm: false,
      hasShippingForm: false,
      hasPlaceOrderButton: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("confirmation");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("allows Lululemon checkout only with high-confidence checkout evidence", () => {
    const result = detectCheckout({
      url: "https://checkout.lululemon.com/checkout/shipping",
      pathname: "/checkout/shipping",
      title: "Checkout | lululemon",
      visibleText:
        "Shipping address Delivery options Order summary Subtotal Estimated total",
      hasShippingForm: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("checkout");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("allows review order pages with place order evidence", () => {
    const result = detectCheckout({
      url: "https://checkout.lululemon.com/checkout/review-order",
      pathname: "/checkout/review-order",
      title: "Review Order | lululemon",
      visibleText:
        "Review your order Payment method Order summary Subtotal Place your order",
      hasPaymentStepLabel: true,
      hasSavedPaymentMethod: true,
      hasPlaceOrderButton: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("review");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("suppresses Amazon home and search pages with checkout-like footer text", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/s?k=water+bottle",
      pathname: "/s",
      title: "Amazon Search",
      visibleText:
        "Results Add to cart Your payment information Shipping rates Conditions of use",
      hasPaymentForm: false,
      hasOrderSummary: false,
    });

    expect(result.stage).toBe("unknown");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("suppresses Apple bag without a visible payment decision control", () => {
    const result = detectCheckout({
      url: "https://www.apple.com/shop/bag",
      pathname: "/shop/bag",
      hostname: "www.apple.com",
      title: "Bag - Apple",
      visibleText: "Bag Check Out Order Summary Subtotal Apple Store",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: false,
      hasExpressCheckoutControl: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.signalSummary?.merchant).toBe("apple");
    expect(result.stage).toBe("cart");
    expect(result.confidence).toBe(0.65);
    expect(result.shouldTriggerRecommendation).toBe(false);
    expect(result.suppressionReason).toBe("cart-only state");
  });

  test("detects Apple bag when express checkout is the payment decision", () => {
    const result = detectCheckout({
      url: "https://www.apple.com/shop/bag",
      pathname: "/shop/bag",
      hostname: "www.apple.com",
      title: "Bag - Apple",
      visibleText: "Bag Apple Pay Check Out Order Summary Subtotal Total",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: false,
      hasExpressCheckoutControl: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.signalSummary?.merchant).toBe("apple");
    expect(result.stage).toBe("payment");
    expect(result.confidence).toBe(0.89);
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
    expect(result.signalSummary?.activePaymentProviders).toContain(
      "express-checkout-control",
    );
  });

  test("detects Target abbreviated checkout payment route with saved payment evidence", () => {
    const result = detectCheckout({
      url: "https://www.target.com/co-payment",
      pathname: "/co-payment",
      hostname: "www.target.com",
      title: "Checkout - Target",
      visibleText:
        "Checkout Delivery Payment Review Credit or debit card Order summary Total",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: true,
      hasExpressCheckoutControl: false,
      hasCheckoutProgress: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.signalSummary?.merchant).toBe("target");
    expect(result.signalSummary?.routeSignals.checkoutRoute).toBe(true);
    expect(result.stage).toBe("payment");
    expect(result.confidence).toBe(0.85);
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("detects Best Buy payment page through universal payment-decision signals", () => {
    const result = detectCheckout({
      url: "https://www.bestbuy.com/checkout/r/payment",
      pathname: "/checkout/r/payment",
      hostname: "www.bestbuy.com",
      title: "Checkout - Payment",
      visibleText:
        "Payment Information How do you want to pay? Credit card PayPal Order Summary Total",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: false,
      hasExpressCheckoutControl: true,
      hasPaymentStepLabel: true,
      hasPaymentOptionControl: true,
      hasCheckoutProgress: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.signalSummary?.merchant).toBe("best-buy");
    expect(result.stage).toBe("payment");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.shouldTriggerRecommendation).toBe(true);
    expect(result.signalSummary?.activePaymentProviders).toContain(
      "payment-option-control",
    );
  });

  test("suppresses cart page with order summary and total but no payment controls", () => {
    const result = detectCheckout({
      url: "https://www.bestbuy.com/cart",
      pathname: "/cart",
      hostname: "www.bestbuy.com",
      title: "Your Cart - Best Buy",
      visibleText: "Your Cart Order Summary Subtotal Total Checkout",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: false,
      hasExpressCheckoutControl: false,
      hasPaymentStepLabel: false,
      hasPaymentOptionControl: false,
      hasBillingAddressControl: false,
      hasCheckoutProgress: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.signalSummary?.merchant).toBe("best-buy");
    expect(result.stage).toBe("cart");
    expect(result.confidenceLabel).toBe("MEDIUM");
    expect(result.shouldTriggerRecommendation).toBe(false);
    expect(result.suppressionReason).toBe("cart-only state");
  });

  test("detects Walmart payment page through universal payment-decision signals", () => {
    const result = detectCheckout({
      url: "https://www.walmart.com/checkout/#/payment",
      pathname: "/checkout",
      hostname: "www.walmart.com",
      title: "Walmart Checkout",
      visibleText:
        "Payment Method Credit or debit card Add payment Billing address Order summary Total",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: true,
      hasExpressCheckoutControl: false,
      hasPaymentStepLabel: true,
      hasPaymentOptionControl: true,
      hasBillingAddressControl: true,
      hasCheckoutProgress: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.signalSummary?.merchant).toBe("walmart");
    expect(result.stage).toBe("payment");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("detects payment-stage intent even when the merchant is unknown", () => {
    const result = detectCheckout({
      url: "https://checkout.example-payments.test/session/123",
      pathname: "/session/123",
      hostname: "checkout.example-payments.test",
      title: "Secure checkout",
      visibleText:
        "Payment Information Choose how to pay Credit card Order summary Total",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: false,
      hasExpressCheckoutControl: false,
      hasPaymentStepLabel: true,
      hasPaymentOptionControl: true,
      hasCheckoutProgress: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.signalSummary?.merchant).toBe("generic");
    expect(result.stage).toBe("payment");
    expect(result.confidenceLabel).toBe("HIGH");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("reevaluation fixture: custom payment selector revealed after user selection", () => {
    const beforeSelection = detectCheckout({
      url: "https://checkout.example.test/order",
      pathname: "/order",
      hostname: "checkout.example.test",
      title: "Checkout",
      visibleText: "Contact information Order summary Total Place Order",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: false,
      hasExpressCheckoutControl: false,
      hasPaymentStepLabel: false,
      hasPaymentOptionControl: false,
      hasCheckoutProgress: true,
      hasPlaceOrderButton: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    const afterSelection = detectCheckout({
      url: "https://checkout.example.test/order",
      pathname: "/order",
      hostname: "checkout.example.test",
      title: "Checkout",
      visibleText:
        "Contact information Payment method Credit card selected Order summary Total Place Order",
      hasPaymentForm: false,
      hasPaymentIframe: false,
      hasSavedPaymentMethod: true,
      hasExpressCheckoutControl: false,
      hasPaymentStepLabel: true,
      hasPaymentOptionControl: true,
      hasCheckoutProgress: true,
      hasPlaceOrderButton: true,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(beforeSelection.stage).toBe("checkout");
    expect(beforeSelection.confidence).toBeLessThan(0.85);
    expect(beforeSelection.shouldTriggerRecommendation).toBe(false);
    expect(afterSelection.signalSummary?.merchant).toBe("generic");
    expect(afterSelection.stage).toBe("review");
    expect(afterSelection.confidenceLabel).toBe("HIGH");
    expect(afterSelection.shouldTriggerRecommendation).toBe(true);
  });

  test("suppresses Amazon sign-in pages during checkout redirect", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.com%2Fgp%2Fbuy%2Fspc",
      pathname: "/ap/signin",
      title: "Amazon Sign-In",
      visibleText: "Sign in Email Password Continue Checkout Cart",
      hasPaymentForm: false,
      hasOrderSummary: false,
    });

    expect(result.stage).toBe("unknown");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });

  test("keeps generic cart pages for other merchants suppressed", () => {
    const result = detectCheckout({
      url: "https://example.com/cart",
      pathname: "/cart",
      title: "Cart",
      visibleText:
        "Cart Checkout Payment Shipping Order summary Estimated total",
      hasPaymentForm: false,
      hasShippingForm: false,
      hasPlaceOrderButton: false,
      hasOrderSummary: true,
      hasSubtotalOrTotal: true,
    });

    expect(result.stage).toBe("cart");
    expect(result.shouldTriggerRecommendation).toBe(false);
  });
});
