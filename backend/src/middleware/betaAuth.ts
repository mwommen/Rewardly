import type { Request, Response, NextFunction } from "express";
import {
  authenticateBetaToken,
  BetaAuthenticationError,
  type AuthenticatedBetaUser,
} from "../services/betaAuthService";

export type BetaRequest = Request & {
  betaUser?: AuthenticatedBetaUser;
};

export async function requireBetaUser(
  req: BetaRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    req.betaUser = await authenticateBetaToken(req.headers.authorization);
    next();
  } catch (error: any) {
    const status = error instanceof BetaAuthenticationError ? error.status : 401;
    res.status(status).json({ error: "Rewardly beta access is required." });
  }
}
