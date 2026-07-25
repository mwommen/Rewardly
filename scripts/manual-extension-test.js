const { chromium } = require("../backend/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const extensionPath = path.resolve("extension");
const profilePath = `/tmp/rewardly-extension-manual-profile-${Date.now()}`;
const screenshotsDir = path.resolve("test-results/rewardly-extension");
const demoBaseUrl = process.env.DEMO_BASE_URL || "http://localhost:5173";
const apiBase = process.env.API_BASE || "http://localhost:5001";
const manualCardSlugs = (
  process.env.MANUAL_CARD_SLUGS || "capital-one-venture"
)
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);
const expectedCardPattern = new RegExp(
  process.env.EXPECTED_CARD_PATTERN || "Venture",
  "i",
);
const expectedExplanationPattern = new RegExp(
  process.env.EXPECTED_EXPLANATION_PATTERN || "2x Venture Miles",
  "i",
);
const forbiddenExplanationPattern = /Capital One Travel credit|airport benefits|generic card benefits/i;

async function main() {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker", { timeout: 10000 }));
  const extensionId = worker.url().split("/")[2];

  await worker.evaluate(
    ({ apiBase, manualCardSlugs }) =>
      new Promise((resolve) => {
        chrome.storage.sync.set(
          {
            API_BASE: apiBase,
            USER_ID: "manualTestUser",
            MANUAL_CARD_SLUGS: manualCardSlugs,
            DEBUG_LOGS: true,
          },
          resolve,
        );
      }),
    { apiBase, manualCardSlugs },
  );

  const results = [];

  async function openPage(name, url) {
    const page = await context.newPage();
    page.on("console", (message) => {
      console.log(`[${name}]`, message.type(), message.text());
    });
    page.on("pageerror", (error) => {
      console.log(`[${name}] pageerror`, error.message);
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(3000);
    return page;
  }

  async function popupInfo(page) {
    const count = await page.locator("#rewardly-popup").count();
    const cardName = count
      ? await page
          .locator("#rewardly-popup .rewardly-card-name")
          .first()
          .innerText()
          .catch(() => null)
      : null;
    const merchant = count
      ? await page
          .locator("#rewardly-popup .rewardly-merchant")
          .first()
          .innerText()
          .catch(() => null)
      : null;
    return { count, cardName, merchant };
  }

  async function popupText(page) {
    return page
      .locator("#rewardly-popup")
      .first()
      .innerText()
      .catch(() => "");
  }

  async function setCartLikeDom(page) {
    await page.evaluate(() => {
      history.pushState({}, "", "/demo-amazon-cart.html");
      document.body.innerHTML = `
        <main>
          <h1>Cart</h1>
          <button>Checkout</button>
          <section>Subtotal $98.00</section>
        </main>
      `;
    });
  }

  async function setCheckoutDom(page) {
    await page.evaluate(() => {
      history.pushState({}, "", "/demo-checkout-amazon.html");
      document.body.innerHTML = `
        <main>
          <h1>Review your order</h1>
          <section id="orderSummaryPrimaryActionBtn">Order total $98.00</section>
          <label>Card number <input autocomplete="cc-number" value="4111111111111111" /></label>
          <button>Place your order</button>
        </main>
      `;
    });
  }

  async function setProductDom(page) {
    await page.evaluate(() => {
      history.pushState({}, "", "/dp/B0TEST1234");
      document.body.innerHTML = `
        <main>
          <h1>Example Product</h1>
          <button>Add to Cart</button>
          <p>Payment options and shipping details</p>
        </main>
      `;
    });
  }

  async function setHydratingCheckoutDom(page) {
    await page.evaluate(() => {
      history.pushState({}, "", "/demo-checkout-amazon.html");
      document.body.innerHTML = `
        <main>
          <h1>Loading checkout</h1>
          <section aria-busy="true">Preparing payment options...</section>
        </main>
      `;
    });
  }

  async function setConfirmationDom(page) {
    await page.evaluate(() => {
      history.pushState({}, "", "/gp/buy/thankyou/handlers/display.html");
      document.body.innerHTML = `
        <main>
          <h1>Thank you for your order</h1>
          <p>Your order has been placed.</p>
          <p>Order number 123-4567890-1234567</p>
        </main>
      `;
    });
  }

  const checkout = await openPage(
    "checkout",
    `${demoBaseUrl}/demo-checkout-amazon.html`,
  );
  await checkout.evaluate(() => {
    document.body.setAttribute("data-rewardly-test-page-loaded", "true");
  });
  let info = await popupInfo(checkout);
  const extensionLoaded = await checkout
    .locator("html")
    .getAttribute("data-rewardly-extension");
  const checkoutDiagnostics = {
    stage: await checkout
      .locator("html")
      .getAttribute("data-rewardly-checkout-stage"),
    shouldTrigger: await checkout
      .locator("html")
      .getAttribute("data-rewardly-should-trigger"),
  };
  results.push({
    test: "extension content script loads",
    pass: extensionLoaded === "loaded",
    info: { extensionLoaded, ...checkoutDiagnostics },
  });
  results.push({
    test: "checkout popup appears",
    pass: info.count === 1,
    info,
  });
  results.push({
    test: "checkout recommends configured wallet-owned card",
    pass: expectedCardPattern.test(info.cardName || ""),
    info,
  });
  const amazonPopupText = await popupText(checkout);
  results.push({
    test: "Amazon popup explanation matches validated winning rule",
    pass:
      expectedExplanationPattern.test(amazonPopupText) &&
      !forbiddenExplanationPattern.test(amazonPopupText),
    info: {
      text: amazonPopupText,
      expected: expectedExplanationPattern.source,
      forbiddenAbsent: !forbiddenExplanationPattern.test(amazonPopupText),
    },
  });
  await checkout.screenshot({
    path: path.join(screenshotsDir, "demo-checkout-popup.png"),
    fullPage: true,
  });

  for (let index = 0; index < 5; index += 1) {
    await checkout.evaluate((value) => {
      const div = document.createElement("div");
      div.textContent = `Rewardly duplicate check ${value}`;
      document.body.appendChild(div);
    }, index);
    await checkout.waitForTimeout(150);
  }
  info = await popupInfo(checkout);
  results.push({
    test: "duplicate popup does not appear",
    pass: info.count === 1,
    info,
  });

  await setCartLikeDom(checkout);
  await checkout.waitForTimeout(5200);
  info = await popupInfo(checkout);
  results.push({
    test: "medium cart classification remains visible after grace period",
    pass: info.count === 1,
    info,
  });

  await setCheckoutDom(checkout);
  await checkout.waitForTimeout(1800);
  info = await popupInfo(checkout);
  results.push({
    test: "valid checkout evidence cancels pending exit",
    pass: info.count === 1,
    info,
  });

  await setHydratingCheckoutDom(checkout);
  await checkout.waitForTimeout(5200);
  info = await popupInfo(checkout);
  results.push({
    test: "weak same-route checkout hydration remains visible after grace period",
    pass: info.count === 1,
    info,
  });

  await setCheckoutDom(checkout);
  await checkout.waitForTimeout(1000);
  info = await popupInfo(checkout);
  results.push({
    test: "valid checkout evidence cancels exit pending after hydration",
    pass: info.count === 1,
    info,
  });

  for (let index = 0; index < 4; index += 1) {
    await checkout.evaluate((value) => {
      const div = document.createElement("div");
      div.textContent = `Rewardly lifecycle duplicate check ${value}`;
      document.body.appendChild(div);
    }, index);
    await checkout.waitForTimeout(150);
  }
  info = await popupInfo(checkout);
  results.push({
    test: "repeated lifecycle mutations do not duplicate popup",
    pass: info.count === 1,
    info,
  });

  await setProductDom(checkout);
  await checkout.waitForTimeout(5200);
  info = await popupInfo(checkout);
  results.push({
    test: "sustained product navigation removes popup after grace period",
    pass: info.count === 0,
    info,
  });

  const confirmationRemoval = await openPage(
    "checkout-confirmation-removal",
    `${demoBaseUrl}/demo-checkout-amazon.html`,
  );
  await confirmationRemoval.waitForTimeout(1000);
  await setConfirmationDom(confirmationRemoval);
  await confirmationRemoval.waitForTimeout(1000);
  info = await popupInfo(confirmationRemoval);
  results.push({
    test: "post-purchase confirmation removes active popup immediately",
    pass: info.count === 0,
    info,
  });
  await confirmationRemoval.close();

  const dismissPage = await openPage(
    "checkout-dismissal",
    `${demoBaseUrl}/demo-checkout-amazon.html`,
  );
  info = await popupInfo(dismissPage);

  if (info.count === 1) {
    await dismissPage.locator("#rewardly-popup .rewardly-dismiss").click();
    await dismissPage.waitForTimeout(300);
    await dismissPage.reload({ waitUntil: "domcontentloaded" });
    await dismissPage.waitForTimeout(1800);
    info = await popupInfo(dismissPage);
    results.push({
      test: "dismiss hides popup after reload",
      pass: info.count === 0,
      info,
    });
    await dismissPage.screenshot({
      path: path.join(screenshotsDir, "demo-checkout-dismissed.png"),
      fullPage: true,
    });
  } else {
    results.push({
      test: "dismiss hides popup after reload",
      pass: false,
      info: { reason: `checkout popup count was ${info.count}` },
    });
  }
  await dismissPage.close();

  const cart = await openPage(
    "cart",
    `${demoBaseUrl}/demo-amazon-cart.html`,
  );
  info = await popupInfo(cart);
  results.push({
    test: "cart page suppresses popup",
    pass: info.count === 0,
    info,
  });
  await cart.screenshot({
    path: path.join(screenshotsDir, "demo-cart-no-popup.png"),
    fullPage: true,
  });

  const confirmation = await openPage(
    "confirmation",
    `${demoBaseUrl}/demo-amazon-confirmation.html`,
  );
  info = await popupInfo(confirmation);
  results.push({
    test: "confirmation page suppresses popup",
    pass: info.count === 0,
    info,
  });
  await confirmation.screenshot({
    path: path.join(screenshotsDir, "demo-confirmation-no-popup.png"),
    fullPage: true,
  });

  const lululemon = await openPage(
    "lululemon-checkout",
    `${demoBaseUrl}/demo-checkout-lululemon.html`,
  );
  await lululemon.waitForTimeout(30000);
  info = await popupInfo(lululemon);
  const lululemonPopupText = await popupText(lululemon);
  results.push({
    test: "Lululemon checkout popup remains visible for 30 seconds",
    pass: info.count === 1,
    info: {
      ...info,
      text: lululemonPopupText,
    },
  });
  results.push({
    test: "Lululemon checkout does not duplicate popup after 30 seconds",
    pass: info.count === 1,
    info,
  });
  await lululemon.screenshot({
    path: path.join(screenshotsDir, "demo-lululemon-checkout-popup-30s.png"),
    fullPage: true,
  });

  console.log(JSON.stringify({ extensionId, results }, null, 2));
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
