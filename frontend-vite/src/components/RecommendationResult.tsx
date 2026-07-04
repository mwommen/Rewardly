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
  unlockedBenefits: UnlockBenefit[];
  onRetry: () => void;
  onSuggestion: (suggestion: string) => void;
};

export default function RecommendationResult({
  merchant,
  submittedIntent,
  loading,
  error,
  topPick,
  unlockedBenefits,
  onRetry,
  onSuggestion,
}: RecommendationResultProps) {
  const topCardLogo = getCardLogo(topPick?.card);

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
          <div className="card-title-row">
            <div className="card-identity">
              <div className="card-logo-tile">
                <LogoMark src={topCardLogo} label={topPick.card.name} />
              </div>
              <div>
                <p className="recommendation-label">Use this card</p>
                <h2>{topPick.card.name}</h2>
                <p className="concierge-copy">
                  Rewardly recommends this card because it gives you the
                  strongest mix of rewards and usable benefits for this
                  purchase.
                </p>
              </div>
            </div>
          </div>
          <div className="advice-grid">
            <div className="reward-callout">
              <strong>{formatRewards(topPick.effectiveRate)}</strong>
            </div>
            <div>
              <span>What you unlock</span>
              <strong>
                {unlockedBenefits.find(
                  (benefit) => !/rewards/i.test(benefit.label),
                )?.label ||
                  topPick.matchedBenefit ||
                  "Relevant card benefits"}
              </strong>
            </div>
            <div>
              <span>Why it wins</span>
              <strong>
                {topPick.explainer ||
                  topPick.why?.[0] ||
                  "Best fit for this purchase."}
              </strong>
            </div>
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
