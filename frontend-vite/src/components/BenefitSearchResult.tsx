import type { Card as WalletCard } from "../cardModules";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  SectionHeader,
} from "../design-system/components";
import { getCardLogo } from "../lib/cardLogos";
import type { Offer } from "../hooks/useRecommendations";
import type { BenefitIntentMatch } from "../lib/intent";
import LogoMark from "./LogoMark";

const SUGGESTED_BENEFITS = [
  "Purchase Protection",
  "Extended Warranty",
  "Rental Car Insurance",
  "Cell Phone Protection",
  "Airport Lounge",
  "TSA PreCheck",
  "Dining Credit",
  "Uber Credit",
];

const BENEFIT_PROFILES: Record<
  string,
  {
    icon: string;
    explanation: string;
    requirements: string;
    limitations: string;
    goodToKnow: string;
    bestFor: string;
  }
> = {
  "cell-phone-protection": {
    icon: "📱",
    explanation:
      "This can help cover an eligible phone if it is damaged or stolen.",
    requirements:
      "You usually need to pay your monthly phone bill with the card.",
    limitations:
      "Coverage usually has claim limits, deductibles, and exclusions.",
    goodToKnow:
      "The protection is easy to miss because it depends on which card pays the bill.",
    bestFor: "Keeping phone bills protected",
  },
  "rental-car-insurance": {
    icon: "🛡",
    explanation:
      "This can help cover an eligible rental car if it is damaged or stolen.",
    requirements:
      "Use the card for the rental and follow the card's rental coverage rules.",
    limitations:
      "Coverage can vary by country, vehicle type, rental length, and issuer terms.",
    goodToKnow:
      "You may need to decline the rental company's collision coverage for this to apply.",
    bestFor: "Booking rental cars",
  },
  "purchase-protection": {
    icon: "🛡",
    explanation:
      "This can help protect eligible items shortly after you buy them.",
    requirements: "Pay for the item with the card that includes the benefit.",
    limitations:
      "Claims usually have time windows, dollar caps, and category exclusions.",
    goodToKnow:
      "You only receive this protection if you pay with the eligible card.",
    bestFor: "Buying electronics, apparel, and gifts",
  },
  "extended-warranty": {
    icon: "↻",
    explanation:
      "This can add time to an eligible manufacturer's warranty after purchase.",
    requirements:
      "Use the card for the purchase and keep the receipt and original warranty.",
    limitations:
      "Warranty extensions usually exclude some items and have maximum claim amounts.",
    goodToKnow:
      "This is most useful for purchases where repairs would be expensive.",
    bestFor: "Buying electronics and appliances",
  },
  "return-protection": {
    icon: "↩",
    explanation:
      "This can help if a merchant will not accept an eligible return.",
    requirements: "Pay with the card and keep the receipt.",
    limitations:
      "Return windows, item types, and reimbursement limits vary by card.",
    goodToKnow:
      "It is a fallback, not a replacement for the merchant's return policy.",
    bestFor: "Buying items you may need to return",
  },
  "trip-delay": {
    icon: "✈",
    explanation:
      "This can help cover eligible expenses when a covered trip is delayed.",
    requirements:
      "Book the trip with the card that includes travel protections.",
    limitations:
      "Benefits usually require a minimum delay and documentation from the carrier.",
    goodToKnow:
      "Meals, lodging, and essentials may be covered when the delay qualifies.",
    bestFor: "Booking flights",
  },
  "trip-cancellation": {
    icon: "✈",
    explanation:
      "This can help reimburse eligible prepaid travel when a covered trip is canceled or interrupted.",
    requirements:
      "Book the trip with the card and keep travel documents and receipts.",
    limitations: "Only covered reasons qualify, and limits vary by card.",
    goodToKnow:
      "This matters most for expensive flights, hotels, and prepaid trips.",
    bestFor: "Booking prepaid travel",
  },
  "airport-lounge": {
    icon: "✈",
    explanation:
      "This gives you access to eligible airport lounges before a flight.",
    requirements:
      "Enrollment, a same-day boarding pass, or a lounge membership may be required.",
    limitations:
      "Guest access, lounge networks, and visit limits vary by card.",
    goodToKnow:
      "Priority Pass, Centurion Lounge, and airline lounges can have different access rules.",
    bestFor: "Airport comfort before travel",
  },
  "tsa-precheck": {
    icon: "✓",
    explanation: "This can reimburse the application fee for TSA PreCheck.",
    requirements: "Pay the application fee with the eligible card.",
    limitations: "Credits usually refresh every few years, not every year.",
    goodToKnow:
      "Some cards also cover Global Entry, which includes TSA PreCheck.",
    bestFor: "Faster airport security",
  },
  "global-entry": {
    icon: "✓",
    explanation: "This can reimburse the application fee for Global Entry.",
    requirements: "Pay the application fee with the eligible card.",
    limitations: "Credits usually refresh every few years, not every year.",
    goodToKnow:
      "Global Entry includes TSA PreCheck, so it can be the better application.",
    bestFor: "International travel",
  },
  "dining-credit": {
    icon: "💳",
    explanation: "This can offset eligible restaurant or dining purchases.",
    requirements: "Use the card tied to the dining credit when you pay.",
    limitations:
      "Credits may be monthly, annual, merchant-specific, or enrollment-based.",
    goodToKnow: "These credits are easy to lose if they expire monthly.",
    bestFor: "Restaurant spending",
  },
  "uber-credit": {
    icon: "💳",
    explanation: "This can offset eligible Uber rides or Uber Eats orders.",
    requirements:
      "Add the eligible card to Uber and use the credit before it expires.",
    limitations: "Credits often expire monthly and may not roll over.",
    goodToKnow: "Check the expiration before ordering or booking a ride.",
    bestFor: "Rideshare and delivery",
  },
  "streaming-credit": {
    icon: "💳",
    explanation: "This can offset eligible streaming or entertainment charges.",
    requirements:
      "Pay the eligible streaming service with the card that includes the credit.",
    limitations: "Only specific services may qualify.",
    goodToKnow:
      "Set the eligible card as the default payment method so the credit triggers.",
    bestFor: "Recurring subscriptions",
  },
  "baggage-insurance": {
    icon: "🛡",
    explanation:
      "This can help cover eligible baggage if it is lost, damaged, or delayed.",
    requirements: "Book the trip with the card that includes baggage coverage.",
    limitations:
      "Coverage usually has item exclusions, documentation rules, and claim limits.",
    goodToKnow:
      "Receipts and airline reports matter if you need to file a claim.",
    bestFor: "Checking bags when flying",
  },
  "travel-insurance": {
    icon: "🛡",
    explanation:
      "This groups useful travel protections like delays, cancellations, and baggage coverage.",
    requirements: "Book travel with the card that includes the protection.",
    limitations:
      "Each protection has its own trigger, limit, and documentation rules.",
    goodToKnow:
      "Travel protections usually only apply when you pay with the right card.",
    bestFor: "Booking trips with confidence",
  },
};

type BenefitSearchResultProps = {
  benefit: BenefitIntentMatch | null;
  submittedIntent: string;
  loading: boolean;
  error: string | null;
  walletCards: WalletCard[];
  offers: Offer[];
  onRetry: () => void;
  onSuggestion: (suggestion: string) => void;
};

type BenefitCardMatch = {
  card: { slug?: string; name: string };
  logoCard?: WalletCard | { slug?: string; name: string };
  coverage: string;
  requirement: string;
  bestFor: string;
};

function profileFor(benefit: BenefitIntentMatch | null) {
  if (!benefit) return BENEFIT_PROFILES["purchase-protection"];
  return (
    BENEFIT_PROFILES[benefit.key] || BENEFIT_PROFILES["purchase-protection"]
  );
}

function benefitTerms(benefit: BenefitIntentMatch | null) {
  if (!benefit) return [];
  return [benefit.label, ...benefit.aliases].map((term) => term.toLowerCase());
}

function bestMatchingText(card: WalletCard, terms: string[]) {
  const creditLabels = [
    ...(card.merchantCredits || []),
    ...(card.recurringCredits || []),
  ].map((credit) => credit.label);
  const candidates = [
    ...(card.perks || []),
    ...creditLabels,
    ...Object.keys(card.benefits || {}),
    ...Object.keys(card.rewardsByCategory || {}),
  ].filter(Boolean);

  return candidates.find((candidate) => {
    const lower = candidate.toLowerCase();
    return terms.some((term) => lower.includes(term) || term.includes(lower));
  });
}

function buildWalletMatches(
  benefit: BenefitIntentMatch | null,
  walletCards: WalletCard[],
) {
  const terms = benefitTerms(benefit);
  const profile = profileFor(benefit);

  return walletCards
    .map((card) => {
      const match = bestMatchingText(card, terms);
      if (!match) return null;

      return {
        card,
        logoCard: card,
        coverage: match,
        requirement: profile.requirements,
        bestFor: profile.bestFor,
      };
    })
    .filter(Boolean) as BenefitCardMatch[];
}

function buildOfferMatches(
  benefit: BenefitIntentMatch | null,
  offers: Offer[],
  existingSlugs: Set<string>,
) {
  const terms = benefitTerms(benefit);
  const profile = profileFor(benefit);

  return offers
    .map((offer) => {
      const coverage = (offer.perks || []).find((perk) => {
        const lower = perk.toLowerCase();
        return terms.some(
          (term) => lower.includes(term) || term.includes(lower),
        );
      });
      if (!coverage || existingSlugs.has(offer.card.slug)) return null;

      return {
        card: offer.card,
        logoCard: offer.card,
        coverage,
        requirement: profile.requirements,
        bestFor: profile.bestFor,
      };
    })
    .filter(Boolean) as BenefitCardMatch[];
}

function benefitMatches(
  benefit: BenefitIntentMatch | null,
  walletCards: WalletCard[],
  offers: Offer[],
) {
  const walletMatches = buildWalletMatches(benefit, walletCards);
  const existingSlugs = new Set(
    walletMatches.map((match) => match.card.slug || match.card.name),
  );
  return [
    ...walletMatches,
    ...buildOfferMatches(benefit, offers, existingSlugs),
  ].slice(0, 5);
}

export default function BenefitSearchResult({
  benefit,
  submittedIntent,
  loading,
  error,
  walletCards,
  offers,
  onRetry,
  onSuggestion,
}: BenefitSearchResultProps) {
  const profile = profileFor(benefit);
  const matches = benefitMatches(benefit, walletCards, offers);
  const benefitName = benefit?.label || submittedIntent || "Card benefit";

  return (
    <Card className="answer-card primary benefit-search-card" variant="hero">
      <SectionHeader
        eyebrow="Benefit Search"
        action={<Badge tone="info">{benefitName}</Badge>}
      />

      {!submittedIntent && (
        <EmptyState title="Search for a card benefit.">
          Ask about purchase protection, rental car coverage, airport lounge
          access, or another benefit in your wallet.
        </EmptyState>
      )}

      {loading && (
        <LoadingState message="Checking your wallet for cards with this benefit..." />
      )}

      {error && (
        <div className="error-state">
          <strong>Something went wrong while checking your benefits.</strong>
          <span>Try again in a moment.</span>
          <Button type="button" variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && submittedIntent && (
        <div className="benefit-search-result">
          <div className="benefit-hero-row">
            <span className="benefit-hero-icon" aria-hidden="true">
              {profile.icon}
            </span>
            <div>
              <p className="recommendation-label">You asked about</p>
              <h2>{benefitName}</h2>
              <p>{profile.explanation}</p>
            </div>
          </div>

          {matches.length ? (
            <>
              <div className="benefit-summary-strip">
                <strong>
                  {matches.length} card{matches.length === 1 ? "" : "s"} in your
                  wallet may include this.
                </strong>
                <span>{profile.goodToKnow}</span>
              </div>

              <section className="benefit-match-section">
                <p className="recommendation-label">Cards that include this</p>
                <div className="benefit-match-list">
                  {matches.map((match) => (
                    <article key={match.card.slug || match.card.name}>
                      <div className="benefit-match-heading">
                        <span className="card-logo-tile">
                          <LogoMark
                            src={getCardLogo(match.logoCard)}
                            label={match.card.name}
                          />
                        </span>
                        <div>
                          <strong>{match.card.name}</strong>
                          <p>{match.coverage}</p>
                        </div>
                      </div>
                      <div className="benefit-match-details">
                        <div>
                          <span>Requirements</span>
                          <p>{match.requirement}</p>
                        </div>
                        <div>
                          <span>Best for</span>
                          <p>{match.bestFor}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="benefit-empty-state">
              <EmptyState title="We couldn't find this benefit in your wallet yet.">
                Try a broader search, or check another protection or credit.
              </EmptyState>
              <div className="suggestion-row">
                {[
                  "purchase protection",
                  "travel insurance",
                  "extended warranty",
                  "rental car coverage",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="secondary"
                    onClick={() => onSuggestion(suggestion)}
                  >
                    Check {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <section className="benefit-plain-grid">
            <div>
              <p className="recommendation-label">Requirements</p>
              <p>{profile.requirements}</p>
            </div>
            <div>
              <p className="recommendation-label">Limitations</p>
              <p>{profile.limitations}</p>
            </div>
            <div>
              <p className="recommendation-label">Good to know</p>
              <p>{profile.goodToKnow}</p>
            </div>
          </section>

          <section className="benefit-suggestions">
            <p className="recommendation-label">Suggested next searches</p>
            <div className="example-row">
              {SUGGESTED_BENEFITS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="secondary"
                  onClick={() => onSuggestion(suggestion)}
                  aria-label={`Search ${suggestion}`}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </section>
        </div>
      )}
    </Card>
  );
}
