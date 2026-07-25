// backend/src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { getAnalyticsCollection, getDb, connectDB } from "./db";
import cardRoutes from "./routes/cardRoutes";
import plaidRoutes from "./routes/plaidRoutes";
import plaidSandboxRoutes from "./routes/plaidSandbox";
import scrapeRoutes from "./routes/scrapeRoutes";
import recommendationRoutes from "./routes/recommendationRoutes";
import merchantRoutes from "./routes/merchantRoutes";
import qaRoutes from "./routes/qaRoutes";
import userBenefitRoutes from "./routes/userBenefitRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import decisionRoutes from "./routes/decisionRoutes";
import intelligenceRoutes from "./routes/intelligenceRoutes";
import productExperienceRoutes from "./routes/productExperienceRoutes";
import opportunityRoutes from "./routes/opportunityRoutes";
import purchaseRoutes from "./routes/purchaseRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";
import betaAuthRoutes from "./routes/betaAuthRoutes";
import { ensureBetaIndexes } from "./services/betaAuthService";

const app = express();

// ---- Config
const PORT = Number(process.env.PORT) || 5001;
const isProduction = process.env.NODE_ENV === "production";
validateEnvironment();

// ---- Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = allowedCorsOrigins();
      const localhostRegex = /^http:\/\/localhost:\d+$/;
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProduction && localhostRegex.test(origin)) ||
        (!isProduction && /^chrome-extension:\/\//.test(origin))
      ) {
        callback(null, true);
      } else {
        callback(new Error("CORS origin denied"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "256kb", type: ["application/json", "application/*+json"] }));
app.use(securityHeaders);
app.use(rateLimit);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", async () => {
    try {
      if (req.path.startsWith("/api/analytics")) return;
      const collection = await getAnalyticsCollection();
      await collection.insertOne({
        userId: isProduction
          ? null
          : String((req.body as any)?.userId || req.query?.userId || "devUser"),
        path: req.path,
        route: req.route?.path || null,
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Analytics request log failed:", err);
    }
  });
  next();
});

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
  res.json({
    ok: true,
    service: "rewardly-api",
    ts: new Date().toISOString(),
  });
});

app.get("/ready", async (_req, res) => {
  const ready = await checkDbReady();
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: "rewardly-api",
    dependencies: {
      database: ready ? "ready" : "unavailable",
    },
    ts: new Date().toISOString(),
  });
});

app.get("/", async (_req, res) => {
  const ready = await checkDbReady();
  res.json({
    ok: true,
    message: "Backend server is running!",
    dbReady: ready,
    ts: new Date().toISOString(),
  });
});

app.get("/api/health", async (_req, res) => {
  const ready = await checkDbReady();
  res.json({
    ok: true,
    service: "cco-api",
    dbReady: ready,
    ts: new Date().toISOString(),
  });
});

app.get("/api/_env", (_req, res) => {
  if (isProduction) {
    return res.status(404).json({ error: "Not found" });
  }
  const mask = (v?: string) => (v ? v.slice(0, 4) + "***" : "MISSING");
  res.json({
    PLAID_ENV: process.env.PLAID_ENV || "MISSING",
    PLAID_CLIENT_ID: mask(process.env.PLAID_CLIENT_ID),
    PLAID_SECRET: mask(process.env.PLAID_SECRET),
    MONGO_URI: process.env.MONGO_URI ? "✓ present" : "MISSING",
  });
});

// ---- Routes
app.use("/api", merchantRoutes); // /api/merchant/infer
app.use("/api/cards", cardRoutes); // /api/cards/...
app.use("/api/plaid", plaidRoutes); // /api/plaid/...
if (!isProduction || process.env.REWARDLY_ENABLE_PLAID_SANDBOX === "true") {
  app.use("/api/plaid-sandbox", plaidSandboxRoutes); // /api/plaid-sandbox/...
}
if (!isProduction) app.use("/api/scrape", scrapeRoutes); // /api/scrape/...
app.use("/api/recommendations", recommendationRoutes); // /api/recommendations/...
app.use("/api", decisionRoutes); // /api/decisions/payment
app.use("/api", productExperienceRoutes); // /api/experience/...
if (!isProduction) app.use("/api", opportunityRoutes); // /api/opportunities/...
app.use("/api", purchaseRoutes); // /api/purchase/...
app.use("/api", betaAuthRoutes); // /api/beta/... and /api/wallet/...
app.use("/api/analytics", analyticsRoutes); // /api/analytics/...
app.use("/api", feedbackRoutes); // /api/feedback/...
app.use("/api", intelligenceRoutes); // /api/intelligence/...
if (!isProduction) app.use("/api", qaRoutes); // /api/qa/...
if (!isProduction) app.use("/api", userBenefitRoutes); // /api/user-benefits/...

// ---- Start
(async () => {
  try {
    await connectDB();
    await ensureBetaIndexes();
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

function allowedCorsOrigins() {
  const configured = [
    process.env.FRONTEND_ORIGIN,
    process.env.EXTENSION_ORIGIN,
    process.env.REWARDLY_INTERNAL_ORIGIN,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (isProduction) return configured;
  return Array.from(
    new Set([...configured, "http://localhost:5173", "http://localhost:5174"]),
  );
}

function validateEnvironment() {
  if (!isProduction) return;
  const missing = ["MONGO_URI", "FRONTEND_ORIGIN", "EXTENSION_ORIGIN"].filter(
    (key) => !process.env[key],
  );
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }
  const unsafe = [
    process.env.MONGO_URI,
    process.env.FRONTEND_ORIGIN,
    process.env.EXTENSION_ORIGIN,
  ].filter((value) => /localhost|127\.0\.0\.1|devUser|manualTestUser/i.test(String(value || "")));
  if (unsafe.length) {
    throw new Error("Production environment contains unsafe development values.");
  }
  if (process.env.REWARDLY_ALLOW_DEV_OVERRIDES === "true") {
    throw new Error("Development identity overrides cannot be enabled in production.");
  }
}

function securityHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

const rateWindow = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = `${req.ip || "unknown"}:${req.path}`;
  const now = Date.now();
  const current = rateWindow.get(key);
  if (!current || current.resetAt <= now) {
    rateWindow.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  current.count += 1;
  if (current.count > 180) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }
  next();
}
