// frontend/src/CardItem.tsx
import type { Card } from "./cardModules";
import { getCardLogo } from "./lib/cardLogos";
import { getEnrollmentLink } from "./lib/enrollmentLinks";
import "./CardList.css";

interface Props {
  card: Card;
  highlight?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  isCompared?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: () => void;
}

const CardItem = ({
  card,
  highlight = false,
  expanded = false,
  onToggle,
  isCompared = false,
  compareDisabled = false,
  onToggleCompare,
}: Props) => {
  const benefitSource = Object.keys(card.benefits || {}).length
    ? card.benefits
    : card.rewardsByCategory || {};
  const benefits = Object.entries(benefitSource || {});
  const merchantCredits = filterCredits(card.merchantCredits || []);
  const recurringCredits = filterCredits(card.recurringCredits || []);
  const filteredPerks = filterPerks(card.perks || []);
  const creditsTotal =
    sumCreditsAnnual(merchantCredits) + sumCreditsAnnual(recurringCredits);
  const annualFee = Number.isFinite(card.annualFee)
    ? `$${card.annualFee}`
    : "—";
  const apr = card.apr ? `${card.apr}` : "—";
  const creditCount = merchantCredits.length + recurringCredits.length;

  const logo = getCardLogo(card);

  return (
    <div className={`card-item ${highlight ? "highlight" : ""}`}>
      {highlight && <div className="badge">Top Pick</div>}

      <div className="card-header">
        {logo && (
          <img
            className="card-logo"
            src={logo}
            alt={`${card.name} card`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <h2 className="card-name">{card.name}</h2>
        <p className="card-type">{card.issuer || "Issuer"}</p>
        <div className="card-meta">
          <span>Annual Fee</span>
          <strong>{annualFee}</strong>
          <span>APR</span>
          <strong>{apr}</strong>
        </div>
        <button
          type="button"
          className={`compare-toggle ${isCompared ? "selected" : ""}`}
          onClick={onToggleCompare}
          disabled={compareDisabled && !isCompared}
        >
          {isCompared ? "Selected" : "Compare"}
        </button>
      </div>

      <div className="card-summary">
        <div>
          <strong>{benefits.length}</strong> reward categories
        </div>
        {card.signupOffer && (
          <div className="card-signup">
            <strong>Welcome offer</strong>
            <span>{card.signupOffer}</span>
          </div>
        )}
        <div>
          <strong>{creditCount}</strong> credits
          {creditsTotal > 0 && (
            <span className="summary-muted"> · up to ${creditsTotal}/yr</span>
          )}
        </div>
        <div>
          <strong>{filteredPerks.length}</strong> perks
        </div>
      </div>

      <button className="card-toggle" onClick={onToggle}>
        {expanded ? "Hide benefits" : "See all benefits"}
      </button>

      {expanded && (
        <>
          <div className="benefits">
            <h3>Benefits</h3>
            {benefits.length ? (
              <ul>
                {benefits.map(([category, multiplier], i) => (
                  <li key={i}>
                    <span className="category-icon">
                      {getCategoryIcon(category)}
                    </span>
                    <strong>
                      {category.charAt(0).toUpperCase() + category.slice(1)}:
                    </strong>{" "}
                    {formatRewardValue(multiplier)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-copy">No structured rewards parsed yet.</p>
            )}
          </div>

          <div className="credits">
            <div className="section-title">
              <h3>Credits</h3>
              {creditsTotal > 0 && (
                <span className="section-meta">Up to ${creditsTotal}/yr</span>
              )}
            </div>
            {merchantCredits.length || recurringCredits.length ? (
              <ul>
                {merchantCredits.map((credit) => (
                  <li key={credit.id}>
                    <strong>
                      <span className="credit-icon">
                        {getCreditIcon(credit.label)}
                      </span>
                      {credit.label}
                    </strong>
                    <span>{formatCredit(credit.amountUSD, credit.period)}</span>
                    {credit.requiresEnrollment && renderOptIn(card, credit)}
                  </li>
                ))}
                {recurringCredits.map((credit) => (
                  <li key={credit.id}>
                    <strong>
                      <span className="credit-icon">
                        {getCreditIcon(credit.label)}
                      </span>
                      {credit.label}
                    </strong>
                    <span>{formatCredit(credit.amountUSD, credit.period)}</span>
                    {credit.requiresEnrollment && renderOptIn(card, credit)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-copy">No credits parsed yet.</p>
            )}
          </div>

          <div className="perks">
            <h3>Perks</h3>
            {filteredPerks.length ? (
              <ul>
                {filteredPerks.map((perk, i) => (
                  <li key={i}>{perk}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-copy">Add perks as they are detected.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Example category icons
const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case "groceries":
      return "🛒";
    case "travel":
      return "✈️";
    case "electronics":
      return "💻";
    case "dining":
      return "🍽️";
    default:
      return "💳";
  }
};

const formatCredit = (amountUSD: number, period: string) => {
  const amount = Number.isFinite(amountUSD) ? `$${amountUSD}` : "$—";
  const per =
    period === "month"
      ? "per month"
      : period === "quarter"
        ? "per quarter"
        : period === "semi-annual"
          ? "per half-year"
          : "per year";
  return `${amount} ${per}`;
};

const getCreditIcon = (label: string) => {
  const s = (label || "").toLowerCase();
  if (s.includes("uber")) return "🚗";
  if (s.includes("saks")) return "🛍️";
  if (s.includes("lululemon") || s.includes("lulu")) return "👟";
  if (s.includes("resy") || s.includes("dining")) return "🍽️";
  if (s.includes("hotel") || s.includes("travel")) return "✈️";
  if (s.includes("airline")) return "🧳";
  if (s.includes("walmart")) return "🛒";
  if (s.includes("clear")) return "🛂";
  if (s.includes("digital") || s.includes("stream")) return "📺";
  return "💳";
};

const filterCredits = <
  T extends {
    label: string;
    amountUSD: number;
    period: string;
    confidence?: number;
  },
>(
  credits: T[],
) => {
  const seen = new Set<string>();
  return credits.filter((credit) => {
    const label = (credit.label || "").trim();
    if (!label || label.length > 160) return false;
    if (/[<>]/.test(label) || /https?:\/\//i.test(label)) return false;
    if (
      !Number.isFinite(credit.amountUSD) ||
      credit.amountUSD < 5 ||
      credit.amountUSD > 1000
    ) {
      return false;
    }
    if (credit.confidence != null && credit.confidence < 0.7) return false;
    if (!/(credit|statement|cash|reimburse|membership)/i.test(label))
      return false;
    const key = `${label}|${credit.amountUSD}|${credit.period}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatRewardValue = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 1) {
    const pct = value * 100;
    const rounded = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1);
    return `${rounded}% back`;
  }
  return `${value}x points`;
};

const sumCreditsAnnual = (
  credits: Array<{ amountUSD: number; period: string }>,
) => {
  const factor = (period: string) => {
    if (period === "month") return 12;
    if (period === "quarter") return 4;
    if (period === "semi-annual") return 2;
    return 1;
  };
  return Math.round(
    credits.reduce(
      (sum, c) =>
        sum +
        (Number.isFinite(c.amountUSD) ? c.amountUSD * factor(c.period) : 0),
      0,
    ),
  );
};

const filterPerks = (perks: string[]) => {
  const seen = new Set<string>();
  const keepers = perks
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 10 && p.length < 160)
    .filter((p) =>
      /(credit|bonus|points|cash back|dining|travel|airport|lounge|protection|insurance|hotel|transfer|dashpass|uber|saks|resy|walmart)/i.test(
        p,
      ),
    )
    .filter(
      (p) =>
        !/opens new credit card offers|reward(s)? program|credit card offers/i.test(
          p,
        ),
    )
    .filter((p) => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return keepers.slice(0, 8);
};

const renderOptIn = (
  card: { issuer?: string; sourceUrl?: string; name?: string },
  credit: { sourceUrl?: string; label?: string; partner?: string },
) => {
  const link = getEnrollmentLink({
    cardName: card.name,
    issuer: card.issuer,
    label: credit.label,
    partner: credit.partner,
    creditSourceUrl: credit.sourceUrl,
    cardSourceUrl: card.sourceUrl,
  });
  if (!link) return <em>Enrollment required</em>;
  return (
    <a className="optin-btn" href={link.url} target="_blank" rel="noreferrer">
      {link.ctaLabel}
    </a>
  );
};

export default CardItem;
