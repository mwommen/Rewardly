import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  SectionHeader,
} from "../design-system/components";
import type { BestCard } from "../hooks/useRecommendations";
import { formatFee, formatRewards } from "../lib/formatters";
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
    body: "Some cards can help cover eligible new purchases if they're damaged or stolen soon after you buy.",
  },
  {
    match: /rental car|rental car insurance|rental car coverage/i,
    title: "Rental Car Insurance",
    body: "Paying with the right card may unlock rental car coverage, which can help you avoid paying extra at the counter.",
  },
  {
    match: /dining credit|restaurant/i,
    title: "Dining Credit",
    body: "Dining credits can quietly offset your bill when you use the right card at eligible restaurants or services.",
  },
  {
    match: /travel|trip|flight/i,
    title: "Travel Insurance",
    body: "The right travel card may include protections for eligible delays, cancellations, or interruptions.",
  },
  {
    match: /extended warranty|warranty/i,
    title: "Extended Warranty",
    body: "Some cards can add extra warranty time to eligible purchases when you pay with that card.",
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
  const reason =
    topPick.explainer || topPick.why?.[0] || "it is the strongest fit here";
  return `Use this card because ${reason.replace(/\.$/, "")}.`;
}

function alternativeReason(card: BestCard) {
  if (card.explainer) return card.explainer;
  if (card.why?.[0]) return card.why[0];
  return `${formatRewards(card.effectiveRate)} if your first choice is not available.`;
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

  return (
    <Card className="answer-card primary recommendation-hero" variant="hero">
      <SectionHeader
        eyebrow="Best Choice"
        action={merchant ? <Badge tone="info">{merchant}</Badge> : null}
      />

      {!submittedIntent && (
        <EmptyState title="Start with what you're buying.">
          Rewardly will recommend the best card and explain which rewards,
          credits, or protections you can use.
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
          <div className="recommendation-advice">
            <div className="recommendation-card-art">
              <LogoMark src={topCardLogo} label={topPick.card.name} />
            </div>

            <div className="recommendation-copy">
              <p className="recommendation-label">Use this card</p>
              <h2>{topPick.card.name}</h2>
              <p className="concierge-copy">
                {recommendationSentence(topPick)}
              </p>
            </div>
          </div>

          <div className="advice-grid">
            <div className="reward-callout">
              <span>Estimated rewards earned</span>
              <strong>{formatRewards(topPick.effectiveRate)}</strong>
            </div>
            <div>
              <span>Benefits unlocked</span>
              <strong>{unlockLabel}</strong>
            </div>
            <div>
              <span>Primary reason</span>
              <strong>
                {topPick.explainer ||
                  topPick.why?.[0] ||
                  "Best fit for this purchase."}
              </strong>
            </div>
          </div>

          <section className="why-rewardly">
            <p className="recommendation-label">Why Rewardly recommends this</p>
            <p>
              Rewardly looks for the card that gives you the strongest
              combination of rewards, credits, protections, and practical value
              for this purchase. For this search, {topPick.card.name} is the
              clearest choice.
            </p>
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
                  {benefit.logo && (
                    <span className="benefit-logo">
                      <LogoMark src={benefit.logo} label={benefit.label} />
                    </span>
                  )}
                  {benefit.label}
                </span>
              ))}
            </div>
          )}

          <div className="recommendation-support">
            {alternatives.length > 0 && (
              <section className="recommendation-panel">
                <p className="recommendation-label">Alternative Cards</p>
                <div className="recommendation-alternatives">
                  {alternatives.slice(0, 2).map((card) => (
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
