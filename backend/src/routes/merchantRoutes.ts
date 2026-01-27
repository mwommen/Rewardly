import express from "express";
import { inferMerchantForHost } from "../utils/merchant";
const router = express.Router();

router.get("/merchant/infer", (req, res) => {
  const host = String(req.query.host || "").trim();
  if (!host) return res.status(400).json({ error: "host required" });
  const out = inferMerchantForHost(host);
  return res.json({ host, merchantName: out.name, mcc: out.mcc || null });
});

export default router;
