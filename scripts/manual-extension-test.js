const { chromium } = require("../backend/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const extensionPath = path.resolve("extension");
const profilePath = `/tmp/rewardly-extension-manual-profile-${Date.now()}`;
const screenshotsDir = path.resolve("test-results/rewardly-extension");

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
    () =>
      new Promise((resolve) => {
        chrome.storage.sync.set(
          {
            API_BASE: "http://localhost:5001",
            USER_ID: "manualTestUser",
            MANUAL_CARD_SLUGS: ["amex-platinum"],
            DEBUG_LOGS: true,
          },
          resolve,
        );
      }),
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

  const checkout = await openPage(
    "checkout",
    "http://localhost:5173/demo-checkout-amazon.html",
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
    test: "checkout recommends wallet-owned Amex Platinum",
    pass: /Platinum/i.test(info.cardName || ""),
    info,
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

  if (info.count === 1) {
    await checkout.locator("#rewardly-popup .rewardly-dismiss").click();
    await checkout.waitForTimeout(300);
    await checkout.reload({ waitUntil: "domcontentloaded" });
    await checkout.waitForTimeout(1800);
    info = await popupInfo(checkout);
    results.push({
      test: "dismiss hides popup after reload",
      pass: info.count === 0,
      info,
    });
    await checkout.screenshot({
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

  const cart = await openPage(
    "cart",
    "http://localhost:5173/demo-amazon-cart.html",
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
    "http://localhost:5173/demo-amazon-confirmation.html",
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

  console.log(JSON.stringify({ extensionId, results }, null, 2));
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
