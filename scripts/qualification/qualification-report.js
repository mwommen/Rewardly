const fs = require("fs");
const path = require("path");

function ensureArtifacts(root) {
  const artifacts = path.join(root, "artifacts");
  fs.mkdirSync(artifacts, { recursive: true });
  return artifacts;
}

function writeReports(root, report) {
  const artifacts = ensureArtifacts(root);
  const jsonPath = path.join(artifacts, "private-beta-qualification.json");
  const mdPath = path.join(artifacts, "private-beta-qualification.md");
  const portableReport = portable(report, root);
  fs.writeFileSync(jsonPath, `${JSON.stringify(portableReport, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(portableReport));
  return { jsonPath, mdPath };
}

function renderMarkdown(report) {
  const lines = [
    "# Rewardly Private Beta Qualification",
    "",
    `Overall Status: ${report.status}`,
    "",
    "## Summary",
    "",
    `Critical Failures: ${report.criticalFailures.length}`,
    `Warnings: ${report.warnings.length}`,
    `Duration: ${formatDuration(report.durationMs)}`,
    `Git Branch: ${report.gitBranch}`,
    `Git Commit: ${report.gitCommit}`,
    `Schema Version: ${report.schemaVersion || "unknown"}`,
    `Runner Version: ${report.runnerVersion || "unknown"}`,
    `CI: ${report.ci ? "true" : "false"}`,
    `Dependencies Installed: ${report.dependenciesInstalled ? "true" : "false"}`,
    `Node: ${report.nodeVersion}`,
    "",
    "| Category | Status | Checks | Failed | Warnings | Duration |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...report.categories.map(
      (category) =>
        `| ${category.name} | ${category.status} | ${category.checksExecuted} | ${category.checksFailed} | ${category.warnings.length} | ${formatDuration(category.durationMs)} |`,
    ),
    "",
  ];

  if (report.criticalFailures.length) {
    lines.push("## Critical Failures", "");
    report.criticalFailures.forEach((failure) => lines.push(`- ${failure}`));
    lines.push("");
  }

  if (report.warnings.length) {
    lines.push("## Warnings", "");
    report.warnings.forEach((warning) => lines.push(`- ${warning}`));
    lines.push("");
  }

  lines.push("## Category Details", "");
  for (const category of report.categories) {
    lines.push(`### ${category.name}`, "");
    lines.push(`Status: ${category.status}`);
    if (category.outputSummary) lines.push(`Summary: ${category.outputSummary}`);
    if (category.artifacts?.length) {
      lines.push("Artifacts:");
      category.artifacts.forEach((artifact) => lines.push(`- ${artifact}`));
    }
    if (category.warnings.length) {
      lines.push("Warnings:");
      category.warnings.forEach((warning) => lines.push(`- ${warning}`));
    }
    lines.push("");
  }

  lines.push(
    "## Manual Boundary",
    "",
    "This automated suite does not claim Chrome Web Store approval, real hosted deployment, real merchant DOM behavior, or human trust/UX reactions were tested.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

module.exports = { writeReports, renderMarkdown, ensureArtifacts };

function portable(value, root) {
  if (Array.isArray(value)) return value.map((entry) => portable(entry, root));
  if (!value || typeof value !== "object") return portableString(value, root);
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, portable(entry, root)]),
  );
}

function portableString(value, root) {
  if (typeof value !== "string") return value;
  const normalizedRoot = root.replace(/\\/g, "/");
  return value.replaceAll(normalizedRoot, ".").replaceAll(root, ".");
}
