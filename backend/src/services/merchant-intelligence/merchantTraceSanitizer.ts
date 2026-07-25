const ALLOWED_TRACE_KEYS = [
  "inputSummary",
  "normalizedHostname",
  "registryCandidates",
  "aliasMatches",
  "categoryResolution",
  "channelResolution",
  "marketplaceResolution",
  "confidenceCalculation",
  "finalResolution",
  "warnings",
];

export function traceUsesAllowlistedKeys(trace: Record<string, unknown>) {
  return Object.keys(trace).every((key) => ALLOWED_TRACE_KEYS.includes(key));
}

export function traceContainsUnsafeValue(trace: unknown) {
  return /\d{12,19}|@|token=|cookie|session|order[-_ ]?id/i.test(
    JSON.stringify(trace),
  );
}
