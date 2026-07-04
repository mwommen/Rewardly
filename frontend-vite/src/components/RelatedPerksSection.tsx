import { Card, SectionHeader } from "../design-system/components";
import type { Offer } from "../hooks/useRecommendations";
import { getBenefitLogo } from "../lib/benefitLogos";
import LogoMark from "./LogoMark";

type RelatedPerksSectionProps = {
  offers: Offer[];
  benefitIntent: boolean;
};

export default function RelatedPerksSection({
  offers,
  benefitIntent,
}: RelatedPerksSectionProps) {
  return (
    <Card className="answer-card" variant="subtle">
      <SectionHeader
        eyebrow={
          benefitIntent ? "Cards with this benefit" : "Related perks and offers"
        }
      />
      {offers.length ? (
        <div className="offer-list">
          {offers.slice(0, 4).map((offer) => (
            <article key={offer.card.slug}>
              <div className="offer-card-heading">
                <span className="benefit-logo">
                  <LogoMark
                    src={getBenefitLogo(
                      offer.perks?.[0] || offer.signupOffer || offer.card.name,
                    )}
                    label={offer.card.name}
                  />
                </span>
                <strong>{offer.card.name}</strong>
              </div>
              {offer.signupOffer && <span>{offer.signupOffer}</span>}
              {(offer.perks || []).slice(0, 2).map((perk) => (
                <p key={perk}>{perk}</p>
              ))}
              {benefitIntent && (
                <div className="benefit-detail-grid">
                  <span>What it covers</span>
                  <p>
                    {offer.perks?.[0] || "Relevant card benefit or protection."}
                  </p>
                  <span>Requirements</span>
                  <p>Use this card when you pay.</p>
                  <span>Good to know</span>
                  <p>Coverage and limits depend on issuer terms.</p>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Related card perks and offers will appear after a search.
        </p>
      )}
    </Card>
  );
}
