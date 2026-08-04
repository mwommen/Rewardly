import { Router } from "express";
import {
  requireAuthenticatedUser,
  sendAuthError,
  type AuthenticatedRequest,
} from "../../middleware/productionAuth";
import {
  addCloudPlanItem,
  addCloudWalletCard,
  completeCloudPlanItem,
  createCloudPlan,
  createPaymentJourney,
  deleteCloudPlan,
  deletePaymentJourney,
  getCloudPlan,
  getCloudWallet,
  getPaymentJourney,
  getPreferences,
  listCloudPlans,
  listPaymentJourney,
  migrateLocalData,
  optimizeCloudPlan,
  removeCloudWalletCard,
  replaceCloudWallet,
  updateCloudPlan,
  updatePaymentJourney,
  updatePreferences,
} from "../../services/userDataService";

const router = Router();

router.use(requireAuthenticatedUser);

router.get("/me/wallet", async (req: AuthenticatedRequest, res) => {
  res.json({ wallet: await getCloudWallet(req.authUser!.userId) });
});

router.put("/me/wallet", asyncHandler(async (req, res) => {
  res.json({ wallet: await replaceCloudWallet(req.authUser!.userId, req.body) });
}));

router.post("/me/wallet/cards", asyncHandler(async (req, res) => {
  res.status(201).json({
    wallet: await addCloudWalletCard(req.authUser!.userId, req.body?.cardId || req.body?.cardSlug),
  });
}));

router.delete("/me/wallet/cards/:cardId", asyncHandler(async (req, res) => {
  res.json({ wallet: await removeCloudWalletCard(req.authUser!.userId, req.params.cardId) });
}));

router.get("/me/payment-journey", async (req: AuthenticatedRequest, res) => {
  res.json({ payments: await listPaymentJourney(req.authUser!.userId, Number(req.query.limit)) });
});

router.post("/me/payment-journey", asyncHandler(async (req, res) => {
  res.status(201).json({ payment: await createPaymentJourney(req.authUser!.userId, req.body) });
}));

router.get("/me/payment-journey/:paymentId", asyncHandler(async (req, res) => {
  const payment = await getPaymentJourney(req.authUser!.userId, req.params.paymentId);
  if (!payment) return notFound(res, req.requestId, "payment not found");
  return res.json({ payment });
}));

router.patch("/me/payment-journey/:paymentId", asyncHandler(async (req, res) => {
  const payment = await updatePaymentJourney(req.authUser!.userId, req.params.paymentId, req.body);
  if (!payment) return notFound(res, req.requestId, "payment not found");
  return res.json({ payment });
}));

router.delete("/me/payment-journey/:paymentId", asyncHandler(async (req, res) => {
  if (!(await deletePaymentJourney(req.authUser!.userId, req.params.paymentId))) {
    return notFound(res, req.requestId, "payment not found");
  }
  return res.status(204).send();
}));

router.get("/me/plans", async (req: AuthenticatedRequest, res) => {
  res.json({ plans: await listCloudPlans(req.authUser!.userId) });
});

router.post("/me/plans", asyncHandler(async (req, res) => {
  res.status(201).json({ plan: await createCloudPlan(req.authUser!.userId, req.body) });
}));

router.get("/me/plans/:planId", asyncHandler(async (req, res) => {
  const plan = await getCloudPlan(req.authUser!.userId, req.params.planId);
  if (!plan) return notFound(res, req.requestId, "plan not found");
  return res.json({ plan });
}));

router.patch("/me/plans/:planId", asyncHandler(async (req, res) => {
  const plan = await updateCloudPlan(req.authUser!.userId, req.params.planId, req.body);
  if (!plan) return notFound(res, req.requestId, "plan not found");
  return res.json({ plan });
}));

router.delete("/me/plans/:planId", asyncHandler(async (req, res) => {
  if (!(await deleteCloudPlan(req.authUser!.userId, req.params.planId))) {
    return notFound(res, req.requestId, "plan not found");
  }
  return res.status(204).send();
}));

router.post("/me/plans/:planId/items", asyncHandler(async (req, res) => {
  const item = await addCloudPlanItem(req.authUser!.userId, req.params.planId, req.body);
  if (!item) return notFound(res, req.requestId, "plan not found");
  return res.status(201).json({ item });
}));

router.post("/me/plans/:planId/optimize", asyncHandler(async (req, res) => {
  const result = await optimizeCloudPlan(req.authUser!, req.params.planId);
  if (!result) return notFound(res, req.requestId, "plan not found");
  return res.json(result);
}));

router.post("/me/plans/:planId/complete-item", asyncHandler(async (req, res) => {
  const item = await completeCloudPlanItem(req.authUser!.userId, req.params.planId, req.body);
  if (!item) return notFound(res, req.requestId, "plan item not found");
  return res.json({ item });
}));

router.get("/me/preferences", async (req: AuthenticatedRequest, res) => {
  res.json({ preferences: await getPreferences(req.authUser!.userId) });
});

router.put("/me/preferences", asyncHandler(async (req, res) => {
  res.json({ preferences: await updatePreferences(req.authUser!.userId, req.body) });
}));

router.post("/me/migration/import", asyncHandler(async (req, res) => {
  res.json(await migrateLocalData(req.authUser!.userId, req.body));
}));

export default router;

function asyncHandler(
  handler: (req: AuthenticatedRequest, res: any) => Promise<any>,
) {
  return async (req: AuthenticatedRequest, res: any) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return sendAuthError(res, error, req.requestId || "req_unknown");
    }
  };
}

function notFound(res: any, requestId: string | undefined, message: string) {
  return res.status(404).json({
    error: {
      code: "RESOURCE_NOT_FOUND",
      message,
      requestId: requestId || "req_unknown",
      retryable: false,
    },
  });
}
