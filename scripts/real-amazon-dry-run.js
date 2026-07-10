const { chromium } = require("../backend/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const extensionPath = path.resolve("extension");
const profilePath = `/tmp/rewardly-real-amazon-profile-${Date.now()}`;
const screenshotsDir = path.resolve("test-results/rewardly-extension");

const pages = [
  {
    name: "amazon-cart",
    url: "https://www.amazon.com/gp/cart/view.html",
  },
  {
    name: "amazon-checkout",
    url: "https://www.amazon.com/gp/buy/spc/handlers/display.html?hasWorkingJavascript=1",
  },
];

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
            API_BASE: "http://localhost:5011",
            USER_ID: "manualTestUser",
            MANUAL_CARD_SLUGS: ["amex-platinum"],
            DEBUG_LOGS: true,
          },
          resolve,
        );
      }),
  );

  const results = [];

  for (const target of pages) {
    const page = await context.newPage();
    const logs = [];
    page.on("console", (message) => {
      const line = `[${target.name}] ${message.type()} ${message.text()}`;
      logs.push(line);
      console.log(line);
    });
    page.on("pageerror", (error) => {
      const line = `[${target.name}] pageerror ${error.message}`;
      logs.push(line);
      console.log(line);
    });

    let loadError = null;
    try {
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForTimeout(5000);
    } catch (error) {
      loadError = String(error?.message || error);
    }

    let info = null;
    let evaluationError = null;
    try {
      info = await page.evaluate(() => ({
        href: location.href,
        title: document.title,
        extensionLoaded:
          document.documentElement.getAttribute("data-rewardly-extension"),
        checkoutStage: document.documentElement.getAttribute(
          "data-rewardly-checkout-stage",
        ),
        shouldTrigger: document.documentElement.getAttribute(
          "data-rewardly-should-trigger",
        ),
        popupCount: document.querySelectorAll("#rewardly-popup").length,
        cardName:
          document.querySelector("#rewardly-popup .rewardly-card-name")
            ?.textContent || null,
        merchant:
          document.querySelector("#rewardly-popup .rewardly-merchant")
            ?.textContent || null,
        bodySnippet: document.body?.innerText?.slice(0, 500) || "",
      }));
    } catch (error) {
      evaluationError = String(error?.message || error);
      info = {
        href: page.url(),
        title: null,
        extensionLoaded: null,
        checkoutStage: null,
        shouldTrigger: null,
        popupCount: null,
        cardName: null,
        merchant: null,
        bodySnippet: "",
      };
    }

    const screenshotPath = path.join(
      screenshotsDir,
      `${target.name}-real-dry-run.png`,
    );
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (error) {
      logs.push(
        `[${target.name}] screenshot error ${String(error?.message || error)}`,
      );
    }

    results.push({
      name: target.name,
      url: target.url,
      loadError,
      evaluationError,
      screenshotPath,
      info,
      rewardlyLogs: logs.filter((line) => line.includes("[Rewardly]")),
    });
  }

  console.log(JSON.stringify({ extensionId, results }, null, 2));
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
