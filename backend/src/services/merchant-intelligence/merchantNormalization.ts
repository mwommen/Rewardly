export function normalizeMerchantHost(value?: string | null) {
  if (!value) return "";
  try {
    const parsed = value.includes("://") ? new URL(value).hostname : value;
    return parsed
      .replace(/\.$/g, "")
      .replace(/:\d+$/g, "")
      .replace(/^(?:www|m)\./i, "")
      .toLowerCase();
  } catch {
    return value
      .replace(/\.$/g, "")
      .replace(/:\d+$/g, "")
      .replace(/^(?:www|m)\./i, "")
      .toLowerCase();
  }
}

export function normalizeMerchantText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[*_/.-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeMerchantUrl(value?: string | null) {
  try {
    const parsed = new URL(String(value || ""));
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return `${parsed.protocol}//${parsed.hostname.replace(/\.$/, "").toLowerCase()}${parsed.pathname.slice(0, 160)}`;
  } catch {
    return "";
  }
}
