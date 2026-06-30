// backend/src/routes/plaidRoutes.ts
import express, { Request, Response } from "express";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  AccountBase,
} from "plaid";
import { getLinkedAccountsCollection } from "../db";

const router = express.Router();

// Resolve Plaid env
const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
const basePath =
  env === "production"
    ? PlaidEnvironments.production
    : env === "development"
    ? PlaidEnvironments.development
    : PlaidEnvironments.sandbox;

const client = new PlaidApi(
  new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
        "PLAID-SECRET": process.env.PLAID_SECRET || "",
        "Plaid-Version": "2020-09-14",
      },
    },
  })
);

/** Dev helper: create sandbox public_token without Link
 * NOTE: If you are also mounting a separate /api/plaid-sandbox router,
 * you can remove this helper to avoid duplicate routes.
 */
router.post("/plaid-sandbox/create-sandbox-item", async (req: Request, res: Response) => {
  try {
    const institution_id = (req.body?.institution_id as string) || "ins_109508"; // First Platypus Bank
    const products = (req.body?.products as Products[]) || [Products.Auth, Products.Transactions];

    const r = await client.sandboxPublicTokenCreate({
      institution_id,
      initial_products: products,
      options: { webhook: "https://example.com/plaid/webhook" },
    });
    res.json(r.data); // { public_token, request_id }
  } catch (err: any) {
    console.error("Sandbox create error:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to create sandbox item", details: err?.response?.data });
  }
});

// Create a Link token
router.post("/create-link-token", async (req: Request, res: Response) => {
  try {
    const userId = (req.body?.userId as string) || "devUser";
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Credit Card Optimizer",
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json(response.data);
  } catch (err: any) {
    console.error("Error creating link token:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to create link token", details: err?.response?.data });
  }
});

/** Exchange public_token -> access_token, persist in Mongo */
router.post("/exchange-public-token", async (req: Request, res: Response) => {
  const { public_token, userId = "devUser" } = req.body || {};
  if (!public_token) return res.status(400).json({ error: "Missing public_token" });

  try {
    // 1) Exchange
    const exchange = await client.itemPublicTokenExchange({ public_token });
    const access_token = exchange.data.access_token;
    const item_id = exchange.data.item_id;

    // 2) Institution (best effort)
    let institution: { id?: string; name?: string } = {};
    try {
      const itemResp = await client.itemGet({ access_token });
      const instId = itemResp.data?.item?.institution_id;
      if (instId) {
        const inst = await client.institutionsGetById({
          institution_id: instId,
          country_codes: [CountryCode.Us],
        });
        institution = { id: instId, name: inst.data.institution?.name || "" };
      }
    } catch {}

    // 3) Accounts
    const accountsResp = await client.accountsGet({ access_token });
    const accounts = (accountsResp.data.accounts || []).map((a: AccountBase) => ({
      accountId: a.account_id,
      mask: a.mask || "",
      name: a.name || "",
      official_name: a.official_name || "",
      type: a.type || "",
      subtype: a.subtype || "",
      mappedCardSlug: mapAccountToCardSlug(a),
    }));

    // 4) Upsert into Mongo
    const linkedCol = await getLinkedAccountsCollection();
    await linkedCol.updateOne(
      { userId, itemId: item_id },
      {
        $set: {
          userId,
          itemId: item_id,
          accessToken: access_token, // TODO: encrypt at rest in prod
          institution,
          accounts,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    res.json({ ok: true, linked: { userId, itemId: item_id, institution, accounts } });
  } catch (err: any) {
    console.error("Error exchanging public token:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to exchange public token", details: err?.response?.data });
  }
});

// Legacy direct fetch (optional)
router.post("/accounts", async (req: Request, res: Response) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: "Missing access_token" });

  try {
    const response = await client.accountsGet({ access_token });
    res.json(response.data);
  } catch (err: any) {
    console.error("Error fetching accounts:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to fetch accounts", details: err?.response?.data });
  }
});

// Return linked accounts from Mongo
router.get("/linked-accounts", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || "devUser";
    const linkedCol = await getLinkedAccountsCollection();
    const docs = await linkedCol.find({ userId }).toArray();
    res.json({ linked: docs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load linked accounts" });
  }
});

// Clear linked accounts for a user (dev only)
router.delete("/linked-accounts", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || "devUser";
    const linkedCol = await getLinkedAccountsCollection();
    const result = await linkedCol.deleteMany({ userId });
    res.json({ ok: true, deleted: result.deletedCount || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to clear linked accounts" });
  }
});

/** NEW: Map a specific Plaid account -> a card slug
 * POST /api/plaid/map-account { userId, accountId, mappedCardSlug }
 */
router.post("/map-account", async (req: Request, res: Response) => {
  try {
    const { userId = "devUser", accountId, mappedCardSlug } = req.body || {};
    if (!accountId) {
      return res.status(400).json({ error: "accountId is required" });
    }

    const col = await getLinkedAccountsCollection();
    const nextSlug = typeof mappedCardSlug === "string" ? mappedCardSlug.trim() : "";
    const result = await col.updateOne(
      { userId, "accounts.accountId": accountId },
      { $set: { "accounts.$.mappedCardSlug": nextSlug, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Account not found for this user" });
    }

    const docs = await col.find({ userId }).toArray();
    res.json({ ok: true, linked: docs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "map-account error" });
  }
});

router.post("/remap-accounts", async (req: Request, res: Response) => {
  try {
    const { userId = "devUser" } = req.body || {};
    const col = await getLinkedAccountsCollection();
    const docs = await col.find({ userId }).toArray();

    await Promise.all(
      docs.map(async (doc) => {
        const accounts = (doc.accounts || []).map((account) => ({
          ...account,
          mappedCardSlug: mapAccountToCardSlug(account),
        }));
        await col.updateOne(
          { _id: doc._id },
          { $set: { accounts, updatedAt: new Date() } }
        );
      })
    );

    const updatedDocs = await col.find({ userId }).toArray();
    res.json({ ok: true, linked: updatedDocs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to remap accounts" });
  }
});

const CARD_SLUG_PATTERNS: Array<{ slug: string; patterns: string[] }> = [
  { slug: "chase-sapphire-reserve", patterns: ["sapphire reserve"] },
  { slug: "chase-sapphire-preferred", patterns: ["sapphire preferred"] },
  { slug: "chase-freedom-unlimited", patterns: ["freedom unlimited"] },
  { slug: "chase-freedom-flex", patterns: ["freedom flex"] },
  { slug: "chase-ink-cash", patterns: ["ink cash", "ink business cash"] },
  { slug: "chase-ink-unlimited", patterns: ["ink unlimited", "ink business unlimited"] },
  { slug: "chase-ink-preferred", patterns: ["ink preferred", "ink business preferred"] },
  { slug: "capital-one-venture-x", patterns: ["venture x"] },
  { slug: "capital-one-venture", patterns: ["venture"] },
  { slug: "capital-one-savorone", patterns: ["savorone", "savor one", "savor"] },
  { slug: "amex-platinum", patterns: ["platinum", "amex platinum", "american express platinum"] },
  { slug: "amex-gold", patterns: ["gold", "amex gold", "american express gold"] },
  { slug: "citi-custom-cash", patterns: ["custom cash"] },
  { slug: "citi-double-cash", patterns: ["double cash"] },
  { slug: "citi-premier", patterns: ["premier"] },
  { slug: "discover-it-cash-back", patterns: ["discover it cash back"] },
  { slug: "discover-it-student", patterns: ["discover it student"] },
];

type AccountTextRecord = {
  name?: string | null;
  official_name?: string | null;
  type?: string | null;
  subtype?: string | null;
};

export function mapAccountToCardSlug(a: AccountTextRecord): string {
  const text = `${a?.official_name || ""} ${a?.name || ""}`.toLowerCase();
  const type = (a?.type || "").toLowerCase();
  const subtype = (a?.subtype || "").toLowerCase();
  const combined = `${text} ${type} ${subtype}`.replace(/[\s]+/g, " ").trim();
  const isCredit = combined.includes("credit") || combined.includes("charge") || combined.includes("card");

  if (!isCredit) return "";

  // Tokenize combined text for soft matching
  const tokens = combined.split(/[^a-z0-9]+/).filter(Boolean);

  let best: { slug: string; score: number } | null = null;

  for (const entry of CARD_SLUG_PATTERNS) {
    let score = 0;
    for (const pattern of entry.patterns) {
      const p = pattern.toLowerCase();
      if (combined.includes(p)) {
        // exact substring match is strong
        score += 100;
      } else {
        // word overlap scoring
        const pTokens = p.split(/[^a-z0-9]+/).filter(Boolean);
        let overlap = 0;
        for (const t of pTokens) {
          if (tokens.includes(t)) overlap += 1;
        }
        score += overlap * 12; // each matching word adds moderate score
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { slug: entry.slug, score };
    }
  }

  // If confident match, return it. Threshold tuned conservatively.
  if (best && best.score >= 20) return best.slug;

  // Conservative fallback: return generic-credit if it's clearly a credit account
  return "generic-credit";
}

export default router;
