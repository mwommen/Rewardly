import type { Merchant, MerchantCategory } from "./domain";

export type MerchantDetectionInput = {
  hostname?: string | null;
  url?: string | null;
  title?: string | null;
  pageText?: string | null;
  mcc?: string | null;
};

type KnownMerchant = {
  name: string;
  category?: MerchantCategory;
  mcc?: string;
  aliases: string[];
};

const KNOWN_MERCHANTS: Record<string, KnownMerchant> = {
  "lululemon.com": {
    name: "Lululemon",
    category: "apparel",
    mcc: "5651",
    aliases: ["lululemon", "lulu lemon"],
  },
  "amazon.com": {
    name: "Amazon",
    category: "online_shopping",
    mcc: "5942",
    aliases: ["amazon", "amazon.com"],
  },
  "target.com": {
    name: "Target",
    category: "departmentstores",
    mcc: "5310",
    aliases: ["target", "target.com"],
  },
  "walmart.com": {
    name: "Walmart",
    category: "departmentstores",
    mcc: "5310",
    aliases: ["walmart", "wal-mart", "walmart.com"],
  },
  "costco.com": {
    name: "Costco",
    category: "groceries",
    mcc: "5300",
    aliases: ["costco", "costco wholesale", "costco.com"],
  },
  "bestbuy.com": {
    name: "Best Buy",
    category: "online_shopping",
    mcc: "5732",
    aliases: ["best buy", "bestbuy", "bestbuy.com"],
  },
  "apple.com": {
    name: "Apple",
    category: "online_shopping",
    mcc: "5732",
    aliases: ["apple store", "apple.com"],
  },
  "nike.com": {
    name: "Nike",
    category: "apparel",
    mcc: "5651",
    aliases: ["nike", "nike.com"],
  },
  "homedepot.com": {
    name: "Home Depot",
    category: "other",
    mcc: "5200",
    aliases: ["home depot", "the home depot", "homedepot"],
  },
  "lowes.com": {
    name: "Lowe's",
    category: "other",
    mcc: "5200",
    aliases: ["lowe's", "lowes", "lowe’s"],
  },
  "doordash.com": {
    name: "DoorDash",
    category: "dining",
    mcc: "5814",
    aliases: ["doordash", "door dash", "doordash.com"],
  },
  "ubereats.com": {
    name: "Uber Eats",
    category: "dining",
    mcc: "5814",
    aliases: ["uber eats", "ubereats", "ubereats.com"],
  },
  "starbucks.com": {
    name: "Starbucks",
    category: "dining",
    mcc: "5814",
    aliases: ["starbucks", "starbucks coffee"],
  },
  "delta.com": {
    name: "Delta",
    category: "travel",
    mcc: "4511",
    aliases: ["delta air lines", "delta airlines", "delta.com"],
  },
  "united.com": {
    name: "United",
    category: "travel",
    mcc: "4511",
    aliases: ["united airlines", "united.com"],
  },
  "southwest.com": {
    name: "Southwest",
    category: "travel",
    mcc: "4511",
    aliases: ["southwest airlines", "southwest.com"],
  },
  "marriott.com": {
    name: "Marriott",
    category: "travel",
    mcc: "7011",
    aliases: ["marriott", "marriott bonvoy"],
  },
  "hilton.com": {
    name: "Hilton",
    category: "travel",
    mcc: "7011",
    aliases: ["hilton", "hilton honors"],
  },
  "airbnb.com": {
    name: "Airbnb",
    category: "travel",
    mcc: "7011",
    aliases: ["airbnb", "airbnb.com"],
  },
  "expedia.com": {
    name: "Expedia",
    category: "travel",
    mcc: "4722",
    aliases: ["expedia", "expedia.com"],
  },
  "booking.com": {
    name: "Booking.com",
    category: "travel",
    mcc: "4722",
    aliases: ["booking.com", "booking com"],
  },
  "saksfifthavenue.com": {
    name: "Saks Fifth Avenue",
    category: "departmentstores",
    mcc: "5944",
    aliases: ["saks", "saks fifth avenue"],
  },
  "uber.com": {
    name: "Uber",
    category: "rideshare",
    aliases: ["uber"],
  },
};

const CANONICAL_BY_NAME = new Map(
  Object.values(KNOWN_MERCHANTS).flatMap((merchant) => [
    [merchant.name.toLowerCase(), merchant],
    ...merchant.aliases.map((alias) => [alias.toLowerCase(), merchant] as const),
  ]),
);

export function normalizeHostname(value?: string | null) {
  if (!value) return "";
  try {
    const parsed = value.includes("://") ? new URL(value).hostname : value;
    return parsed.replace(/^(?:www|m)\./i, "").toLowerCase();
  } catch {
    return value.replace(/^(?:www|m)\./i, "").toLowerCase();
  }
}

export function normalizeMerchantName(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!normalized) return "";

  return CANONICAL_BY_NAME.get(normalized)?.name || titleCase(normalized);
}

export function detectMerchant(input: MerchantDetectionInput): Merchant {
  const hostname = normalizeHostname(input.hostname || input.url);
  const text = [hostname, input.title, input.pageText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const known = findKnownMerchant(hostname, text);
  if (known) {
    return {
      name: known.name,
      hostname: hostname || null,
      domain: hostname || null,
      category: known.category || null,
      mcc: input.mcc || known.mcc || null,
      confidence: hostname ? 0.9 : 0.72,
    };
  }

  const fallbackName = hostname
    ? hostname.split(".")[0]?.replace(/[-_]+/g, " ") || "Merchant"
    : "Merchant";

  return {
    name: titleCase(fallbackName),
    hostname: hostname || null,
    domain: hostname || null,
    category: null,
    mcc: input.mcc || null,
    confidence: hostname ? 0.45 : 0.2,
  };
}

function findKnownMerchant(hostname: string, text: string) {
  if (hostname) {
    const direct = KNOWN_MERCHANTS[hostname];
    if (direct) return direct;

    const parts = hostname.split(".");
    for (let index = 1; index < parts.length - 1; index += 1) {
      const suffix = parts.slice(index).join(".");
      if (KNOWN_MERCHANTS[suffix]) return KNOWN_MERCHANTS[suffix];
    }
  }

  return Object.values(KNOWN_MERCHANTS).find((merchant) =>
    merchant.aliases.some((alias) => text.includes(alias)),
  );
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
