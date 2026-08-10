import type { Request, Response } from "express";
import {
  attachValidationToDecisionRuntime,
  createDecisionRuntime,
} from "../../../services/decisionRuntimeService";
import { validateDecisionObject } from "../../../services/decisionValidationService";
import { accessScopeForAuthUser, optionalAuthUser } from "./middleware";
import { toPaymentDecisionRequest } from "./requestMapper";
import { toV1PaymentDecisionResponse } from "./responseMapper";
import { validatePaymentDecisionRequest } from "./validation";

export async function createPaymentDecisionController(
  req: Request,
  res: Response,
) {
  const validation = validatePaymentDecisionRequest(req.body);
  if (!validation.ok) {
    return res.status(validation.status).json({
      error: {
        code: validation.code,
        message: validation.message,
      },
    });
  }

  try {
    const normalizedDecisionRequest = toPaymentDecisionRequest(validation.value);
    const authUser = await optionalAuthUser(req.headers.authorization);
    const accessScope = accessScopeForAuthUser(authUser);
    const runtime = await createDecisionRuntime({
      normalizedRequest: normalizedDecisionRequest,
      ownerUserId: authUser?.userId || null,
      partnerId: null,
    });
    const validationResult = await validateDecisionObject(
      runtime.decision,
      accessScope,
    );
    const validatedRuntimeDecision = await attachValidationToDecisionRuntime(
      runtime.decision.decisionId,
      {
        validationId: validationResult.validationId,
        status: validationResult.status,
        trustScore: validationResult.trustScore,
        trustScoreLevel: validationResult.trustScoreLevel,
        validatedAt: validationResult.validatedAt,
      },
      accessScope,
    );

    return res.json(
      toV1PaymentDecisionResponse(
        runtime.engineDecision,
        validatedRuntimeDecision.decisionId,
        runtime.trustRecord,
        {
          normalizedRequest: normalizedDecisionRequest,
          latency: validatedRuntimeDecision.latency,
          runtimeDecision: validatedRuntimeDecision,
          validationResult,
        },
      ),
    );
  } catch (error) {
    console.error(
      "[v1/payment-decisions] Engine failure:",
      error instanceof Error ? error.message : "unknown",
    );
    return res.status(500).json({
      error: {
        code: "ENGINE_FAILURE",
        message: "Rewardly could not create a payment decision.",
      },
    });
  }
}
