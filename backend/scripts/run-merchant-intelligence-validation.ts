import fs from "fs";
import path from "path";
import {
  runMerchantIntelligenceValidation,
  type MerchantValidationOptions,
} from "../src/validation/merchantIntelligenceValidation";

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = runMerchantIntelligenceValidation(options);
    if (options.report) writeReports(report);
    printSummary(report);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(
      `[Rewardly] merchant intelligence validation failed: ${String(
        (error as Error)?.message || error,
      )}`,
    );
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): MerchantValidationOptions & { report?: boolean } {
  const options: MerchantValidationOptions & { report?: boolean } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--suite") {
      options.suite = parseSuite(next);
      index += 1;
    } else if (arg === "--scenario") {
      options.scenario = requireValue(arg, next);
      index += 1;
    } else if (arg === "--tag") {
      options.tag = requireValue(arg, next);
      index += 1;
    } else if (arg === "--seed") {
      options.seed = parseInteger(arg, next);
      index += 1;
    } else if (arg === "--count") {
      options.count = parseInteger(arg, next);
      index += 1;
    } else if (arg === "--report") {
      options.report = true;
    } else if (arg === "--fail-fast") {
      options.failFast = true;
    } else if (arg === "--invariants") {
      options.suite = "invariants";
    } else if (arg === "--metamorphic") {
      options.suite = "metamorphic";
    } else if (arg === "--registry") {
      options.suite = "registry";
    } else if (arg === "--coverage") {
      options.suite = "coverage";
    } else if (arg === "--parity") {
      options.suite = "parity";
    } else if (arg === "--privacy") {
      options.suite = "privacy";
    } else if (arg === "--performance") {
      options.suite = "performance";
    } else if (arg === "--show-evidence" || arg === "--show-trace") {
      // Reserved for parity with the validation framework contract.
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function parseSuite(value: string | undefined) {
  const suite = requireValue("--suite", value);
  if (
    ![
      "curated",
      "generated",
      "invariants",
      "metamorphic",
      "registry",
      "coverage",
      "parity",
      "privacy",
      "performance",
      "full",
    ].includes(suite)
  ) {
    throw new Error(`Invalid --suite value: ${suite}`);
  }
  return suite as "curated" | "generated" | "full";
}

function parseInteger(name: string, value: string | undefined) {
  const parsed = Number(requireValue(name, value));
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function requireValue(name: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function writeReports(report: ReturnType<typeof runMerchantIntelligenceValidation>) {
  const docsDir = path.resolve(__dirname, "../../docs");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(
    path.join(docsDir, "MERCHANT_INTELLIGENCE_REPORT.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(docsDir, "MERCHANT_INTELLIGENCE_REPORT.md"),
    markdownReport(report),
  );
  fs.writeFileSync(
    path.join(docsDir, "MERCHANT_INTELLIGENCE_PARITY_REPORT.json"),
    `${JSON.stringify(report.parity, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(docsDir, "MERCHANT_INTELLIGENCE_PARITY_REPORT.md"),
    parityMarkdown(report),
  );
  fs.writeFileSync(
    path.join(docsDir, "MERCHANT_INTELLIGENCE_PRIVACY_REPORT.json"),
    `${JSON.stringify(report.privacy, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(docsDir, "MERCHANT_INTELLIGENCE_PERFORMANCE_REPORT.json"),
    `${JSON.stringify(report.performance, null, 2)}\n`,
  );
}

function markdownReport(report: ReturnType<typeof runMerchantIntelligenceValidation>) {
  const failed = report.results.filter((result) => !result.passed);
  return `# Merchant Intelligence Validation Report

Status: ${report.ok ? "PASS" : "FAIL"}

- Suite: ${report.suite}
- Seed: ${report.seed}
- Scenarios: ${report.passed}/${report.total} passing
- Registry: ${report.registry.ok ? "PASS" : "FAIL"}
- Invariants: ${report.invariants.passed}/${report.invariants.total} passing
- Metamorphic: ${report.metamorphic.passed}/${report.metamorphic.total} passing
- Coverage: ${report.coverage.ok ? "PASS" : "FAIL"}
- Parity: ${report.parity.passed}/${report.parity.total} passing
- Privacy: ${report.privacy.passed}/${report.privacy.total} passing
- Performance: ${report.performance.passed}/${report.performance.total} passing
- Duration: ${report.durationMs}ms

## Failures

${
  failed.length
    ? failed
        .map(
          (result) =>
            `- ${result.scenarioId}: ${result.failures.join("; ")}`,
        )
        .join("\n")
    : "None."
}

## Coverage

- Merchants covered: ${report.coverage.merchantCount}
- Categories covered: ${report.coverage.categoryCount}
- Evidence types covered: ${report.coverage.evidenceTypeCount}

## Generated Families

${Object.entries(report.generatedFamilies || {})
  .map(([family, total]) => `- ${family}: ${total}`)
  .join("\n")}

## Performance

- Median evaluation: ${report.performance.metrics.medianEvaluationMs}ms
- p95 evaluation: ${report.performance.metrics.p95EvaluationMs}ms
- p99 evaluation: ${report.performance.metrics.p99EvaluationMs}ms
- 1,000 generated runtime: ${report.performance.metrics.generated1000RuntimeMs}ms
- 10,000 generated runtime: ${report.performance.metrics.generated10000RuntimeMs ?? "not run"}ms

`;
}

function parityMarkdown(report: ReturnType<typeof runMerchantIntelligenceValidation>) {
  return `# Merchant Intelligence Parity Report

Status: ${report.parity.failed === 0 ? "PASS" : "FAIL"}

- Total: ${report.parity.total}
- Passed: ${report.parity.passed}
- Failed: ${report.parity.failed}

## Results

${report.parity.results
  .map(
    (item) =>
      `- ${item.scenarioId}: ${item.status} (${item.legacyMerchant} -> ${item.newMerchant}, ${item.legacyCategory} -> ${item.newCategory})`,
  )
  .join("\n")}
`;
}

function printSummary(report: ReturnType<typeof runMerchantIntelligenceValidation>) {
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        suite: report.suite,
        total: report.total,
        passed: report.passed,
        failed: report.failed,
        registryOk: report.registry.ok,
        invariantFailures: report.invariants.failed,
        metamorphicFailures: report.metamorphic.failed,
        coverageFailures: report.coverage.failures.length,
        parityFailures: report.parity.failed,
        privacyFailures: report.privacy.failed,
        performanceFailures: report.performance.failed,
        durationMs: report.durationMs,
      },
      null,
      2,
    ),
  );
}

main();
