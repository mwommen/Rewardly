const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "authorization",
  "accessToken",
  "refreshToken",
  "token",
  "password",
  "passwordHash",
  "passwordSalt",
  "email",
  "betaSessionToken",
  "apiKey",
  "secret",
]);

export type OperationalEvent = {
  event: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export function redactForLog<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveKey(key) ? REDACTED : redactForLog(child);
  }
  return output as T;
}

export function recordOperationalEvent(event: Omit<OperationalEvent, "timestamp">) {
  const payload: OperationalEvent = {
    ...event,
    metadata: event.metadata ? redactForLog(event.metadata) : undefined,
    timestamp: new Date().toISOString(),
  };
  if (process.env.REWARDLY_STRUCTURED_LOGS === "true") {
    console.info("[Rewardly]", JSON.stringify(payload));
  }
  return payload;
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[-_]/g, "");
  return [...SENSITIVE_KEYS].some(
    (sensitive) => normalized === sensitive.toLowerCase().replace(/[-_]/g, ""),
  );
}
