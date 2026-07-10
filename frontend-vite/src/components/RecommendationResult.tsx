import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  SectionHeader,
} from "../design-system/components";
import type { BestCard } from "../hooks/useRecommendations";
import { formatFee, formatRewards, rewardChip } from "../lib/formatters";
import { getCardLogo } from "../lib/cardLogos";
import LogoMark from "./LogoMark";
import NoResultState from "./NoResultState";

type UnlockBenefit = {
  label: string;
  logo: string | null;
};

type RecommendationResultProps = {
  merchant: string;
  submittedIntent: string;
  loading: boolean;
  error: string | null;
  topPick: BestCard | null;
  alternatives: BestCard[];
  unlockedBenefits: UnlockBenefit[];
  onRetry: () => void;
  onSuggestion: (suggestion: string) => void;
};

const BENEFIT_LESSONS = [
  {
    match: /purchase protection/i,
    title: "Purchase Protection",
    body: "You only receive Purchase Protection when you pay with the eligible card.",
  },
  {
    match: /rental car|rental car insurance|rental car coverage/i,
    title: "Rental Car Insurance",
    body: "Rental coverage usually depends on paying for the booking with the card that includes it.",
  },
  {
    match: /dining credit|restaurant/i,
    title: "Dining Credit",
    body: "Dining credits only help if you use the card tied to that credit at checkout.",
  },
  {
    match: /travel|trip|flight/i,
    title: "Travel Insurance",
    body: "Travel protections usually require booking the trip with the card that provides them.",
  },
  {
    match: /extended warranty|warranty/i,
    title: "Extended Warranty",
    body: "Extended Warranty can apply only when the eligible purchase is paid for with that card.",
  },
];

function primaryUnlock(unlockedBenefits: UnlockBenefit[], topPick: BestCard) {
  return (
    unlockedBenefits.find((benefit) => !/rewards/i.test(benefit.label))
      ?.label ||
    topPick.matchedBenefit ||
    "Relevant card benefits"
  );
}

function recommendationSentence(topPick: BestCard) {
  if (topPick.matchedBenefit) {
    return "This card earns strong rewards while also unlocking a benefit you can use on this purchase.";
  }
  return "Rewardly recommends this card because it gives you the strongest overall value for this purchase.";
}

function alternativeReason(card: BestCard) {
  if (card.explainer) return card.explainer;
  if (card.why?.[0]) return card.why[0];
  return `${formatRewards(card.effectiveRate)} if your first choice is not available.`;
}

function rewardCallout(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    return "Strong rewards for this purchase";
  }
  return rewardChip(rate);
}

function rewardPhrase(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    return "strong rewards";
  }
  return rewardChip(rate).toLowerCase();
}

function specificReason(topPick: BestCard, unlockLabel: string) {
  const rewards = rewardCallout(topPick.effectiveRate).toLowerCase();
  if (unlockLabel && unlockLabel !== "Relevant card benefits") {
    return `${topPick.card.name} wins because it pairs ${rewards} with ${unlockLabel}.`;
  }
  return `${topPick.card.name} wins because it gives you ${rewards} for this purchase.`;
}

function primaryReason(topPick: BestCard, unlockLabel: string) {
  if (unlockLabel && unlockLabel !== "Relevant card benefits") {
    return `This purchase can unlock ${unlockLabel}.`;
  }
  return `This card gives you ${rewardPhrase(topPick.effectiveRate)} here.`;
}

function whyThisMatters(topPick: BestCard, unlockLabel: string) {
  if (/purchase protection/i.test(unlockLabel)) {
    return "If your item is damaged or stolen after purchase, this card may help cover it because you paid with the right card.";
  }
  if (/extended warranty|warranty/i.test(unlockLabel)) {
    return "This purchase may activate Extended Warranty when you pay with this card.";
  }
  if (/rental car|insurance|coverage/i.test(unlockLabel)) {
    return "Paying with this card helps keep the protection attached to the purchase or booking.";
  }
  if (/travel|trip|flight/i.test(unlockLabel)) {
    return "Booking with this card can help preserve travel protections if something goes wrong.";
  }
  if (/cell phone|phone/i.test(unlockLabel)) {
    return "Using the right card is what keeps cell phone protection connected to the bill.";
  }
  if (/dining|restaurant|credit/i.test(unlockLabel)) {
    return "Using this card helps you capture the credit instead of leaving card value unused.";
  }
  if (typeof topPick.effectiveRate === "number") {
    return `You get ${rewardPhrase(topPick.effectiveRate)}, so this purchase earns more value than it would on a lower-reward card.`;
  }
  return "Rewardly is pointing you to the best mix of rewards and usable benefits in your wallet.";
}

function matterIcon(topPick: BestCard, unlockLabel: string) {
  if (/protection|insurance|coverage|warranty/i.test(unlockLabel)) {
    return "🛡";
  }
  if (typeof topPick.effectiveRate === "number" && topPick.effectiveRate >= 3) {
    return "★";
  }
  return "💡";
}

function benefitLesson(
  submittedIntent: string,
  topPick: BestCard,
  unlockedBenefits: UnlockBenefit[],
) {
  const searchable = [
    submittedIntent,
    topPick.matchedBenefit || "",
    ...unlockedBenefits.map((benefit) => benefit.label),
    ...(topPick.why || []),
    topPick.explainer || "",
  ].join(" ");

  return (
    BENEFIT_LESSONS.find((lesson) => lesson.match.test(searchable)) ||
    BENEFIT_LESSONS[0]
  );
}

export default function RecommendationResult({
  merchant,
  submittedIntent,
  loading,
  error,
  topPick,
  alternatives,
  unlockedBenefits,
  onRetry,
  onSuggestion,
}: RecommendationResultProps) {
  const topCardLogo = getCardLogo(topPick?.card);
  const unlockLabel = topPick
    ? primaryUnlock(unlockedBenefits, topPick)
    : "Relevant card benefits";
  const lesson = topPick
    ? benefitLesson(submittedIntent, topPick, unlockedBenefits)
    : BENEFIT_LESSONS[0];
  const reason = topPick ? primaryReason(topPick, unlockLabel) : "";
  const matter = topPick ? whyThisMatters(topPick, unlockLabel) : "";
  const icon = topPick ? matterIcon(topPick, unlockLabel) : "💡";

  return (
    <Card className="answer-card primary recommendation-hero" variant="hero">
      <SectionHeader
        eyebrow="Best Choice"
        action={merchant ? <Badge tone="info">{merchant}</Badge> : null}
      />

      {!submittedIntent && (
        <EmptyState title="Ask Rewardly what you're buying.">
          Tell us what you're buying and we'll show you the smartest card to
          use.
        </EmptyState>
      )}

      {loading && (
        <LoadingState message="Checking your wallet for the smartest way to pay..." />
      )}

      {error && (
        <div className="error-state">
          <strong>Something went wrong while checking your wallet.</strong>
          <span>Try again in a moment.</span>
          <Button type="button" variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && submittedIntent && topPick && (
        <div className="recommendation">
          <p className="recommendation-summary">
            {recommendationSentence(topPick)}
          </p>

          <div className="recommendation-advice">
            <div className="recommendation-card-art">
              <LogoMark src={topCardLogo} label={topPick.card.name} />
            </div>

            <div className="recommendation-copy">
              <p className="recommendation-label">Best Choice</p>
              <h2>{topPick.card.name}</h2>
              <p className="concierge-copy">
                {specificReason(topPick, unlockLabel)}
              </p>
            </div>
          </div>

          <div className="advice-grid">
            <div className="reward-callout">
              <span>You'll earn</span>
              <strong>{rewardCallout(topPick.effectiveRate)}</strong>
            </div>
            <div>
              <span>You unlock</span>
              <strong>{unlockLabel}</strong>
            </div>
          </div>

          <section className="why-matters">
            <span className="why-matters-icon" aria-hidden="true">
              {icon}
            </span>
            <div>
              <p className="recommendation-label">Why this matters</p>
              <strong>{reason}</strong>
              <p>{matter}</p>
            </div>
          </section>

          {unlockedBenefits.length > 0 && (
            <div
              className="recommendation-benefits"
              aria-label="Unlocked benefits"
            >
              {unlockedBenefits.slice(0, 4).map((benefit, index) => (
                <span
                  className="recommendation-benefit-chip"
                  key={benefit.label}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {benefit.label}
                </span>
              ))}
            </div>
          )}

          <div className="recommendation-support">
            {alternatives.length > 0 && (
              <section className="recommendation-panel">
                <p className="recommendation-label">Also consider</p>
                <div className="recommendation-alternatives">
                  {alternatives.slice(0, 1).map((card) => (
                    <article key={card.card.slug}>
                      <div className="alternative-card-heading">
                        <span className="alternative-logo">
                          <LogoMark
                            src={getCardLogo(card.card)}
                            label={card.card.name}
                          />
                        </span>
                        <strong>{card.card.name}</strong>
                      </div>
                      <p>{alternativeReason(card)}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="recommendation-panel did-you-know">
              <p className="recommendation-label">Did you know?</p>
              <div>
                <strong>{lesson.title}</strong>
                <p>{lesson.body}</p>
              </div>
            </section>
          </div>

          <div className="metadata-row">
            <strong>Details</strong>
            {formatFee(topPick.annualFee) && (
              <Badge>{formatFee(topPick.annualFee)}</Badge>
            )}
            {topPick.lastVerified && (
              <Badge>
                Verified {new Date(topPick.lastVerified).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
      )}

      {!loading && !error && submittedIntent && !topPick && (
        <NoResultState onSelect={onSuggestion} />
      )}
    </Card>
  );
}
