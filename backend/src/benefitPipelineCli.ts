import {
  compareAmexPilotFixture,
  extractAmexPilotFixture,
  promoteAmexPilotFixture,
  rejectAmexPilotFixture,
  reviewAmexPilotFixture,
  rollbackAmexPilotFixture,
} from "./services/amexPilotService";
import {
  approveAndPromoteFixture,
  rejectFixtureCandidate,
  rollbackFixturePromotion,
  runBenefitPipelineFixture,
} from "./services/benefitPipelineService";
import { createInMemoryBenefitPipelineLogger } from "./services/benefitPipelineLogger";
import { listBenefitSources } from "./services/benefitSourceRegistryService";

const command = process.argv[2] || "help";

function run() {
  if (command === "sources") {
    print({ sources: listBenefitSources() });
    return;
  }
  if (command === "extract") {
    const pipeline = runBenefitPipelineFixture();
    print({
      sourceId: pipeline.source.sourceId,
      candidates: pipeline.candidates,
      parserConfidence: pipeline.extraction.parserConfidence,
    });
    return;
  }
  if (command === "compare") {
    const pipeline = runBenefitPipelineFixture();
    print({
      comparisons: pipeline.comparisons.map((item) => ({
        candidateId: item.candidate.candidateId,
        status: item.comparisonStatus,
        changes: item.changes,
      })),
      removedChanges: pipeline.removedChanges,
    });
    return;
  }
  if (command === "review") {
    const pipeline = runBenefitPipelineFixture();
    print({ reviews: pipeline.reviews });
    return;
  }
  if (command === "promote") {
    print(approveAndPromoteFixture().promotion);
    return;
  }
  if (command === "reject") {
    print(rejectFixtureCandidate().promotion);
    return;
  }
  if (command === "rollback") {
    print(rollbackFixturePromotion().rollback);
    return;
  }
  if (command === "health") {
    print(runBenefitPipelineFixture().health);
    return;
  }
  if (command === "staleness") {
    print(runBenefitPipelineFixture().staleness);
    return;
  }
  if (command === "amex:extract") {
    const memory = createInMemoryBenefitPipelineLogger();
    const extracted = extractAmexPilotFixture("v2", undefined, memory.logger);
    print({
      sourceId: extracted.source.sourceId,
      candidates: extracted.candidates,
      parserConfidence: extracted.extraction.parserConfidence,
      logs: memory.events,
    });
    return;
  }
  if (command === "amex:compare") {
    const memory = createInMemoryBenefitPipelineLogger();
    const comparison = compareAmexPilotFixture(undefined, memory.logger);
    print({
      comparisons: comparison.comparisons.map((item) => ({
        candidateId: item.candidate.candidateId,
        benefitId: item.candidate.normalizedData.id,
        status: item.comparisonStatus,
        changes: item.changes,
      })),
      removedChanges: comparison.removedChanges,
      health: comparison.health,
      logs: memory.events,
    });
    return;
  }
  if (command === "amex:review-demo") {
    const memory = createInMemoryBenefitPipelineLogger();
    const review = reviewAmexPilotFixture(undefined, memory.logger);
    print({ reviews: review.reviews, logs: memory.events });
    return;
  }
  if (command === "amex:promote-demo") {
    const memory = createInMemoryBenefitPipelineLogger();
    const promotion = promoteAmexPilotFixture(undefined, memory.logger);
    print({
      approvedReview: promotion.approvedReview,
      promotion: promotion.promotion,
      logs: memory.events,
    });
    return;
  }
  if (command === "amex:reject-demo") {
    const memory = createInMemoryBenefitPipelineLogger();
    const rejection = rejectAmexPilotFixture(undefined, memory.logger);
    print({
      rejectedReview: rejection.rejectedReview,
      promotion: rejection.promotion,
      productionBenefit: rejection.approvedBenefits[0],
      logs: memory.events,
    });
    return;
  }
  if (command === "amex:rollback-demo") {
    const memory = createInMemoryBenefitPipelineLogger();
    const rollback = rollbackAmexPilotFixture(undefined, memory.logger);
    print({
      promotion: rollback.promotion,
      rollback: rollback.rollback,
      logs: memory.events,
    });
    return;
  }
  print({
    usage:
      "ts-node src/benefitPipelineCli.ts sources|extract|compare|review|promote|reject|rollback|health|staleness|amex:extract|amex:compare|amex:review-demo|amex:promote-demo|amex:reject-demo|amex:rollback-demo",
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run();
