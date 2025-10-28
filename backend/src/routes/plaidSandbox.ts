// backend/src/routes/plaidSandbox.ts
import express, { Request, Response } from "express";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  SandboxPublicTokenCreateRequest,
  Products,
} from "plaid";

const router = express.Router();

// Sandbox client
const client = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
        "PLAID-SECRET": process.env.PLAID_SECRET || "",
        "Plaid-Version": "2020-09-14",
      },
    },
  })
);

// POST /api/plaid-sandbox/create-sandbox-item
router.post("/create-sandbox-item", async (req: Request, res: Response) => {
  try {
    const request: SandboxPublicTokenCreateRequest = {
      institution_id: (req.body?.institution_id as string) || "ins_109508",
      initial_products:
        (req.body?.products as Products[]) || [Products.Auth, Products.Transactions],
      options: {
        webhook: (req.body?.webhook as string) || "",
      },
    };

    const { data: created } = await client.sandboxPublicTokenCreate(request);
    const public_token = created.public_token;

    // Exchange for access_token (handy for dev)
    const { data: exchanged } = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchanged;

    res.json({
      message: "Sandbox item created",
      public_token,
      access_token,
      item_id,
    });
  } catch (err: any) {
    const details = err?.response?.data || { message: err?.message };
    console.error("Error creating sandbox item:", details);
    res.status(500).json({ error: "Failed to create sandbox item", details });
  }
});

export default router;
