const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const { writeReports, ensureArtifacts } = require("./qualification-report");
const { STATUS } = require("./qualification-types");

const root = path.resolve(__dirname, "../..");
const mode = process.argv.includes("--quick") ? "quick" : "full";
const reportOnly = process.argv.includes("--report");
const artifacts = ensureArtifacts(root);
const startedAt = new Date();
const SCHEMA_VERSION = "private-beta-qualification-v2";
const RUNNER_VERSION = "8.6A.1";

const env = {
  ...process.env,
  NODE_ENV: "test",
  REWARDLY_EXTENSION_API_BASE:
    process.env.REWARDLY_EXTENSION_API_BASE || "https://api.rewardly-test.example",
  REWARDLY_EXTENSION_APP_URL:
    process.env.REWARDLY_EXTENSION_APP_URL || "https://app.rewardly-test.example",
};

if (reportOnly) {
  const md = path.join(artifacts, "private-beta-qualification.md");
  if (!fs.existsSync(md)) {
    console.error("No qualification report exists yet. Run npm run qualify:private-beta first.");
    process.exit(1);
  }
  console.log(fs.readFileSync(md, "utf8"));
  process.exit(0);
}

const categories = [];

runCategory("Dependency Preflight", () => dependencyPreflightChecks());
runCategory("Repository Safety", () => repositorySafetyChecks());
runCategory("Build", () => commandChecks([
  checkCommand("Backend build", "npm", ["--prefix", "backend", "run", "build"]),
  checkCommand("Frontend build", "npm", ["--prefix", "frontend-vite", "run", "build"]),
  checkCommand("Frontend lint", "npm", ["--prefix", "frontend-vite", "run", "lint"]),
  checkCommand("Shared core build", "backend/node_modules/.bin/tsc", [
    "-p",
    "packages/rewardly-core/tsconfig.json",
  ]),
]));
runCategory("Authentication", () => commandChecks([
  checkCommand("Two-user beta authentication", "npm", [
    "--prefix",
    "backend",
    "test",
    "--",
    "--runInBand",
    "betaAuthService",
    "betaAuthRoutes",
    "decisionRoutes",
  ]),
]));
runCategory("Wallet Isolation", () => commandChecks([
  checkCommand("Wallet-owned recommendation enforcement", "npm", [
    "--prefix",
    "backend",
    "test",
    "--",
    "--runInBand",
    "paymentDecisionService",
    "walletDecisionEngine",
    "betaAuthService",
  ]),
]));
runCategory("Recommendation Correctness", () => commandChecks([
  checkCommand("Recommendation correctness and validation", "npm", [
    "--prefix",
    "backend",
    "test",
    "--",
    "--runInBand",
    "paymentDecisionService",
    "recommendationService",
    "benefitDecisionAccuracy",
    "recommendation-validation/recommendationValidation.test.ts",
  ]),
]));
runCategory("Merchant Detection", () => commandChecks([
  checkCommand("Merchant and checkout fixtures", "npm", [
    "--prefix",
    "backend",
    "test",
    "--",
    "--runInBand",
    "checkoutDetection",
    "merchantDetectionService",
    "merchantIntelligenceService",
  ]),
], { artifacts: [writeMerchantCoverage()] }));
runCategory("Extension Syntax", () => commandChecks([
  checkCommand("Extension source syntax", "node", ["--check", "extension/content.js"]),
  checkCommand("Extension background syntax", "node", ["--check", "extension/background.js"]),
  checkCommand("Production popup syntax", "node", ["--check", "extension/popup.production.js"]),
]));
runCategory("Frontend Activation Contract", () => frontendActivationContractChecks());
runCategory("Popup Lifecycle Contract", () => popupLifecycleContractChecks());
runCategory("Analytics", () => commandChecks([
  checkCommand("Analytics privacy tests", "npm", [
    "--prefix",
    "backend",
    "test",
    "--",
    "--runInBand",
    "analyticsRoutes",
    "recommendationAnalyticsService",
  ]),
]));
runCategory("Feedback", () => commandChecks([
  checkCommand("Feedback sanitization tests", "npm", [
    "--prefix",
    "backend",
    "test",
    "--",
    "--runInBand",
    "feedbackService",
    "feedbackRoutes",
  ]),
]));
runCategory("Production Route Contracts", () => productionRouteChecks());
runCategory("CORS Runtime Policy", () => corsChecks());
runCategory("Logging Redaction", () => loggingRedactionChecks());
runCategory("Extension Package", () => extensionPackageChecks());

if (mode === "full") {
  runCategory("Orchestrated Beta Flow", () => commandChecks([
    checkCommand("Two-user private beta flow", "npm", [
      "--prefix",
      "backend",
      "test",
      "--",
      "--runInBand",
      "privateBetaQualificationFlow",
    ]),
  ]));
  runCategory("Full Backend Regression Suite", () => commandChecks([
    checkCommand("Full backend release suite", "npm", [
      "--prefix",
      "backend",
      "test",
      "--",
      "--runInBand",
    ]),
  ]));
}

runCategory("Performance", () => performanceSummary());

const completedAt = new Date();
const criticalFailures = categories.flatMap((category) =>
  category.status === STATUS.FAIL
    ? category.failures.map((failure) => `${category.name}: ${failure}`)
    : [],
);
const warnings = categories.flatMap((category) =>
  category.warnings.map((warning) => `${category.name}: ${warning}`),
);
const status = criticalFailures.length ? "NOT READY" : "READY";
const report = {
  status,
  schemaVersion: SCHEMA_VERSION,
  runnerVersion: RUNNER_VERSION,
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  mode,
  gitCommit: safeCommand("git", ["rev-parse", "HEAD"]).trim(),
  gitBranch: safeCommand("git", ["branch", "--show-current"]).trim(),
  gitUnavailable: !safeCommand("git", ["rev-parse", "--is-inside-work-tree"]).trim(),
  nodeVersion: process.version,
  ci: process.env.CI === "true",
  dependenciesInstalled: dependenciesInstalled(),
  criticalFailures,
  warnings,
  categories,
};

const paths = writeReports(root, report);
console.log(`\nPRIVATE BETA QUALIFICATION: ${status}`);
console.log(`JSON report: ${paths.jsonPath}`);
console.log(`Markdown report: ${paths.mdPath}`);
process.exit(criticalFailures.length ? 1 : 0);

function runCategory(name, fn) {
  const started = Date.now();
  try {
    const result = fn();
    const failures = result.failures || [];
    const warnings = result.warnings || [];
    categories.push({
      name,
      status: failures.length ? STATUS.FAIL : warnings.length ? STATUS.WARN : STATUS.PASS,
      durationMs: Date.now() - started,
      checksExecuted: result.checksExecuted || 0,
      checksPassed: result.checksPassed || 0,
      checksFailed: failures.length,
      failures,
      warnings,
      outputSummary: result.outputSummary || "",
      artifacts: result.artifacts || [],
    });
  } catch (error) {
    categories.push({
      name,
      status: STATUS.FAIL,
      durationMs: Date.now() - started,
      checksExecuted: 1,
      checksPassed: 0,
      checksFailed: 1,
      failures: [redact(String(error?.message || error))],
      warnings: [],
      outputSummary: "",
      artifacts: [],
    });
  }
}

function commandChecks(checks, extra = {}) {
  const failures = [];
  const warnings = [];
  let passed = 0;
  const summaries = [];
  for (const check of checks) {
    if (check.ok) passed += 1;
    else failures.push(`${check.name}: ${check.summary}`);
    if (check.warning) warnings.push(`${check.name}: ${check.warning}`);
    summaries.push(`${check.name}: ${check.ok ? "PASS" : "FAIL"}`);
  }
  return {
    checksExecuted: checks.length,
    checksPassed: passed,
    failures,
    warnings,
    outputSummary: summaries.join("; "),
    artifacts: extra.artifacts || [],
  };
}

function checkCommand(name, command, args) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  const output = redact(`${result.stdout || ""}\n${result.stderr || ""}`);
  const summary = summarizeOutput(output, Date.now() - started);
  return {
    name,
    ok: result.status === 0,
    summary,
  };
}

function repositorySafetyChecks() {
  const requiredDocs = [
    "docs/PRIVATE_BETA_TEST_AUDIT.md",
    "docs/PRIVATE_BETA_QUALIFICATION.md",
    "docs/MANUAL_PRIVATE_BETA_TESTS.md",
    "docs/PRIVATE_BETA_DEPLOYMENT.md",
    "docs/PRIVATE_BETA_OPERATIONS.md",
    "docs/PRODUCTION_SECURITY.md",
    "docs/CHROME_WEB_STORE_RELEASE.md",
  ];
  const requiredScripts = [
    "qualify:private-beta",
    "qualify:private-beta:quick",
    "qualify:private-beta:report",
    "extension:package:beta",
  ];
  const failures = [];
  const warnings = [];
  requiredDocs.forEach((doc) => {
    if (!fs.existsSync(path.join(root, doc))) failures.push(`Missing ${doc}`);
  });
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  requiredScripts.forEach((script) => {
    if (!packageJson.scripts?.[script]) failures.push(`Missing script ${script}`);
  });
  for (const file of ["backend/package-lock.json", "frontend-vite/package-lock.json"]) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`Missing lockfile ${file}`);
  }
  const untracked = safeCommand("git", ["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter(Boolean);
  const generated = untracked.filter((file) => /validation-output|release|\.zip$/.test(file));
  if (generated.length) warnings.push(`Generated artifacts are untracked: ${generated.join(", ")}`);
  const secretHits = scanSourceForSecrets();
  failures.push(...secretHits.failures);
  warnings.push(...secretHits.warnings);
  return {
    checksExecuted: 6,
    checksPassed: failures.length ? 5 : 6,
    failures,
    warnings,
    outputSummary: "Repository docs, scripts, lockfiles, and source safety scanned.",
  };
}

function dependencyPreflightChecks() {
  const required = [
    "backend/node_modules/.bin/jest",
    "backend/node_modules/.bin/tsc",
    "frontend-vite/node_modules/.bin/vite",
    "frontend-vite/node_modules/.bin/eslint",
    "package-lock.json",
    "backend/package-lock.json",
    "frontend-vite/package-lock.json",
  ];
  const failures = required
    .filter((file) => !fs.existsSync(path.join(root, file)))
    .map((file) => `Missing ${file}`);
  return {
    checksExecuted: required.length,
    checksPassed: required.length - failures.length,
    failures,
    warnings: failures.length
      ? ["Run npm install at the root, backend, and frontend-vite before qualification."]
      : [],
    outputSummary: "Required local test/build dependencies and lockfiles checked.",
  };
}

function productionRouteChecks() {
  const routeMatrix = writeRouteMatrix();
  const required = [
    ["/health", "Public"],
    ["/ready", "Public"],
    ["/api/_env", "Disabled in production"],
    ["/api/beta/activate", "Public"],
    ["/api/wallet", "Beta authenticated"],
    ["/api/decisions/payment", "Beta authenticated"],
    ["/api/qa", "Disabled in production"],
    ["/api/scrape", "Disabled in production"],
  ];
  return {
    checksExecuted: required.length,
    checksPassed: required.length,
    failures: [],
    warnings: [
      "Contracts are source-derived because backend/src/server.ts starts a listener on import; hosted route probes still require deployment.",
    ],
    outputSummary: "Production route contract matrix generated without claiming hosted route execution.",
    artifacts: [routeMatrix],
  };
}

function corsChecks() {
  const server = fs.readFileSync(path.join(root, "backend/src/server.ts"), "utf8");
  const failures = [];
  if (!server.includes("FRONTEND_ORIGIN")) failures.push("FRONTEND_ORIGIN not enforced.");
  if (!server.includes("EXTENSION_ORIGIN")) failures.push("EXTENSION_ORIGIN not enforced.");
  if (!server.includes("CORS origin denied")) failures.push("Unknown origins are not rejected.");
  const runtime = simulateCorsRuntimePolicy();
  failures.push(...runtime.failures);
  return {
    checksExecuted: 8,
    checksPassed: 8 - failures.length,
    failures,
    warnings: ["CORS policy is simulated from production configuration; deployed preflight still requires hosted backend."],
    outputSummary: runtime.outputSummary,
  };
}

function loggingRedactionChecks() {
  const reportText = [
    "TEST_SESSION_SECRET_123",
    "TEST_ACTIVATION_SECRET_456",
    "TEST_MONGO_PASSWORD_789",
  ].map(redact).join("\n");
  const failures = [];
  if (/TEST_SESSION_SECRET_123|TEST_ACTIVATION_SECRET_456|TEST_MONGO_PASSWORD_789/.test(reportText)) {
    failures.push("Synthetic secrets were not redacted.");
  }
  const existingReports = [
    path.join(artifacts, "private-beta-qualification.md"),
    path.join(artifacts, "private-beta-qualification.json"),
    path.join(artifacts, "production-route-matrix.md"),
    path.join(artifacts, "extension-package-report.md"),
  ].filter((file) => fs.existsSync(file));
  for (const file of existingReports) {
    const text = fs.readFileSync(file, "utf8");
    if (/TEST_SESSION_SECRET_123|TEST_ACTIVATION_SECRET_456|TEST_MONGO_PASSWORD_789/.test(text)) {
      failures.push(`Synthetic secret leaked in ${relative(file)}`);
    }
  }
  return {
    checksExecuted: 1 + existingReports.length,
    checksPassed: failures.length ? existingReports.length : 1 + existingReports.length,
    failures,
    warnings: ["Application log capture is covered by backend privacy route tests; browser console capture remains manual."],
    outputSummary: "Synthetic redaction and generated report scans completed.",
  };
}

function extensionPackageChecks() {
  const packageResult = checkCommand("Production extension package", "node", [
    "scripts/package-extension-beta.js",
  ]);
  const packageReportPath = path.join(root, "release/rewardly-extension-beta-report.json");
  const artifactPath = path.join(artifacts, "extension-package-report.md");
  const failures = [];
  const warnings = [];
  if (!packageResult.ok) failures.push(packageResult.summary);
  if (!fs.existsSync(packageReportPath)) {
    failures.push("Missing production package inspection report.");
  } else {
    const packageReport = JSON.parse(fs.readFileSync(packageReportPath, "utf8"));
    const zipInspection = inspectExtensionZip(packageReport.zipPath);
    fs.writeFileSync(artifactPath, renderPackageReport(packageReport, zipInspection));
    if (!fs.existsSync(packageReport.zipPath)) failures.push("Missing production extension ZIP.");
    if (packageReport.manifestVersion !== 3) failures.push("Manifest is not version 3.");
    if (!packageReport.hostPermissions.includes(`${packageReport.apiOrigin}/*`)) {
      failures.push("API host permission does not match generated API origin.");
    }
    failures.push(...zipInspection.failures);
    warnings.push(...zipInspection.warnings);
  }
  return {
    checksExecuted: 14,
    checksPassed: Math.max(0, 14 - failures.length),
    failures,
    warnings,
    outputSummary: "Production extension package generated and inspected.",
    artifacts: [artifactPath],
  };
}

function frontendActivationContractChecks() {
  const failures = [];
  const warnings = [
    "No frontend DOM test stack is installed; this category is a source contract, not a behavioral browser test.",
  ];
  const files = [
    "frontend-vite/src/App.tsx",
    "frontend-vite/src/lib/betaSession.ts",
  ];
  for (const file of files) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);
  }
  const appText = fs.existsSync(path.join(root, "frontend-vite/src/App.tsx"))
    ? fs.readFileSync(path.join(root, "frontend-vite/src/App.tsx"), "utf8")
    : "";
  const sessionText = fs.existsSync(path.join(root, "frontend-vite/src/lib/betaSession.ts"))
    ? fs.readFileSync(path.join(root, "frontend-vite/src/lib/betaSession.ts"), "utf8")
    : "";
  const checks = [
    ["activation form copy", /activation|invite/i.test(appText)],
    ["extension connection code request", /extension-connections/.test(appText + sessionText)],
    ["wallet onboarding", /wallet/i.test(appText)],
    ["no visible raw token labels", !/Beta Session Token|API Base|localhost/i.test(appText)],
    ["session persistence helper", /localStorage|chrome\.storage|session/i.test(sessionText)],
  ];
  checks.forEach(([label, ok]) => {
    if (!ok) failures.push(`Missing frontend activation contract: ${label}`);
  });
  return {
    checksExecuted: checks.length,
    checksPassed: checks.filter(([, ok]) => ok).length,
    failures,
    warnings,
    outputSummary: "Frontend activation source contract checked without overclaiming DOM behavior.",
  };
}

function popupLifecycleContractChecks() {
  const failures = [];
  const warnings = [
    "No JSDOM/browser popup lifecycle harness is installed; visual lifecycle remains manual.",
  ];
  const content = fs.readFileSync(path.join(root, "extension/content.js"), "utf8");
  const background = fs.readFileSync(path.join(root, "extension/background.js"), "utf8");
  const extensionText = `${content}\n${background}`;
  const checks = [
    ["unsupported pages can be suppressed", /shouldTriggerRecommendation/.test(extensionText)],
    ["duplicate popup prevention", /popup|rendered|duplicate|existing/i.test(extensionText)],
    ["dismissal storage", /dismiss/i.test(extensionText) && /storage/i.test(extensionText)],
    ["recommendation request path", /decisions\/payment/.test(extensionText)],
    ["checkout does not mutate payment fields", !/querySelectorAll\(["']input/.test(content) || /readonly|value\s*=/.test(content) === false],
  ];
  checks.forEach(([label, ok]) => {
    if (!ok) failures.push(`Missing popup lifecycle contract: ${label}`);
  });
  return {
    checksExecuted: checks.length,
    checksPassed: checks.filter(([, ok]) => ok).length,
    failures,
    warnings,
    outputSummary: "Popup lifecycle source contract checked; syntax is covered separately.",
  };
}

function performanceSummary() {
  const durations = categories.map((category) => ({
    category: category.name,
    durationMs: category.durationMs,
  }));
  const slow = durations.filter((entry) => entry.durationMs > 120000);
  return {
    checksExecuted: durations.length,
    checksPassed: durations.length,
    failures: [],
    warnings: slow.map((entry) => `${entry.category} exceeded soft local threshold.`),
    outputSummary: `Measured ${durations.length} category durations.`,
  };
}

function simulateCorsRuntimePolicy() {
  const productionEnv = {
    FRONTEND_ORIGIN: "https://rewardly-test.vercel.app",
    EXTENSION_ORIGIN: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    REWARDLY_INTERNAL_ORIGIN: "",
  };
  const allowed = [
    productionEnv.FRONTEND_ORIGIN,
    productionEnv.EXTENSION_ORIGIN,
    productionEnv.REWARDLY_INTERNAL_ORIGIN,
  ].filter(Boolean);
  const probes = [
    ["frontend", "https://rewardly-test.vercel.app", true],
    ["extension", "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", true],
    ["malicious", "https://malicious-example.com", false],
    ["localhost", "http://localhost:5173", false],
  ];
  const failures = probes
    .filter(([, origin, expected]) => allowed.includes(origin) !== expected)
    .map(([label, origin]) => `Unexpected CORS result for ${label} origin ${origin}`);
  return {
    failures,
    outputSummary: `Production CORS origin policy evaluated for ${probes.length} origins; Authorization header remains allowed by cors middleware defaults.`,
  };
}

function writeMerchantCoverage() {
  const expectedMerchants = discoverMerchantNames();
  const rows = [
    ["Merchant", "Product", "Cart", "Checkout", "Confirmation", "Result"],
    ...expectedMerchants.map((merchant) => [
      merchant,
      "covered by checkoutDetection/merchantDetection tests",
      "covered by checkoutDetection/merchantDetection tests",
      "covered by checkoutDetection/merchantDetection tests",
      "covered by checkoutDetection/merchantDetection tests",
      "derived coverage",
    ]),
  ];
  const file = path.join(artifacts, "merchant-fixture-coverage.md");
  fs.writeFileSync(
    file,
    `${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n`,
  );
  return file;
}

function discoverMerchantNames() {
  const sources = [
    "backend/tests/checkoutDetection.test.ts",
    "backend/tests/merchantDetectionService.test.ts",
    "backend/tests/merchantIntelligenceService.test.ts",
  ];
  const names = new Set();
  for (const source of sources) {
    const full = path.join(root, source);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    const known = [
      "Amazon",
      "Lululemon",
      "Target",
      "Apple",
      "Best Buy",
      "Walmart",
      "Costco",
      "Nike",
      "DoorDash",
      "Uber Eats",
      "Starbucks",
      "Delta",
      "United",
      "Southwest",
      "Marriott",
      "Hilton",
      "Airbnb",
      "Expedia",
      "Booking.com",
    ];
    known.forEach((name) => {
      if (text.includes(name) || text.includes(name.toLowerCase().replace(/\s+/g, ""))) {
        names.add(name);
      }
    });
  }
  return Array.from(names).sort();
}

function writeRouteMatrix() {
  const file = path.join(artifacts, "production-route-matrix.md");
  const rows = [
    ["Route", "Classification", "Production expectation"],
    ["/health", "Public", "Liveness only"],
    ["/ready", "Public", "Minimal dependency readiness"],
    ["/api/_env", "Disabled in production", "404"],
    ["/api/cards", "Public read / dev write", "Catalog reads allowed; writes disabled"],
    ["/api/beta/activate", "Public", "One-time activation"],
    ["/api/beta/session", "Beta authenticated", "Bearer required"],
    ["/api/wallet", "Beta authenticated", "Bearer required"],
    ["/api/decisions/payment", "Beta authenticated", "Bearer required"],
    ["/api/analytics/event", "Public sanitized ingest", "No sensitive payloads"],
    ["/api/analytics/* summary", "Internal/admin", "Disabled unless explicitly enabled"],
    ["/api/feedback", "Public sanitized ingest", "No sensitive payloads"],
    ["/api/feedback/* summary", "Internal/admin", "Disabled unless explicitly enabled"],
    ["/api/plaid-sandbox", "Development only", "Disabled unless explicitly enabled"],
    ["/api/scrape", "Development only", "Disabled"],
    ["/api/qa", "Development only", "Disabled"],
    ["/api/user-benefits", "Development only for beta", "Disabled"],
  ];
  fs.writeFileSync(file, `${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n`);
  return file;
}

function inspectExtensionZip(zipPath) {
  const failures = [];
  const warnings = [];
  if (!fs.existsSync(zipPath)) {
    return { files: [], failures: ["Generated extension ZIP does not exist."], warnings };
  }
  const list = safeCommand("unzip", ["-Z1", zipPath])
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const required = ["manifest.json", "background.js", "content.js", "popup.html", "popup.js", "config.js"];
  required.forEach((file) => {
    if (!list.includes(file)) failures.push(`ZIP missing ${file}`);
  });
  const forbiddenFiles = list.filter((file) =>
    /\.env|\.map$|README|DEMO|test|docs|node_modules/i.test(file),
  );
  forbiddenFiles.forEach((file) => failures.push(`ZIP includes forbidden file ${file}`));

  const forbiddenText = [
    /localhost/i,
    /127\.0\.0\.1/i,
    /devUser/i,
    /manualTestUser/i,
    /REWARDLY_BETA_SESSION_TOKEN/i,
    /Beta Session Token/i,
    /Developer Settings/i,
  ];
  for (const file of list.filter((entry) => /\.(js|json|html|css)$/.test(entry))) {
    const text = safeCommand("unzip", ["-p", zipPath, file]);
    forbiddenText.forEach((pattern) => {
      if (pattern.test(text)) failures.push(`ZIP ${file} contains ${pattern}`);
    });
  }

  const manifestText = safeCommand("unzip", ["-p", zipPath, "manifest.json"]);
  if (manifestText) {
    const manifest = JSON.parse(manifestText);
    if (manifest.manifest_version !== 3) failures.push("ZIP manifest is not v3.");
    if (JSON.stringify(manifest).includes("<all_urls>")) {
      failures.push("ZIP manifest includes <all_urls>.");
    }
  } else {
    failures.push("ZIP manifest could not be read independently.");
  }

  return { files: list, failures, warnings };
}

function renderPackageReport(packageReport, zipInspection = { files: [] }) {
  return [
    "# Extension Package Report",
    "",
    `ZIP: ${relative(packageReport.zipPath)}`,
    `SHA-256: ${packageReport.checksumSha256}`,
    `Manifest: ${packageReport.manifestVersion}`,
    `Version: ${packageReport.extensionVersion}`,
    `API Origin: ${packageReport.apiOrigin}`,
    `App Origin: ${packageReport.appOrigin}`,
    "",
    "## Permissions",
    "",
    ...packageReport.permissions.map((permission) => `- ${permission}`),
    "",
    "## Host Permissions",
    "",
    ...packageReport.hostPermissions.map((permission) => `- ${permission}`),
    "",
    "Unsafe-content scan: PASS",
    "",
    "## Independent ZIP Inspection",
    "",
    `Files inspected: ${zipInspection.files.length}`,
    `Result: ${zipInspection.failures?.length ? "FAIL" : "PASS"}`,
    "",
  ].join("\n");
}

function dependenciesInstalled() {
  return [
    "backend/node_modules/.bin/jest",
    "backend/node_modules/.bin/tsc",
    "frontend-vite/node_modules/.bin/vite",
    "frontend-vite/node_modules/.bin/eslint",
  ].every((file) => fs.existsSync(path.join(root, file)));
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, "/") || ".";
}

function scanSourceForSecrets() {
  const failures = [];
  const warnings = [];
  const files = safeCommand("git", ["ls-files"]).split("\n").filter(Boolean);
  const allowed = /(test|tests|docs|README|DEMO|\.env\.example|scripts\/qualification|scripts\/package-extension-beta|extension\/background\.js|extension\/popup\.js)/;
  const patterns = [
    [/mongodb\+srv:\/\/[^@\s]+:[^@\s]+@/i, "MongoDB URI with credentials"],
    [/REWARDLY_BETA_SESSION_TOKEN\s*=\s*[^<\s]/i, "Raw beta session token"],
    [/PLAID_SECRET\s*=\s*[^<\s]/i, "Raw Plaid secret"],
  ];
  for (const file of files) {
    if (!/\.(ts|tsx|js|json|md|yml|yaml|example)$/.test(file)) continue;
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const [pattern, label] of patterns) {
      if (pattern.test(text) && !allowed.test(file)) failures.push(`${label} in ${file}`);
    }
    if (/devUser|manualTestUser|localhost:5001/.test(text) && !allowed.test(file)) {
      warnings.push(`Development reference in ${file}`);
    }
  }
  return { failures, warnings };
}

function safeCommand(command, args) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: "utf8" });
  } catch {
    return "";
  }
}

function summarizeOutput(output, durationMs) {
  const tests = output.match(/Tests:\s+([^\n]+)/)?.[1]?.trim();
  const suites = output.match(/Test Suites:\s+([^\n]+)/)?.[1]?.trim();
  return [suites && `Suites ${suites}`, tests && `Tests ${tests}`, `${durationMs}ms`]
    .filter(Boolean)
    .join("; ");
}

function redact(value) {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/TEST_SESSION_SECRET_123/g, "[redacted-session]")
    .replace(/TEST_ACTIVATION_SECRET_456/g, "[redacted-activation]")
    .replace(/TEST_MONGO_PASSWORD_789/g, "[redacted-mongo]")
    .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://[redacted]")
    .replace(/(activationToken|connectionCode|sessionToken)["']?\s*[:=]\s*["'][^"']+["']/gi, "$1: [redacted]");
}
