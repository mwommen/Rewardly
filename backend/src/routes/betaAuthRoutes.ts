import { Router } from "express";
import { requireBetaUser, type BetaRequest } from "../middleware/betaAuth";
import {
  activateBetaUser,
  completeBetaOnboarding,
  createExtensionConnection,
  redeemExtensionConnection,
  getBetaWallet,
  setBetaWalletCards,
  BetaValidationError,
} from "../services/betaAuthService";

const router = Router();

router.post("/beta/activate", async (req, res) => {
  try {
    const activationToken = String(req.body?.activationToken || "").trim();
    if (!activationToken) {
      return res.status(400).json({ error: "Activation code is required." });
    }

    const activated = await activateBetaUser(activationToken);
    res.json({
      ok: true,
      user: activated.user,
      sessionToken: activated.sessionToken,
    });
  } catch {
    res.status(401).json({ error: "Rewardly beta invite is invalid." });
  }
});

router.get("/beta/session", requireBetaUser, async (req: BetaRequest, res) => {
  res.json({ ok: true, user: req.betaUser });
});

router.post(
  "/beta/extension-connections",
  requireBetaUser,
  async (req: BetaRequest, res) => {
    const connection = await createExtensionConnection(req.betaUser!.userId);
    res.json({ ok: true, ...connection });
  },
);

router.post("/beta/extension-connections/redeem", async (req, res) => {
  try {
    const connectionCode = String(req.body?.connectionCode || "").trim();
    if (!connectionCode) {
      return res.status(400).json({ error: "Connection code is required." });
    }
    const redeemed = await redeemExtensionConnection(connectionCode);
    res.json({
      ok: true,
      user: redeemed.user,
      sessionToken: redeemed.sessionToken,
    });
  } catch {
    res.status(401).json({ error: "Rewardly extension connection is invalid." });
  }
});

router.get("/wallet", requireBetaUser, async (req: BetaRequest, res) => {
  const wallet = await getBetaWallet(req.betaUser!.userId);
  res.json({
    ok: true,
    wallet: {
      cardSlugs: wallet.cardSlugs,
      onboardingCompletedAt: wallet.onboardingCompletedAt || null,
      updatedAt: wallet.updatedAt,
    },
  });
});

router.put("/wallet/cards", requireBetaUser, async (req: BetaRequest, res) => {
  if (!Array.isArray(req.body?.cardSlugs)) {
    return res.status(400).json({ error: "Card list is required." });
  }
  try {
    const wallet = await setBetaWalletCards(
      req.betaUser!.userId,
      req.body.cardSlugs,
    );
    res.json({
      ok: true,
      wallet: {
        cardSlugs: wallet.cardSlugs,
        onboardingCompletedAt: wallet.onboardingCompletedAt || null,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof BetaValidationError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
});

router.post(
  "/wallet/onboarding-complete",
  requireBetaUser,
  async (req: BetaRequest, res) => {
    const wallet = await completeBetaOnboarding(req.betaUser!.userId);
    res.json({
      ok: true,
      wallet: {
        cardSlugs: wallet.cardSlugs,
        onboardingCompletedAt: wallet.onboardingCompletedAt || null,
        updatedAt: wallet.updatedAt,
      },
    });
  },
);

export default router;
