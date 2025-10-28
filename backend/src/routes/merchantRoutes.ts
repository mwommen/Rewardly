import express from "express";
const router = express.Router();

const CANONICAL: Record<string,{name:string;mcc?:string;aliases?:string[]}> = {
  "lululemon.com": { name: "Lululemon", mcc: "5651" }, // Family Clothing
  "starbucks.com": { name: "Starbucks", mcc: "5814" },  // Fast food/coffee
  "amazon.com":    { name: "Amazon",    mcc: "5942" },  // Books/general retail (you can tune)
  // add over time
};

function pretty(host: string) {
  const h = host.replace(/^www\./i, "").toLowerCase();
  if (CANONICAL[h]) return CANONICAL[h];
  const base = h.split(".")[0];
  // fallback: title-case domain root
  return { name: base.charAt(0).toUpperCase() + base.slice(1) };
}

router.get("/merchant/infer", (req, res) => {
  const host = String(req.query.host || "").trim();
  if (!host) return res.status(400).json({ error: "host required" });
  const out = pretty(host);
  return res.json({ host, merchantName: out.name, mcc: out.mcc || null });
});

export default router;
