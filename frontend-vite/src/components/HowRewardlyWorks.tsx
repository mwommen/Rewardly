const STEPS = [
  {
    label: "Step 1",
    text: "Ask Rewardly what you're buying.",
  },
  {
    label: "Step 2",
    text: "Rewardly recommends your best card.",
  },
  {
    label: "Step 3",
    text: "Earn more rewards and unlock benefits.",
  },
];

export default function HowRewardlyWorks() {
  return (
    <section className="how-it-works" aria-label="How Rewardly works">
      {STEPS.map((step, index) => (
        <div className="work-step-group" key={step.label}>
          <article className="work-step">
            <span>{step.label}</span>
            <strong>{step.text}</strong>
          </article>
          {index < STEPS.length - 1 && (
            <div className="work-arrow" aria-hidden="true">
              ↓
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
