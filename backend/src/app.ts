import "dotenv/config";
import express from "express";
import cors from "cors";
import { isSandboxMode } from "./config/environment";
import { getAnalyticsCollection, getDb } from "./db";
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
import v1PaymentDecisionRoutes from "./routes/v1/paymentDecisionRoutes";
import v1PlanningRoutes from "./routes/v1/planningRoutes";
import v1FinancialIntentRoutes from "./routes/v1/financialIntentRoutes";
import v1MerchantKnowledgeRoutes from "./routes/v1/merchantKnowledgeRoutes";
import v1AuthRoutes from "./routes/v1/authRoutes";
import v1MeRoutes from "./routes/v1/meRoutes";
import v1DecisionTrustRoutes from "./routes/v1/decisionTrustRoutes";

const isProduction = process.env.NODE_ENV === "production";

const app = express();

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
app.use(
  express.json({
    limit: "256kb",
    type: ["application/json", "application/*+json"],
  }),
);
app.use(jsonErrorHandler);
app.use(securityHeaders);
app.use(rateLimit);
app.use(requestAnalytics);

app.get("/health", async (_req, res) => {
  res.json({ status: "ok" });
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
  const mask = (value?: string) =>
    value ? `${value.slice(0, 4)}***` : "MISSING";
  res.json({
    PLAID_ENV: process.env.PLAID_ENV || "MISSING",
    PLAID_CLIENT_ID: mask(process.env.PLAID_CLIENT_ID),
    PLAID_SECRET: mask(process.env.PLAID_SECRET),
    MONGO_URI: process.env.MONGO_URI ? "present" : "MISSING",
  });
});

app.use("/api", merchantRoutes);
app.use("/api/v1", v1PaymentDecisionRoutes);
app.use("/api/v1", v1PlanningRoutes);
app.use("/api/v1", v1FinancialIntentRoutes);
app.use("/api/v1", v1MerchantKnowledgeRoutes);
app.use("/api/v1", v1AuthRoutes);
app.use("/api/v1", v1MeRoutes);
app.use("/api/v1", v1DecisionTrustRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/plaid", plaidRoutes);
if (!isProduction || process.env.REWARDLY_ENABLE_PLAID_SANDBOX === "true") {
  app.use("/api/plaid-sandbox", plaidSandboxRoutes);
}
if (!isProduction) app.use("/api/scrape", scrapeRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api", decisionRoutes);
app.use("/api", productExperienceRoutes);
if (!isProduction) app.use("/api", opportunityRoutes);
app.use("/api", purchaseRoutes);
app.use("/api", betaAuthRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", intelligenceRoutes);
if (!isProduction) app.use("/api", qaRoutes);
if (!isProduction) app.use("/api", userBenefitRoutes);

app.use(notFoundHandler);
app.use(unhandledErrorHandler);

export default app;

async function checkDbReady(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

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

function securityHeaders(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
}

const rateWindow = new Map<string, { count: number; resetAt: number }>();
function rateLimit(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const key = `${req.ip || "unknown"}:${req.path}`;
  const now = Date.now();
  const current = rateWindow.get(key);
  if (!current || current.resetAt <= now) {
    rateWindow.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  current.count += 1;
  if (current.count > 180) {
    return res.status(429).json(
      req.path.startsWith("/api/v1")
        ? {
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please try again later.",
            },
          }
        : { error: "Too many requests. Please try again later." },
    );
  }
  next();
}

function requestAnalytics(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (process.env.REWARDLY_DISABLE_REQUEST_ANALYTICS === "true") {
    return next();
  }
  if (isSandboxMode()) {
    return next();
  }
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
}

function jsonErrorHandler(
  error: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!error) return next();
  const isPayloadTooLarge = error?.type === "entity.too.large";
  const isJsonSyntax = error instanceof SyntaxError && "body" in error;
  if (!isPayloadTooLarge && !isJsonSyntax) return next(error);
  const status = isPayloadTooLarge ? 413 : 400;
  const code = isPayloadTooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST";
  const message = isPayloadTooLarge
    ? "Request body exceeds the supported size."
    : "Request body must be valid JSON.";
  return res
    .status(status)
    .json(
      req.path.startsWith("/api/v1")
        ? { error: { code, message } }
        : { error: message },
    );
}

function notFoundHandler(req: express.Request, res: express.Response) {
  res
    .status(404)
    .json(
      req.path.startsWith("/api/v1")
        ? { error: { code: "NOT_FOUND", message: "Route not found." } }
        : { error: "Not found" },
    );
}

function unhandledErrorHandler(
  _error: any,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  res.status(500).json(
    req.path.startsWith("/api/v1")
      ? {
          error: {
            code: "INTERNAL_ERROR",
            message: "Rewardly could not complete the request.",
          },
        }
      : { error: "Internal server error" },
  );
}
