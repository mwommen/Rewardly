const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const outputDir = path.join(root, "release");
const stagingDir = path.join(outputDir, "rewardly-extension-beta");
const zipPath = path.join(outputDir, "rewardly-extension-beta.zip");
const reportPath = path.join(outputDir, "rewardly-extension-beta-report.json");

const apiBase = process.env.REWARDLY_EXTENSION_API_BASE;
const appUrl = process.env.REWARDLY_EXTENSION_APP_URL;

if (!apiBase || !/^https:\/\//.test(apiBase)) {
  fail("REWARDLY_EXTENSION_API_BASE must be an HTTPS Render API URL.");
}
if (!appUrl || !/^https:\/\//.test(appUrl)) {
  fail("REWARDLY_EXTENSION_APP_URL must be an HTTPS Vercel application URL.");
}

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });
copyDir(extensionDir, stagingDir);
fs.copyFileSync(
  path.join(stagingDir, "popup.production.html"),
  path.join(stagingDir, "popup.html"),
);
fs.copyFileSync(
  path.join(stagingDir, "popup.production.js"),
  path.join(stagingDir, "popup.js"),
);
fs.copyFileSync(
  path.join(stagingDir, "background.production.js"),
  path.join(stagingDir, "background.js"),
);
fs.rmSync(path.join(stagingDir, "popup.production.html"), { force: true });
fs.rmSync(path.join(stagingDir, "popup.production.js"), { force: true });
fs.rmSync(path.join(stagingDir, "background.production.js"), { force: true });

fs.writeFileSync(
  path.join(stagingDir, "config.js"),
  `globalThis.REWARDLY_CONFIG = ${JSON.stringify(
    {
      API_BASE: apiBase.replace(/\/$/, ""),
      APP_URL: appUrl.replace(/\/$/, ""),
      ENV: "production",
    },
    null,
    2,
  )};\n`,
);
sanitizeProductionFile(path.join(stagingDir, "background.js"));
sanitizeProductionFile(path.join(stagingDir, "content.js"));
sanitizeProductionManifest(path.join(stagingDir, "manifest.json"));

validateManifest(path.join(stagingDir, "manifest.json"));
scanForUnsafeContent(stagingDir);

fs.rmSync(zipPath, { force: true });
execFileSync("zip", ["-qr", zipPath, "."], { cwd: stagingDir });
const checksum = crypto
  .createHash("sha256")
  .update(fs.readFileSync(zipPath))
  .digest("hex");

console.log(`Chrome Web Store beta package: ${zipPath}`);
console.log(`sha256: ${checksum}`);
writeInspectionReport(checksum);

function copyDir(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyDir(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function shouldSkip(name) {
  return [
    ".env",
    ".DS_Store",
    "test-results",
    "README.md",
    "DEMO.md",
    ".env.example",
  ].includes(name);
}

function validateManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.manifest_version !== 3) fail("Manifest must use version 3.");
  if (!manifest.name || !manifest.description || !manifest.version) {
    fail("Manifest must include name, description, and version.");
  }
  if (JSON.stringify(manifest).includes("<all_urls>")) {
    fail("Production manifest cannot include <all_urls>.");
  }
}

function sanitizeProductionManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const apiHost = new URL(apiBase).origin.replace(/\/$/, "");
  manifest.host_permissions = sanitizeMatches([
    `${apiHost}/*`,
    ...(manifest.host_permissions || []),
  ]);
  manifest.content_scripts = (manifest.content_scripts || []).map((script) => ({
    ...script,
    matches: sanitizeMatches(script.matches || []),
  }));
  manifest.web_accessible_resources = (manifest.web_accessible_resources || []).map((resource) => ({
    ...resource,
    matches: sanitizeMatches(resource.matches || []),
  }));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function sanitizeMatches(matches) {
  return Array.from(
    new Set(
      matches.filter(
        (match) =>
          !/localhost|127\.0\.0\.1|<all_urls>/i.test(String(match || "")),
      ),
    ),
  );
}

function sanitizeProductionFile(filePath) {
  let text = fs.readFileSync(filePath, "utf8");
  text = text
    .replaceAll("http://localhost:5001", apiBase.replace(/\/$/, ""))
    .replaceAll("http://localhost:5173", appUrl.replace(/\/$/, ""))
    .replaceAll("\"development\"", "\"production\"")
    .replaceAll("\"devUser\"", "\"\"")
    .replaceAll("\"localhost\"", "\"\"")
    .replaceAll("\"127.0.0.1\"", "\"\"")
    .replaceAll("devUser", "beta-user")
    .replaceAll("manualTestUser", "beta-user");
  fs.writeFileSync(filePath, text);
}

function scanForUnsafeContent(dir) {
  const unsafe = [
    /localhost/i,
    /127\.0\.0\.1/i,
    /devUser/i,
    /manualTestUser/i,
    /REWARDLY_BETA_SESSION_TOKEN/i,
    /debug=true/i,
    /Developer Settings/i,
    /apiBase/i,
    /userId/i,
    /betaSessionToken/i,
  ];
  const failures = [];
  for (const file of walk(dir)) {
    if (!/\.(js|json|html|css)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    unsafe.forEach((pattern) => {
      if (pattern.test(text)) failures.push(`${file}: ${pattern}`);
    });
  }
  if (failures.length) {
    fail(`Production extension package contains unsafe content:\n${failures.join("\n")}`);
  }
}

function writeInspectionReport(checksum) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(stagingDir, "manifest.json"), "utf8"),
  );
  const files = walk(stagingDir).map((file) =>
    path.relative(stagingDir, file).replace(/\\/g, "/"),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    zipPath,
    checksumSha256: checksum,
    apiOrigin: new URL(apiBase).origin,
    appOrigin: new URL(appUrl).origin,
    manifestVersion: manifest.manifest_version,
    extensionVersion: manifest.version,
    permissions: manifest.permissions || [],
    hostPermissions: manifest.host_permissions || [],
    contentScriptMatches: (manifest.content_scripts || []).flatMap(
      (script) => script.matches || [],
    ),
    includedFiles: files.sort(),
    excludedPatterns: [
      "localhost permissions",
      "developer settings markup",
      "manual token UI",
      "tests",
      "docs",
      ".env files",
      "source maps",
    ],
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`package inspection report: ${reportPath}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
