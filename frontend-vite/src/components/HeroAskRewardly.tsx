import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, SearchInput } from "../design-system/components";
import type { BestCard } from "../hooks/useRecommendations";
import AdvancedInputs, { type DebugState } from "./AdvancedInputs";
import ExampleChips from "./ExampleChips";

type HeroAskRewardlyProps = {
  intent: string;
  debug: DebugState;
  debugOpen: boolean;
  topPick: BestCard | null;
  examples: string[];
  onIntentChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onExample: (example: string) => void;
  onDebugChange: (debug: DebugState) => void;
  onDebugOpenChange: (open: boolean) => void;
};

export default function HeroAskRewardly({
  intent,
  debug,
  debugOpen,
  topPick,
  examples,
  onIntentChange,
  onSubmit,
  onExample,
  onDebugChange,
  onDebugOpenChange,
}: HeroAskRewardlyProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholder =
    examples[placeholderIndex] || "Ask Rewardly what you're buying";

  useEffect(() => {
    if (!examples.length) return undefined;

    const rotation = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % examples.length);
    }, 2800);

    return () => window.clearInterval(rotation);
  }, [examples.length]);

  return (
    <>
      <div className="brand-row">
        <span className="brand-mark">R</span>
        <span>Rewardly</span>
      </div>
      <div className="hero-copy">
        <h1>Know the best card to use before you pay.</h1>
        <p>
          Search a store, purchase, or benefit. Rewardly checks your cards and
          tells you the smartest way to pay.
        </p>
      </div>

      <Card className="intent-panel" variant="default">
        <form onSubmit={onSubmit}>
          <SearchInput
            id="intent"
            label="What are you buying or trying to use?"
            value={intent}
            onChange={(event) => onIntentChange(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            action={
              <Button type="submit" variant="primary">
                Ask Rewardly
              </Button>
            }
            note="Rewardly only uses your card benefits to make recommendations. You stay in control."
          />
        </form>
        <ExampleChips examples={examples} onSelect={onExample} />
        <AdvancedInputs
          debug={debug}
          open={debugOpen}
          topPick={topPick}
          onChange={onDebugChange}
          onOpenChange={onDebugOpenChange}
        />
      </Card>
    </>
  );
}
