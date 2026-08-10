import { Router } from "express";
import {
  DecisionRuntimeNotFoundError,
  getDecisionRuntime,
  getDecisionRuntimeEvents,
  replayDecisionRuntime,
} from "../../../services/decisionRuntimeService";
import {
  DecisionValidationNotFoundError,
  getValidationById,
  getValidationForDecision,
  validateDecisionById,
} from "../../../services/decisionValidationService";
import { decisionNotFound, validationNotFound } from "./errors";
import { accessScopeForAuthUser, optionalAuthUser } from "./middleware";

const router = Router();

router.get("/validations/:validationId", async (req, res) => {
  const authUser = await optionalAuthUser(req.headers.authorization);
  const validation = await getValidationById(
    req.params.validationId,
    accessScopeForAuthUser(authUser),
  );
  if (!validation) return validationNotFound(res);
  return res.json({ validation });
});

router.get("/decisions/:decisionId", async (req, res) => {
  const authUser = await optionalAuthUser(req.headers.authorization);
  const decision = await getDecisionRuntime(
    req.params.decisionId,
    accessScopeForAuthUser(authUser),
  );
  if (!decision) return decisionNotFound(res);
  return res.json({ decision });
});

router.get("/decisions/:decisionId/validation", async (req, res) => {
  const authUser = await optionalAuthUser(req.headers.authorization);
  const validation = await getValidationForDecision(
    req.params.decisionId,
    accessScopeForAuthUser(authUser),
  );
  if (!validation) return validationNotFound(res);
  return res.json({ validation });
});

router.post("/decisions/:decisionId/validate", async (req, res) => {
  const authUser = await optionalAuthUser(req.headers.authorization);
  try {
    const validation = await validateDecisionById(
      req.params.decisionId,
      accessScopeForAuthUser(authUser),
    );
    return res.json({ validation });
  } catch (error) {
    if (error instanceof DecisionValidationNotFoundError) {
      return decisionNotFound(res);
    }
    console.error(
      "[v1/decisions/validate] Validation failure:",
      error instanceof Error ? error.message : "unknown",
    );
    return res.status(500).json({
      error: {
        code: "VALIDATION_FAILURE",
        message: "Rewardly could not validate this decision.",
      },
    });
  }
});

router.get("/decisions/:decisionId/events", async (req, res) => {
  const authUser = await optionalAuthUser(req.headers.authorization);
  const events = await getDecisionRuntimeEvents(
    req.params.decisionId,
    accessScopeForAuthUser(authUser),
  );
  if (!events) return decisionNotFound(res);
  return res.json({
    decisionId: req.params.decisionId,
    events,
    eventCount: events.length,
  });
});

router.post("/decisions/:decisionId/replay", async (req, res) => {
  const authUser = await optionalAuthUser(req.headers.authorization);
  try {
    const replay = await replayDecisionRuntime(
      req.params.decisionId,
      accessScopeForAuthUser(authUser),
    );
    return res.json(replay);
  } catch (error) {
    if (error instanceof DecisionRuntimeNotFoundError) {
      return decisionNotFound(res);
    }
    console.error(
      "[v1/decisions/replay] Replay failure:",
      error instanceof Error ? error.message : "unknown",
    );
    return res.status(500).json({
      error: {
        code: "REPLAY_FAILURE",
        message: "Rewardly could not replay this decision.",
      },
    });
  }
});

export default router;
