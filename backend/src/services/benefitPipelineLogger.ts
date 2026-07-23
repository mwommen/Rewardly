export type BenefitPipelineLogStage =
  | "source"
  | "extraction"
  | "normalization"
  | "comparison"
  | "review"
  | "promotion"
  | "rollback"
  | "health";

export type BenefitPipelineLogEvent = {
  stage: BenefitPipelineLogStage;
  action: string;
  sourceId?: string;
  candidateId?: string;
  benefitId?: string;
  status?: "started" | "succeeded" | "failed" | "skipped";
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

export type BenefitPipelineLogger = (event: BenefitPipelineLogEvent) => void;

export const silentBenefitPipelineLogger: BenefitPipelineLogger = () => {};

export const consoleBenefitPipelineLogger: BenefitPipelineLogger = (event) => {
  console.log(
    JSON.stringify({
      namespace: "rewardly.benefit_pipeline",
      timestamp: event.timestamp || new Date().toISOString(),
      ...event,
    }),
  );
};

export function createInMemoryBenefitPipelineLogger() {
  const events: BenefitPipelineLogEvent[] = [];
  const logger: BenefitPipelineLogger = (event) => {
    events.push({
      timestamp: event.timestamp || new Date().toISOString(),
      stage: event.stage,
      action: event.action,
      sourceId: event.sourceId,
      candidateId: event.candidateId,
      benefitId: event.benefitId,
      status: event.status,
      message: event.message,
      metadata: event.metadata,
    });
  };
  return { logger, events };
}
