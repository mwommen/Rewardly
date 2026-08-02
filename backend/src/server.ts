import "dotenv/config";
import http from "http";
import app from "./app";
import { connectDB } from "./db";
import { validateRuntimeEnvironment } from "./config/environment";
import { ensureBetaIndexes } from "./services/betaAuthService";

const runtime = validateRuntimeEnvironment();
let server: http.Server | null = null;

(async () => {
  try {
    if (runtime.sandboxMode) {
      console.log("Rewardly sandbox mode enabled; skipping external database startup.");
    } else {
      await connectDB();
      await ensureBetaIndexes();
      console.log("Connected to MongoDB successfully");
    }

    server = app.listen(runtime.port, () => {
      console.log(`Server running on http://localhost:${runtime.port}`);
    });
  } catch (err) {
    console.error("Failed to start Rewardly API:", err);
    process.exit(1);
  }
})();

function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}; shutting down Rewardly API.`);
  if (!server) {
    process.exit(0);
  }
  server.close((error) => {
    if (error) {
      console.error("Rewardly API shutdown failed:", error);
      process.exit(1);
    }
    console.log("Rewardly API stopped cleanly.");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
