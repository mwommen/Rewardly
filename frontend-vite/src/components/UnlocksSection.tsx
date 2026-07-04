import { Card, SectionHeader } from "../design-system/components";
import LogoMark from "./LogoMark";

type UnlockBenefit = {
  label: string;
  logo: string | null;
};

type UnlocksSectionProps = {
  unlockedBenefits: UnlockBenefit[];
};

export default function UnlocksSection({
  unlockedBenefits,
}: UnlocksSectionProps) {
  return (
    <Card className="answer-card unlock-card" variant="subtle">
      <SectionHeader eyebrow="What you unlock" />
      {unlockedBenefits.length ? (
        <ul className="benefit-list">
          {unlockedBenefits.map((benefit) => (
            <li key={benefit.label}>
              <span className="benefit-logo">
                <LogoMark src={benefit.logo} label={benefit.label} />
              </span>
              <span>{benefit.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Rewardly didn't find a specific benefit yet, but this card still looks
          like the strongest option based on available rewards.
        </p>
      )}
    </Card>
  );
}
