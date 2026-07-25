import fs from "fs";
import path from "path";
import { generateRecommendationScenarios } from "../src/validation/recommendationScenarioGenerator";
import { runRecommendationScenario } from "../src/validation/recommendationScenarioRunner";
import { recommendationValidationCatalog } from "../tests/recommendation-validation/fixtures/cards/catalog";

type Options = {
  seed: number;
  scenarioIndex: number;
  issue: string;
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = recommendationValidationCatalog();
  const scenarios = generateRecommendationScenarios({
    seed: options.seed,
    count: options.scenarioIndex + 1,
    catalog,
  });
  const scenario = scenarios.find(
    (item) => item.metadata?.generatorIndex === options.scenarioIndex,
  );
  if (!scenario) {
    throw new Error(
      `No generated scenario found for seed=${options.seed} scenario-index=${options.scenarioIndex}`,
    );
  }

  const result = runRecommendationScenario(scenario, catalog);
  if (result.passed) {
    throw new Error(
      `Refusing to promote ${scenario.id}: scenario currently passes. Promotion is only for reproduced failures.`,
    );
  }

  const fileName = `${safeName(options.issue)}-${scenario.id}.scenario.ts`;
  const outputDir = path.resolve(
    __dirname,
    "../tests/recommendation-validation/scenarios/regressions",
  );
  const outputPath = path.join(outputDir, fileName);
  if (fs.existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite existing regression scenario: ${outputPath}`);
  }

  const promoted = {
    ...scenario,
    id: `${options.issue.toLowerCase()}-${scenario.id}`,
    tags: Array.from(new Set([...scenario.tags, "regression", options.issue])),
    metadata: {
      ...scenario.metadata,
      issueId: options.issue,
      originalSeed: options.seed,
      generatorSeed: options.seed,
      generatorIndex: options.scenarioIndex,
      dateDiscovered: new Date().toISOString().slice(0, 10),
      rootCauseCategory: result.failureCategories.join(", ") || "unclassified",
      expectedBehavior: "TODO: document unresolved expected behavior before merging regression.",
      fixedByCommit: "TODO",
    },
  };

  const source = [
    'import type { RecommendationScenario } from "../../../../src/validation/recommendationScenario.types";',
    "",
    `export const ${safeIdentifier(options.issue)}${options.scenarioIndex}Regression = ${JSON.stringify(promoted, null, 2)} satisfies RecommendationScenario;`,
    "",
  ].join("\n");

  fs.writeFileSync(outputPath, source);
  console.log(`Created ${outputPath}`);
}

function parseArgs(args: string[]): Options {
  const options: Partial<Options> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--seed" && next) {
      options.seed = positiveInteger(next, "seed");
      index += 1;
    } else if (arg === "--scenario-index" && next) {
      options.scenarioIndex = positiveInteger(next, "scenario-index");
      index += 1;
    } else if (arg === "--issue" && next) {
      options.issue = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }
  if (!options.issue) throw new Error("--issue is required");
  if (options.seed === undefined) throw new Error("--seed is required");
  if (options.scenarioIndex === undefined) throw new Error("--scenario-index is required");
  return options as Options;
}

function positiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Invalid ${name}: ${value}`);
  return parsed;
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function safeIdentifier(value: string) {
  const base = safeName(value).replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
  return /^[a-z]/.test(base) ? base : `regression${base}`;
}
