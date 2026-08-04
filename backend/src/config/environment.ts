export type RuntimeEnvironment = {
  nodeEnv: string;
  port: number;
  isProduction: boolean;
  sandboxMode: boolean;
  requiredProductionVariables: string[];
};

const REQUIRED_PRODUCTION_VARIABLES = [
  "MONGO_URI",
  "FRONTEND_ORIGIN",
  "EXTENSION_ORIGIN",
];

export function runtimeEnvironment(env = process.env): RuntimeEnvironment {
  const nodeEnv = String(env.NODE_ENV || "development");
  const port = Number(env.PORT) || 5001;
  const sandboxMode = env.REWARDLY_SANDBOX_MODE === "true";

  return {
    nodeEnv,
    port,
    isProduction: nodeEnv === "production",
    sandboxMode,
    requiredProductionVariables: REQUIRED_PRODUCTION_VARIABLES,
  };
}

export function isSandboxMode(env = process.env) {
  return runtimeEnvironment(env).sandboxMode;
}

export function validateRuntimeEnvironment(env = process.env) {
  const runtime = runtimeEnvironment(env);
  const errors: string[] = [];

  if (!Number.isFinite(runtime.port) || runtime.port <= 0 || runtime.port > 65_535) {
    errors.push("PORT must be a valid TCP port number");
  }

  if (runtime.isProduction && !runtime.sandboxMode) {
    const missing = runtime.requiredProductionVariables.filter((key) => !env[key]);
    if (missing.length) {
      errors.push(
        `Missing required production environment variables: ${missing.join(", ")}`,
      );
    }

    const unsafe = runtime.requiredProductionVariables.filter((key) =>
      /localhost|127\.0\.0\.1|devUser|manualTestUser/i.test(String(env[key] || "")),
    );
    if (unsafe.length) {
      errors.push(
        `Production environment contains unsafe development values: ${unsafe.join(", ")}`,
      );
    }

    if (env.REWARDLY_ALLOW_DEV_OVERRIDES === "true") {
      errors.push("REWARDLY_ALLOW_DEV_OVERRIDES cannot be true in production");
    }
  }

  if (errors.length) {
    throw new Error(`Rewardly environment validation failed: ${errors.join("; ")}`);
  }

  return runtime;
}
