const assetPath = (path: string) => new URL(path, import.meta.url).href;

const ASSET_LOGOS: Array<{ pattern: RegExp; src: string }> = [
  { pattern: /resy/i, src: assetPath("../assets/benefit-logos/resy logo.png") },
  {
    pattern: /clear/i,
    src: assetPath("../assets/benefit-logos/clear logo.png"),
  },
  {
    pattern: /uber one/i,
    src: assetPath("../assets/benefit-logos/uber one logo.png"),
  },
  {
    pattern: /uber(?!\s*one)/i,
    src: assetPath("../assets/benefit-logos/uber logo.png"),
  },
  { pattern: /saks/i, src: assetPath("../assets/benefit-logos/saks logo.png") },
  {
    pattern: /lululemon/i,
    src: assetPath("../assets/benefit-logos/lululemon logo.png"),
  },
  {
    pattern: /walmart/i,
    src: assetPath("../assets/benefit-logos/walmart logo.png"),
  },
  {
    pattern: /capital one travel/i,
    src: assetPath("../assets/benefit-logos/capital one travel.png"),
  },
  {
    pattern: /global entry/i,
    src: assetPath("../assets/benefit-logos/global entry logo.png"),
  },
  {
    pattern: /tsa pre.?check/i,
    src: assetPath("../assets/benefit-logos/tsa precheck logo.png"),
  },
];

type BenefitLogoSpec = {
  bg: string;
  fg: string;
  text: string;
};

const BENEFIT_LOGOS: Array<{ pattern: RegExp; spec: BenefitLogoSpec }> = [
  { pattern: /resy/i, spec: { bg: "#0f172a", fg: "#ffffff", text: "RESY" } },
  { pattern: /clear/i, spec: { bg: "#0ea5e9", fg: "#ffffff", text: "CLEAR" } },
  {
    pattern: /uber(?!\s*one)/i,
    spec: { bg: "#000000", fg: "#ffffff", text: "Uber" },
  },
  {
    pattern: /uber one/i,
    spec: { bg: "#111827", fg: "#67e8f9", text: "Uber+" },
  },
  { pattern: /saks/i, spec: { bg: "#111111", fg: "#ffffff", text: "SAKS" } },
  {
    pattern: /dunkin/i,
    spec: { bg: "#f97316", fg: "#ec4899", text: "DUNKIN" },
  },
  {
    pattern: /lululemon/i,
    spec: { bg: "#dc2626", fg: "#ffffff", text: "LULU" },
  },
  { pattern: /walmart/i, spec: { bg: "#1d4ed8", fg: "#facc15", text: "WM" } },
  {
    pattern: /streaming/i,
    spec: { bg: "#7c3aed", fg: "#ffffff", text: "PLAY" },
  },
  { pattern: /travel/i, spec: { bg: "#0f766e", fg: "#ffffff", text: "TRVL" } },
];

function svgDataUri({ bg, fg, text }: BenefitLogoSpec) {
  const safeText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">` +
    `<rect width="72" height="72" rx="18" fill="${bg}"/>` +
    `<text x="36" y="41" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${fg}">${safeText}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getBenefitLogo(label?: string | null): string | null {
  const value = String(label || "").trim();
  if (!value) return null;
  const assetMatch = ASSET_LOGOS.find((item) => item.pattern.test(value));
  if (assetMatch) return assetMatch.src;
  const match = BENEFIT_LOGOS.find((item) => item.pattern.test(value));
  return match ? svgDataUri(match.spec) : null;
}
