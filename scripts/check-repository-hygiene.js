#!/usr/bin/env node
const { execFileSync } = require("child_process");
const fs = require("fs");

const MAX_TRACKED_BYTES = 10 * 1024 * 1024;
const BLOCKED_TRACKED_PATTERNS = [
  /^node_modules\//,
  /\/node_modules\//,
  /^backend\/dist\//,
  /^frontend-vite\/dist\//,
  /^packages\/[^/]+\/dist\//,
  /^release\//,
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$|sample$)/,
  /RECOMMENDATION_VALIDATION_REPORT\.json$/,
  /RECOMMENDATION_COVERAGE_REPORT\.json$/,
  /RECOMMENDATION_MUTATION_REPORT\.json$/,
];
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
];

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const failures = [];
for (const file of tracked) {
  if (BLOCKED_TRACKED_PATTERNS.some((pattern) => pattern.test(file))) {
    failures.push(`Blocked tracked path: ${file}`);
  }
  const stat = fs.existsSync(file) ? fs.statSync(file) : null;
  if (stat && stat.size > MAX_TRACKED_BYTES) {
    failures.push(`Tracked file exceeds 10 MB: ${file} (${stat.size} bytes)`);
  }
  if (stat && stat.isFile() && stat.size < 1024 * 1024) {
    const text = fs.readFileSync(file, "utf8");
    if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
      failures.push(`Potential secret pattern in tracked file: ${file}`);
    }
  }
}

if (failures.length) {
  console.error("Repository hygiene check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Repository hygiene check passed.");
