import { Button, EmptyState } from "../design-system/components";

const NO_RESULT_SUGGESTIONS = [
  "groceries",
  "rental car insurance",
  "Best Buy",
  "cell phone protection",
];

type NoResultStateProps = {
  onSelect: (suggestion: string) => void;
};

export default function NoResultState({ onSelect }: NoResultStateProps) {
  return (
    <EmptyState
      title="We don't have a confident match yet."
      action={
        <div className="suggestion-row" aria-label="No result suggestions">
          {NO_RESULT_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="secondary"
              onClick={() => onSelect(suggestion)}
              aria-label={`Try ${suggestion}`}
            >
              Try "{suggestion}"
            </Button>
          ))}
        </div>
      }
    >
      Try a specific merchant, category, or benefit like Lululemon, groceries,
      or cell phone protection.
    </EmptyState>
  );
}
