export function decisionNotFound(res: any) {
  return res.status(404).json({
    error: {
      code: "DECISION_NOT_FOUND",
      message: "Decision runtime object was not found.",
    },
  });
}

export function validationNotFound(res: any) {
  return res.status(404).json({
    error: {
      code: "VALIDATION_NOT_FOUND",
      message: "Decision validation result was not found.",
    },
  });
}
