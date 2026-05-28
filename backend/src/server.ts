// backend/src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb, connectDB } from "./db";
import cardRoutes from "./routes/cardRoutes";
import plaidRoutes from "./routes/plaidRoutes";
import plaidSandboxRoutes from "./routes/plaidSandbox";
import scrapeRoutes from "./routes/scrapeRoutes";
import recommendationRoutes from "./routes/recommendationRoutes";
import merchantRoutes from "./routes/merchantRoutes";
import qaRoutes from "./routes/qaRoutes";
import userBenefitRoutes from "./routes/userBenefitRoutes";

const app = express();

// ---- Config
const PORT = Number(process.env.PORT) || 5001;

// ---- Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_ORIGIN || "http://localhost:5173",
        "http://localhost:5173",
        "http://localhost:5174",
      ];
      const localhostRegex = /^http:\/\/localhost:\d+$/;
      if (!origin || allowedOrigins.includes(origin) || localhostRegex.test(origin) || /^chrome-extension:\/\//.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin denied: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// ---- Health & diagnostics
let dbReady = false;
(async () => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 }).catch(() => null);
    dbReady = true;
    console.log("Connected to MongoDB");
  } catch (e) {
    dbReady = false;
    console.error("DB connection check failed:", (e as Error).message);
  }
})();

async function checkDbReady(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

app.get("/health", async (_req, res) => {
  const ready = await checkDbReady();
  res.json({ ok: true, service: "cco-api", dbReady: ready, ts: new Date().toISOString() });
});

app.get("/", async (_req, res) => {
  const ready = await checkDbReady();
  res.json({ ok: true, message: "Backend server is running!", dbReady: ready, ts: new Date().toISOString() });
});

app.get("/api/health", async (_req, res) => {
  const ready = await checkDbReady();
  res.json({ ok: true, service: "cco-api", dbReady: ready, ts: new Date().toISOString() });
});

app.get("/api/_env", (_req, res) => {
  const mask = (v?: string) => (v ? v.slice(0, 4) + "***" : "MISSING");
  res.json({
    PLAID_ENV: process.env.PLAID_ENV || "MISSING",
    PLAID_CLIENT_ID: mask(process.env.PLAID_CLIENT_ID),
    PLAID_SECRET: mask(process.env.PLAID_SECRET),
    MONGO_URI: process.env.MONGO_URI ? "✓ present" : "MISSING",
  });
});

// ---- Routes
app.use("/api", merchantRoutes);                   // /api/merchant/infer
app.use("/api/cards", cardRoutes);                 // /api/cards/...
app.use("/api/plaid", plaidRoutes);                // /api/plaid/...
app.use("/api/plaid-sandbox", plaidSandboxRoutes); // /api/plaid-sandbox/...
app.use("/api/scrape", scrapeRoutes);              // /api/scrape/...
app.use("/api/recommendations", recommendationRoutes); // /api/recommendations/...
app.use("/api", qaRoutes);                             // /api/qa/...
app.use("/api", userBenefitRoutes);                    // /api/user-benefits/...

// ---- Start
(async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB successfully");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
})();

export default app;
