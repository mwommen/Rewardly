import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const script = path.resolve(__dirname, "../../scripts/promote-recommendation-regression.ts");
const tsNode = path.resolve(__dirname, "../../node_modules/.bin/ts-node");

describe("recommendation regression promotion", () => {
  test("issue ID is required", () => {
    const result = runPromotion(["--seed", "20260724", "--scenario-index", "0"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("--issue is required");
  });

  test("currently passing generated scenarios cannot be promoted as failures", () => {
    const result = runPromotion([
      "--seed",
      "20260724",
      "--scenario-index",
      "0",
      "--issue",
      "REWARDLY-TEST",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("scenario currently passes");
  });

  test("promotion source preserves deterministic metadata contract", () => {
    const source = fs.readFileSync(script, "utf8");

    expect(source).toContain("originalSeed");
    expect(source).toContain("generatorIndex");
    expect(source).toContain("dateDiscovered");
    expect(source).toContain("rootCauseCategory");
    expect(source).toContain("TODO: document unresolved expected behavior");
    expect(source).toContain("fixedByCommit");
    expect(source).toContain("Refusing to overwrite existing regression scenario");
  });
});

function runPromotion(args: string[]) {
  return spawnSync(tsNode, [script, ...args], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
  });
}
