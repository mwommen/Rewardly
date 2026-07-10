const { chromium } = require("../backend/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const extensionPath = path.resolve("extension");
const profilePath =
  process.env.REWARDLY_AMAZON_PROFILE ||
  "/tmp/rewardly-natural-amazon-profile";
const screenshotsDir = path.resolve("test-results/rewardly-extension");
const outputPath = path.join(
  screenshotsDir,
  "natural-amazon-checkout-result.json",
);

const apiBase = process.env.REWARDLY_API_BASE || "http://localhost:5011";
const userId = process.env.REWARDLY_USER_ID || "manualTestUser";
const walletCardSlugs = (
  process.env.REWARDLY_WALLET_CARDS || "amex-platinum"
)
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);

function prompt(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

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
    ({ apiBase, userId, walletCardSlugs }) =>
      new Promise((resolve) => {
        chrome.storage.sync.set(
          {
            API_BASE: apiBase,
            USER_ID: userId,
            MANUAL_CARD_SLUGS: walletCardSlugs,
            DEBUG_LOGS: true,
          },
          resolve,
        );
      }),
    { apiBase, userId, walletCardSlugs },
  );

  const page = await context.newPage();
  const logs = [];
  page.on("console", (message) => {
    const line = `[amazon-natural] ${message.type()} ${message.text()}`;
    logs.push(line);
    console.log(line);
  });
  page.on("pageerror", (error) => {
    const line = `[amazon-natural] pageerror ${error.message}`;
    logs.push(line);
    console.log(line);
  });

  const captures = [];

  await page.goto("https://www.amazon.com/", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  console.log("\nRewardly natural Amazon checkout test is ready.");
  console.log(`Extension ID: ${extensionId}`);
  console.log(`API base: ${apiBase}`);
  console.log(`User ID: ${userId}`);
  console.log(`Wallet cards: ${walletCardSlugs.join(", ")}`);
  console.log("\nManual steps:");
  console.log("1. Sign in to Amazon if needed.");
  console.log("2. Add one inexpensive item to cart.");
  console.log("3. Open the Amazon cart page.");
  await prompt("\nPress Enter here when you are on Amazon cart...");
  captures.push(await captureState(page, "natural-amazon-cart"));

  console.log("\nNext manual step:");
  console.log("Navigate naturally from cart to checkout/payment selection.");
  console.log("Do not place an order.");
  await prompt("\nPress Enter here when you are on checkout/payment selection...");
  captures.push(await captureState(page, "natural-amazon-checkout"));

  const checkoutInfo = captures[captures.length - 1].info;
  if (checkoutInfo.popupCount === 1) {
    await page.evaluate(() => {
      for (let index = 0; index < 5; index += 1) {
        const div = document.createElement("div");
        div.textContent = `Rewardly natural duplicate check ${index}`;
        document.body.appendChild(div);
      }
    });
    await page.waitForTimeout(1000);
    captures.push(await captureState(page, "natural-amazon-duplicate-check"));

    await page.locator("#rewardly-popup .rewardly-dismiss").click();
    await page.waitForTimeout(500);
    captures.push(await captureState(page, "natural-amazon-after-dismiss"));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    captures.push(await captureState(page, "natural-amazon-after-dismiss-reload"));
  } else {
    captures.push({
      name: "natural-amazon-dismiss-not-run",
      skipped: true,
      reason: `Popup count was ${checkoutInfo.popupCount}`,
    });
  }

  console.log("\nOptional final step:");
  console.log(
    "If you can reach an Amazon thank-you/confirmation page without placing a new real order, navigate there now.",
  );
  await prompt(
    "Press Enter to capture the current page as confirmation, or leave as-is and press Enter...",
  );
  captures.push(await captureState(page, "natural-amazon-confirmation-or-current"));

  const result = {
    generatedAt: new Date().toISOString(),
    extensionId,
    apiBase,
    userId,
    walletCardSlugs,
    profilePath,
    captures,
    rewardlyLogs: logs.filter((line) => line.includes("[Rewardly]")),
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nSaved result JSON: ${outputPath}`);
  await context.close();
}

async function captureState(page, name) {
  await page.waitForTimeout(1000);
  const screenshotPath = path.join(screenshotsDir, `${name}.png`);
  let info;
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
      bodySnippet: document.body?.innerText?.slice(0, 600) || "",
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

  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    evaluationError =
      evaluationError || `screenshot failed: ${String(error?.message || error)}`;
  }

  const capture = {
    name,
    screenshotPath,
    evaluationError,
    info,
  };
  console.log(JSON.stringify(capture, null, 2));
  return capture;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
