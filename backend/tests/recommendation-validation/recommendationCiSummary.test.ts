import fs from "fs";
import os from "os";
import path from "path";
import { buildRecommendationCiSummary } from "../../scripts/write-recommendation-ci-summary";

describe("recommendation CI summary", () => {
  test("renders actual report values as valid Markdown", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rewardly-ci-summary-"));
    const validationPath = path.join(dir, "validation.json");
    const coveragePath = path.join(dir, "coverage.json");
    const mutationPath = path.join(dir, "mutation.json");

    fs.writeFileSync(
      validationPath,
      JSON.stringify({
        seed: 20260724,
        generatedScenarioCount: 2,
        invariants: { passed: 5, total: 6 },
        metamorphic: { passed: 7, total: 7 },
        results: [
          { scenarioId: "dining-001", passed: true },
          { scenarioId: "generated-20260724-000000", passed: true },
          { scenarioId: "generated-20260724-000001", passed: false },
        ],
      }),
    );
    fs.writeFileSync(coveragePath, JSON.stringify({ thresholdFailures: ["rule_type/base"] }));
    fs.writeFileSync(
      mutationPath,
      JSON.stringify([
        { mutationId: "a", mutationDetected: true },
        { mutationId: "b", mutationDetected: false },
      ]),
    );

    const markdown = buildRecommendationCiSummary({
      validationPath,
      coveragePath,
      mutationPath,
      artifactNames: ["artifact-a"],
    });

    expect(markdown).toContain("| Curated scenarios | 1/1 (100.00%) |");
    expect(markdown).toContain("| Generated scenarios | 1/2 (50.00%) |");
    expect(markdown).toContain("| Invariant checks | 5/6 |");
    expect(markdown).toContain("| Metamorphic checks | 7/7 |");
    expect(markdown).toContain("| Mutations killed/executed | 1/2 |");
    expect(markdown).toContain("| Mutation score | 50.00% |");
    expect(markdown).toContain("| Semantic coverage threshold failures | 1 |");
    expect(markdown).toContain("| Seed | 20260724 |");
    expect(markdown).toContain("- artifact-a");
  });

  test("missing reports render Unavailable instead of success-looking values", () => {
    const markdown = buildRecommendationCiSummary({
      validationPath: "/missing/validation.json",
      coveragePath: "/missing/coverage.json",
      mutationPath: "/missing/mutation.json",
    });

    expect(markdown).toContain("| Curated scenarios | Unavailable |");
    expect(markdown).toContain("| Mutations killed/executed | Unavailable |");
    expect(markdown).toContain("| Semantic coverage threshold failures | Unavailable |");
  });
});
