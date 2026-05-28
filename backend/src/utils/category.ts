export type CategoryKey =
  | "restaurants" | "groceries" | "gas" | "travel" | "airfare" | "hotels"
  | "rideshare" | "transit" | "streaming" | "drugstores" | "wholesale"
  | "homeimprovement" | "online" | "departmentstores" | "gym" | "utilities"
  | "amazon" | "walmart" | "target" | "entertainment" | "apparel" | "online_shopping" | "other";

const MCC_TO_CATEGORY: Record<string, CategoryKey> = {
  "5411": "groceries",
  "5541": "gas",
  "5812": "restaurants",
  "5814": "restaurants",
  "4111": "transit",
  "4121": "rideshare",
  "4511": "airfare",
  "7011": "hotels",
  "5912": "drugstores",
  "5942": "departmentstores",
};

const BRAND_TO_CATEGORY: Record<string, CategoryKey> = {
  "amazon": "amazon",
  "walmart": "walmart",
  "target": "target",
  "lululemon": "apparel",
  "lulu lemon": "apparel",
  "nike": "apparel",
  "adidas": "apparel",
  "saks": "departmentstores",
  "saks fifth avenue": "departmentstores",
  "costco": "wholesale",
  "sam's club": "wholesale",
  "home depot": "homeimprovement",
  "lowe's": "homeimprovement",
  "uber": "rideshare",
  "lyft": "rideshare",
  "doordash": "restaurants",
  "grubhub": "restaurants",
  "instacart": "groceries",
  "starbucks": "restaurants",
};

export function normalizeMerchant(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function inferCategories(merchant: string, mcc?: string): CategoryKey[] {
  const m = normalizeMerchant(merchant);
  const set = new Set<CategoryKey>();

  if (mcc && MCC_TO_CATEGORY[mcc]) set.add(MCC_TO_CATEGORY[mcc]);
  if (BRAND_TO_CATEGORY[m]) set.add(BRAND_TO_CATEGORY[m]);

  if (m.includes("market") || m.includes("grocery")) set.add("groceries");
  if (m.includes("gas") || m.includes("fuel")) set.add("gas");
  if (m.includes("dining") || m.includes("restaurant") || m.includes("cafe") || m.includes("pizza") || m.includes("coffee")) {
    set.add("restaurants");
  }
  if (m.includes("streaming")) set.add("streaming");
  if (m.includes("travel")) set.add("travel");
  if (m.includes("apparel") || m.includes("clothing")) set.add("apparel");
  if (m.includes("online shopping")) set.add("online_shopping");
  if (set.size === 0) set.add("other");

  return [...set];
}
