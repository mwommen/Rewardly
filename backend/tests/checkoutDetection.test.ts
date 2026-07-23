import { detectCheckout } from "../../packages/rewardly-core/src/checkoutDetection";

describe("checkout detection", () => {
  test("treats payment pages with confirm language as payment, not confirmation", () => {
    const result = detectCheckout({
      pathname: "/demo-checkout-amazon.html",
      title: "Amazon Checkout - Payment",
      visibleText:
        "Confirm your payment method, review order summary, then place your order. Confirmation test",
      hasPaymentForm: true,
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("payment");
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
      hasOrderSummary: true,
    });

    expect(result.stage).toBe("payment");
    expect(result.shouldTriggerRecommendation).toBe(true);
  });

  test("detects Amazon checkout paths even when page text is sparse", () => {
    const result = detectCheckout({
      url: "https://www.amazon.com/checkout/p/p-123",
      pathname: "/checkout/p/p-123",
      title: "Amazon Checkout",
      visibleText: "Shipping address Order summary",
      hasPaymentForm: false,
      hasOrderSummary: false,
    });

    expect(result.stage).toBe("checkout");
    expect(result.shouldTriggerRecommendation).toBe(true);
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
});
