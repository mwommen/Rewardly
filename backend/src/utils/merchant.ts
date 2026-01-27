// backend/src/utils/merchant.ts
export type MerchantInfo = { name: string; mcc?: string };

const CANONICAL: Record<string, { name: string; mcc?: string; aliases?: string[] }> = {
  "lululemon.com": { name: "Lululemon", mcc: "5651", aliases: ["lulu lemon", "lululemon"] },
  "starbucks.com": { name: "Starbucks", mcc: "5814", aliases: ["starbucks"] },
  "amazon.com": { name: "Amazon", mcc: "5942", aliases: ["amazon"] },
  "saksfifthavenue.com": { name: "Saks Fifth Avenue", mcc: "5944", aliases: ["saks", "saks fifth avenue"] },
  "saks.com": { name: "Saks", mcc: "5944", aliases: ["saks", "saks fifth avenue"] },
  "clearme.com": { name: "CLEAR", mcc: "7399", aliases: ["clear", "clearme"] },
};

function canonicalForHost(host: string) {
  const h = host.replace(/^www\./i, "").toLowerCase();
  const parts = h.split(".").filter(Boolean);
  if (CANONICAL[h]) return CANONICAL[h];

  for (let i = 1; i < parts.length - 1; i += 1) {
    const suffix = parts.slice(i).join(".");
    if (CANONICAL[suffix]) return CANONICAL[suffix];
  }
  return null;
}

function inferFromString(host: string) {
  const text = host.replace(/^www\./i, "").toLowerCase();
  for (const key of Object.keys(CANONICAL)) {
    const entry = CANONICAL[key];
    const aliases = entry.aliases || [];
    if (aliases.some((a) => text.includes(a.replace(/\s+/g, "")))) return entry;
  }
  return null;
}

function fallbackPretty(host: string): MerchantInfo {
  const h = host.replace(/^www\./i, "").toLowerCase();
  const base = h.split(".")[0] || "";
  return { name: base.charAt(0).toUpperCase() + base.slice(1) };
}

export function inferMerchantForHost(host: string): MerchantInfo {
  const canonical = canonicalForHost(host) || inferFromString(host);
  if (canonical) return canonical;
  return fallbackPretty(host);
}
