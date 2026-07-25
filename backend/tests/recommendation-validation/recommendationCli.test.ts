import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const runner = path.resolve(__dirname, "../../scripts/run-recommendation-validation.ts");
const tsNode = path.resolve(__dirname, "../../node_modules/.bin/ts-node");

describe("recommendation validation CLI", () => {
  test("zero count fails rather than producing a zero-scenario success", () => {
    const result = runCli(["--suite", "generated", "--count", "0"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("Invalid count: 0");
  });

  test("no-match scenario, tag, or generator index fails", () => {
    expect(runCli(["--scenario", "missing-scenario"]).status).not.toBe(0);
    expect(runCli(["--tag", "missing-tag"]).status).not.toBe(0);
    expect(
      runCli(["--suite", "generated", "--count", "2", "--scenario-index", "99"]).status,
    ).not.toBe(0);
  });

  test("full mode enforces mutations and coverage and writes stable reports", () => {
    const result = runCli([
      "--suite",
      "full",
      "--seed",
      "20260724",
      "--count",
      "1000",
      "--report",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Mutation smoke:");
    expect(result.stdout).toContain("Coverage threshold failures:");
    expect(fs.existsSync(path.resolve(__dirname, "../../../docs/RECOMMENDATION_VALIDATION_REPORT.json"))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, "../../../docs/RECOMMENDATION_COVERAGE_REPORT.json"))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, "../../../docs/RECOMMENDATION_MUTATION_REPORT.json"))).toBe(true);
  });

  test("--fail-fast stops after the first failed scenario", () => {
    const result = runCli([
      "--suite",
      "generated",
      "--count",
      "3",
      "--scenario-index",
      "0",
      "--fail-fast",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("scenarios=1");
  });
});

function runCli(args: string[]) {
  return spawnSync(tsNode, [runner, ...args], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
  });
}
