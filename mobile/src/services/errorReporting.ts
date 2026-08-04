const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = ["authorization", "accessToken", "refreshToken", "password", "email"];

export type MobileErrorReport = {
  message: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
};

export function captureAppError(error: unknown, report: Omit<MobileErrorReport, "message"> = {}) {
  const payload: MobileErrorReport = {
    message: error instanceof Error ? error.message : "Unknown mobile error",
    componentStack: report.componentStack,
    metadata: report.metadata ? redact(report.metadata) : undefined,
  };
  if (__DEV__) {
    console.warn("[Rewardly]", "mobile-error", payload);
  }
  return payload;
}

function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redact(item)) as T;
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEYS.includes(key) ? REDACTED : redact(child);
  }
  return output as T;
}
