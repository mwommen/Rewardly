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

const BENEFIT_ICONS = [
  { match: /purchase protection/i, icon: "🛡" },
  { match: /travel|trip|flight/i, icon: "✈" },
  { match: /cell phone|phone/i, icon: "📱" },
  { match: /extended warranty|warranty/i, icon: "🔄" },
  { match: /dining|restaurant/i, icon: "💳" },
  { match: /rental car|coverage|insurance/i, icon: "✓" },
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

function benefitIcon(label: string) {
  return BENEFIT_ICONS.find((item) => item.match.test(label))?.icon || "✓";
}

function whyBullets(topPick: BestCard, unlockLabel: string) {
  const bullets = [
    `${rewardPhrase(topPick.effectiveRate)} for this purchase`,
    unlockLabel && unlockLabel !== "Relevant card benefits"
      ? `Unlocks ${unlockLabel}`
      : "Strong fit for this purchase",
    topPick.matchedBenefit
      ? "Useful card benefit available"
      : topPick.why?.[0] ||
        topPick.explainer ||
        "Best card in your wallet here",
  ];

  return Array.from(new Set(bullets)).slice(0, 3);
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
  const reasons = topPick ? whyBullets(topPick, unlockLabel) : [];

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

          <section className="why-card">
            <p className="recommendation-label">Why this card?</p>
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
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
                  <span className="benefit-chip-icon" aria-hidden="true">
                    {benefitIcon(benefit.label)}
                  </span>
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
